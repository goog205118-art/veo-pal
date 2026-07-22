// Image generation submit flow.
// Loaded as a classic script so inline onclick handlers keep resolving window.submitImgGen.

async function submitImgGen(taskId) {
    clearImgGenPromptDraftTimer(taskId);
    const shadowTask = getTaskShadow(taskId);
    const task = (shadowTask && shadowTask.type === 'tool_image_gen')
        ? (cloneTaskDeep(shadowTask) || { ...shadowTask })
        : await getTaskDB(taskId);
    if (!task) return;
    ensureImgGenState(task);
    if (!task.state.prompt) return showToast("请输入生图提示词", "error");
    const now = Date.now();
    const nextSubmitAt = toFiniteNumber(task.state.nextSubmitAt, 0);
    if (now < nextSubmitAt) {
        const waitSec = Math.max(1, Math.ceil((nextSubmitAt - now) / 1000));
        showToast(`请等待 ${waitSec}s 后再生成`, "warning");
        renderCard(taskId, task);
        return;
    }
    if (task.state.previewCollapsed) task.state.previewCollapsed = false;
    try {
        await captureImgMaskFromEditor(taskId, task, { clearIfEmpty: true });
    } catch (err) {}

    task.state.nextSubmitAt = now + window.VeoImageConfig.clickCooldownMs;
    task.retryCount = 0;
    task.isBilled = false;
    task.state.startTime = now;
    task.state.previewCollapsed = false;
    const previewItemId = pushImgGenPendingItem(task);
    task.timestamp = now;
    setTaskShadow(task);
    await renderCard(taskId, task);
    forceRenderImgGenPreviewPanel(task, previewItemId);
    await waitNextPaint();
    await saveTaskDB(task).catch((err) => {
        console.warn('[submitImgGen] pending save failed, continue request:', err);
    });

    setTimeout(async () => {
        try {
            const fresh = await getTaskDB(taskId);
            const live = getTaskShadow(taskId);
            const next = fresh ? mergeImgGenTaskWithShadow(fresh, live, { protectedIds: getImgGenProtectedPreviewIds(taskId) }) : live;
            if (!next) return;
            setTaskShadow(next);
            await renderCard(taskId, next);
            forceRenderImgGenPreviewPanel(next, previewItemId);
        } catch (err) {}
    }, window.VeoImageConfig.clickCooldownMs + 40);

    let resolvedSize = resolveImgGenSize(task.state);
    const promptContext = window.VeoImageRequest.resolvePromptContext(task);

    if (resolvedSize !== 'auto') {
        const strict = enforceProSizeRules(resolvedSize);
        if (!strict.isValid) {
            markImgGenPreviewFailed(task, previewItemId, 'Pro 尺寸不符合规则');
            await saveTaskDB(task);
            renderCard(taskId, task);
            forceRenderImgGenPreviewPanel(task, previewItemId);
            return showToast('Pro 尺寸不符合规则，请调整比例后重试', 'error');
        }
        if (strict.changed) {
            resolvedSize = strict.size;
            showToast(`Pro 尺寸已按规则校正为 ${strict.size}`, 'info');
        }
    }
    task.state.size = resolvedSize;
    const sizeToSend = resolvedSize;
    const route = normalizeImgGenRoute(task.state.providerSort);
    const version = route.version === 'pro' ? 'pro' : 'trial';
    enforceImgGenRouteReferenceLimit(task);
    const maxImageCount = getImgGenMaxReferenceCount(task);
    const imagesForSubmit = limitImgGenReferencesForRoute(task, task.state.images);
    task.state.images = imagesForSubmit;
    normalizeImgGenRefControls(task);
    const mode = resolveImgGenMode(task.state);
    const imageModel = getImgGenModelForRoute(route);
    const imageEncodeOptions = resolveImgGenNetworkEncodeOptions(route.key, 'image');
    const maskEncodeOptions = resolveImgGenNetworkEncodeOptions(route.key, 'mask');
    const imagesBase64 = await blobsToBase64Sequential(imagesForSubmit, imageEncodeOptions);
    const maskSource = task.state.maskBlob || task.state.maskImage || null;
    const maskBase64 = maskSource ? await blobToBase64(maskSource, maskEncodeOptions) : null;
    const imagePayloadFields = buildImgGenImagePayloadFields(imagesBase64, maskBase64, maxImageCount);
    const encodedImageBytes = window.VeoImageRequest.measureEncodedPayloadBytes(imagesBase64, maskBase64);
    if (route.version === 'trial' && encodedImageBytes > 10 * 1024 * 1024) {
        markImgGenPreviewFailed(task, previewItemId, 'Stable image request is still too large. Reduce references or crop/compress first.');
        await saveTaskDB(task);
        renderCard(taskId, task);
        forceRenderImgGenPreviewPanel(task, previewItemId);
        return showToast('Stable 通道垫图体积过大，请减少参考图或先裁切压缩', 'error');
    }
    const referenceControls = buildImgGenRefControlPayload(task);
    const clientRequestId = `${task.id}_${previewItemId}`;
    const unifiedPayload = window.VeoImageRequest.buildUnifiedPayload({
        task,
        version,
        route,
        mode,
        imageModel,
        sizeToSend,
        previewItemId,
        clientRequestId,
        promptContext,
        referenceControls,
        imagePayloadFields
    });

    let success = false;
    let attempts = 0;
    const maxAttempts = 1;
    let lastError = null;

    while (attempts < maxAttempts && !success) {
        attempts++;
        try {
            const resultPack = await window.VeoImageRequest.submitUnifiedOnce(unifiedPayload);
            const resData = resultPack.resData;
            const returnedUrls = resultPack.returnedUrls;

            if (!(await isImgGenPreviewItemStillPending(taskId, previewItemId))) {
                clearImgGenPolling(taskId, previewItemId);
                return;
            }

            if (returnedUrls.length > 0) {
                let output = returnedUrls[0];
                try {
                    const r = await fetch(output);
                    if (r.ok) output = await r.blob();
                } catch (fetchErr) {}
                const costTime = Math.floor((Date.now() - task.state.startTime) / 1000);
                const imageMeta = await readImageMeta(output);
                if (!(await isImgGenPreviewItemStillPending(taskId, previewItemId))) {
                    clearImgGenPolling(taskId, previewItemId);
                    return;
                }
                const writeTask = await getImgGenTaskForPreviewWrite(taskId, previewItemId, task);
                if (!writeTask) {
                    clearImgGenPolling(taskId, previewItemId);
                    return;
                }
                if (!markImgGenPreviewSuccess(writeTask, previewItemId, output, costTime, imageMeta)) {
                    clearImgGenPolling(taskId, previewItemId);
                    return;
                }
                writeTask.state.costTime = costTime;
                writeTask.timestamp = Date.now();
                if (!getImgGenPendingCount(writeTask)) writeTask.genTaskId = null;
                const billingInfo = calculateImgGenBilling(writeTask, resultPack.rawData);
                writeTask.state.lastUsageCost = billingInfo.cost;
                writeTask.state.lastUsageDetail = billingInfo.detail;
                writeTask.state.lastUsageAt = Date.now();
                success = true;
                forceRenderImgGenPreviewPanel(writeTask, previewItemId);

                await addBillingRecord({
                    id: 'bill_img_' + writeTask.id + '_' + Date.now(),
                    taskId: writeTask.id,
                    type: 'image',
                    cost: billingInfo.cost,
                    detail: billingInfo.detail,
                    inputTokens: billingInfo.usage ? billingInfo.usage.inputTokens : 0,
                    outputTokens: billingInfo.usage ? billingInfo.usage.outputTokens : 0,
                    version
                });
                updateBillingUI();
                if (window.VeoBilling && typeof window.VeoBilling.refreshBalanceAfterUsage === 'function') {
                    window.VeoBilling.refreshBalanceAfterUsage();
                }
                setTaskShadow(writeTask);
                await saveTaskDB(writeTask);
                renderCard(taskId, writeTask);
                forceRenderImgGenPreviewPanel(writeTask, previewItemId);
            } else {
                const asyncTaskId = extractImgGenTaskId(resData);
                const status = extractImgGenStatus(resData);
                if (asyncTaskId) {
                    if (!(await isImgGenPreviewItemStillPending(taskId, previewItemId))) {
                        clearImgGenPolling(taskId, previewItemId);
                        return;
                    }
                    const writeTask = await getImgGenTaskForPreviewWrite(taskId, previewItemId, task);
                    if (!writeTask) {
                        clearImgGenPolling(taskId, previewItemId);
                        return;
                    }
                    const item = writeTask.state.previewHistory.find((entry) => entry && entry.id === previewItemId);
                    if (item) item.remoteTaskId = asyncTaskId;
                    updateImgGenPreviewGuard(taskId, previewItemId, { remoteTaskId: asyncTaskId });
                    writeTask.genTaskId = asyncTaskId;
                    writeTask.timestamp = Date.now();
                    setTaskShadow(writeTask);
                    await saveTaskDB(writeTask);
                    renderCard(taskId, writeTask);
                    forceRenderImgGenPreviewPanel(writeTask, previewItemId);
                    startImgGenTaskPolling(taskId, asyncTaskId, previewItemId);
                    return;
                }
                if (isImgGenPendingStatus(status) || !status) {
                    if (!(await isImgGenPreviewItemStillPending(taskId, previewItemId))) {
                        clearImgGenPolling(taskId, previewItemId);
                        return;
                    }
                    if (!asyncTaskId) {
                        const writeTask = await getImgGenTaskForPreviewWrite(taskId, previewItemId, task);
                        if (!writeTask) {
                            clearImgGenPolling(taskId, previewItemId);
                            return;
                        }
                        markImgGenPreviewFailed(writeTask, previewItemId, '后端未返回图片或真实任务ID');
                        writeTask.genTaskId = null;
                        writeTask.timestamp = Date.now();
                        setTaskShadow(writeTask);
                        await saveTaskDB(writeTask);
                        renderCard(taskId, writeTask);
                        forceRenderImgGenPreviewPanel(writeTask, previewItemId);
                        showToast('后端未返回图片或真实任务ID，请检查 n8n Respond 输出', 'warning');
                        return;
                    }
                    const fallbackTaskId = asyncTaskId;
                    const writeTask = await getImgGenTaskForPreviewWrite(taskId, previewItemId, task);
                    if (!writeTask) {
                        clearImgGenPolling(taskId, previewItemId);
                        return;
                    }
                    const item = writeTask.state.previewHistory.find((entry) => entry && entry.id === previewItemId);
                    if (item) {
                        item.remoteTaskId = fallbackTaskId;
                        item.errorReason = '';
                    }
                    updateImgGenPreviewGuard(taskId, previewItemId, { remoteTaskId: fallbackTaskId, errorReason: '' });
                    writeTask.genTaskId = fallbackTaskId;
                    writeTask.timestamp = Date.now();
                    setTaskShadow(writeTask);
                    await saveTaskDB(writeTask);
                    renderCard(taskId, writeTask);
                    forceRenderImgGenPreviewPanel(writeTask, previewItemId);
                    startImgGenTaskPolling(taskId, fallbackTaskId, previewItemId);
                    if (resultPack.rawData && resultPack.rawData.empty_response) {
                        showToast('后端已接收请求，但未返回任务ID，已启动兜底轮询', 'warning');
                    }
                    return;
                }
                if (isImgGenFailedStatus(status)) {
                    throw new Error(`后端返回失败状态: ${status}`);
                }
                throw new Error("无返回有效图片结构");
            }
        } catch (err) {
            lastError = err;
            if (attempts >= maxAttempts) {
                if (!(await isImgGenPreviewItemStillPending(taskId, previewItemId))) {
                    clearImgGenPolling(taskId, previewItemId);
                    return;
                }
                const writeTask = await getImgGenTaskForPreviewWrite(taskId, previewItemId, task);
                if (!writeTask) {
                    clearImgGenPolling(taskId, previewItemId);
                    return;
                }
                markImgGenPreviewFailed(writeTask, previewItemId, err);
                writeTask.timestamp = Date.now();
                setTaskShadow(writeTask);
                await saveTaskDB(writeTask);
                renderCard(taskId, writeTask);
                forceRenderImgGenPreviewPanel(writeTask, previewItemId);
            } else {
                if (!(await isImgGenPreviewItemStillPending(taskId, previewItemId))) {
                    clearImgGenPolling(taskId, previewItemId);
                    return;
                }
                const writeTask = await getImgGenTaskForPreviewWrite(taskId, previewItemId, task);
                if (!writeTask) {
                    clearImgGenPolling(taskId, previewItemId);
                    return;
                }
                writeTask.retryCount = attempts;
                writeTask.timestamp = Date.now();
                setTaskShadow(writeTask);
                await saveTaskDB(writeTask);
                renderCard(taskId, writeTask);
                forceRenderImgGenPreviewPanel(writeTask, previewItemId);
                await new Promise(r => setTimeout(r, 2000));
            }
        }
    }

    const finalTask = await getImgGenTaskForPreviewWrite(taskId, previewItemId, task);
    if (finalTask) {
        setTaskShadow(finalTask);
        await saveTaskDB(finalTask);
        renderCard(taskId, finalTask);
        forceRenderImgGenPreviewPanel(finalTask, previewItemId);
    }
    if (!success) {
        clearImgGenPolling(taskId, previewItemId);
        showToast("生图请求失败，请检查 webhook、密钥或网络", "error");
        if (lastError) console.warn('[submitImgGen] failed:', lastError);
    }
}

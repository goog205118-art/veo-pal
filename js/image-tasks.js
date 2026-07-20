(function () {
    const pollControllers = new Map();
    const pollTimers = new Map();

    function buildPollKey(taskId, previewItemId = '') {
        return `${taskId}::${previewItemId || 'default'}`;
    }

    function clearPolling(taskId, previewItemId = null) {
        const keys = [];
        if (previewItemId) keys.push(buildPollKey(taskId, previewItemId));
        else {
            pollControllers.forEach((_, key) => {
                if (String(key).startsWith(`${taskId}::`)) keys.push(key);
            });
            pollTimers.forEach((_, key) => {
                if (String(key).startsWith(`${taskId}::`) && !keys.includes(key)) keys.push(key);
            });
            if (keys.length === 0) keys.push(buildPollKey(taskId, 'default'));
        }

        keys.forEach((pollKey) => {
            const controller = pollControllers.get(pollKey);
            if (controller) {
                try { controller.abort(); } catch (err) {}
                pollControllers.delete(pollKey);
            }
            const timerId = pollTimers.get(pollKey);
            if (timerId) {
                clearTimeout(timerId);
                pollTimers.delete(pollKey);
            }
        });
    }

    function hasPolling(taskId, previewItemId = null) {
        if (previewItemId) {
            const pollKey = buildPollKey(taskId, previewItemId);
            return pollControllers.has(pollKey) || pollTimers.has(pollKey);
        }
        const prefix = `${taskId}::`;
        for (const key of pollControllers.keys()) {
            if (String(key).startsWith(prefix)) return true;
        }
        for (const key of pollTimers.keys()) {
            if (String(key).startsWith(prefix)) return true;
        }
        return false;
    }

    function startPolling(taskId, remoteTaskId, previewItemId = '') {
        const itemId = previewItemId || remoteTaskId || createImgGenPreviewId();
        const pollKey = buildPollKey(taskId, itemId);
        clearPolling(taskId, itemId);
        let attempts = 0;
        let errorCount = 0;
        const maxAttempts = 180;
        const maxErrors = 24;

        const scheduleNext = (delayMs = 3500) => {
            const timer = setTimeout(() => {
                poll().catch(() => {});
            }, Math.max(1000, toFiniteNumber(delayMs, 3500)));
            pollTimers.set(pollKey, timer);
        };

        const poll = async () => {
            pollTimers.delete(pollKey);
            attempts++;

            const task = mergeImgGenTaskWithShadow(await getTaskDB(taskId), getTaskShadow(taskId), { protectedIds: getImgGenProtectedPreviewIds(taskId) });
            if (!task) { clearPolling(taskId, itemId); return; }
            ensureImgGenState(task);
            normalizeImgGenPreviewHistory(task);

            const targetItem = task.state.previewHistory.find((entry) => entry && entry.id === itemId);
            if (!targetItem || targetItem.status !== 'pending') {
                clearPolling(taskId, itemId);
                return;
            }

            const remoteId = String(remoteTaskId || targetItem.remoteTaskId || '').trim();
            if (!remoteId) {
                const writeTask = await getImgGenTaskForPreviewWrite(taskId, itemId, task);
                if (!writeTask) { clearPolling(taskId, itemId); return; }
                markImgGenPreviewFailed(writeTask, itemId, '轮询缺少任务 ID');
                writeTask.timestamp = Date.now();
                clearPolling(taskId, itemId);
                setTaskShadow(writeTask);
                await saveTaskDB(writeTask);
                renderCard(taskId, writeTask);
                forceRenderImgGenPreviewPanel(writeTask, itemId);
                showToast('轮询缺少任务ID，已终止', 'error');
                return;
            }

            const pollPayload = buildImgGenPollPayload(task, remoteId);
            const attemptsList = [];
            const pollEndpoint = resolveImgGenPollEndpoint();

            if (isLocalImgGenFallbackTaskId(remoteId, taskId)) {
                const writeTask = await getImgGenTaskForPreviewWrite(taskId, itemId, task);
                if (!writeTask) { clearPolling(taskId, itemId); return; }
                markImgGenPreviewFailed(writeTask, itemId, '后端未返回真实图片任务 ID，已停止无效轮询');
                writeTask.timestamp = Date.now();
                clearPolling(taskId, itemId);
                setTaskShadow(writeTask);
                await saveTaskDB(writeTask);
                renderCard(taskId, writeTask);
                forceRenderImgGenPreviewPanel(writeTask, itemId);
                showToast('后端未返回真实任务ID，已停止轮询避免刷屏', 'warning');
                return;
            }

            if (!pollEndpoint.url) {
                const reason = pollEndpoint.reason === 'points_to_generation'
                    ? '图片轮询接口误指向生图生成入口，已停止轮询，避免 n8n 空 prompt 刷屏'
                    : '未配置可用图片轮询接口，已停止轮询；默认 unified 入口需支持 action=poll，或单独配置 VEO_IMAGE_POLL_WEBHOOK';
                const writeTask = await getImgGenTaskForPreviewWrite(taskId, itemId, task);
                if (!writeTask) { clearPolling(taskId, itemId); return; }
                markImgGenPreviewFailed(writeTask, itemId, reason);
                writeTask.genTaskId = null;
                writeTask.timestamp = Date.now();
                clearPolling(taskId, itemId);
                setTaskShadow(writeTask);
                await saveTaskDB(writeTask);
                renderCard(taskId, writeTask);
                forceRenderImgGenPreviewPanel(writeTask, itemId);
                console.warn('[img-poll] stopped invalid image polling:', {
                    reason: pollEndpoint.reason,
                    imagePollWebhook: window.VeoApi.config.imagePoll || '',
                    imageGenWebhook: window.VeoApi.config.imageUnified,
                    remoteId
                });
                showToast('图片轮询已熔断：请检查 VEO_IMAGE_POLL_WEBHOOK，不要填旧版生成入口', 'warning');
                return;
            }
            attemptsList.push({ url: pollEndpoint.url, body: pollPayload.unified });

            let rawData = null;
            let lastHttpError = null;
            for (const target of attemptsList) {
                if (!target || !target.url) continue;
                try {
                    const controller = new AbortController();
                    pollControllers.set(pollKey, controller);
                    const response = await window.VeoApi.imagePoll(target.url, target.body, { signal: controller.signal });
                    pollControllers.delete(pollKey);
                    if (response.status === 401 || response.status === 403) {
                        clearPolling(taskId, itemId);
                        handleAuthError();
                        return;
                    }
                    if (!response.ok) {
                        lastHttpError = new Error(`poll http ${response.status}`);
                        continue;
                    }
                    rawData = await parseImgGenHttpResponse(response, 'processing');
                    if (rawData !== null && rawData !== undefined) break;
                } catch (err) {
                    if (err && err.name === 'AbortError') return;
                    lastHttpError = err;
                } finally {
                    pollControllers.delete(pollKey);
                }
            }

            if (rawData === null || rawData === undefined) {
                errorCount++;
                if (errorCount >= maxErrors || attempts >= maxAttempts) {
                    const writeTask = await getImgGenTaskForPreviewWrite(taskId, itemId, task);
                    if (!writeTask) { clearPolling(taskId, itemId); return; }
                    markImgGenPreviewFailed(writeTask, itemId, lastHttpError || '轮询无有效响应');
                    writeTask.timestamp = Date.now();
                    clearPolling(taskId, itemId);
                    setTaskShadow(writeTask);
                    await saveTaskDB(writeTask);
                    renderCard(taskId, writeTask);
                    forceRenderImgGenPreviewPanel(writeTask, itemId);
                    showToast('生图轮询超时，请稍后重试', 'error');
                    if (lastHttpError) console.warn('[img-poll] no valid response:', lastHttpError);
                    return;
                }
                scheduleNext(3500);
                return;
            }

            const returnedUrls = extractImageUrlsFromResponse(rawData);
            if (Array.isArray(returnedUrls) && returnedUrls.length > 0) {
                let output = returnedUrls[0];
                try {
                    const r = await fetch(output);
                    if (r.ok) output = await r.blob();
                } catch (fetchErr) {}

                const writeTask = await getImgGenTaskForPreviewWrite(taskId, itemId, task);
                if (!writeTask) { clearPolling(taskId, itemId); return; }
                const writeItem = writeTask.state.previewHistory.find((entry) => entry && entry.id === itemId) || targetItem;
                const costTime = Math.floor((Date.now() - (writeItem.createdAt || targetItem.createdAt || Date.now())) / 1000);
                const imageMeta = await readImageMeta(output);
                markImgGenPreviewSuccess(writeTask, itemId, output, costTime, imageMeta);
                writeTask.state.costTime = costTime;
                writeTask.timestamp = Date.now();
                if (!getImgGenPendingCount(writeTask)) writeTask.genTaskId = null;
                const billingInfo = calculateImgGenBilling(writeTask, rawData);
                writeTask.state.lastUsageCost = billingInfo.cost;
                writeTask.state.lastUsageDetail = billingInfo.detail;
                writeTask.state.lastUsageAt = Date.now();
                clearPolling(taskId, itemId);
                await addBillingRecord({
                    id: 'bill_img_' + writeTask.id + '_' + Date.now(),
                    taskId: writeTask.id,
                    type: 'image',
                    cost: billingInfo.cost,
                    detail: billingInfo.detail,
                    inputTokens: billingInfo.usage ? billingInfo.usage.inputTokens : 0,
                    outputTokens: billingInfo.usage ? billingInfo.usage.outputTokens : 0,
                    version: 'pro'
                });
                updateBillingUI();
                setTaskShadow(writeTask);
                await saveTaskDB(writeTask);
                renderCard(taskId, writeTask);
                forceRenderImgGenPreviewPanel(writeTask, itemId);
                return;
            }

            const status = extractImgGenStatus(rawData);
            if (isImgGenSuccessStatus(status)) {
                scheduleNext(resolveImgGenPollDelayMs(rawData, 1800));
                return;
            }
            if (isImgGenFailedStatus(status)) {
                const writeTask = await getImgGenTaskForPreviewWrite(taskId, itemId, task);
                if (!writeTask) { clearPolling(taskId, itemId); return; }
                markImgGenPreviewFailed(writeTask, itemId, `后端返回失败状态: ${status}`);
                writeTask.timestamp = Date.now();
                clearPolling(taskId, itemId);
                setTaskShadow(writeTask);
                await saveTaskDB(writeTask);
                renderCard(taskId, writeTask);
                forceRenderImgGenPreviewPanel(writeTask, itemId);
                showToast('生图任务失败，请调整参数后重试', 'error');
                return;
            }

            const nextTaskId = extractImgGenTaskId(rawData);
            if (nextTaskId && nextTaskId !== remoteId) {
                remoteTaskId = nextTaskId;
                const dynamicItem = task.state.previewHistory.find((entry) => entry && entry.id === itemId);
                if (dynamicItem) dynamicItem.remoteTaskId = nextTaskId;
                updateImgGenPreviewGuard(taskId, itemId, { remoteTaskId: nextTaskId });
                const writeTask = await getImgGenTaskForPreviewWrite(taskId, itemId, task);
                if (!writeTask) { clearPolling(taskId, itemId); return; }
                writeTask.genTaskId = nextTaskId;
                writeTask.timestamp = Date.now();
                setTaskShadow(writeTask);
                await saveTaskDB(writeTask);
            }

            if (!status || isImgGenPendingStatus(status)) {
                if (attempts >= maxAttempts) {
                    const writeTask = await getImgGenTaskForPreviewWrite(taskId, itemId, task);
                    if (!writeTask) { clearPolling(taskId, itemId); return; }
                    markImgGenPreviewFailed(writeTask, itemId, '轮询超时');
                    writeTask.timestamp = Date.now();
                    clearPolling(taskId, itemId);
                    setTaskShadow(writeTask);
                    await saveTaskDB(writeTask);
                    renderCard(taskId, writeTask);
                    forceRenderImgGenPreviewPanel(writeTask, itemId);
                    showToast('生图轮询超时，请稍后重试', 'error');
                    return;
                }
                scheduleNext(resolveImgGenPollDelayMs(rawData, 3500));
                return;
            }

            scheduleNext(resolveImgGenPollDelayMs(rawData, 3500));
        };

        scheduleNext(800);
    }

    window.VeoImageTasks = {
        buildPollKey,
        clearPolling,
        hasPolling,
        startPolling
    };
})();

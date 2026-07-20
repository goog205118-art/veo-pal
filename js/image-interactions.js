async function toggleImgGenPreviewPanel(e, taskId) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    const baseTask = getTaskShadow(taskId) || await getTaskDB(taskId);
    const task = baseTask ? (cloneTaskDeep(baseTask) || { ...baseTask }) : null;
    if (!task) return;
    ensureImgGenState(task);
    task.state.previewCollapsed = !task.state.previewCollapsed;
    task.timestamp = Date.now();
    setTaskShadow(task);
    renderCard(taskId, task);
    await saveTaskDB(task);
}

async function switchImgGenChannelAndRetry(e, taskId) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    await queueImgGenTaskUpdate(taskId, async () => {
        const baseTask = getTaskShadow(taskId) || await getTaskDB(taskId);
        if (!baseTask) return;
        const task = cloneTaskDeep(baseTask) || { ...baseTask };
        ensureImgGenState(task);
        if (task.state.version === 'pro') {
            const route = normalizeImgGenRoute();
            task.state.providerSort = route.key;
            task.state.modelSuffix = route.suffix;
            task.state.routeMode = route.mode;
            task.state.imageModel = getImgGenModelForRoute(route);
            showToast('Pro 将使用默认通道重试', 'info');
        } else {
            task.state.channel = task.state.channel === 'channel_2' ? 'channel_1' : 'channel_2';
            showToast(`已切换试用通道：${task.state.channel === 'channel_2' ? '通道 2' : '通道 1'}，准备重试`, 'info');
        }
        task.state.nextSubmitAt = 0;
        task.retryCount = 0;
        task.timestamp = Date.now();
        setTaskShadow(task);
        renderCard(taskId, task);
        await saveTaskDB(task);
    }).catch(() => {
        showToast('切换通道失败，请手动重试', 'error');
    });
    setTimeout(() => submitImgGen(taskId), 80);
}

async function retryImgGenPreviewItem(e, taskId) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    await queueImgGenTaskUpdate(taskId, async () => {
        const baseTask = getTaskShadow(taskId) || await getTaskDB(taskId);
        if (!baseTask) return;
        const task = cloneTaskDeep(baseTask) || { ...baseTask };
        ensureImgGenState(task);
        task.state.nextSubmitAt = 0;
        task.state.previewCollapsed = false;
        task.retryCount = 0;
        task.timestamp = Date.now();
        setTaskShadow(task);
        renderCard(taskId, task);
        await saveTaskDB(task);
    }).catch(() => {
        showToast('重试准备失败，请再点一次', 'error');
    });
    setTimeout(() => submitImgGen(taskId), 80);
}

async function removeImgGenPreviewItem(e, taskId, itemId) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    if (!itemId) return;
    await queueImgGenTaskUpdate(taskId, async () => {
        const baseTask = getTaskShadow(taskId) || await getTaskDB(taskId);
        if (!baseTask) return;
        const task = cloneTaskDeep(baseTask) || { ...baseTask };
        ensureImgGenState(task);
        const removedItem = Array.isArray(task.state.previewHistory)
            ? task.state.previewHistory.find((item) => item && item.id === itemId)
            : null;
        task.state.previewHistory = Array.isArray(task.state.previewHistory)
            ? task.state.previewHistory.filter((item) => item && item.id !== itemId)
            : [];
        if (removedItem && removedItem.status === 'pending') {
            task.state.previewHistory.push({ ...removedItem, hidden: true });
            guardImgGenPreviewItem(taskId, { ...removedItem, hidden: true, status: 'pending' });
        } else {
            clearImgGenPolling(taskId, itemId);
            releaseImgGenPreviewGuard(taskId, itemId);
        }
        recalcImgGenTaskStatus(task);
        if (removedItem && removedItem.status === 'pending' && getImgGenPendingCount(task) === 0) {
            task.genTaskId = null;
            task.retryCount = 0;
            task.state.startTime = null;
        }
        if (removedItem && removedItem.remoteTaskId && task.genTaskId === removedItem.remoteTaskId) {
            task.genTaskId = null;
        }
        if (removedItem && removedItem.id) {
            revokeBlobPrefixSafe(`${taskId}_feed_${removedItem.id}_`);
        }
        task.timestamp = Date.now();
        setTaskShadow(task);
        renderCard(taskId, task);
        if (removedItem && removedItem.status === 'pending') {
            forceRenderImgGenPreviewPanel(task, '');
            showToast('已隐藏等待框，后台结果返回后会自动补回预览', 'info');
        }
        await saveTaskDB(task);
    }).catch(() => {
        showToast('删除失败记录失败，请重试', 'error');
    });
}

async function toggleImgGenParamsPanel(e, taskId) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    await queueImgGenTaskUpdate(taskId, async () => {
        const baseTask = getTaskShadow(taskId) || await getTaskDB(taskId);
        if (!baseTask) return;
        const task = cloneTaskDeep(baseTask) || { ...baseTask };
        ensureImgGenState(task);
        task.state.paramsCollapsed = !task.state.paramsCollapsed;
        task.timestamp = Date.now();
        setTaskShadow(task);
        renderCard(taskId, task);
        await saveTaskDB(task);
    }).catch(() => {
        showToast('参数面板切换失败', 'error');
    });
}

async function toggleImgGenPromptTools(e, taskId) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    await queueImgGenTaskUpdate(taskId, async () => {
        const baseTask = getTaskShadow(taskId) || await getTaskDB(taskId);
        if (!baseTask) return;
        const task = cloneTaskDeep(baseTask) || { ...baseTask };
        ensureImgGenState(task);
        task.state.promptToolsCollapsed = !task.state.promptToolsCollapsed;
        task.timestamp = Date.now();
        setTaskShadow(task);
        renderCard(taskId, task);
        await saveTaskDB(task);
    }).catch(() => {
        showToast('快捷提示词切换失败', 'error');
    });
}

async function toggleImgGenMaskTools(e, taskId) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    await queueImgGenTaskUpdate(taskId, async () => {
        const baseTask = getTaskShadow(taskId) || await getTaskDB(taskId);
        if (!baseTask) return;
        const task = cloneTaskDeep(baseTask) || { ...baseTask };
        ensureImgGenState(task);
        task.state.maskPanelCollapsed = !task.state.maskPanelCollapsed;
        task.timestamp = Date.now();
        setTaskShadow(task);
        renderCard(taskId, task);
        await saveTaskDB(task);
    }).catch(() => {
        showToast('蒙版工具切换失败', 'error');
    });
}

async function updateImgGenState(taskId, key, val) {
    await queueImgGenTaskUpdate(taskId, async () => {
        const baseTask = getTaskShadow(taskId) || await getTaskDB(taskId);
        if (!baseTask) return;

        const task = cloneTaskDeep(baseTask) || { ...baseTask };
        ensureImgGenState(task);

        if (key === 'n') {
            task.state.n = 1;
        } else if (key === 'proResolution') {
            task.state.proResolution = ['1k', '2k', '4k'].includes(String(val)) ? String(val) : '1k';
            if (task.state.version === 'pro') task.state.size = resolveImgGenSize(task.state);
        } else if (key === 'proRatio') {
            task.state.proRatio = String(val || '1:1');
            if (task.state.version === 'pro') task.state.size = resolveImgGenSize(task.state);
        } else if (key === 'providerSort') {
            const route = normalizeImgGenRoute(val);
            task.state.providerSort = route.key;
            task.state.modelSuffix = route.suffix;
            task.state.routeMode = route.mode;
            task.state.imageModel = getImgGenModelForRoute(route);
        } else if (key === 'maskBrushSize') {
            task.state.maskBrushSize = clampImgMaskBrushSize(val);
        } else if (key === 'maskStageHeight') {
            task.state.maskStageHeight = clampImgMaskStageHeight(val);
        } else if (key === 'seedLocked') {
            task.state.seedLocked = val === true || val === 'true';
            if (task.state.seedLocked && task.state.seed === '') {
                task.state.seed = Math.floor(Math.random() * 2147483647);
            }
        } else if (key === 'seed') {
            const parsedSeed = parseInt(val, 10);
            task.state.seed = Number.isFinite(parsedSeed) && parsedSeed >= 0 ? parsedSeed : '';
            if (task.state.seed !== '') task.state.seedLocked = true;
        } else if (key === 'customW' || key === 'customH') {
            const parsed = parseInt(val, 10);
            task.state[key] = Number.isFinite(parsed) && parsed > 0 ? parsed : (key === 'customW' ? 9 : 16);
            if (task.state.version === 'pro' && task.state.proRatio === 'custom') task.state.size = resolveImgGenSize(task.state);
            if (task.state.version !== 'pro' && task.state.trialRatio === 'custom') task.state.size = resolveImgGenSize(task.state);
        } else if (key === 'trialRatio') {
            task.state.trialRatio = ['1:1', '3:2', '2:3', '16:9', '9:16', 'custom'].includes(String(val)) ? String(val) : '1:1';
            task.state.size = resolveImgGenSize(task.state);
        } else if (key === 'version') {
            const nextVersion = val === 'pro' ? 'pro' : 'trial';
            if (nextVersion === 'trial' && !IMG_GEN_TRIAL_AVAILABLE) {
                task.state.version = 'pro';
                task.state.size = resolveImgGenSize(task.state);
                showToast('试用版服务通道已关闭，已保持专业版', 'warning');
            } else {
                task.state.version = nextVersion;
                if (nextVersion === 'pro') {
                    const detected = detectProPresetFromSize(task.state.size);
                    if (detected.proRatio && detected.proRatio !== 'auto') task.state.proRatio = detected.proRatio;
                    if (detected.proResolution) task.state.proResolution = detected.proResolution;
                    task.state.size = resolveImgGenSize(task.state);
                } else {
                    task.state.size = resolveImgGenSize(task.state);
                }
            }
        } else if (key === 'size') {
            task.state.size = val;
            if (task.state.version === 'pro') {
                const detected = detectProPresetFromSize(val);
                if (detected.proRatio !== 'auto') task.state.proRatio = detected.proRatio;
                task.state.proResolution = detected.proResolution;
            } else {
                if (val === '') task.state.trialRatio = 'custom';
                else {
                    const trialDetected = detectProPresetFromSize(val);
                    if (trialDetected.proRatio && trialDetected.proRatio !== 'auto') task.state.trialRatio = trialDetected.proRatio;
                }
                task.state.size = resolveImgGenSize(task.state);
            }
        } else {
            task.state[key] = val;
            if (key === 'prompt' && typeof task.state.prompt !== 'string') task.state.prompt = '';
        }

        enforceImgGenRouteReferenceLimit(task);
        normalizeImgGenRefControls(task);
        task.timestamp = Date.now();
        setTaskShadow(task);
        renderCard(taskId, task);
        await saveTaskDB(task);
    }).catch(() => {
        showToast('参数更新失败，请重试', 'error');
    });
}

async function updateImgGenRefControl(taskId, index, key, value) {
    const slotIndex = parseInt(index, 10);
    if (!Number.isFinite(slotIndex) || slotIndex < 0 || slotIndex > 4) return;
    await queueImgGenTaskUpdate(taskId, async () => {
        const baseTask = getTaskShadow(taskId) || await getTaskDB(taskId);
        if (!baseTask) return;
        const task = cloneTaskDeep(baseTask) || { ...baseTask };
        ensureImgGenState(task);
        normalizeImgGenRefControls(task);
        if (!task.state.refControls[slotIndex]) return;
        if (key === 'intent') {
            const allowed = new Set(IMG_GEN_REF_INTENTS.map((item) => item.value));
            task.state.refControls[slotIndex].intent = allowed.has(value) ? value : getImgGenDefaultRefIntent(slotIndex);
        } else if (key === 'weight') {
            task.state.refControls[slotIndex].weight = clampImgGenRefWeight(value);
        } else if (key === 'locked') {
            task.state.refControls[slotIndex].locked = value === true || value === 'true';
        }
        task.timestamp = Date.now();
        setTaskShadow(task);
        renderCard(taskId, task);
        await saveTaskDB(task);
    }).catch(() => {
        showToast('参考图控制更新失败', 'error');
    });
}

async function appendImgGenPromptTag(event, taskId, text) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const tagIndex = parseInt(text, 10);
    const tag = Number.isFinite(tagIndex) && IMG_GEN_PROMPT_TAGS[tagIndex]
        ? IMG_GEN_PROMPT_TAGS[tagIndex].text
        : String(text || '').trim();
    if (!tag) return;
    const baseTask = getTaskShadow(taskId) || await getTaskDB(taskId);
    if (!baseTask) return;
    const task = cloneTaskDeep(baseTask) || { ...baseTask };
    ensureImgGenState(task);
    const current = String(task.state.prompt || '').trim();
    task.state.prompt = current ? `${current}, ${tag}` : tag;
    task.timestamp = Date.now();
    setTaskShadow(task);
    renderCard(taskId, task);
    await saveTaskDB(task).catch((err) => {
        console.warn('[submitImgGen] pending save failed, continue request:', err);
    });
    const promptEl = document.querySelector(`#card-${cssEscapeSafe(taskId)} .img-gen-prompt`);
    if (promptEl) {
        promptEl.focus();
        try { promptEl.setSelectionRange(promptEl.value.length, promptEl.value.length); } catch (err) {}
    }
}

async function handleGenImageUpload(input, taskId) {
    if (!input.files || input.files.length === 0) return;
    const task = await getTaskDB(taskId); if (!task) return;
    ensureImgGenState(task);
    const maxImageCount = getImgGenMaxReferenceCount(task);
    const files = Array.from(input.files);
    const filesToUse = maxImageCount === 1 ? files.slice(-1) : files;
    if (maxImageCount === 1 && files.length > 1) {
        showToast('AI666 通道仅支持 1 张参考图，已使用最后选择的图片', 'info');
    }
    for (let file of filesToUse) {
        const blob = await compressImageToBlob(file, 1024);
        if (maxImageCount === 1) {
            task.state.images = [blob];
            break;
        }
        if (task.state.images.length >= 5) break;
        task.state.images.push(blob);
    }
    enforceImgGenRouteReferenceLimit(task);
    normalizeImgGenRefControls(task);
    task.timestamp = Date.now();
    revokeBlobPrefixSafe(`${taskId}_img_`);
    revokeBlobPrefixSafe(`${taskId}_mask_preview_`);
    renderCard(taskId, task);
    await saveTaskDB(task);
    input.value = '';
}

// ==========================================
// ✅ 修复版：生图卡片拖拽处理函数 (免疫 dataTransfer 销毁)
// ==========================================
async function handleGenImageDrop(e, taskId) {
    e.preventDefault(); e.stopPropagation();
    const zone = document.getElementById(`img-gen-zone-${taskId}`);
    if (zone) zone.classList.remove('drag-over');

    const srcToUse = await parseDroppedImage(e);
    if (!srcToUse) return;

    const task = await getTaskDB(taskId);
    if (!task) return;
    ensureImgGenState(task);

    const maxImageCount = getImgGenMaxReferenceCount(task);
    if (maxImageCount === 1) {
        task.state.images = [srcToUse];
        task.state.maskBlob = null;
        task.state.maskImage = null;
        task.state.maskEditMode = false;
        revokeBlobPrefixSafe(`${taskId}_mask_preview_`);
        revokeBlobPrefixSafe(`${taskId}_mask_studio_`);
        destroyImgMaskStudio(taskId);
        destroyImgMaskEditor(taskId);
        showToast('AI666 通道仅保留 1 张参考图，已替换为新图', 'info');
    } else {
        if (task.state.images.length >= 5) {
            return showToast('最多只能垫入 5 张图', 'error');
        }
        task.state.images.push(srcToUse);
    }

    enforceImgGenRouteReferenceLimit(task);
    normalizeImgGenRefControls(task);
    task.timestamp = Date.now();
    revokeBlobPrefixSafe(`${taskId}_img_`);
    revokeBlobPrefixSafe(`${taskId}_mask_preview_`);
    renderCard(taskId, task);
    await saveTaskDB(task);
}
async function removeGenImage(e, taskId, index) {
    e.stopPropagation(); const task = await getTaskDB(taskId); if (!task) return;
    ensureImgGenState(task);
    const removedBase = index === 0;
    task.state.images.splice(index, 1);
    if (Array.isArray(task.state.refControls)) task.state.refControls.splice(index, 1);
    normalizeImgGenRefControls(task);
    revokeBlobPrefixSafe(`${taskId}_img_`);
    revokeBlobPrefixSafe(`${taskId}_mask_preview_`);
    revokeBlobPrefixSafe(`${taskId}_mask_studio_`);
    if (removedBase) {
        task.state.maskBlob = null;
        task.state.maskImage = null;
        if (task.state.images.length === 0) task.state.maskEditMode = false;
        destroyImgMaskStudio(taskId);
        destroyImgMaskEditor(taskId);
    }
    if (task.state.images.length === 0) {
        task.state.maskBlob = null;
        task.state.maskImage = null;
        task.state.maskEditMode = false;
        destroyImgMaskStudio(taskId);
        destroyImgMaskEditor(taskId);
    }
    task.timestamp = Date.now();
    renderCard(taskId, task);
    await saveTaskDB(task);
}

// ==========================================
// 🎨 AI 多模生图核心控制模块 (完全融合版)
// ==========================================

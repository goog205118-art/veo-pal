// Image generation preview result actions.
// Loaded as a classic script for existing inline onclick handlers.

async function createImgGenVariations(event, taskId, itemId) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const sourceTask = getTaskShadow(taskId) || await getTaskDB(taskId);
    if (!sourceTask || sourceTask.type !== 'tool_image_gen') return;
    ensureImgGenState(sourceTask);
    const item = findImgGenPreviewItem(sourceTask, itemId);
    if (!item || item.status !== 'success' || !item.image) {
        showToast('没有可衍生的成功图片', 'warning');
        return;
    }

    const seedBase = sourceTask.state.seedLocked && sourceTask.state.seed !== ''
        ? parseInt(sourceTask.state.seed, 10)
        : Math.floor(Math.random() * 2147483647);
    const clones = [];
    const groupId = `var_group_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const variantW = 330;
    const variantH = 440;
    const variantGap = 18;
    const clusterSize = {
        width: variantW * 2 + variantGap,
        height: variantH * 2 + variantGap
    };
    const clusterOrigin = resolveLinkedNodePosition(sourceTask, clusterSize, { gap: 42, yOffset: -8 });
    const framePadding = 34;
    const variantFrame = {
        id: `frame_img_var_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: 'frame',
        x: clusterOrigin.x - framePadding,
        y: clusterOrigin.y - framePadding,
        width: clusterSize.width + framePadding * 2,
        height: clusterSize.height + framePadding * 2,
        title: 'V1-4 变体组',
        isCollapsed: false,
        timestamp: Date.now()
    };
    for (let i = 0; i < IMG_GEN_VARIATION_COUNT; i++) {
        const clone = cloneTaskDeep(sourceTask) || { ...sourceTask, state: { ...(sourceTask.state || {}) } };
        clone.id = `tool_img_var_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`;
        clone.x = clusterOrigin.x + (i % 2) * (variantW + variantGap);
        clone.y = clusterOrigin.y + Math.floor(i / 2) * (variantH + variantGap);
        clone.timestamp = Date.now() + i;
        clone.status = 'idle';
        clone.retryCount = 0;
        clone.genTaskId = null;
        clone.isBilled = false;
        clone.parentId = variantFrame.id;
        clone.state = cloneTaskDeep(sourceTask.state) || { ...(sourceTask.state || {}) };
        ensureImgGenState(clone);
        clone.state.images = getImgGenMaxReferenceCount(clone) === 1
            ? [item.image]
            : [item.image, ...(Array.isArray(sourceTask.state.images) ? sourceTask.state.images.slice(0, 4) : [])].slice(0, 5);
        clone.state.refControls = clone.state.images.map((_, index) => createImgGenRefControl(index, {
            intent: index === 0 ? 'structure' : (sourceTask.state.refControls && sourceTask.state.refControls[index - 1] ? sourceTask.state.refControls[index - 1].intent : getImgGenDefaultRefIntent(index)),
            weight: index === 0 ? 0.92 : (sourceTask.state.refControls && sourceTask.state.refControls[index - 1] ? sourceTask.state.refControls[index - 1].weight : undefined)
        }));
        clone.state.prompt = `${sourceTask.state.prompt || ''}, variation ${i + 1}, preserve product identity and premium cinematic lighting`.trim();
        clone.state.previewHistory = [];
        clone.state.resultBlob = null;
        clone.state.resultBlobs = [];
        clone.state.resultUrl = null;
        clone.state.nextSubmitAt = 0;
        clone.state.maskBlob = null;
        clone.state.maskImage = null;
        clone.state.maskEditMode = false;
        clone.state.stageDocked = false;
        clone.state.stageReleased = false;
        clone.state.previewCollapsed = true;
        clone.state.paramsCollapsed = true;
        clone.state.cardWidthCollapsed = variantW;
        clone.state.cardWidthOpen = 650;
        clone.state.cardHeight = variantH;
        clone.state.variantGroupId = groupId;
        clone.state.variantIndex = i + 1;
        clone.state.variantSourceTaskId = sourceTask.id;
        clone.state.variantSourcePreviewId = itemId;
        clone.state.seedLocked = true;
        clone.state.seed = seedBase + i;
        recalcImgGenTaskStatus(clone);
        clones.push(clone);
    }

    const saveList = [variantFrame].concat(clones);
    if (typeof saveTaskBatchDB === 'function') await saveTaskBatchDB(saveList);
    else for (const task of saveList) await saveTaskDB(task);
    await renderBoard();
    setTimeout(() => selectAndFocusTaskIds([variantFrame.id]), 60);
    showToast(`已创建 ${IMG_GEN_VARIATION_COUNT} 个紧凑变体节点，并收纳为便携变体组`, 'success');
}

async function sendImgGenPreviewToMask(event, taskId, itemId) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const sourceTask = getTaskShadow(taskId) || await getTaskDB(taskId);
    if (!sourceTask || sourceTask.type !== 'tool_image_gen') return;
    ensureImgGenState(sourceTask);
    const item = findImgGenPreviewItem(sourceTask, itemId);
    if (!item || !item.image) return showToast('没有可送入蒙版的图片', 'warning');
    sourceTask.state.version = 'pro';
    sourceTask.state.images = getImgGenMaxReferenceCount(sourceTask) === 1
        ? [item.image]
        : [item.image, ...(Array.isArray(sourceTask.state.images) ? sourceTask.state.images.slice(0, 4) : [])].slice(0, 5);
    sourceTask.state.refControls = sourceTask.state.images.map((_, index) => createImgGenRefControl(index, { intent: index === 0 ? 'structure' : getImgGenDefaultRefIntent(index) }));
    sourceTask.state.maskBlob = null;
    sourceTask.state.maskImage = null;
    sourceTask.state.maskEditMode = false;
    sourceTask.state.size = resolveImgGenSize(sourceTask.state);
    normalizeImgGenRefControls(sourceTask);
    sourceTask.timestamp = Date.now();
    setTaskShadow(sourceTask);
    await saveTaskDB(sourceTask);
    renderCard(taskId, sourceTask);
    setTimeout(() => openImgGenMaskStudio(null, taskId), 80);
}

async function sendImgGenPreviewToCropper(event, taskId, itemId) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const sourceTask = getTaskShadow(taskId) || await getTaskDB(taskId);
    if (!sourceTask || sourceTask.type !== 'tool_image_gen') return;
    ensureImgGenState(sourceTask);
    const item = findImgGenPreviewItem(sourceTask, itemId);
    if (!item || !item.image) return showToast('没有可裁切的图片', 'warning');
    const dock = resolveLinkedNodePosition(sourceTask, { width: 340, height: 420 }, { gap: 42, yOffset: 10 });
    const cropTask = {
        id: `tool_crop_from_img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: 'tool_cropper',
        x: dock.x,
        y: dock.y,
        timestamp: Date.now(),
        state: {
            sourceBlob: item.image,
            resultBlob: null,
            cropParams: { left: 15, top: 15, width: 70, height: 70 }
        }
    };
    await saveTaskDB(cropTask);
    await renderBoard();
    setTimeout(() => focusTaskById(cropTask.id), 60);
    showToast('已创建局部裁切器', 'success');
}

function startImgGenTaskPolling(taskId, remoteTaskId, previewItemId = '') {
    return window.VeoImageTasks.startPolling(taskId, remoteTaskId, previewItemId);
}

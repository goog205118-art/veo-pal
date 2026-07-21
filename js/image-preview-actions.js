// Image generation preview result actions.
// Loaded as a classic script for existing inline onclick handlers.

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
    const maxReferenceCount = getImgGenMaxReferenceCount(sourceTask);
    sourceTask.state.images = [item.image, ...(Array.isArray(sourceTask.state.images) ? sourceTask.state.images.slice(0, maxReferenceCount - 1) : [])].slice(0, maxReferenceCount);
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

function startImgGenTaskPolling(taskId, remoteTaskId, previewItemId = '') {
    return window.VeoImageTasks.startPolling(taskId, remoteTaskId, previewItemId);
}

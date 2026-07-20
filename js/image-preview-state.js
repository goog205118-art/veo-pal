// Image generation preview state helpers.
// Kept as a classic script so existing globals and inline handlers remain compatible.

function createImgGenPreviewId() {
    return `img_item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeImgGenPreviewHistory(task) {
    if (!task || task.type !== 'tool_image_gen') return;
    if (!task.state || typeof task.state !== 'object') task.state = {};

    let list = Array.isArray(task.state.previewHistory) ? task.state.previewHistory.slice() : [];
    if (list.length === 0) {
        const seeded = [];
        const seededBlobs = Array.isArray(task.state.resultBlobs) && task.state.resultBlobs.length > 0
            ? task.state.resultBlobs
            : (task.state.resultBlob ? [task.state.resultBlob] : []);
        seededBlobs.forEach((img) => {
            if (!img) return;
            seeded.push({
                id: createImgGenPreviewId(),
                status: 'success',
                image: img,
                createdAt: Date.now()
            });
        });
        list = seeded;
    }

    list = list
        .filter((item) => item && typeof item === 'object')
        .map((item) => ({
            id: item.id || createImgGenPreviewId(),
            status: item.status || 'success',
            image: item.image || null,
            createdAt: Number.isFinite(item.createdAt) ? item.createdAt : Date.now(),
            costTime: Number.isFinite(item.costTime) ? item.costTime : null,
            remoteTaskId: item.remoteTaskId ? String(item.remoteTaskId) : '',
            width: toFiniteNumber(item.width, 0),
            height: toFiniteNumber(item.height, 0),
            ratio: toFiniteNumber(item.ratio, 0),
            layout: item.layout || '',
            errorReason: item.errorReason || '',
            seed: typeof item.seed === 'undefined' ? '' : item.seed,
            prompt: item.prompt || '',
            version: item.version || '',
            size: item.size || '',
            referenceControls: Array.isArray(item.referenceControls) ? item.referenceControls : [],
            hidden: item.hidden === true
        }))
        .sort((a, b) => a.createdAt - b.createdAt);

    task.state.previewHistory = list;
    if (!Number.isFinite(task.state.nextSubmitAt)) task.state.nextSubmitAt = 0;

    const successImages = task.state.previewHistory
        .filter((item) => item.status === 'success' && item.image)
        .map((item) => item.image);
    if (successImages.length > IMG_GEN_PREVIEW_LIMIT) {
        let dropCount = successImages.length - IMG_GEN_PREVIEW_LIMIT;
        const trimmed = [];
        for (const item of task.state.previewHistory) {
            if (item.status === 'success' && item.image && dropCount > 0) {
                if (item.id) revokeBlobPrefixSafe(`${task.id}_feed_${item.id}_`);
                dropCount--;
                continue;
            }
            trimmed.push(item);
        }
        task.state.previewHistory = trimmed;
    }

    const finalSuccessImages = task.state.previewHistory
        .filter((item) => item.status === 'success' && item.image)
        .map((item) => item.image)
        .slice(-IMG_GEN_PREVIEW_LIMIT);
    task.state.resultBlobs = finalSuccessImages;
    task.state.resultBlob = finalSuccessImages.length ? finalSuccessImages[finalSuccessImages.length - 1] : null;
}

function getImgGenPendingCount(task) {
    if (!task || !task.state || !Array.isArray(task.state.previewHistory)) return 0;
    return task.state.previewHistory.filter((item) => item && item.status === 'pending').length;
}

function getVisibleImgGenPendingCount(task) {
    if (!task || !task.state || !Array.isArray(task.state.previewHistory)) return 0;
    return task.state.previewHistory.filter((item) => item && item.status === 'pending' && item.hidden !== true).length;
}

async function isImgGenPreviewItemStillPending(taskId, itemId) {
    if (!taskId || !itemId) return true;
    const guarded = getImgGenPreviewGuardItems(taskId).find((item) => item && item.id === itemId);
    if (guarded && guarded.status === 'pending') return true;
    const liveTask = mergeImgGenTaskWithShadow(await getTaskDB(taskId), getTaskShadow(taskId), { protectedIds: getImgGenProtectedPreviewIds(taskId) });
    if (!liveTask || liveTask.type !== 'tool_image_gen') return false;
    ensureImgGenState(liveTask);
    return liveTask.state.previewHistory.some((item) => item && item.id === itemId && item.status === 'pending');
}

async function getImgGenTaskForPreviewWrite(taskId, itemId, fallbackTask = null) {
    let dbTask = null;
    try { dbTask = await getTaskDB(taskId); } catch (err) {}
    const shadowTask = getTaskShadow(taskId);
    let task = null;
    if (dbTask && dbTask.type === 'tool_image_gen') {
        task = mergeImgGenTaskWithShadow(dbTask, shadowTask, { protectedIds: getImgGenProtectedPreviewIds(taskId) });
    } else if (shadowTask && shadowTask.type === 'tool_image_gen') {
        task = cloneTaskDeep(shadowTask) || { ...shadowTask };
    } else if (fallbackTask && fallbackTask.type === 'tool_image_gen') {
        task = cloneTaskDeep(fallbackTask) || { ...fallbackTask };
    }
    if (!task || task.type !== 'tool_image_gen') return null;
    ensureImgGenState(task);
    const hasItem = task.state.previewHistory.some((item) => item && item.id === itemId);
    if (!hasItem && fallbackTask && fallbackTask.state && Array.isArray(fallbackTask.state.previewHistory)) {
        const fallbackItem = fallbackTask.state.previewHistory.find((item) => item && item.id === itemId);
        if (fallbackItem) {
            task.state.previewHistory.push({ ...fallbackItem });
            normalizeImgGenPreviewHistory(task);
        }
    }
    return task;
}

function recalcImgGenTaskStatus(task) {
    if (!task || task.type !== 'tool_image_gen') return;
    normalizeImgGenPreviewHistory(task);
    const pendingCount = getImgGenPendingCount(task);
    if (pendingCount > 0) {
        task.status = 'processing';
        return;
    }
    const hasSuccess = task.state.previewHistory.some((item) => item && item.status === 'success');
    if (hasSuccess) {
        task.status = 'success';
        return;
    }
    const hasFailed = task.state.previewHistory.some((item) => item && item.status === 'failed');
    if (hasFailed) {
        task.status = 'failed';
        return;
    }
    task.status = 'idle';
}

function pushImgGenPendingItem(task) {
    normalizeImgGenPreviewHistory(task);
    const itemId = createImgGenPreviewId();
    const pendingItem = {
        id: itemId,
        status: 'pending',
        image: null,
        createdAt: Date.now(),
        costTime: null,
        remoteTaskId: '',
        width: 0,
        height: 0,
        ratio: 0,
        layout: '',
        seed: task.state.seedLocked ? task.state.seed : '',
        prompt: task.state.prompt || '',
        version: task.state.version || 'trial',
        size: task.state.size || '',
        referenceControls: buildImgGenRefControlPayload(task),
        hidden: false
    };
    task.state.previewHistory.push(pendingItem);
    guardImgGenPreviewItem(task.id, pendingItem);
    recalcImgGenTaskStatus(task);
    return itemId;
}

function markImgGenPreviewSuccess(task, itemId, imageBlobOrUrl, costTimeSec = null, meta = null) {
    normalizeImgGenPreviewHistory(task);
    const item = task.state.previewHistory.find((entry) => entry && entry.id === itemId);
    if (item) {
        item.status = 'success';
        item.image = imageBlobOrUrl || null;
        item.costTime = Number.isFinite(costTimeSec) ? costTimeSec : null;
        item.remoteTaskId = '';
        item.width = meta && Number.isFinite(meta.width) ? meta.width : item.width;
        item.height = meta && Number.isFinite(meta.height) ? meta.height : item.height;
        item.ratio = meta && Number.isFinite(meta.ratio) ? meta.ratio : item.ratio;
        item.layout = meta && meta.layout ? meta.layout : item.layout;
        item.hidden = false;
        releaseImgGenPreviewGuard(task.id, itemId);
    } else {
        task.state.previewHistory.push({
            id: itemId || createImgGenPreviewId(),
            status: 'success',
            image: imageBlobOrUrl || null,
            createdAt: Date.now(),
            costTime: Number.isFinite(costTimeSec) ? costTimeSec : null,
            remoteTaskId: '',
            width: meta && Number.isFinite(meta.width) ? meta.width : 0,
            height: meta && Number.isFinite(meta.height) ? meta.height : 0,
            ratio: meta && Number.isFinite(meta.ratio) ? meta.ratio : 0,
            layout: meta && meta.layout ? meta.layout : '',
            hidden: false
        });
    }
    releaseImgGenPreviewGuard(task.id, itemId);
    recalcImgGenTaskStatus(task);
    return true;
}

function normalizeImgGenErrorReason(errorLike) {
    const raw = errorLike && errorLike.message ? errorLike.message : String(errorLike || '');
    const msg = raw.toLowerCase();
    if (msg.includes('401') || msg.includes('403') || msg.includes('密钥') || msg.includes('auth')) return '密钥或权限校验失败';
    if (msg.includes('safe') || msg.includes('moderation') || msg.includes('policy') || msg.includes('安全')) return '提示词可能触发安全拦截';
    if (msg.includes('timeout') || msg.includes('超时') || msg.includes('taskid') || msg.includes('异步')) return '通道超时或未返回任务 ID';
    if (msg.includes('429') || msg.includes('rate')) return '通道限流，请稍后重试';
    if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504')) return '后端通道暂时不可用';
    if (raw) return raw.slice(0, 42);
    return '通道响应异常或超时';
}

function markImgGenPreviewFailed(task, itemId, reason = '') {
    normalizeImgGenPreviewHistory(task);
    const errorReason = normalizeImgGenErrorReason(reason);
    const item = task.state.previewHistory.find((entry) => entry && entry.id === itemId);
    if (item) {
        item.status = 'failed';
        item.remoteTaskId = '';
        item.errorReason = errorReason;
        item.hidden = false;
        releaseImgGenPreviewGuard(task.id, itemId);
    }
    else {
        task.state.previewHistory.push({
            id: itemId || createImgGenPreviewId(),
            status: 'failed',
            image: null,
            createdAt: Date.now(),
            costTime: null,
            remoteTaskId: '',
            width: 0,
            height: 0,
            ratio: 0,
            layout: '',
            errorReason
        });
    }
    releaseImgGenPreviewGuard(task.id, itemId);
    recalcImgGenTaskStatus(task);
    return true;
}

function findImgGenPreviewItem(task, itemId) {
    if (!task || !task.state || !Array.isArray(task.state.previewHistory)) return null;
    return task.state.previewHistory.find((item) => item && item.id === itemId) || null;
}

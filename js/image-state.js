const imgGenUpdateQueues = new Map();
const imgGenPreviewGuards = new Map();

function cloneTaskDeep(task) {
    if (typeof structuredClone === 'function') {
        try { return structuredClone(task); } catch (err) {}
    }
    try { return JSON.parse(JSON.stringify(task)); } catch (err) { return null; }
}

function getImgGenPreviewStatusRank(item) {
    const status = item && item.status ? String(item.status) : '';
    if (status === 'success') return 4;
    if (status === 'failed') return 3;
    if (status === 'pending') return 2;
    return 1;
}

function mergeImgGenPreviewItem(prevItem, nextItem) {
    if (!prevItem) return nextItem ? { ...nextItem } : null;
    if (!nextItem) return { ...prevItem };
    const prevRank = getImgGenPreviewStatusRank(prevItem);
    const nextRank = getImgGenPreviewStatusRank(nextItem);
    const prevTime = toFiniteNumber(prevItem.updatedAt || prevItem.createdAt, 0);
    const nextTime = toFiniteNumber(nextItem.updatedAt || nextItem.createdAt, 0);
    const winner = (nextRank > prevRank || (nextRank === prevRank && nextTime >= prevTime)) ? nextItem : prevItem;
    const fallback = winner === nextItem ? prevItem : nextItem;
    return {
        ...fallback,
        ...winner,
        image: winner.image || fallback.image || null,
        remoteTaskId: winner.remoteTaskId || fallback.remoteTaskId || '',
        errorReason: winner.errorReason || fallback.errorReason || '',
        costTime: Number.isFinite(winner.costTime) ? winner.costTime : (Number.isFinite(fallback.costTime) ? fallback.costTime : null),
        width: toFiniteNumber(winner.width, toFiniteNumber(fallback.width, 0)),
        height: toFiniteNumber(winner.height, toFiniteNumber(fallback.height, 0)),
        ratio: toFiniteNumber(winner.ratio, toFiniteNumber(fallback.ratio, 0)),
        layout: winner.layout || fallback.layout || '',
        referenceControls: Array.isArray(winner.referenceControls) && winner.referenceControls.length
            ? winner.referenceControls
            : (Array.isArray(fallback.referenceControls) ? fallback.referenceControls : [])
    };
}

function getImgGenPreviewList(task) {
    return task && task.state && Array.isArray(task.state.previewHistory) ? task.state.previewHistory : [];
}

function guardImgGenPreviewItem(taskId, item) {
    if (!taskId || !item || !item.id) return;
    const bucket = imgGenPreviewGuards.get(taskId) || new Map();
    bucket.set(item.id, { ...item });
    imgGenPreviewGuards.set(taskId, bucket);
}

function updateImgGenPreviewGuard(taskId, itemId, patch = {}) {
    if (!taskId || !itemId) return;
    const bucket = imgGenPreviewGuards.get(taskId);
    if (!bucket || !bucket.has(itemId)) return;
    bucket.set(itemId, { ...bucket.get(itemId), ...patch });
}

function releaseImgGenPreviewGuard(taskId, itemId) {
    if (!taskId || !itemId) return;
    const bucket = imgGenPreviewGuards.get(taskId);
    if (!bucket) return;
    bucket.delete(itemId);
    if (bucket.size === 0) imgGenPreviewGuards.delete(taskId);
}

function getImgGenPreviewGuardItems(taskId) {
    const bucket = imgGenPreviewGuards.get(taskId);
    return bucket ? Array.from(bucket.values()) : [];
}

function getImgGenProtectedPreviewIds(taskId) {
    return getImgGenPreviewGuardItems(taskId).map((item) => item && item.id).filter(Boolean);
}

function mergeImgGenPreviewHistory(primaryTask, secondaryTask, options = {}) {
    const protectedIds = new Set(Array.isArray(options.protectedIds) ? options.protectedIds.filter(Boolean) : []);
    const primaryList = getImgGenPreviewList(primaryTask);
    const secondaryList = getImgGenPreviewList(secondaryTask);
    const primaryIds = new Set(primaryList.map((item) => item && item.id).filter(Boolean));
    const merged = new Map();

    primaryList.forEach((item) => {
        if (!item || !item.id) return;
        merged.set(item.id, { ...item });
    });

    secondaryList.forEach((item) => {
        if (!item || !item.id) return;
        const existing = merged.get(item.id);
        if (existing) {
            merged.set(item.id, mergeImgGenPreviewItem(existing, item));
            return;
        }

        if (protectedIds.has(item.id) && item.status === 'pending' && !primaryIds.has(item.id)) {
            merged.set(item.id, { ...item });
        }
    });

    return Array.from(merged.values()).sort((a, b) => toFiniteNumber(a.createdAt, 0) - toFiniteNumber(b.createdAt, 0));
}

function mergeImgGenTaskWithShadow(task, shadowTask, options = {}) {
    if (!task || task.type !== 'tool_image_gen') return task;
    if (!shadowTask || shadowTask.type !== 'tool_image_gen' || shadowTask.id !== task.id) return task;

    const dbTask = cloneTaskDeep(task) || { ...task };
    const liveTask = cloneTaskDeep(shadowTask) || { ...shadowTask };
    ensureImgGenState(dbTask);
    ensureImgGenState(liveTask);

    const dbTime = toFiniteNumber(dbTask.timestamp, 0);
    const liveTime = toFiniteNumber(liveTask.timestamp, 0);
    const primary = liveTime >= dbTime ? liveTask : dbTask;
    const secondary = primary === liveTask ? dbTask : liveTask;
    const merged = cloneTaskDeep(primary) || { ...primary };
    ensureImgGenState(merged);

    const protectedIds = Array.isArray(options.protectedIds) ? options.protectedIds : [];
    merged.state.previewHistory = mergeImgGenPreviewHistory(primary, secondary, { protectedIds });
    getImgGenPreviewGuardItems(merged.id).forEach((guardItem) => {
        if (!guardItem || !guardItem.id) return;
        const exists = merged.state.previewHistory.some((item) => item && item.id === guardItem.id);
        if (!exists) merged.state.previewHistory.push({ ...guardItem });
    });
    normalizeImgGenPreviewHistory(merged);

    const pendingCount = getImgGenPendingCount(merged);
    if (pendingCount > 0) {
        merged.status = 'processing';
        merged.state.previewCollapsed = false;
        merged.genTaskId = merged.genTaskId || secondary.genTaskId || null;
        merged.retryCount = Math.max(toFiniteNumber(merged.retryCount, 0), toFiniteNumber(secondary.retryCount, 0));
        merged.state.startTime = merged.state.startTime || (secondary.state && secondary.state.startTime) || Date.now();
        merged.state.nextSubmitAt = Math.max(
            toFiniteNumber(merged.state.nextSubmitAt, 0),
            toFiniteNumber(secondary.state && secondary.state.nextSubmitAt, 0)
        );
    } else {
        recalcImgGenTaskStatus(merged);
    }
    merged.timestamp = Math.max(dbTime, liveTime, toFiniteNumber(merged.timestamp, 0));
    return merged;
}

function queueImgGenTaskUpdate(taskId, runner) {
    const prev = imgGenUpdateQueues.get(taskId) || Promise.resolve();
    const next = prev
        .catch(() => null)
        .then(() => runner())
        .catch((err) => {
            console.error('[img-gen-update] failed:', err);
            throw err;
        });

    imgGenUpdateQueues.set(taskId, next);
    next.finally(() => {
        if (imgGenUpdateQueues.get(taskId) === next) imgGenUpdateQueues.delete(taskId);
    });
    return next;
}

function clearImgGenStateRuntime(taskId) {
    imgGenPreviewGuards.delete(taskId);
    imgGenUpdateQueues.delete(taskId);
}

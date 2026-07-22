// Image generation preview feed UI.
function renderImgGenPendingItem(item, task) {
    const proStages = ['正在连接 GPT-Image 2...', '正在渲染画面细节...', '正在进行超分处理...', '正在封装输出图像...'];
    const stages = proStages;
    const itemId = item && item.id ? item.id : '';
    const startedAt = toFiniteNumber(item && item.createdAt, Date.now());
    return `
        <div class="img-gen-preview-item img-gen-preview-pending" data-preview-id="${escapeAttr(itemId)}">
            <button class="img-gen-preview-delete" type="button" onclick="removeImgGenPreviewItem(event, '${task.id}', '${itemId}')" data-tip="删除这条生成中记录">
                <span class="material-symbols-outlined">close</span>
            </button>
            <div class="img-gen-preview-skeleton">
                <div class="img-gen-skeleton-sheen"></div>
                <div class="img-gen-skeleton-orb"></div>
            </div>
            <div class="img-gen-preview-pending-inner">
                <svg class="spinner" viewBox="0 0 50 50"><circle cx="25" cy="25" r="20"></circle></svg>
                <div class="img-gen-preview-placeholder-title">生成中...</div>
                <div class="img-gen-preview-timer">
                    <span class="material-symbols-outlined">timer</span>
                    <span class="veo-dynamic-timer" data-start-time="${startedAt}">00:00</span>
                </div>
                <div class="img-gen-preview-stage-lines">
                    ${stages.map((stage) => `<span>${escapeHtml(stage)}</span>`).join('')}
                </div>
            </div>
        </div>
    `;
}

function renderImgGenFailedItem(item, task) {
    const reason = item && item.errorReason ? item.errorReason : '通道响应异常或超时';
    const itemId = item && item.id ? item.id : '';
    return `
        <div class="img-gen-preview-item img-gen-preview-failed" data-preview-id="${escapeAttr(itemId)}">
            <button class="img-gen-preview-delete" type="button" onclick="removeImgGenPreviewItem(event, '${task.id}', '${itemId}')" data-tip="删除这条失败记录">
                <span class="material-symbols-outlined">close</span>
            </button>
            <div class="img-gen-preview-actions" onmousedown="event.stopPropagation()" onclick="event.stopPropagation()">
                <button type="button" onclick="submitImgGen('${task.id}')" data-tip="重新发起这次生图">
                    <span class="material-symbols-outlined">refresh</span>
                </button>
            </div>
            <div class="img-gen-preview-pending-inner">
                <span class="material-symbols-outlined">warning</span>
                <div class="img-gen-preview-placeholder-title">本次失败</div>
                <div class="img-gen-preview-placeholder-sub">${escapeHtml(reason)}</div>
            </div>
        </div>
    `;
}
function renderImgGenPreviewFeed(task, previewEntries) {
    const entries = Array.isArray(previewEntries) ? previewEntries.filter((item) => item && item.hidden !== true) : [];
    if (entries.length === 0) {
        return `<div class="img-gen-preview-placeholder"><span class="material-symbols-outlined">play_circle</span><div class="img-gen-preview-placeholder-title">点击生成开始预览</div><div class="img-gen-preview-placeholder-sub">结果将按时间顺序向下堆叠，最多保留 6 张</div></div>`;
    }

    const sorted = entries.slice().sort((a, b) => {
        const aPending = a && a.status === 'pending' ? 0 : 1;
        const bPending = b && b.status === 'pending' ? 0 : 1;
        if (aPending !== bPending) return aPending - bPending;
        return toFiniteNumber(b && b.createdAt, 0) - toFiniteNumber(a && a.createdAt, 0);
    });

    let successDragIndex = -1;
    return `<div class="img-gen-preview-feed">${
        sorted.map((item) => {
            if (!item) return '';
            if (item.status === 'pending') return renderImgGenPendingItem(item, task);
            if (item.status === 'failed') return renderImgGenFailedItem(item, task);
            if (item.status === 'success' && item.image) {
                successDragIndex++;
                const imgKey = `${task.id}_feed_${item.id}_${task.timestamp || ''}`;
                const imgUrl = getBlobUrl(imgKey, item.image);
                const safeRatio = Number.isFinite(Number(item.ratio)) && Number(item.ratio) > 0 ? Number(item.ratio) : 1;
                const layoutClass = item.layout === 'landscape' ? 'is-landscape' : (item.layout === 'portrait' ? 'is-portrait' : 'is-square');
                return `<div class="img-gen-preview-item ${layoutClass}" data-preview-id="${escapeAttr(item.id)}" style="--preview-aspect:${safeRatio};">
                    <button class="img-gen-preview-delete" type="button" onclick="removeImgGenPreviewItem(event, '${task.id}', '${item.id}')" data-tip="删除这张预览图">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                    <div class="img-gen-preview-actions" onmousedown="event.stopPropagation()" onclick="event.stopPropagation()">
                        <button type="button" onclick="sendImgGenPreviewToMask(event, '${task.id}', '${item.id}')" data-tip="把这张图作为 Base 打开蒙版重绘">
                            <span class="material-symbols-outlined">gesture</span>
                        </button>
                    </div>
                    <img src="${escapeAttr(imgUrl)}" draggable="true" ondragstart="event.dataTransfer.setData('application/json', JSON.stringify({taskId: '${task.id}', type: 'gen_result', previewId: '${item.id}', index: ${successDragIndex}}))" ondblclick="openLightbox(this.src)" data-tip="双击全屏高清预览，按住可拖动复用">
                </div>`;
            }
            return '';
        }).join('')
    }</div>`;
}

window.VeoImagePreviewUI = {
    renderFailedItem: renderImgGenFailedItem,
    renderFeed: renderImgGenPreviewFeed,
    renderPendingItem: renderImgGenPendingItem
};

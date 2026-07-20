// Video task card rendering.
// Kept as a classic script so app.js can delegate without changing the existing global runtime.

function renderVideoTaskCardHTML(task) {
    let statusBadge = '';
    let mediaHtml = '';
    const thumbImg = task.rawImages && (task.rawImages.firstFrame || (task.rawImages.references && task.rawImages.references[0]));
    const thumbUrl = getBlobUrl(task.id + '_thumb', thumbImg);
    const safeVideoPrompt = escapeHtml(task.prompt || '');
    const safeVideoPromptAttr = escapeAttr(task.prompt || '');
    const safeVideoTime = escapeHtml(task.time || '');
    const safeVideoModel = escapeHtml(task.modelStr || '');
    const safeVideoRatio = escapeHtml(task.ratio || '');
    const safeVideoAspect = sanitizeAspectRatioCss(task.ratio, '16/9');
    const safeVideoUrl = escapeAttr(task.videoUrl || '');
    const safeThumbUrl = escapeAttr(thumbUrl || '');

    if (task.status === 'processing') {
        const retryTxt = task.retryCount ? ` (重试 ${task.retryCount})` : '';
        statusBadge = `<span class="status-badge processing">生成中...${retryTxt}</span>`;
        const progressHtml = `
            <div class="cyber-scanner-box"><div class="cyber-scanner-line"></div></div>
            <div style="font-size: 11px; color: var(--accent); margin-top: 8px; font-weight: 600; font-family: monospace; letter-spacing: 1px;">MODELS ENGAGED...</div>
        `;
        mediaHtml = `<div class="card-media" style="aspect-ratio: ${safeVideoAspect}; padding: 20px;"><div style="display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%; color: var(--accent);"><svg class="spinner" viewBox="0 0 50 50" style="width:36px;height:36px;"><circle cx="25" cy="25" r="20"></circle></svg><div class="generating-text" style="margin-top: 12px;">视频生成中...</div>${progressHtml}</div></div>`;
    } else if (task.status === 'failed') {
        statusBadge = `<span class="status-badge failed">失败</span>`;
        mediaHtml = `<div class="card-media" style="background:#2c2c2e; color:var(--danger); aspect-ratio: ${safeVideoAspect}; font-size:12px;">生成超时或失败</div>`;
    } else {
        statusBadge = `<span class="status-badge success">已完成</span>`;
        mediaHtml = `<div class="card-media" data-tip="双击全屏播放视频"><video src="${safeVideoUrl}" preload="none" poster="${safeThumbUrl}" controls playsinline ondblclick="this.requestFullscreen()"></video></div>`;
    }

    const thumbHtml = thumbImg
        ? `<img src="${safeThumbUrl}" draggable="true" ondragstart="event.dataTransfer.setData('application/json', JSON.stringify({taskId: '${task.id}', type: 'thumb'}))" ondblclick="openLightbox(this.src)" data-tip="双击全屏高清预览，按住可拖动复用">`
        : `<div style="width:44px;height:44px;border-radius:4px;background:#2c2c2e;display:flex;align-items:center;justify-content:center;"><span class="material-symbols-outlined" style="color:#666;">image</span></div>`;

    return `<div class="card-header"><div class="time-model"><span class="material-symbols-outlined" style="font-size: 14px;">schedule</span> ${safeVideoTime} · ${safeVideoModel}</div>${statusBadge}</div><div class="card-prompt">${thumbHtml}<p title="${safeVideoPromptAttr}">${safeVideoPrompt}</p></div><div class="card-tags"><span class="card-tag">${safeVideoRatio}</span>${task.autoRetry ? `<span class="card-tag" style="color:var(--success); border: 1px solid var(--success);">已开挂机重试</span>` : ''}</div>${mediaHtml}<div class="card-actions">${task.status === 'success' ? `<button onclick="downloadVideo(this.dataset.url)" data-url="${safeVideoUrl}" data-tip="下载此视频到本地"><span class="material-symbols-outlined">download</span></button>` : ''}${task.status === 'failed' ? `<button class="retry-btn" onclick="retryTask('${task.id}', this)" data-tip="原地重新发起此任务"><span class="material-symbols-outlined">refresh</span></button>` : ''}<button class="reuse-btn" onclick="reuseTask('${task.id}')" data-tip="提取该任务的所有图文参数，反填至底部控制台"><span class="material-symbols-outlined">edit_note</span></button><button onclick="removeTask('${task.id}')" data-tip="删除此生成记录"><span class="material-symbols-outlined">delete</span></button></div>`;
}

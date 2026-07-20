// Cropper runtime and card actions.
// Loaded as a classic script after app.js so legacy inline handlers keep resolving globals.

let activeCrop = null;

function renderCropperCardHTML(task) {
    const hasSource = !!task.state.sourceBlob;
    const hasResult = !!task.state.resultBlob;
    let contentHtml = '';

    if (!hasSource) {
        contentHtml = `<div class="img-slot" id="crop-zone-${task.id}" style="width:100%; height:200px; border-radius:8px;" data-tip="点击上传或从画布拖入素材图片" onclick="document.getElementById('crop-file-${task.id}').click()"><span class="material-symbols-outlined" style="font-size:32px; color:var(--text-sub);">add_photo_alternate</span><span style="margin-top:8px;">导入素材图片</span><input type="file" id="crop-file-${task.id}" style="display:none;" accept="image/*" onchange="handleCropperUpload(this, '${task.id}')"></div>`;
    } else if (!hasResult) {
        const p = task.state.cropParams;
        contentHtml = `<div class="cropper-workspace" id="crop-workspace-${task.id}"><img id="crop-img-${task.id}" src="${getBlobUrl(task.id+'_src_'+(task.timestamp || ''), task.state.sourceBlob)}"><div class="crop-box" id="crop-box-${task.id}" data-task-id="${task.id}" style="left:${p.left}%; top:${p.top}%; width:${p.width}%; height:${p.height}%;"><div class="crop-grid"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div><div class="crop-handle ch-nw" data-dir="nw"></div><div class="crop-handle ch-ne" data-dir="ne"></div><div class="crop-handle ch-sw" data-dir="sw"></div><div class="crop-handle ch-se" data-dir="se"></div></div></div><div style="display:flex; gap:8px;"><button class="img-gen-btn" style="flex:1; background:var(--surface-hover); color:var(--text-main); margin:0;" onclick="resetCropper('${task.id}')">重置图片</button><button class="img-gen-btn" style="flex:2; background:var(--success); margin:0;" onclick="generateCrop('${task.id}')"><span class="material-symbols-outlined" style="font-size:16px;">crop</span> 确认裁切提取</button></div>`;
    } else {
        contentHtml = `<div class="img-gen-result" style="border:none; border-radius:8px; background:transparent; min-height: unset;"><img src="${getBlobUrl(task.id+'_res_'+(task.timestamp||''), task.state.resultBlob)}" draggable="true" ondragstart="event.dataTransfer.setData('application/json', JSON.stringify({taskId: '${task.id}', type: 'crop_result'}))" data-tip="按住拖拽，送至其他卡片组件复用" style="border-radius: 8px; border: 1px solid rgba(255,255,255,0.2);"></div><button class="img-gen-btn" style="width:100%; margin: 0; background:var(--surface-hover); color:var(--text-main);" onclick="reEditCropper('${task.id}')"><span class="material-symbols-outlined" style="font-size:16px;">history</span> 返回重新调整框选区</button>`;
    }

    return `<div class="card-header"><span style="color:var(--success); display:flex; align-items:center; gap:4px;"><span class="material-symbols-outlined" style="font-size:14px;">crop</span> 局部裁切器</span><button onclick="removeTask('${task.id}')" style="background:transparent; border:none; color:var(--text-sub); cursor:pointer;"><span class="material-symbols-outlined" style="font-size:16px;">close</span></button></div><div style="padding: 0 12px 12px 12px; display:flex; flex-direction:column; gap:12px;" ondragover="event.preventDefault();" ondrop="handleCropperDrop(event, '${task.id}')">${contentHtml}</div>`;
}

async function handleCropperDrop(e, taskId) {
    e.preventDefault();
    e.stopPropagation();
    const srcToUse = await parseDroppedImage(e);
    if (srcToUse) {
        const task = await getTaskDB(taskId);
        if (task) {
            revokeBlobPrefixSafe(taskId + '_src_');
            revokeBlobPrefixSafe(taskId + '_res_');
            task.state.sourceBlob = srcToUse;
            task.state.resultBlob = null;
            task.timestamp = Date.now();
            await saveTaskDB(task);
            renderCard(taskId);
            showToast("✅ 成功导入待裁切素材", "success");
        }
    }
}

async function handleCropperUpload(input, taskId) {
    if (!input.files || input.files.length === 0) return;
    const blob = await compressImageToBlob(input.files[0], 1024);
    const task = await getTaskDB(taskId);
    if (task) {
        revokeBlobPrefixSafe(taskId + '_src_');
        revokeBlobPrefixSafe(taskId + '_res_');
        task.state.sourceBlob = blob;
        task.state.resultBlob = null;
        task.timestamp = Date.now();
        await saveTaskDB(task);
        renderCard(taskId);
    }
    input.value = '';
}

async function resetCropper(taskId) {
    const task = await getTaskDB(taskId);
    if (task) {
        revokeBlobPrefixSafe(taskId + '_src_');
        revokeBlobPrefixSafe(taskId + '_res_');
        task.state.sourceBlob = null;
        task.state.resultBlob = null;
        await saveTaskDB(task);
        renderCard(taskId);
    }
}

async function reEditCropper(taskId) {
    const task = await getTaskDB(taskId);
    if (task) {
        revokeBlobPrefixSafe(taskId + '_res_');
        task.state.resultBlob = null;
        task.timestamp = Date.now();
        await saveTaskDB(task);
        renderCard(taskId);
    }
}

async function generateCrop(taskId) {
    const task = await getTaskDB(taskId);
    if (!task || !task.state.sourceBlob) return;

    const imgEl = document.getElementById(`crop-img-${taskId}`);
    const boxEl = document.getElementById(`crop-box-${taskId}`);
    if (!imgEl || !boxEl) return;

    const containerRect = imgEl.parentElement.getBoundingClientRect();
    const boxRect = boxEl.getBoundingClientRect();
    const scaleX = imgEl.naturalWidth / containerRect.width;
    const scaleY = imgEl.naturalHeight / containerRect.height;
    const cropX = (boxRect.left - containerRect.left) * scaleX;
    const cropY = (boxRect.top - containerRect.top) * scaleY;
    const cropW = boxRect.width * scaleX;
    const cropH = boxRect.height * scaleY;

    const canvas = document.createElement('canvas');
    canvas.width = cropW;
    canvas.height = cropH;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.src = imgEl.src;
    img.onload = async () => {
        ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        canvas.toBlob(async (blob) => {
            task.state.resultBlob = blob;
            task.timestamp = Date.now();
            await saveTaskDB(task);
            renderCard(taskId);
            showToast("✂️ 裁切提取完成！可按住新图片拖拽复用", "success");
        }, 'image/jpeg', 0.9);
    };
}

document.addEventListener('mousedown', (e) => {
    const handle = e.target.closest('.crop-handle');
    const box = e.target.closest('.crop-box');
    if (!handle && (!box || e.target.tagName === 'BUTTON')) return;

    e.stopPropagation();
    isPanning = false;
    setCanvasMoving(false);

    const targetBox = handle ? handle.closest('.crop-box') : box;
    const taskId = targetBox.getAttribute('data-task-id');
    const el = document.getElementById('card-' + taskId);
    if (!el || !el.__veoTask) return;

    activeCrop = {
        task: el.__veoTask,
        boxEl: targetBox,
        container: targetBox.parentElement,
        mode: handle ? handle.getAttribute('data-dir') : 'move',
        startX: e.clientX,
        startY: e.clientY,
        startLeft: el.__veoTask.state.cropParams.left,
        startTop: el.__veoTask.state.cropParams.top,
        startWidth: el.__veoTask.state.cropParams.width,
        startHeight: el.__veoTask.state.cropParams.height
    };
});

document.addEventListener('mousemove', (e) => {
    if (!activeCrop) return;
    const dx = (e.clientX - activeCrop.startX) / transform.scale;
    const dy = (e.clientY - activeCrop.startY) / transform.scale;
    const cw = activeCrop.container.offsetWidth;
    const ch = activeCrop.container.offsetHeight;
    const dxPct = (dx / cw) * 100;
    const dyPct = (dy / ch) * 100;

    let { startLeft, startTop, startWidth, startHeight, mode } = activeCrop;
    let newLeft = startLeft;
    let newTop = startTop;
    let newWidth = startWidth;
    let newHeight = startHeight;

    if (mode === 'move') {
        newLeft = Math.max(0, Math.min(100 - newWidth, startLeft + dxPct));
        newTop = Math.max(0, Math.min(100 - newHeight, startTop + dyPct));
    } else {
        if (mode.includes('e')) newWidth = Math.max(5, Math.min(100 - startLeft, startWidth + dxPct));
        if (mode.includes('s')) newHeight = Math.max(5, Math.min(100 - startTop, startHeight + dyPct));
        if (mode.includes('w')) {
            let maxW = startLeft + startWidth;
            newLeft = Math.max(0, Math.min(maxW - 5, startLeft + dxPct));
            newWidth = maxW - newLeft;
        }
        if (mode.includes('n')) {
            let maxH = startTop + startHeight;
            newTop = Math.max(0, Math.min(maxH - 5, startTop + dyPct));
            newHeight = maxH - newTop;
        }
    }
    activeCrop.task.state.cropParams = { left: newLeft, top: newTop, width: newWidth, height: newHeight };
    activeCrop.boxEl.style.left = newLeft + '%';
    activeCrop.boxEl.style.top = newTop + '%';
    activeCrop.boxEl.style.width = newWidth + '%';
    activeCrop.boxEl.style.height = newHeight + '%';
});

document.addEventListener('mouseup', async () => {
    if (activeCrop) {
        await saveTaskDB(activeCrop.task);
        activeCrop = null;
        renderMinimap();
    }
});

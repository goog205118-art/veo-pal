// Cropper runtime and card actions.
// Loaded as a classic script after app.js so legacy inline handlers keep resolving globals.

let activeCrop = null;

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

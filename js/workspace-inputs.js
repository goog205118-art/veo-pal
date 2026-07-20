// Clipboard, drag/drop, and console-slot image ingestion helpers.
(function (window) {
    'use strict';

    const IMAGE_MAX_EDGE = 1024;
    const state = { hooks: {} };

    function configure(options = {}) {
        state.hooks = { ...state.hooks, ...(options.hooks || {}) };
        return api;
    }

    function callHook(name, ...args) {
        const fn = state.hooks && state.hooks[name];
        if (typeof fn !== 'function') return undefined;
        return fn(...args);
    }

    function isEditableTarget(target) {
        const tagName = target && target.tagName ? target.tagName.toUpperCase() : '';
        return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
    }

    function createLocalImageTask(blob) {
        return {
            id: 'local_img_' + Date.now() + Math.random().toString(36).substr(2, 5),
            type: 'local_image',
            src: blob,
            timestamp: Date.now()
        };
    }

    async function compressImage(file) {
        const compressed = await callHook('compressImage', file, IMAGE_MAX_EDGE);
        return compressed || file;
    }

    async function saveLocalImage(file) {
        const blob = await compressImage(file);
        await callHook('saveTask', createLocalImageTask(blob));
        return true;
    }

    async function ingestImageFiles(files) {
        let added = 0;
        for (const file of Array.from(files || [])) {
            if (!file || !file.type || !file.type.startsWith('image/')) continue;
            await saveLocalImage(file);
            added += 1;
        }
        return added;
    }

    async function finishMaterialIngest(count, message) {
        if (!count) return false;
        await callHook('renderMaterialLibrary');
        callHook('showToast', message, 'success');
        callHook('openMaterialDrawer');
        return true;
    }

    async function handleClipboardPaste(event) {
        if (isEditableTarget(event.target)) return false;
        const items = event.clipboardData && event.clipboardData.items;
        if (!items) return false;
        let added = 0;
        for (const item of Array.from(items)) {
            if (!item || !item.type || item.type.indexOf('image') === -1) continue;
            const file = item.getAsFile();
            if (!file) continue;
            await saveLocalImage(file);
            added += 1;
        }
        return finishMaterialIngest(added, '已将剪贴板图片收入全局素材库');
    }

    function bindClipboardIngest(target = window) {
        target.addEventListener('paste', handleClipboardPaste);
    }

    function preventGlobalFileDrop(target = window) {
        target.addEventListener('dragover', (event) => event.preventDefault(), false);
        target.addEventListener('drop', (event) => event.preventDefault(), false);
    }

    function bindViewportDrop(viewport) {
        if (!viewport) return;
        viewport.addEventListener('dragover', (event) => {
            event.preventDefault();
        }, false);
        viewport.addEventListener('drop', async (event) => {
            event.preventDefault();
            const files = event.dataTransfer && event.dataTransfer.files;
            const added = await ingestImageFiles(files);
            await finishMaterialIngest(added, '已将拖入的图片收入全局素材库');
        });
    }

    async function resolveMetaImage(meta) {
        if (!meta || !meta.taskId) return null;
        const task = await callHook('getTask', meta.taskId);
        if (!task) return null;
        if (meta.type === 'local') return task.src || null;
        if (meta.type === 'thumb') return task.rawImages && (task.rawImages.firstFrame || (Array.isArray(task.rawImages.references) && task.rawImages.references[0])) || null;
        if (meta.type === 'crop_result') return task.state && task.state.resultBlob || null;
        if (meta.type !== 'gen_result') return null;
        if (meta.previewId && Array.isArray(task.state && task.state.previewHistory)) {
            const hit = task.state.previewHistory.find((entry) => entry && entry.id === meta.previewId && entry.status === 'success' && entry.image);
            if (hit) return hit.image;
        }
        const index = Number.isFinite(Number(meta.index)) ? Number(meta.index) : 0;
        if (Array.isArray(task.state && task.state.resultBlobs) && task.state.resultBlobs[index]) return task.state.resultBlobs[index];
        return task.state && task.state.resultBlob || null;
    }

    async function parseDroppedImage(event) {
        const dataTransfer = event && event.dataTransfer;
        if (!dataTransfer) return null;
        let srcToUse = null;
        try {
            const jsonStr = dataTransfer.getData('application/json');
            if (jsonStr) srcToUse = await resolveMetaImage(JSON.parse(jsonStr));
        } catch (error) {}
        if (!srcToUse) {
            const textData = dataTransfer.getData('text/plain');
            if (textData && textData.startsWith('data:image')) {
                try {
                    srcToUse = await (await fetch(textData)).blob();
                } catch (error) {}
            }
        }
        if (!srcToUse && dataTransfer.files && dataTransfer.files.length > 0) {
            const file = Array.from(dataTransfer.files).find((item) => item && item.type && item.type.startsWith('image/'));
            if (file) srcToUse = await compressImage(file);
        }
        return srcToUse;
    }

    function bindMainConsoleDrop(slotId, stateKey) {
        const slot = document.getElementById(slotId);
        if (!slot) return;
        slot.addEventListener('dragover', (event) => {
            event.preventDefault();
            slot.classList.add('drag-over');
        });
        slot.addEventListener('dragleave', (event) => {
            event.preventDefault();
            slot.classList.remove('drag-over');
        });
        slot.addEventListener('drop', async (event) => {
            event.preventDefault();
            slot.classList.remove('drag-over');
            const srcToUse = await parseDroppedImage(event);
            if (!srcToUse) return;
            if (stateKey === 'references') {
                callHook('addConsoleReferenceImage', srcToUse);
                callHook('showToast', '已送入 Veo 参考图槽', 'success');
                return;
            }
            callHook('setConsoleFrameImage', stateKey, srcToUse);
            callHook('showToast', stateKey === 'firstFrame' ? '已送入 Veo 首帧槽' : '已送入 Veo 尾帧槽', 'success');
        });
    }

    const api = {
        bindClipboardIngest,
        bindMainConsoleDrop,
        bindViewportDrop,
        configure,
        handleClipboardPaste,
        ingestImageFiles,
        parseDroppedImage,
        preventGlobalFileDrop
    };

    window.VeoWorkspaceInputs = api;
})(window);

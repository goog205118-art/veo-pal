// Canvas task creation, cloning, and selection-level actions.
(function (window) {
    'use strict';

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

    function toFiniteNumber(value, fallback = 0) {
        const converter = state.hooks && state.hooks.toFiniteNumber;
        if (typeof converter === 'function') return converter(value, fallback);
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function createDefaultImageGenTask(spawnX, spawnY) {
        const imageState = window.VeoImageCardProfile
            ? window.VeoImageCardProfile.createDefaultState()
            : {
                version: 'trial',
                providerSort: 'stable_channel_1',
                modelSuffix: '',
                routeMode: 'stable',
                imageModel: 'gpt-image-2-all',
                channel: 'channel_1',
                quality: 'auto',
                format: 'png',
                n: 1,
                size: '1024x1024',
                proRatio: '1:1',
                proResolution: '1k',
                customW: 9,
                customH: 16,
                background: 'auto',
                moderation: 'auto',
                prompt: '',
                images: [],
                refControls: [],
                seedLocked: false,
                seed: '',
                maskImage: null,
                maskBlob: null,
                maskEditMode: false,
                maskBrushSize: 20,
                maskStageHeight: 220,
                resultUrl: null,
                resultBlob: null,
                resultBlobs: [],
                previewCollapsed: false,
                paramsCollapsed: true,
                imgGenUiV2: true,
                cardWidthOpen: 680,
                cardWidthCollapsed: 360,
                cardHeight: 520,
                autoRetry: false
            };
        return {
            id: 'tool_img_' + Date.now(),
            type: 'tool_image_gen',
            x: toFiniteNumber(spawnX, 0),
            y: toFiniteNumber(spawnY, 0),
            timestamp: Date.now(),
            status: 'idle',
            state: imageState,
            retryCount: 0
        };
    }

    function getDefaultViewportRect() {
        const viewportRect = callHook('getViewportRect');
        if (viewportRect) return viewportRect;
        return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    }

    async function createImageGenNode(x = NaN, y = NaN) {
        let spawnX = toFiniteNumber(x, NaN);
        let spawnY = toFiniteNumber(y, NaN);
        if (!Number.isFinite(spawnX) || !Number.isFinite(spawnY)) {
            const rect = getDefaultViewportRect();
            const center = callHook('clientToBoard', rect.left + rect.width / 2, rect.top + rect.height / 2) || { x: 0, y: 0 };
            spawnX = center.x - 340;
            spawnY = center.y - 260;
        }
        const task = createDefaultImageGenTask(spawnX, spawnY);
        callHook('ensureImageState', task);
        await callHook('saveTask', task);
        await callHook('renderBoard');
        callHook('showToast', '已新建 AI 生图节点', 'success');
        return task;
    }

    function normalizeTaskPosition(task) {
        if (!task || typeof task !== 'object') return;
        task.x = toFiniteNumber(task.x, 0);
        task.y = toFiniteNumber(task.y, 0);
    }

    function buildDuplicateTaskPayload(originalTask, offsetX = 40, offsetY = 40) {
        if (!originalTask || typeof originalTask !== 'object') return null;
        const baseType = originalTask.type ? originalTask.type : 'task';
        const cloneTask = callHook('cloneTask', originalTask);
        const clone = cloneTask || { ...originalTask };
        clone.id = `${baseType}_copy_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        clone.timestamp = Date.now();
        delete clone.parentId;

        if (clone.type === 'tool_image_gen') {
            sanitizeImgGenCloneState(clone);
        }
        normalizeTaskPosition(clone);
        clone.x += offsetX;
        clone.y += offsetY;
        return clone;
    }

    function sanitizeImgGenCloneState(clone) {
        if (!clone || clone.type !== 'tool_image_gen') return clone;
        callHook('ensureImageState', clone);
        const profilePreviewLimit = window.VeoImageCardProfile
            ? window.VeoImageCardProfile.getPreviewLimit()
            : undefined;
        const previewLimit = toFiniteNumber(profilePreviewLimit || callHook('getImagePreviewLimit'), 12);
        const successHistory = Array.isArray(clone.state.previewHistory)
            ? clone.state.previewHistory
                .filter((item) => item && item.status === 'success' && item.image)
                .slice(-previewLimit)
                .map((item) => ({
                    ...item,
                    id: callHook('createImagePreviewId') || ('preview_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)),
                    status: 'success',
                    remoteTaskId: '',
                    errorReason: ''
                }))
            : [];
        clone.state.previewHistory = successHistory;
        clone.state.resultBlobs = successHistory.map((item) => item.image).filter(Boolean);
        clone.state.resultBlob = clone.state.resultBlobs.length ? clone.state.resultBlobs[clone.state.resultBlobs.length - 1] : null;
        clone.state.resultUrl = null;
        clone.state.startTime = null;
        clone.state.nextSubmitAt = 0;
        clone.state.maskImage = null;
        clone.state.maskBlob = null;
        clone.state.maskEditMode = false;
        clone.genTaskId = null;
        clone.retryCount = 0;
        clone.isBilled = false;
        callHook('recalcImageTaskStatus', clone);
        if (clone.status === 'processing') clone.status = 'idle';
        return clone;
    }

    async function duplicateSelectedTasks() {
        const ids = callHook('getSelectedTaskIds') || [];
        if (ids.length === 0) return;
        const clones = [];
        for (let i = 0; i < ids.length; i++) {
            const original = callHook('getTaskShadow', ids[i]) || await callHook('getTask', ids[i]);
            if (!original) continue;
            const offset = 44 + i * 14;
            const clone = buildDuplicateTaskPayload(original, offset, offset);
            if (!clone) continue;
            clones.push(clone);
            await callHook('saveTask', clone);
        }
        if (clones.length === 0) return;
        await callHook('renderBoard');
        callHook('clearSelection');
        clones.forEach((clone) => {
            const el = callHook('getTaskElement', clone.id);
            callHook('selectTask', clone.id, el);
            if (el) {
                el.classList.remove('is-viewport-culled');
                el.style.zIndex = callHook('nextZIndex');
            }
        });
        callHook('scheduleViewportCulling', 40);
        callHook('updateSelectionToolbar');
        callHook('showToast', `已复制 ${clones.length} 个节点`, 'success');
    }

    async function duplicateTask(originalTask, mouseEvent) {
        if (!originalTask || typeof originalTask !== 'object') return;
        const pointerState = callHook('getPointerState') || {};
        const cascadeOffset = !mouseEvent || !pointerState.isPrimaryPointerDown ? 40 : 0;
        const clone = buildDuplicateTaskPayload(originalTask, cascadeOffset, cascadeOffset);
        if (!clone) return;
        const newId = clone.id;

        await callHook('saveTask', clone);
        await callHook('renderBoard');
        await callHook('renderCard', newId);

        const newCardEl = callHook('getTaskElement', newId);
        if (!newCardEl) {
            callHook('showToast', '\u5df2\u590d\u5236\uff0c\u4f46\u65b0\u5361\u7247\u672a\u6302\u8f7d\uff0c\u8bf7\u91cd\u8bd5\u4e00\u6b21\u3002', 'error');
            return;
        }
        if (newCardEl.__veoTask) normalizeTaskPosition(newCardEl.__veoTask);
        normalizeTaskPosition(clone);
        const settledX = newCardEl.__veoTask ? toFiniteNumber(newCardEl.__veoTask.x, clone.x) : clone.x;
        const settledY = newCardEl.__veoTask ? toFiniteNumber(newCardEl.__veoTask.y, clone.y) : clone.y;
        clone.x = settledX;
        clone.y = settledY;
        if (newCardEl.__veoTask) {
            newCardEl.__veoTask.x = settledX;
            newCardEl.__veoTask.y = settledY;
        }

        newCardEl.style.zIndex = callHook('nextZIndex');
        newCardEl.style.willChange = 'transform';
        newCardEl.style.transform = `translate3d(${clone.x}px, ${clone.y}px, 0)`;

        callHook('clearSelection');
        callHook('selectTask', newId, newCardEl);
        callHook('updateSelectionToolbar');
        callHook('scheduleViewportCulling', 40);

        if (pointerState.isPrimaryPointerDown && newCardEl.__veoTask && mouseEvent) {
            const dragStartX = toFiniteNumber(mouseEvent.clientX, pointerState.lastPointerClientX);
            const dragStartY = toFiniteNumber(mouseEvent.clientY, pointerState.lastPointerClientY);
            callHook('setDraggingCardInfo', {
                el: newCardEl,
                task: newCardEl.__veoTask,
                startMouseX: dragStartX,
                startMouseY: dragStartY,
                initialX: toFiniteNumber(newCardEl.__veoTask.x, clone.x),
                initialY: toFiniteNumber(newCardEl.__veoTask.y, clone.y),
                fromCanvasCard: true,
                justCreated: true
            });
        } else {
            newCardEl.style.willChange = 'auto';
            try {
                await callHook('saveTask', newCardEl.__veoTask || clone);
            } catch (err) {
                console.warn('clone settle save failed:', err);
            }
        }

        callHook('showToast', '\u5df2\u590d\u5236\u7ec4\u4ef6\u548c\u53c2\u6570', 'success');
        return clone;
    }

    const api = {
        buildDuplicateTaskPayload,
        configure,
        createDefaultImageGenTask,
        createImageGenNode,
        duplicateTask,
        duplicateSelectedTasks,
        sanitizeImgGenCloneState
    };

    window.VeoTaskActions = api;
})(window);

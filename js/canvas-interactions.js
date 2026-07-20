// Canvas pointer, keyboard, wheel, and card-drag interactions.
(function (window) {
    'use strict';

    const state = {
        viewport: null,
        board: null,
        transform: { x: 0, y: 0, scale: 1 },
        selection: null,
        hooks: {},
        isBound: false,
        isPanning: false,
        isSpacePanningKeyDown: false,
        isPrimaryPointerDown: false,
        lastPointerClientX: 0,
        lastPointerClientY: 0,
        startPanX: 0,
        startPanY: 0,
        ticking: false,
        draggingCardInfo: null,
        scrollTimeout: null,
        resizeRefreshTimer: null
    };

    function configure(options = {}) {
        state.viewport = options.viewport || state.viewport;
        state.board = options.board || state.board;
        state.transform = options.transform || state.transform;
        state.selection = options.selection || state.selection;
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

    function setLastPointer(e) {
        if (!e) return;
        if (Number.isFinite(e.clientX)) state.lastPointerClientX = e.clientX;
        if (Number.isFinite(e.clientY)) state.lastPointerClientY = e.clientY;
    }

    function beginCanvasPan(e) {
        callHook('cancelCameraAnimation');
        callHook('cancelCanvasInertia');
        callHook('clearSelection');
        state.isPanning = true;
        callHook('setCanvasMoving', true);
        state.startPanX = e.clientX - state.transform.x;
        state.startPanY = e.clientY - state.transform.y;
        callHook('recordPanSample', e.clientX, e.clientY);
    }

    function handleGlobalMouseDown(e) {
        if (e.button === 0) state.isPrimaryPointerDown = true;
        setLastPointer(e);
    }

    function dragSelectedChildren(dx, dy) {
        const dragInfo = state.draggingCardInfo;
        if (!dragInfo || !dragInfo.children) return;
        dragInfo.children.forEach((child) => {
            const childBaseX = toFiniteNumber(child.initialX, 0);
            const childBaseY = toFiniteNumber(child.initialY, 0);
            child.task.x = childBaseX + dx;
            child.task.y = childBaseY + dy;
            child.el.style.transform = `translate3d(${child.task.x}px, ${child.task.y}px, 0)`;
        });
    }

    function updateDragPosition(e) {
        const dragInfo = state.draggingCardInfo;
        if (!dragInfo) return;
        const scale = toFiniteNumber(state.transform.scale, 1) || 1;
        const dx = (e.clientX - dragInfo.startMouseX) / scale;
        const dy = (e.clientY - dragInfo.startMouseY) / scale;
        const dragBaseX = toFiniteNumber(dragInfo.initialX, 0);
        const dragBaseY = toFiniteNumber(dragInfo.initialY, 0);
        dragInfo.task.x = dragBaseX + dx;
        dragInfo.task.y = dragBaseY + dy;
        dragInfo.el.style.transform = `translate3d(${dragInfo.task.x}px, ${dragInfo.task.y}px, 0)`;
        callHook('setStageDragOver', callHook('canDockToStage', dragInfo, e.clientX, e.clientY));
        dragSelectedChildren(dx, dy);
        callHook('requestSelectionToolbarUpdate');
    }

    function handleGlobalMouseMove(e) {
        setLastPointer(e);
        if (state.ticking) return;
        state.ticking = true;
        requestAnimationFrame(() => {
            if (state.isPanning) {
                state.transform.x = e.clientX - state.startPanX;
                state.transform.y = e.clientY - state.startPanY;
                callHook('recordPanSample', e.clientX, e.clientY);
                callHook('applyCanvasTransform', { cull: false, minimapDuration: 900 });
            } else if (state.selection && state.selection.isSelecting) {
                state.selection.updateMarqueeSelection(e.clientX, e.clientY);
                callHook('requestSelectionToolbarUpdate');
            } else if (state.draggingCardInfo) {
                updateDragPosition(e);
            }
            state.ticking = false;
        });
    }

    function isSpacePanInteractiveTarget(target) {
        return target && typeof target.closest === 'function'
            ? target.closest('input, textarea, select, button, .img-gen-preview-panel, .img-gen-mask-block')
            : null;
    }

    function handleSpacePanMouseDown(e) {
        if (!state.isSpacePanningKeyDown) return;
        if (isSpacePanInteractiveTarget(e.target)) return;
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        beginCanvasPan(e);
    }

    function handleViewportMouseDown(e) {
        if (e.target !== state.viewport && e.target !== state.board) return;
        callHook('cancelCameraAnimation');
        callHook('cancelCanvasInertia');
        if (e.shiftKey) {
            if (state.selection) {
                state.selection.startMarqueeSelection(e.clientX, e.clientY, callHook('buildSelectionCandidates'));
            }
            callHook('updateSelectionToolbar');
        } else {
            beginCanvasPan(e);
        }
    }

    async function handleGlobalMouseUp() {
        state.isPrimaryPointerDown = false;
        const wasPanning = state.isPanning;
        state.isPanning = false;
        callHook('setCanvasMoving', false);
        if (wasPanning) callHook('startCanvasInertia');
        if (state.selection && state.selection.finishMarqueeSelection()) {
            callHook('scheduleViewportCulling', 40);
            callHook('updateSelectionToolbar');
        }

        if (!state.draggingCardInfo) return;
        const dragInfo = state.draggingCardInfo;
        dragInfo.el.style.willChange = 'auto';
        const dockedToStage = await callHook('dockToStage', dragInfo);
        if (dockedToStage) {
            state.draggingCardInfo = null;
            return;
        }
        callHook('setStageDragOver', false);
        callHook('syncCardViewportMetrics', dragInfo.el, dragInfo.task);
        await callHook('saveTask', dragInfo.task);

        if (dragInfo.children) {
            for (const child of dragInfo.children) {
                child.el.style.willChange = 'auto';
                callHook('syncCardViewportMetrics', child.el, child.task);
                await callHook('saveTask', child.task);
            }
        } else {
            await callHook('checkGroupDrop', dragInfo);
        }
        state.draggingCardInfo = null;
        callHook('scheduleViewportCulling', 40);
        callHook('updateSelectionToolbar');
        callHook('renderMinimap');
    }

    function consumeNestedCanvasWheel(e) {
        const target = e && e.target && typeof e.target.closest === 'function' ? e.target : null;
        if (!target) return false;
        const promptRail = target.closest('.img-gen-prompt-chip-row');
        if (promptRail) {
            const modeFactor = e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? window.innerHeight : 1);
            const deltaX = toFiniteNumber(e.deltaX, 0) * modeFactor;
            const deltaY = toFiniteNumber(e.deltaY, 0) * modeFactor;
            const amount = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
            if (amount !== 0) {
                e.preventDefault();
                promptRail.scrollLeft += amount;
            }
            return true;
        }
        if (target.closest('.img-gen-input-body, .img-gen-preview-panel, .img-gen-preview-body, .img-gen-help-body')) {
            return true;
        }
        return false;
    }

    function handleViewportWheel(e) {
        if (e.target.tagName === 'TEXTAREA' || e.target.closest('textarea')) return;
        if (consumeNestedCanvasWheel(e)) return;
        if (state.draggingCardInfo) return;
        e.preventDefault();
        callHook('cancelCameraAnimation');
        callHook('cancelCanvasInertia');
        callHook('setCanvasMoving', true);
        clearTimeout(state.scrollTimeout);
        state.scrollTimeout = setTimeout(() => {
            callHook('setCanvasMoving', false);
            callHook('scheduleViewportCulling', 40);
            callHook('renderMinimap');
        }, 170);

        const modeFactor = e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? window.innerHeight : 1);
        const deltaX = toFiniteNumber(e.deltaX, 0) * modeFactor;
        const deltaY = toFiniteNumber(e.deltaY, 0) * modeFactor;
        const trackpadPan = !e.ctrlKey && (Math.abs(deltaX) > 0.5 || (e.deltaMode === 0 && Math.abs(deltaY) < 48) || e.shiftKey);

        if (trackpadPan) {
            callHook('panCanvasBy', -deltaX, -deltaY, { cull: false, minimapDuration: 700 });
        } else {
            const factor = Math.exp(-deltaY * 0.0012);
            callHook('zoomCanvasAt', e.clientX, e.clientY, state.transform.scale * factor, { cull: false, minimapDuration: 700 });
        }
    }

    function handleResize() {
        clearTimeout(state.resizeRefreshTimer);
        state.resizeRefreshTimer = setTimeout(() => {
            callHook('applyCanvasTransform', { cull: false, revealMinimap: false });
            callHook('scheduleViewportCulling', 60);
            callHook('renderMinimap');
            callHook('updateSelectionToolbar');
        }, 90);
    }

    async function handleKeyDown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
        if (e.code === 'Space') {
            state.isSpacePanningKeyDown = true;
            document.body.classList.add('space-pan-ready');
            e.preventDefault();
            return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
            e.preventDefault();
            if (state.selection) state.selection.selectVisibleCards();
            callHook('updateSelectionToolbar');
            callHook('scheduleViewportCulling', 40);
            callHook('showToast', '已全选可见节点', 'info');
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
            e.preventDefault();
            await callHook('duplicateSelectedTasks');
        }
        if (e.key === 'Backspace' || e.key === 'Delete') {
            await callHook('deleteSelectedTasks');
        }
    }

    function handleKeyUp(e) {
        if (e.code === 'Space') {
            state.isSpacePanningKeyDown = false;
            document.body.classList.remove('space-pan-ready');
        }
    }

    function getInteractiveDragTarget(target) {
        return target && typeof target.closest === 'function'
            ? target.closest('input, textarea, select, button, video, .img-gen-mask-block, .img-gen-preview-panel')
            : null;
    }

    function bindCardDrag(cardEl, task) {
        cardEl.__veoTask = task;
        cardEl.oncontextmenu = (e) => {
            if (getInteractiveDragTarget(e.target)) return;
            callHook('openTaskContextMenu', e, task.id);
        };
        cardEl.onmousedown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
            cardEl.style.zIndex = callHook('nextZIndex');
            if (task.type === 'tool_image_gen') callHook('activateImageStageTask', task);
        };

        const header = cardEl.querySelector('.card-header');
        if (!header) return;
        header.onmousedown = async (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
            callHook('cancelCameraAnimation');
            callHook('cancelCanvasInertia');
            callHook('setCanvasMoving', false);

            if (e.altKey) {
                e.preventDefault();
                e.stopPropagation();
                if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
                await callHook('duplicateTask', task, e);
                return;
            }

            cardEl.style.zIndex = callHook('nextZIndex');
            cardEl.style.willChange = 'transform';
            if (task.type === 'tool_image_gen') callHook('activateImageStageTask', task);
            if (e.shiftKey || e.ctrlKey || e.metaKey) {
                if (state.selection) state.selection.toggleTask(task.id, cardEl);
            } else if (!callHook('isTaskSelected', task.id)) {
                callHook('clearSelection');
                if (state.selection) state.selection.selectTask(task.id, cardEl);
            }
            state.draggingCardInfo = {
                el: cardEl,
                task: cardEl.__veoTask,
                startMouseX: e.clientX,
                startMouseY: e.clientY,
                initialX: toFiniteNumber(cardEl.__veoTask && cardEl.__veoTask.x, 0),
                initialY: toFiniteNumber(cardEl.__veoTask && cardEl.__veoTask.y, 0),
                fromCanvasCard: true,
                startedInsideStageRail: callHook('isPointInStageRail', e.clientX, e.clientY),
                startedNearStageRail: callHook('isPointNearStageRail', e.clientX, e.clientY),
                justCreated: false
            };

            if (task.type === 'frame') return;
            e.stopPropagation();
        };
    }

    function startFrameResize(e) {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    }

    function bind() {
        if (state.isBound || !state.viewport) return;
        window.addEventListener('mousedown', handleGlobalMouseDown, true);
        window.addEventListener('mousemove', handleGlobalMouseMove);
        state.viewport.addEventListener('mousedown', handleSpacePanMouseDown, true);
        state.viewport.addEventListener('mousedown', handleViewportMouseDown);
        window.addEventListener('mouseup', handleGlobalMouseUp);
        state.viewport.addEventListener('wheel', handleViewportWheel, { passive: false });
        window.addEventListener('resize', handleResize);
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        state.isBound = true;
    }

    function getPointerState() {
        return {
            isPrimaryPointerDown: state.isPrimaryPointerDown,
            lastPointerClientX: state.lastPointerClientX,
            lastPointerClientY: state.lastPointerClientY
        };
    }

    const api = {
        beginCanvasPan,
        bind,
        bindCardDrag,
        configure,
        consumeNestedCanvasWheel,
        getDraggingCardInfo: () => state.draggingCardInfo,
        getPointerState,
        isPanning: () => state.isPanning,
        setDraggingCardInfo: (dragInfo) => { state.draggingCardInfo = dragInfo; },
        startFrameResize
    };

    window.VeoCanvasInteractions = api;
})(window);

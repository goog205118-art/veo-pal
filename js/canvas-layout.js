// Canvas layout, measurement, selection focus, and retired frame compatibility.
(function (window) {
    'use strict';

    const FRAME_SAFE_PADDING = 36;
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

    function normalizeTaskPosition(task) {
        if (!task || typeof task !== 'object') return;
        task.x = toFiniteNumber(task.x, 0);
        task.y = toFiniteNumber(task.y, 0);
    }

    function getTaskFallbackSize(task) {
        if (!task || typeof task !== 'object') return { width: 340, height: 400 };
        if (task.type === 'tool_image_gen') {
            callHook('ensureImageState', task);
            const stateObj = task.state || {};
            const isCollapsed = stateObj.previewCollapsed === true;
            return {
                width: isCollapsed
                    ? Math.max(320, Math.min(760, toFiniteNumber(stateObj.cardWidthCollapsed, 360)))
                    : Math.max(560, Math.min(1200, toFiniteNumber(stateObj.cardWidthOpen, 680))),
                height: Math.max(420, Math.min(1100, toFiniteNumber(stateObj.cardHeight, 520)))
            };
        }
        return {
            width: Math.max(280, toFiniteNumber(task.width, 340)),
            height: Math.max(220, toFiniteNumber(task.height, 400))
        };
    }

    function measureTaskAABB(task) {
        const fallback = getTaskFallbackSize(task);
        const cardEl = task && task.id ? callHook('getTaskElement', task.id) : null;
        if (!cardEl) return fallback;
        const rect = typeof cardEl.getBoundingClientRect === 'function' ? cardEl.getBoundingClientRect() : null;
        const width = Math.round(toFiniteNumber(cardEl.offsetWidth, 0) || toFiniteNumber(rect && rect.width, 0));
        const height = Math.round(toFiniteNumber(cardEl.offsetHeight, 0) || toFiniteNumber(rect && rect.height, 0));
        return {
            width: Math.max(1, width || fallback.width),
            height: Math.max(1, height || fallback.height)
        };
    }

    function clampWorldValue(value, min, max) {
        if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) return value;
        return Math.max(min, Math.min(max, value));
    }

    function fitTaskInsideFrameBounds(task, frame, padding = FRAME_SAFE_PADDING) {
        if (!task || !frame || task.type === 'frame') return { taskChanged: false, frameChanged: false };
        normalizeTaskPosition(task);
        normalizeTaskPosition(frame);
        const safePad = Math.max(20, toFiniteNumber(padding, FRAME_SAFE_PADDING));
        const size = measureTaskAABB(task);
        let taskChanged = false;
        let frameChanged = false;
        const minFrameW = Math.max(340, size.width + safePad * 2);
        const minFrameH = Math.max(160, size.height + safePad * 2);
        if (toFiniteNumber(frame.width, 0) < minFrameW) {
            frame.width = minFrameW;
            frameChanged = true;
        }
        if (toFiniteNumber(frame.height, 0) < minFrameH) {
            frame.height = minFrameH;
            frameChanged = true;
        }
        const minX = frame.x + safePad;
        const minY = frame.y + safePad;
        const maxX = Math.max(minX, frame.x + frame.width - safePad - size.width);
        const maxY = Math.max(minY, frame.y + frame.height - safePad - size.height);
        const nextX = clampWorldValue(toFiniteNumber(task.x, 0), minX, maxX);
        const nextY = clampWorldValue(toFiniteNumber(task.y, 0), minY, maxY);
        if (Math.abs(nextX - task.x) > 0.1) {
            task.x = nextX;
            taskChanged = true;
        }
        if (Math.abs(nextY - task.y) > 0.1) {
            task.y = nextY;
            taskChanged = true;
        }
        return { taskChanged, frameChanged };
    }

    async function createFrame() {
        callHook('showToast', 'Frame nodes are retired. Use AI image nodes instead.', 'info');
    }

    async function checkGroupDrop(draggedInfo) {
        if (!draggedInfo || !draggedInfo.task) return;
        if (draggedInfo.task.parentId) {
            draggedInfo.task.parentId = null;
            await callHook('saveTask', draggedInfo.task);
        }
    }

    async function alignSelectedCards() {
        const tasks = await callHook('getAllTasks');
        if (!Array.isArray(tasks) || tasks.length === 0) {
            callHook('showToast', '画布上目前没有任何卡片', 'info');
            return;
        }

        const selectedIds = callHook('getSelectedTaskIds') || [];
        const layoutableCards = tasks.filter((task) => (
            task &&
            task.type !== 'local_image' &&
            task.type !== 'frame' &&
            !task.parentId
        ));
        const selectedCards = selectedIds.length > 0
            ? layoutableCards.filter((task) => selectedIds.includes(task.id))
            : [];
        const cardsToAlign = selectedCards.length >= 2 ? selectedCards : layoutableCards;
        const layoutScope = selectedCards.length >= 2 ? '选中卡片' : '全部卡片';

        if (cardsToAlign.length === 0) {
            callHook('showToast', '没有可排版的散落卡片', 'info');
            return;
        }
        if (cardsToAlign.length === 1) {
            callHook('showToast', '至少需要 2 张卡片才能排版', 'info');
            return;
        }

        cardsToAlign.forEach(normalizeTaskPosition);
        cardsToAlign.sort((a, b) => (Math.abs(a.y) + Math.abs(a.x)) - (Math.abs(b.y) + Math.abs(b.x)));
        await callHook('renderBoard');

        const minX = Math.min(...cardsToAlign.map((task) => toFiniteNumber(task.x, 0)));
        const minY = Math.min(...cardsToAlign.map((task) => toFiniteNumber(task.y, 0)));
        const gapX = 28;
        const gapY = 30;
        const scale = Math.max(0.1, toFiniteNumber(callHook('getCanvasScale'), 1));
        const viewportWidthBoard = Math.max(600, Math.floor(window.innerWidth / scale));

        const sizeCache = new Map();
        cardsToAlign.forEach((task) => sizeCache.set(task.id, measureTaskAABB(task)));
        const widest = Math.max(...cardsToAlign.map((task) => (sizeCache.get(task.id) || { width: 340 }).width), 340);
        const usableWidth = Math.max(widest + gapX, viewportWidthBoard - 120);
        const updatedAt = Date.now();

        let cursorX = minX;
        let cursorY = minY;
        let rowMaxHeight = 0;

        for (const task of cardsToAlign) {
            const size = sizeCache.get(task.id) || { width: 340, height: 400 };
            const nextRight = (cursorX - minX) + size.width;
            const shouldWrap = (cursorX !== minX) && (nextRight > usableWidth);
            if (shouldWrap) {
                cursorX = minX;
                cursorY += rowMaxHeight + gapY;
                rowMaxHeight = 0;
            }
            task.x = cursorX;
            task.y = cursorY;
            task.timestamp = updatedAt;
            cursorX += size.width + gapX;
            rowMaxHeight = Math.max(rowMaxHeight, size.height);
        }

        await callHook('saveTasks', cardsToAlign);
        await callHook('renderBoard');
        callHook('clearSelection');
        cardsToAlign.forEach((task) => {
            callHook('addSelectedTask', task.id);
            const el = callHook('getTaskElement', task.id);
            if (el) {
                el.classList.add('selected');
                el.classList.remove('is-viewport-culled');
            }
        });
        callHook('updateSelectionToolbar');
        focusSelectedTasks();
        callHook('showToast', `空间清理完成：已排版 ${layoutScope} ${cardsToAlign.length} 张`, 'success');
    }

    function resolveLinkedNodePosition(sourceTask, targetSize = {}, options = {}) {
        const sourceSize = measureTaskAABB(sourceTask);
        const targetW = Math.max(240, toFiniteNumber(targetSize.width, 340));
        const targetH = Math.max(180, toFiniteNumber(targetSize.height, 420));
        const gap = Math.max(20, toFiniteNumber(options.gap, 36));
        const sourceX = toFiniteNumber(sourceTask && sourceTask.x, 0);
        const sourceY = toFiniteNumber(sourceTask && sourceTask.y, 0);
        const sourceBounds = {
            left: sourceX,
            top: sourceY,
            right: sourceX + sourceSize.width,
            bottom: sourceY + sourceSize.height
        };
        const visible = callHook('getVisibleWorldRect', 96) || {
            left: -Infinity,
            top: -Infinity,
            right: Infinity,
            bottom: Infinity
        };
        const yBase = sourceY + toFiniteNumber(options.yOffset, 0);
        const xBase = sourceX + toFiniteNumber(options.xOffset, 0);
        const visibleCenterX = (visible.left + visible.right) / 2;
        const preferLeft = sourceX + sourceSize.width / 2 > visibleCenterX;
        const rightX = sourceBounds.right + gap;
        const leftX = sourceBounds.left - targetW - gap;
        const belowY = sourceBounds.bottom + gap;
        const aboveY = sourceBounds.top - targetH - gap;
        const clampY = (value) => clampWorldValue(value, visible.top, visible.bottom - targetH);
        const clampX = (value) => clampWorldValue(value, visible.left, visible.right - targetW);
        const candidates = [
            { x: rightX, y: clampY(yBase), side: 'right' },
            { x: leftX, y: clampY(yBase), side: 'left' },
            { x: clampX(xBase), y: belowY, side: 'below' },
            { x: clampX(xBase), y: aboveY, side: 'above' }
        ];
        if (preferLeft) candidates.splice(0, 2, candidates[1], candidates[0]);

        const fitsVisible = (pos) => (
            pos.x >= visible.left &&
            pos.y >= visible.top &&
            pos.x + targetW <= visible.right &&
            pos.y + targetH <= visible.bottom
        );
        const isOutsideSource = (pos) => (
            pos.x + targetW <= sourceBounds.left ||
            pos.x >= sourceBounds.right ||
            pos.y + targetH <= sourceBounds.top ||
            pos.y >= sourceBounds.bottom
        );
        const visibleHit = candidates.find((pos) => fitsVisible(pos) && isOutsideSource(pos));
        if (visibleHit) return { x: visibleHit.x, y: visibleHit.y };

        const fallback = preferLeft && leftX >= visible.left - targetW * 1.4
            ? { x: leftX, y: clampY(yBase) }
            : { x: rightX, y: clampY(yBase) };
        return fallback;
    }

    function getSelectedWorldBounds() {
        const elements = callHook('getSelectedCanvasElements') || [];
        if (elements.length === 0) return null;
        return elements.reduce((acc, el) => {
            const task = el.__veoTask;
            if (!task) return acc;
            const size = callHook('getCardWorldSize', el, task) || measureTaskAABB(task);
            const left = toFiniteNumber(task.x, 0);
            const top = toFiniteNumber(task.y, 0);
            return {
                left: Math.min(acc.left, left),
                top: Math.min(acc.top, top),
                right: Math.max(acc.right, left + size.width),
                bottom: Math.max(acc.bottom, top + size.height)
            };
        }, { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
    }

    function focusSelectedTasks() {
        const bounds = getSelectedWorldBounds();
        if (!bounds || !Number.isFinite(bounds.left) || !Number.isFinite(bounds.right)) return;
        const width = Math.max(1, bounds.right - bounds.left);
        const height = Math.max(1, bounds.bottom - bounds.top);
        const marginX = Math.min(260, Math.max(120, window.innerWidth * 0.18));
        const marginY = Math.min(220, Math.max(110, window.innerHeight * 0.18));
        const clampedScale = callHook('clampCanvasScale', Math.min((window.innerWidth - marginX) / width, (window.innerHeight - marginY) / height, 1.55));
        const nextScale = Number.isFinite(clampedScale) ? clampedScale : Math.min(1.55, Math.max(0.1, toFiniteNumber(clampedScale, 1)));
        const centerX = bounds.left + width / 2;
        const centerY = bounds.top + height / 2;
        callHook('animateCameraTo', {
            x: window.innerWidth / 2 - centerX * nextScale,
            y: window.innerHeight / 2 - centerY * nextScale,
            scale: nextScale
        }, { duration: 430 });
    }

    function selectAndFocusTaskIds(taskIds) {
        const ids = Array.isArray(taskIds) ? taskIds.filter(Boolean) : [];
        if (!ids.length) return;
        callHook('clearSelection');
        ids.forEach((id) => {
            callHook('addSelectedTask', id);
            const el = callHook('getTaskElement', id);
            if (el) {
                el.classList.add('selected');
                el.classList.remove('is-viewport-culled');
                el.style.zIndex = callHook('nextZIndex');
            }
        });
        callHook('updateSelectionToolbar');
        focusSelectedTasks();
    }

    function focusTaskById(taskId) {
        const el = callHook('getTaskElement', taskId);
        const task = el && el.__veoTask;
        if (!el || !task) return;
        callHook('clearSelection');
        callHook('selectTask', taskId, el);
        el.classList.remove('is-viewport-culled');
        el.style.zIndex = callHook('nextZIndex');
        callHook('updateSelectionToolbar');
        focusSelectedTasks();
    }

    function detectToolPluginType() {
        return '';
    }

    const api = {
        alignSelectedCards,
        checkGroupDrop,
        clampWorldValue,
        configure,
        createFrame,
        detectToolPluginType,
        fitTaskInsideFrameBounds,
        focusSelectedTasks,
        focusTaskById,
        getSelectedWorldBounds,
        getTaskFallbackSize,
        measureTaskAABB,
        normalizeTaskPosition,
        resolveLinkedNodePosition,
        selectAndFocusTaskIds
    };

    window.VeoCanvasLayout = api;
})(window);

// Canvas card frame sizing, resize persistence, and refresh fingerprints.
(function (window) {
    'use strict';

    const state = { hooks: {} };
    const SYNC_KEYS = [
        'status',
        'retry',
        'imgLen',
        'progress',
        'cropSrc',
        'cropRes',
        'version',
        'previewCollapsed',
        'previewFeed',
        'paramsCollapsed',
        'promptToolsCollapsed',
        'maskPanelCollapsed',
        'maskEdit',
        'maskBrush',
        'maskHeight',
        'title',
        'collapsed'
    ];

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

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function applyImageCardFrame(cardEl, task) {
        if (!cardEl || !task || task.type !== 'tool_image_gen') return;
        callHook('ensureImageState', task);
        const isOpen = task.state.previewCollapsed !== true;
        const collapsedWidth = clamp(toFiniteNumber(task.state.cardWidthCollapsed, 360), 320, 760);
        const expandedWidth = clamp(toFiniteNumber(task.state.cardWidthOpen, 680), 560, 1200);
        const cardHeight = clamp(toFiniteNumber(task.state.cardHeight, 520), 420, 1100);
        cardEl.classList.toggle('is-preview-open', isOpen);
        cardEl.style.setProperty('--img-gen-card-height', `${cardHeight}px`);
        cardEl.style.width = `${isOpen ? expandedWidth : collapsedWidth}px`;
        cardEl.style.height = `${cardHeight}px`;
    }

    function bindImageCardResizeSave(cardEl, task) {
        if (!cardEl || !task || task.type !== 'tool_image_gen' || cardEl.__imgGenResizeBound) return;
        cardEl.__imgGenResizeBound = true;
        cardEl.addEventListener('mouseup', () => {
            const liveTask = cardEl.__veoTask || callHook('getTaskShadow', task.id) || task;
            if (!liveTask || liveTask.type !== 'tool_image_gen') return;
            callHook('ensureImageState', liveTask);
            const width = Math.round(toFiniteNumber(cardEl.offsetWidth, 0));
            const height = Math.round(toFiniteNumber(cardEl.offsetHeight, 0));
            if (width <= 0 || height <= 0) return;
            const isCollapsed = liveTask.state.previewCollapsed === true;
            const nextWidth = isCollapsed ? clamp(width, 320, 760) : clamp(width, 560, 1200);
            const nextHeight = clamp(height, 420, 1100);
            const widthKey = isCollapsed ? 'cardWidthCollapsed' : 'cardWidthOpen';
            if (Math.abs(toFiniteNumber(liveTask.state[widthKey], 0) - nextWidth) < 2 && Math.abs(toFiniteNumber(liveTask.state.cardHeight, 0) - nextHeight) < 2) return;
            liveTask.state[widthKey] = nextWidth;
            liveTask.state.cardHeight = nextHeight;
            cardEl.style.width = `${nextWidth}px`;
            cardEl.style.height = `${nextHeight}px`;
            cardEl.style.setProperty('--img-gen-card-height', `${nextHeight}px`);
            liveTask.timestamp = Date.now();
            callHook('setTaskShadow', liveTask);
            const queued = callHook('queueTaskUpdate', liveTask.id, async () => {
                const latest = callHook('getTaskShadow', liveTask.id) || liveTask;
                await callHook('saveTask', latest);
            });
            if (queued && typeof queued.catch === 'function') queued.catch(() => {});
        });
    }

    function getSyncSnapshot(task) {
        const isImageTask = task && task.type === 'tool_image_gen' && task.state;
        return {
            status: task.status || 'static',
            retry: task.retryCount || 0,
            imgLen: task.state && task.state.images ? task.state.images.length : 0,
            progress: task.progress || '',
            cropSrc: task.state && task.state.sourceBlob ? 'hasSrc' : 'noSrc',
            cropRes: task.state && task.state.resultBlob ? 'hasRes' : 'noRes',
            version: task.state && task.state.version ? task.state.version : 'pro',
            previewCollapsed: isImageTask ? String(task.state.previewCollapsed === true) : 'na',
            previewFeed: isImageTask ? callHook('getPreviewFingerprint', task) : 'na',
            paramsCollapsed: isImageTask ? String(task.state.paramsCollapsed === true) : 'na',
            promptToolsCollapsed: isImageTask ? String(task.state.promptToolsCollapsed === true) : 'na',
            maskPanelCollapsed: isImageTask ? String(task.state.maskPanelCollapsed === true) : 'na',
            maskEdit: isImageTask ? String(task.state.maskEditMode === true) : 'na',
            maskBrush: isImageTask ? String(callHook('clampMaskBrushSize', task.state.maskBrushSize)) : 'na',
            maskHeight: isImageTask ? String(callHook('clampMaskStageHeight', task.state.maskStageHeight)) : 'na',
            title: task.title || '',
            collapsed: String(task.isCollapsed)
        };
    }

    function syncKeyToAttribute(key) {
        return 'data-sync-' + key.replace(/[A-Z]/g, (match) => '-' + match.toLowerCase());
    }

    function shouldRefresh(cardEl, task, snapshot = null) {
        if (!cardEl) return true;
        const next = snapshot || getSyncSnapshot(task);
        return SYNC_KEYS.some((key) => cardEl.getAttribute(syncKeyToAttribute(key)) != next[key]);
    }

    function applySyncAttributes(cardEl, task, snapshot = null) {
        if (!cardEl || !task) return;
        const next = snapshot || getSyncSnapshot(task);
        SYNC_KEYS.forEach((key) => {
            cardEl.setAttribute(syncKeyToAttribute(key), next[key]);
        });
    }

    const api = {
        applyImageCardFrame,
        applySyncAttributes,
        bindImageCardResizeSave,
        configure,
        getSyncSnapshot,
        shouldRefresh
    };

    window.VeoCanvasCards = api;
})(window);

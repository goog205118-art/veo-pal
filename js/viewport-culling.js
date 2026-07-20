// Viewport culling and card bounds cache for large canvas boards.
(function (window) {
    'use strict';

    const CULL_PADDING = 900;
    const state = {
        viewport: null,
        board: null,
        transform: { x: 0, y: 0, scale: 1 },
        cullTimer: 0,
        hooks: {}
    };

    function configure(options = {}) {
        state.viewport = options.viewport || state.viewport;
        state.board = options.board || state.board;
        state.transform = options.transform || state.transform;
        state.hooks = { ...state.hooks, ...(options.hooks || {}) };
        return api;
    }

    function callHook(name, ...args) {
        const fn = state.hooks && state.hooks[name];
        if (typeof fn !== 'function') return undefined;
        return fn(...args);
    }

    function finite(value, fallback = 0) {
        const hookValue = callHook('toFiniteNumber', value, fallback);
        if (Number.isFinite(hookValue)) return hookValue;
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    }

    function getFallbackSize(task) {
        return callHook('getTaskFallbackSize', task) || { width: 340, height: 420 };
    }

    function getCardWorldSize(cardEl, task) {
        const fallback = getFallbackSize(task);
        const dataW = finite(cardEl && cardEl.dataset ? cardEl.dataset.aabbWidth : 0, 0);
        const dataH = finite(cardEl && cardEl.dataset ? cardEl.dataset.aabbHeight : 0, 0);
        return {
            width: Math.max(1, dataW || fallback.width),
            height: Math.max(1, dataH || fallback.height)
        };
    }

    function syncCardViewportMetrics(cardEl, task) {
        if (!cardEl || !task) return;
        if (cardEl.classList.contains('is-viewport-culled')) return;
        const size = callHook('measureTaskAABB', task) || getFallbackSize(task);
        cardEl.dataset.aabbWidth = String(size.width);
        cardEl.dataset.aabbHeight = String(size.height);
        cardEl.style.setProperty('--culled-width', `${size.width}px`);
        cardEl.style.setProperty('--culled-height', `${size.height}px`);
    }

    function updateViewportCulling() {
        if (!state.viewport || !state.board) return;
        const scaleHook = callHook('clampScale', state.transform.scale);
        const scaleSafe = Number.isFinite(scaleHook) ? scaleHook : Math.max(0.1, finite(state.transform.scale, 1));
        const padding = CULL_PADDING / scaleSafe;
        const view = {
            left: -state.transform.x / scaleSafe - padding,
            top: -state.transform.y / scaleSafe - padding,
            right: (-state.transform.x + window.innerWidth) / scaleSafe + padding,
            bottom: (-state.transform.y + window.innerHeight) / scaleSafe + padding
        };
        const draggingCardInfo = callHook('getDraggingCardInfo');
        document.querySelectorAll('.canvas-board > .video-card').forEach((cardEl) => {
            const task = cardEl.__veoTask;
            if (!task || cardEl.classList.contains('hidden-in-frame') || cardEl.classList.contains('selected') || (draggingCardInfo && draggingCardInfo.el === cardEl)) {
                cardEl.classList.remove('is-viewport-culled');
                return;
            }
            const size = getCardWorldSize(cardEl, task);
            const left = finite(task.x, 0);
            const top = finite(task.y, 0);
            const outside = left + size.width < view.left || left > view.right || top + size.height < view.top || top > view.bottom;
            cardEl.classList.toggle('is-viewport-culled', outside);
        });
    }

    function scheduleViewportCulling(delay = 120) {
        clearTimeout(state.cullTimer);
        state.cullTimer = setTimeout(updateViewportCulling, Math.max(0, delay));
    }

    const api = {
        configure,
        getCardWorldSize,
        syncCardViewportMetrics,
        updateViewportCulling,
        scheduleViewportCulling
    };

    window.VeoViewportCulling = api;
})(window);

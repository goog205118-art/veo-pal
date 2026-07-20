// Image generation preview rendering helpers.
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

    function getPreviewList(task) {
        const hooked = callHook('getPreviewList', task);
        if (Array.isArray(hooked)) return hooked;
        return task && task.state && Array.isArray(task.state.previewHistory) ? task.state.previewHistory : [];
    }

    function getPreviewFingerprint(task) {
        if (!task || task.type !== 'tool_image_gen') return 'na';
        return getPreviewList(task).map((item) => {
            if (!item) return 'x';
            const imageSig = item.image
                ? (typeof item.image === 'string' ? `url${item.image.length}` : `blob${toFiniteNumber(item.image.size, 0)}`)
                : 'noimg';
            return [
                item.id || '',
                item.status || '',
                item.remoteTaskId || '',
                item.errorReason || '',
                imageSig,
                toFiniteNumber(item.costTime, -1)
            ].join(':');
        }).join('|');
    }

    function scheduleNextPaint(callback) {
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(callback);
            return;
        }
        setTimeout(callback, 16);
    }

    function waitNextPaint() {
        return new Promise((resolve) => scheduleNextPaint(resolve));
    }

    function forcePreviewPanel(task, focusItemId = '') {
        if (!task || task.type !== 'tool_image_gen') return false;
        callHook('ensureImageState', task);
        const cardEl = callHook('getTaskElement', task.id) || document.getElementById('card-' + task.id);
        if (!cardEl) return false;

        task.state.previewCollapsed = false;
        callHook('setTaskShadow', task);

        const splitEl = cardEl.querySelector('.img-gen-split');
        const panelEl = cardEl.querySelector('.img-gen-preview-panel');
        const bodyEl = cardEl.querySelector('.img-gen-preview-body');
        const pendingCount = toFiniteNumber(callHook('getVisiblePendingCount', task), 0);

        if (splitEl) splitEl.classList.remove('preview-collapsed');
        if (panelEl) {
            panelEl.classList.remove('is-collapsed');
            panelEl.classList.toggle('is-running', pendingCount > 0);
        }
        if (bodyEl) {
            bodyEl.innerHTML = callHook('renderPreviewFeed', task, task.state.previewHistory || []) || '';
        }
        callHook('applyCardFrame', cardEl, task);

        cardEl.setAttribute('data-sync-status', task.status || 'static');
        cardEl.setAttribute('data-sync-retry', task.retryCount || 0);
        cardEl.setAttribute('data-sync-preview-collapsed', 'false');
        cardEl.setAttribute('data-sync-preview-feed', getPreviewFingerprint(task));
        cardEl.__veoTask = task;

        if (focusItemId) scrollPreviewToItem(task.id, focusItemId);
        return true;
    }

    function scrollPreviewToItem(taskId, itemId) {
        if (!taskId || !itemId) return;
        scheduleNextPaint(() => {
            const cardEl = callHook('getTaskElement', taskId) || document.getElementById('card-' + taskId);
            if (!cardEl) return;
            const feed = cardEl.querySelector('.img-gen-preview-feed');
            const escapedId = callHook('cssEscape', itemId) || String(itemId);
            const target = cardEl.querySelector(`[data-preview-id="${escapedId}"]`) || cardEl.querySelector('.img-gen-preview-pending');
            if (feed) {
                try { feed.scrollTo({ top: 0, behavior: 'smooth' }); } catch (err) { feed.scrollTop = 0; }
            }
            if (target && typeof target.animate === 'function') {
                target.animate([
                    { transform: 'scale(0.985)', filter: 'brightness(1.18)' },
                    { transform: 'scale(1)', filter: 'brightness(1)' }
                ], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' });
            }
        });
    }

    const api = {
        configure,
        forcePreviewPanel,
        getPreviewFingerprint,
        scheduleNextPaint,
        scrollPreviewToItem,
        waitNextPaint
    };

    window.VeoImageRender = api;
})(window);

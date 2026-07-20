// Canvas card render orchestration and board reconciliation.
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

    function normalizeTaskForRender(task) {
        if (!task || typeof task !== 'object') return null;
        let nextTask = task;
        if (nextTask.type === 'tool_image_gen') {
            nextTask = callHook('mergeImageTaskWithShadow', nextTask) || nextTask;
        }
        callHook('normalizeTaskPosition', nextTask);
        callHook('setTaskShadow', nextTask);
        return nextTask;
    }

    function generateCardHTML(task) {
        if (!task || callHook('isRetiredTaskType', task.type)) return '';
        if (task.type === 'tool_image_gen') return callHook('renderImageCardHTML', task) || '';
        return callHook('renderVideoCardHTML', task) || '';
    }

    function getBoardTaskClassName(task) {
        return task && task.type === 'tool_image_gen' ? 'video-card tool-image-gen' : 'video-card';
    }

    function isRenderableTask(task) {
        return task && task.type !== 'local_image' && !callHook('isRetiredTaskType', task.type);
    }

    function removeStaleCards(board, boardTaskIds) {
        Array.from(board.children).forEach((card) => {
            if (boardTaskIds.has(card.id)) return;
            const removedTaskId = callHook('resolveTaskIdFromCardElement', card);
            if (removedTaskId) {
                callHook('destroyMaskStudio', removedTaskId);
                callHook('destroyMaskEditor', removedTaskId);
            }
            card.remove();
        });
    }

    function syncProcessingImagePolling(task) {
        if (!task || task.type !== 'tool_image_gen' || task.status !== 'processing') return;
        const pendingItems = Array.isArray(task.state && task.state.previewHistory)
            ? task.state.previewHistory.filter((entry) => entry && entry.status === 'pending' && entry.remoteTaskId)
            : [];
        if (pendingItems.length > 0) {
            pendingItems.forEach((entry) => {
                if (!callHook('hasImagePolling', task.id, entry.id)) {
                    callHook('startImagePolling', task.id, entry.remoteTaskId, entry.id);
                }
            });
            return;
        }
        if (task.genTaskId && !callHook('hasImagePolling', task.id)) {
            callHook('startImagePolling', task.id, task.genTaskId, task.genTaskId);
        }
    }

    function finalizeCard(cardEl, task, syncSnapshot = null) {
        cardEl.classList.toggle('hidden-in-frame', false);
        cardEl.classList.toggle('is-auto-retrying', task.status === 'processing' && callHook('toFiniteNumber', task.retryCount, 0) > 0);
        callHook('bindCardDrag', cardEl, task);
        callHook('syncCardViewportMetrics', cardEl, task);
        callHook('applySyncAttributes', cardEl, task, syncSnapshot);
    }

    function renderCardShell(cardEl, task, options = {}) {
        const syncSnapshot = options.syncSnapshot || callHook('getSyncSnapshot', task);
        cardEl.style.transform = `translate3d(${task.x}px, ${task.y}px, 0)`;
        if (options.force || callHook('shouldRefreshCard', cardEl, task, syncSnapshot)) {
            callHook('morphCardDOM', cardEl, generateCardHTML(task));
        }
        callHook('applyImageCardFrame', cardEl, task);
        const maskSync = callHook('syncMaskEditor', cardEl, task);
        if (maskSync && typeof maskSync.catch === 'function') maskSync.catch(() => {});
        callHook('bindImageCardResizeSave', cardEl, task);
        return syncSnapshot;
    }

    async function renderCard(taskId, taskOverride = null) {
        const rawTask = taskOverride || await callHook('getTask', taskId);
        const task = normalizeTaskForRender(rawTask);
        if (!task) return;
        const cardEl = callHook('getTaskElement', taskId);
        if (!cardEl) return;

        renderCardShell(cardEl, task, { force: true });
        finalizeCard(cardEl, task);
        callHook('scheduleViewportCulling', 40);
        callHook('updateSelectionToolbar');
    }

    async function renderBoard() {
        const board = callHook('getBoardElement');
        if (!board) return;
        const tasks = await callHook('getAllTasks');
        const boardTasks = (Array.isArray(tasks) ? tasks : []).filter(isRenderableTask);
        const boardTaskIds = new Set(boardTasks.map((task) => 'card-' + task.id));
        removeStaleCards(board, boardTaskIds);

        boardTasks.forEach((rawTask) => {
            const task = normalizeTaskForRender(rawTask);
            if (!task) return;

            let cardEl = callHook('getTaskElement', task.id);
            const syncSnapshot = callHook('getSyncSnapshot', task);
            if (!cardEl) {
                cardEl = document.createElement('div');
                cardEl.id = 'card-' + task.id;
                cardEl.className = getBoardTaskClassName(task);
                renderCardShell(cardEl, task, { force: true, syncSnapshot });
                board.appendChild(cardEl);
                callHook('ensureVideoPollingTask', task);
            } else {
                renderCardShell(cardEl, task, { syncSnapshot });
            }

            syncProcessingImagePolling(task);
            finalizeCard(cardEl, task, syncSnapshot);
        });

        callHook('renderMinimap');
        callHook('scheduleViewportCulling', 40);
        callHook('updateSelectionToolbar');
    }

    const api = {
        configure,
        generateCardHTML,
        renderBoard,
        renderCard
    };

    window.VeoCanvasRenderer = api;
})(window);

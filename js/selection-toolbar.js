// Floating toolbar for selected canvas cards.
(function (window) {
    'use strict';

    let toolbarFrame = 0;
    let pendingContext = null;
    const state = {
        hooks: {},
        actions: {}
    };

    function configure(options = {}) {
        state.hooks = { ...state.hooks, ...(options.hooks || {}) };
        state.actions = { ...state.actions, ...(options.actions || {}) };
        return api;
    }

    function callHook(name, ...args) {
        const fn = state.hooks && state.hooks[name];
        if (typeof fn !== 'function') return undefined;
        return fn(...args);
    }

    function getSelectedCanvasElements(selectedTaskIds) {
        const ids = selectedTaskIds || callHook('getSelectedTaskIds') || [];
        return Array.from(ids)
            .map((id) => document.getElementById('card-' + id))
            .filter((el) => el && !el.classList.contains('hidden-in-frame'));
    }

    function normalizeActions(actions) {
        return actions && typeof actions === 'object' ? actions : {};
    }

    function resolveActions(actions) {
        return actions ? normalizeActions(actions) : normalizeActions(state.actions);
    }

    function ensureSelectionToolbar(actions = null) {
        let toolbar = document.getElementById('canvas-selection-toolbar');
        if (toolbar) {
            toolbar.__veoSelectionActions = resolveActions(actions);
            return toolbar;
        }

        toolbar = document.createElement('div');
        toolbar.id = 'canvas-selection-toolbar';
        toolbar.className = 'canvas-selection-toolbar';
        toolbar.innerHTML = `
            <button type="button" data-action="focus" data-tip="聚焦选中节点"><span class="material-symbols-outlined">center_focus_strong</span></button>
            <button type="button" data-action="duplicate" data-tip="复制选中节点"><span class="material-symbols-outlined">content_copy</span></button>
            <button type="button" data-action="delete" data-tip="删除选中节点"><span class="material-symbols-outlined">delete</span></button>
            <button type="button" data-action="clear" data-tip="取消选择"><span class="material-symbols-outlined">close</span></button>
        `;
        toolbar.__veoSelectionActions = resolveActions(actions);
        toolbar.addEventListener('mousedown', (event) => event.stopPropagation());
        toolbar.addEventListener('click', async (event) => {
            const button = event.target.closest('button[data-action]');
            if (!button) return;
            event.preventDefault();
            event.stopPropagation();

            const actionName = button.dataset.action;
            const handlers = normalizeActions(toolbar.__veoSelectionActions);
            const handler = handlers[actionName];
            if (typeof handler === 'function') await handler(event);
        });
        document.body.appendChild(toolbar);
        return toolbar;
    }

    function buildContext(context = {}) {
        return {
            selectedTaskIds: context.selectedTaskIds || callHook('getSelectedTaskIds') || [],
            isPanning: typeof context.isPanning === 'boolean' ? context.isPanning : !!callHook('isPanning'),
            isSelecting: typeof context.isSelecting === 'boolean' ? context.isSelecting : !!callHook('isSelecting'),
            actions: {
                ...state.actions,
                ...(context.actions || {})
            }
        };
    }

    function updateSelectionToolbar(context = {}) {
        const toolbarContext = buildContext(context);
        const selectedTaskIds = toolbarContext.selectedTaskIds || [];
        const toolbar = ensureSelectionToolbar(toolbarContext.actions);
        const elements = getSelectedCanvasElements(selectedTaskIds)
            .filter((el) => !el.classList.contains('is-viewport-culled'));

        if (elements.length === 0 || toolbarContext.isPanning || toolbarContext.isSelecting) {
            toolbar.classList.remove('show');
            return toolbar;
        }

        const rects = elements.map((el) => el.getBoundingClientRect()).filter((rect) => rect.width > 0 && rect.height > 0);
        if (rects.length === 0) {
            toolbar.classList.remove('show');
            return toolbar;
        }

        const bounds = rects.reduce((acc, rect) => ({
            left: Math.min(acc.left, rect.left),
            top: Math.min(acc.top, rect.top),
            right: Math.max(acc.right, rect.right),
            bottom: Math.max(acc.bottom, rect.bottom)
        }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
        const x = Math.max(86, Math.min(window.innerWidth - 86, (bounds.left + bounds.right) / 2));
        const y = Math.max(14, bounds.top - 48);
        toolbar.style.transform = `translate(${x}px, ${y}px) translateX(-50%)`;
        toolbar.classList.add('show');
        return toolbar;
    }

    function requestSelectionToolbarUpdate(context = {}) {
        pendingContext = buildContext(context);
        if (toolbarFrame) return;
        toolbarFrame = requestAnimationFrame(() => {
            toolbarFrame = 0;
            updateSelectionToolbar(pendingContext || {});
            pendingContext = null;
        });
    }

    const api = {
        configure,
        getSelectedCanvasElements,
        ensureSelectionToolbar,
        updateSelectionToolbar,
        requestSelectionToolbarUpdate
    };

    window.VeoSelectionToolbar = api;
})(window);

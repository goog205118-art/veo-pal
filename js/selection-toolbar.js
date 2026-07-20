// Floating toolbar for selected canvas cards.
(function (window) {
    'use strict';

    let toolbarFrame = 0;
    let pendingContext = null;

    function getSelectedCanvasElements(selectedTaskIds) {
        return Array.from(selectedTaskIds || [])
            .map((id) => document.getElementById('card-' + id))
            .filter((el) => el && !el.classList.contains('hidden-in-frame'));
    }

    function normalizeActions(actions) {
        return actions && typeof actions === 'object' ? actions : {};
    }

    function ensureSelectionToolbar(actions = {}) {
        let toolbar = document.getElementById('canvas-selection-toolbar');
        if (toolbar) {
            toolbar.__veoSelectionActions = normalizeActions(actions);
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
        toolbar.__veoSelectionActions = normalizeActions(actions);
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

    function updateSelectionToolbar(context = {}) {
        const selectedTaskIds = context.selectedTaskIds || [];
        const toolbar = ensureSelectionToolbar(context.actions);
        const elements = getSelectedCanvasElements(selectedTaskIds)
            .filter((el) => !el.classList.contains('is-viewport-culled'));

        if (elements.length === 0 || context.isPanning || context.isSelecting) {
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
        pendingContext = context;
        if (toolbarFrame) return;
        toolbarFrame = requestAnimationFrame(() => {
            toolbarFrame = 0;
            updateSelectionToolbar(pendingContext || {});
            pendingContext = null;
        });
    }

    window.VeoSelectionToolbar = {
        getSelectedCanvasElements,
        ensureSelectionToolbar,
        updateSelectionToolbar,
        requestSelectionToolbarUpdate
    };
})(window);

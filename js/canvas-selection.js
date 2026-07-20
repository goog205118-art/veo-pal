// Canvas selection state and marquee hit testing.
(function (window) {
    'use strict';

    const state = {
        selectedTasks: new Set(),
        marquee: null,
        isSelecting: false,
        startX: 0,
        startY: 0,
        selectionCandidates: [],
        cardSelector: '.canvas-board > .video-card'
    };

    function configure(options = {}) {
        state.marquee = options.marquee || state.marquee;
        state.cardSelector = options.cardSelector || state.cardSelector;
        return api;
    }

    function getCardId(card) {
        return card && card.id ? card.id.replace('card-', '') : '';
    }

    function buildSelectionCandidates() {
        return Array.from(document.querySelectorAll(state.cardSelector))
            .filter((card) => card && !card.classList.contains('hidden-in-frame') && !card.classList.contains('is-viewport-culled'))
            .map((card) => ({
                el: card,
                id: getCardId(card),
                rect: card.getBoundingClientRect()
            }))
            .filter((item) => item.id && item.rect && item.rect.width > 0 && item.rect.height > 0);
    }

    function clearSelection() {
        state.selectionCandidates = [];
        state.selectedTasks.clear();
        document.querySelectorAll('.video-card.selected').forEach((card) => card.classList.remove('selected'));
    }

    function startMarqueeSelection(clientX, clientY, candidates) {
        state.isSelecting = true;
        state.startX = clientX;
        state.startY = clientY;
        state.selectionCandidates = Array.isArray(candidates) ? candidates : buildSelectionCandidates();
        if (state.marquee) {
            state.marquee.style.left = `${state.startX}px`;
            state.marquee.style.top = `${state.startY}px`;
            state.marquee.style.width = '0';
            state.marquee.style.height = '0';
            state.marquee.style.display = 'block';
            state.marquee.classList.add('is-window');
            state.marquee.classList.remove('is-crossing');
        }
    }

    function updateMarqueeSelection(clientX, clientY) {
        if (!state.isSelecting) return;
        const left = Math.min(state.startX, clientX);
        const top = Math.min(state.startY, clientY);
        const width = Math.abs(clientX - state.startX);
        const height = Math.abs(clientY - state.startY);
        const isCrossing = clientX < state.startX;
        if (state.marquee) {
            state.marquee.style.left = `${left}px`;
            state.marquee.style.top = `${top}px`;
            state.marquee.style.width = `${width}px`;
            state.marquee.style.height = `${height}px`;
            state.marquee.classList.toggle('is-crossing', isCrossing);
            state.marquee.classList.toggle('is-window', !isCrossing);
        }
        const selRect = { left, top, right: left + width, bottom: top + height };
        const candidates = state.selectionCandidates.length ? state.selectionCandidates : buildSelectionCandidates();
        candidates.forEach((candidate) => {
            const card = candidate.el;
            const rect = candidate.rect;
            const intersects = rect.left < selRect.right && rect.right > selRect.left && rect.top < selRect.bottom && rect.bottom > selRect.top;
            const contains = rect.left >= selRect.left && rect.right <= selRect.right && rect.top >= selRect.top && rect.bottom <= selRect.bottom;
            const hit = isCrossing ? intersects : contains;
            if (hit) {
                card.classList.add('selected');
                state.selectedTasks.add(candidate.id);
            } else {
                card.classList.remove('selected');
                state.selectedTasks.delete(candidate.id);
            }
        });
    }

    function finishMarqueeSelection() {
        if (!state.isSelecting) return false;
        state.isSelecting = false;
        state.selectionCandidates = [];
        if (state.marquee) {
            state.marquee.style.display = 'none';
            state.marquee.classList.remove('is-crossing', 'is-window');
        }
        return true;
    }

    function toggleTask(taskId, cardEl) {
        if (!taskId) return false;
        if (state.selectedTasks.has(taskId)) {
            state.selectedTasks.delete(taskId);
            if (cardEl) cardEl.classList.remove('selected');
            return false;
        }
        state.selectedTasks.add(taskId);
        if (cardEl) cardEl.classList.add('selected');
        return true;
    }

    function selectTask(taskId, cardEl) {
        if (!taskId) return;
        state.selectedTasks.add(taskId);
        if (cardEl) cardEl.classList.add('selected');
    }

    function selectVisibleCards() {
        document.querySelectorAll('.video-card').forEach((card) => {
            if (card.classList.contains('hidden-in-frame')) return;
            const id = getCardId(card);
            if (!id) return;
            state.selectedTasks.add(id);
            card.classList.add('selected');
        });
    }

    const api = {
        get selectedTasks() { return state.selectedTasks; },
        get isSelecting() { return state.isSelecting; },
        configure,
        buildSelectionCandidates,
        clearSelection,
        startMarqueeSelection,
        updateMarqueeSelection,
        finishMarqueeSelection,
        toggleTask,
        selectTask,
        selectVisibleCards
    };

    window.VeoCanvasSelection = api;
})(window);

// Page boot and document-level workspace events.
(function (window) {
    'use strict';

    function getViewport() {
        return document.getElementById('canvas-viewport');
    }

    function getBoard() {
        return document.getElementById('canvas-board');
    }

    function getConsole() {
        return document.getElementById('floating-console');
    }

    function handleDocumentClick(e) {
        const viewport = getViewport();
        const board = getBoard();
        const consoleEl = getConsole();
        const popover = document.getElementById('ref-popover');
        const slotBox = document.getElementById('slot-ref-box');
        if (popover && slotBox && popover.style.display === 'flex' && !popover.contains(e.target) && !slotBox.contains(e.target)) {
            popover.style.display = 'none';
        }
        if (!viewport || !board || !consoleEl) return;
        if (e.target === viewport || e.target === board) {
            consoleEl.classList.add('minimized');
            const materialDrawer = document.getElementById('material-drawer');
            if (materialDrawer) materialDrawer.classList.remove('open');
        } else if (consoleEl.contains(e.target)) {
            consoleEl.classList.remove('minimized');
        }
    }

    function handleViewportDoubleClick(e) {
        const viewport = getViewport();
        const board = getBoard();
        if (!viewport || !board) return;
        if (e.target !== viewport && e.target !== board) return;
        const p = window.clientToBoard(e.clientX, e.clientY);
        window.createImageGenNode(p.x, p.y);
    }

    async function boot() {
        try {
            await window.initDB();
            window.applyCanvasTransform({ cull: false, revealMinimap: false });
            await window.renderBoard();
            await window.renderMaterialLibrary();
            window.bindMainConsoleDrop('slot-ref-box', 'references');
            window.bindMainConsoleDrop('slot-first-box', 'firstFrame');
            window.bindMainConsoleDrop('slot-last-box', 'lastFrame');
            await window.updateBillingUI();
            window.updateEstimatedCost();
        } catch (err) {
            console.error('Main workspace initialization failed:', err);
            window.showToast('\u521d\u59cb\u5316\u5931\u8d25\uff0c\u8bf7\u5237\u65b0\u91cd\u8bd5', 'error');
        }
    }

    function bind() {
        document.addEventListener('click', handleDocumentClick);
        const viewport = getViewport();
        if (viewport) viewport.addEventListener('dblclick', handleViewportDoubleClick);
        document.addEventListener('DOMContentLoaded', boot);
    }

    const api = {
        bind,
        boot,
        handleDocumentClick,
        handleViewportDoubleClick
    };

    window.VeoAppBootstrap = api;
    bind();
})(window);

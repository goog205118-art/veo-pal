// Canvas camera, zoom, grid, and inertia engine.
(function (window) {
    'use strict';

    const CANVAS_MIN_SCALE = 0.18;
    const CANVAS_MAX_SCALE = 3.5;
    const CANVAS_GRID_BASE = 30;

    const transform = { x: window.innerWidth / 2, y: 100, scale: 1 };
    const state = {
        viewport: null,
        board: null,
        cameraAnimFrame: 0,
        inertiaFrame: 0,
        minimapAwakeTimer: 0,
        panSamples: [],
        hooks: {}
    };

    function callHook(name, ...args) {
        const fn = state.hooks && state.hooks[name];
        if (typeof fn !== 'function') return undefined;
        return fn(...args);
    }

    function finite(value, fallback = 0) {
        if (typeof window.toFiniteNumber === 'function') return window.toFiniteNumber(value, fallback);
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    }

    function configure(options = {}) {
        state.viewport = options.viewport || state.viewport;
        state.board = options.board || state.board;
        state.hooks = { ...state.hooks, ...(options.hooks || {}) };
        return api;
    }

    function clampScale(value) {
        return Math.min(CANVAS_MAX_SCALE, Math.max(CANVAS_MIN_SCALE, finite(value, 1)));
    }

    function clientToBoard(clientX, clientY) {
        const scaleSafe = (Number.isFinite(transform.scale) && transform.scale !== 0) ? transform.scale : 1;
        const rect = (state.viewport && typeof state.viewport.getBoundingClientRect === 'function')
            ? state.viewport.getBoundingClientRect()
            : { left: 0, top: 0 };
        const localX = (Number.isFinite(clientX) ? clientX : 0) - rect.left;
        const localY = (Number.isFinite(clientY) ? clientY : 0) - rect.top;
        return {
            x: (localX - transform.x) / scaleSafe,
            y: (localY - transform.y) / scaleSafe
        };
    }

    function getVisibleWorldRect(screenPadding = 80) {
        const scaleSafe = Math.max(0.1, finite(transform && transform.scale, 1));
        const viewportRect = (state.viewport && typeof state.viewport.getBoundingClientRect === 'function')
            ? state.viewport.getBoundingClientRect()
            : { width: window.innerWidth, height: window.innerHeight };
        const pad = Math.max(0, finite(screenPadding, 80));
        return {
            left: (pad - finite(transform.x, 0)) / scaleSafe,
            top: (pad - finite(transform.y, 0)) / scaleSafe,
            right: (Math.max(1, viewportRect.width) - pad - finite(transform.x, 0)) / scaleSafe,
            bottom: (Math.max(1, viewportRect.height) - pad - finite(transform.y, 0)) / scaleSafe
        };
    }

    function cancelAnimation() {
        if (state.cameraAnimFrame) {
            cancelAnimationFrame(state.cameraAnimFrame);
            state.cameraAnimFrame = 0;
        }
    }

    function cancelInertia() {
        if (state.inertiaFrame) {
            cancelAnimationFrame(state.inertiaFrame);
            state.inertiaFrame = 0;
        }
        state.panSamples = [];
    }

    function setMoving(active) {
        if (state.board) state.board.classList.toggle('is-moving', !!active);
        if (state.viewport) state.viewport.classList.toggle('is-panning', !!active);
        document.body.classList.toggle('canvas-camera-active', !!active);
        if (active) wakeMinimap(900);
    }

    function wakeMinimap(duration = 900) {
        const container = document.getElementById('minimap-container');
        if (!container || container.classList.contains('is-minimized')) return;
        container.classList.add('is-awake');
        clearTimeout(state.minimapAwakeTimer);
        state.minimapAwakeTimer = setTimeout(() => {
            container.classList.remove('is-awake');
        }, Math.max(260, duration));
    }

    function updateDynamicGrid() {
        const scaleSafe = clampScale(transform.scale);
        let gridSize = CANVAS_GRID_BASE * scaleSafe;
        while (gridSize < 18) gridSize *= 2;
        while (gridSize > 72) gridSize /= 2;
        const posX = ((finite(transform.x, 0) % gridSize) + gridSize) % gridSize;
        const posY = ((finite(transform.y, 0) % gridSize) + gridSize) % gridSize;
        document.body.style.backgroundSize = `${gridSize}px ${gridSize}px`;
        document.body.style.backgroundPosition = `${posX}px ${posY}px`;
        document.body.style.setProperty('--canvas-grid-size', `${gridSize}px`);
        document.body.style.setProperty('--canvas-grid-opacity', `${Math.max(0.08, Math.min(0.26, 0.22 - Math.abs(scaleSafe - 1) * 0.035))}`);
    }

    function applyTransform(options = {}) {
        transform.x = finite(transform.x, window.innerWidth / 2);
        transform.y = finite(transform.y, 100);
        transform.scale = clampScale(transform.scale);
        if (state.board) {
            state.board.style.transform = `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`;
        }
        updateDynamicGrid();
        callHook('syncMinimapViewport');
        callHook('updateSelectionToolbar');
        if (options.revealMinimap !== false) wakeMinimap(options.minimapDuration || 900);
        if (options.cull !== false) callHook('scheduleViewportCulling', options.cullDelay || 120);
    }

    function zoomAt(clientX, clientY, nextScale, options = {}) {
        if (!state.viewport) return;
        const rect = state.viewport.getBoundingClientRect();
        const oldScale = clampScale(transform.scale);
        const scale = clampScale(nextScale);
        if (Math.abs(scale - oldScale) < 0.0005) return;
        const mouseX = finite(clientX, rect.left + rect.width / 2) - rect.left;
        const mouseY = finite(clientY, rect.top + rect.height / 2) - rect.top;
        transform.x = mouseX - (mouseX - transform.x) * (scale / oldScale);
        transform.y = mouseY - (mouseY - transform.y) * (scale / oldScale);
        transform.scale = scale;
        applyTransform(options);
    }

    function panBy(deltaX, deltaY, options = {}) {
        transform.x += finite(deltaX, 0);
        transform.y += finite(deltaY, 0);
        applyTransform(options);
    }

    function animateTo(target, options = {}) {
        if (!target) return;
        cancelAnimation();
        cancelInertia();
        const from = { x: transform.x, y: transform.y, scale: transform.scale };
        const to = {
            x: finite(target.x, from.x),
            y: finite(target.y, from.y),
            scale: clampScale(target.scale !== undefined ? target.scale : from.scale)
        };
        const duration = Math.max(120, finite(options.duration, 420));
        const start = performance.now();
        setMoving(true);
        const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
        const step = (now) => {
            const p = Math.min(1, (now - start) / duration);
            const eased = easeOutCubic(p);
            transform.x = from.x + (to.x - from.x) * eased;
            transform.y = from.y + (to.y - from.y) * eased;
            transform.scale = from.scale + (to.scale - from.scale) * eased;
            applyTransform({ cull: false, minimapDuration: 900 });
            if (p < 1) {
                state.cameraAnimFrame = requestAnimationFrame(step);
            } else {
                state.cameraAnimFrame = 0;
                setMoving(false);
                callHook('scheduleViewportCulling', 40);
                callHook('renderMinimap');
            }
        };
        state.cameraAnimFrame = requestAnimationFrame(step);
    }

    function recordPanSample(clientX, clientY) {
        const now = performance.now();
        state.panSamples.push({ x: finite(clientX, 0), y: finite(clientY, 0), t: now });
        state.panSamples = state.panSamples.filter((sample) => now - sample.t <= 120);
    }

    function startInertia() {
        if (state.panSamples.length < 2) {
            callHook('scheduleViewportCulling', 60);
            return;
        }
        const last = state.panSamples[state.panSamples.length - 1];
        let first = state.panSamples[0];
        for (let i = state.panSamples.length - 2; i >= 0; i--) {
            if (last.t - state.panSamples[i].t >= 48) {
                first = state.panSamples[i];
                break;
            }
        }
        const dt = Math.max(16, last.t - first.t);
        let velocityX = (last.x - first.x) / dt;
        let velocityY = (last.y - first.y) / dt;
        const speed = Math.hypot(velocityX, velocityY);
        state.panSamples = [];
        if (speed < 0.05) {
            callHook('scheduleViewportCulling', 60);
            return;
        }
        let prev = performance.now();
        setMoving(true);
        const decayPerFrame = 0.91;
        const step = (now) => {
            const delta = Math.min(34, Math.max(8, now - prev));
            prev = now;
            transform.x += velocityX * delta;
            transform.y += velocityY * delta;
            velocityX *= Math.pow(decayPerFrame, delta / 16.67);
            velocityY *= Math.pow(decayPerFrame, delta / 16.67);
            applyTransform({ cull: false, minimapDuration: 700 });
            if (Math.hypot(velocityX, velocityY) > 0.018) {
                state.inertiaFrame = requestAnimationFrame(step);
            } else {
                state.inertiaFrame = 0;
                setMoving(false);
                callHook('scheduleViewportCulling', 40);
                callHook('renderMinimap');
            }
        };
        state.inertiaFrame = requestAnimationFrame(step);
    }

    const api = {
        transform,
        configure,
        clampScale,
        clientToBoard,
        getVisibleWorldRect,
        cancelAnimation,
        cancelInertia,
        setMoving,
        wakeMinimap,
        updateDynamicGrid,
        applyTransform,
        zoomAt,
        panBy,
        animateTo,
        recordPanSample,
        startInertia
    };

    window.VeoCanvasCamera = api;
})(window);

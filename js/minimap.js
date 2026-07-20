// Canvas minimap rendering and viewport jump controls.
(function (window) {
    'use strict';

    const state = {
        transform: { x: 0, y: 0, scale: 1 },
        mapMeta: { minX: 0, minY: 0, mapScale: 0, offsetX: 0, offsetY: 0 },
        hooks: {}
    };

    function configure(options = {}) {
        state.transform = options.transform || state.transform;
        state.hooks = { ...state.hooks, ...(options.hooks || {}) };
        return api;
    }

    function callHook(name, ...args) {
        const fn = state.hooks && state.hooks[name];
        if (typeof fn !== 'function') return undefined;
        return fn(...args);
    }

    function isRetiredTask(task) {
        const retiredTypes = callHook('getRetiredNodeTypes');
        return !!(task && retiredTypes && typeof retiredTypes.has === 'function' && retiredTypes.has(task.type));
    }

    function isBoardTask(task) {
        return !!(task && task.type !== 'local_image' && !isRetiredTask(task));
    }

    function getTaskWidth(task) {
        return Number.isFinite(Number(task && task.width)) ? Number(task.width) : 340;
    }

    function getTaskHeight(task) {
        return Number.isFinite(Number(task && task.height)) ? Number(task.height) : 400;
    }

    function syncViewport() {
        const viewBox = document.getElementById('minimap-viewport-box');
        if (!viewBox) return;
        const meta = state.mapMeta;
        if (!meta || !Number.isFinite(meta.mapScale) || meta.mapScale <= 0) {
            viewBox.style.display = 'none';
            return;
        }
        const scaleSafe = Number.isFinite(state.transform.scale) && state.transform.scale !== 0 ? state.transform.scale : 1;
        const viewMinX = -state.transform.x / scaleSafe;
        const viewMinY = -state.transform.y / scaleSafe;
        const vPx = meta.offsetX + (viewMinX - meta.minX) * meta.mapScale;
        const vPy = meta.offsetY + (viewMinY - meta.minY) * meta.mapScale;
        const vPw = (window.innerWidth / scaleSafe) * meta.mapScale;
        const vPh = (window.innerHeight / scaleSafe) * meta.mapScale;
        viewBox.style.display = 'block';
        viewBox.style.left = `${vPx}px`;
        viewBox.style.top = `${vPy}px`;
        viewBox.style.width = `${vPw}px`;
        viewBox.style.height = `${vPh}px`;
    }

    async function render() {
        const container = document.getElementById('minimap-container');
        if (!container || container.classList.contains('is-minimized')) return;

        const canvas = document.getElementById('minimap-canvas');
        const viewBox = document.getElementById('minimap-viewport-box');
        if (!canvas || !viewBox) return;
        const ctx = canvas.getContext('2d');
        const cw = container.clientWidth;
        const ch = container.clientHeight;
        canvas.width = cw;
        canvas.height = ch;

        const allTasks = await callHook('getAllTasks');
        const boardTasks = Array.isArray(allTasks) ? allTasks.filter(isBoardTask) : [];
        if (boardTasks.length === 0) {
            ctx.clearRect(0, 0, cw, ch);
            viewBox.style.display = 'none';
            return;
        }

        let minX = Math.min(...boardTasks.map((task) => task.x));
        let maxX = Math.max(...boardTasks.map((task) => task.x + getTaskWidth(task)));
        let minY = Math.min(...boardTasks.map((task) => task.y));
        let maxY = Math.max(...boardTasks.map((task) => task.y + getTaskHeight(task)));

        const scaleSafe = Number.isFinite(state.transform.scale) && state.transform.scale !== 0 ? state.transform.scale : 1;
        const viewMinX = -state.transform.x / scaleSafe;
        const viewMaxX = viewMinX + window.innerWidth / scaleSafe;
        const viewMinY = -state.transform.y / scaleSafe;
        const viewMaxY = viewMinY + window.innerHeight / scaleSafe;

        minX = Math.min(minX, viewMinX);
        maxX = Math.max(maxX, viewMaxX);
        minY = Math.min(minY, viewMinY);
        maxY = Math.max(maxY, viewMaxY);
        const padding = 800;
        minX -= padding;
        maxX += padding;
        minY -= padding;
        maxY += padding;

        const mapWidth = Math.max(1, maxX - minX);
        const mapHeight = Math.max(1, maxY - minY);
        const scaleX = cw / mapWidth;
        const scaleY = ch / mapHeight;
        const mapScale = Math.min(scaleX, scaleY);
        const offsetX = (cw - mapWidth * mapScale) / 2;
        const offsetY = (ch - mapHeight * mapScale) / 2;
        state.mapMeta = { minX, minY, mapScale, offsetX, offsetY };

        ctx.clearRect(0, 0, cw, ch);
        boardTasks.forEach((task) => {
            const px = offsetX + (task.x - minX) * mapScale;
            const py = offsetY + (task.y - minY) * mapScale;
            const pw = getTaskWidth(task) * mapScale;
            const ph = getTaskHeight(task) * mapScale;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(px, py, pw, Math.max(ph, 5), 3);
            else ctx.rect(px, py, pw, Math.max(ph, 5));
            ctx.fillStyle = task.type === 'tool_image_gen' ? 'rgba(10, 132, 255, 0.8)' : 'rgba(255, 255, 255, 0.3)';
            ctx.fill();
        });
        syncViewport();
    }

    function handleClick(event) {
        const container = document.getElementById('minimap-container');
        if (!container || container.classList.contains('is-minimized')) return;
        const meta = state.mapMeta;
        if (!meta || !Number.isFinite(meta.mapScale) || meta.mapScale <= 0) return;

        const rect = container.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;
        const targetWorldX = (clickX - meta.offsetX) / meta.mapScale + meta.minX;
        const targetWorldY = (clickY - meta.offsetY) / meta.mapScale + meta.minY;
        callHook('animateCameraTo', {
            x: -targetWorldX * state.transform.scale + window.innerWidth / 2,
            y: -targetWorldY * state.transform.scale + window.innerHeight / 2,
            scale: state.transform.scale
        }, { duration: 420 });
    }

    const api = {
        configure,
        render,
        syncViewport,
        handleClick,
        getMapMeta: () => ({ ...state.mapMeta })
    };

    window.VeoMinimap = api;
})(window);

// Image-generation stage rail for docking active image cards off the canvas.
(function (window) {
    'use strict';

    const DOCK_MIN_TRAVEL = 96;
    const state = {
        hooks: {},
        collapsed: false,
        renderTimer: null,
        activeTaskId: '',
        fingerprint: ''
    };

    try {
        state.collapsed = window.localStorage.getItem('veo_img_gen_stage_collapsed') === '1';
    } catch (err) {
        state.collapsed = false;
    }

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
        const converted = callHook('toFiniteNumber', value, fallback);
        if (Number.isFinite(converted)) return converted;
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function escapeAttr(value) {
        return escapeHtml(value).replace(/`/g, '&#96;');
    }

    function ensureImageState(task) {
        if (task && task.type === 'tool_image_gen') callHook('ensureImageState', task);
        return task;
    }

    function isDocked(task) {
        if (!task || task.type !== 'tool_image_gen') return false;
        ensureImageState(task);
        return !!(task.state && task.state.stageDocked === true);
    }

    function mergeTask(task) {
        if (!task || task.type !== 'tool_image_gen') return task;
        const shadow = task.id ? callHook('getTaskShadow', task.id) : null;
        const protectedIds = task.id ? callHook('getProtectedPreviewIds', task.id) : undefined;
        const merged = callHook('mergeImageTaskWithShadow', task, shadow, { protectedIds }) || task;
        ensureImageState(merged);
        return merged;
    }

    function getPendingCount(task) {
        const hooked = callHook('getPendingCount', task);
        if (Number.isFinite(hooked)) return hooked;
        if (typeof window.getImgGenPendingCount === 'function') return window.getImgGenPendingCount(task);
        return task && task.status === 'processing' ? 1 : 0;
    }

    function getStatus(task) {
        if (!task || task.type !== 'tool_image_gen') return 'idle';
        ensureImageState(task);
        if (getPendingCount(task) > 0 || task.status === 'processing') return 'pending';
        if (task.status === 'failed') return 'failed';
        const history = Array.isArray(task.state && task.state.previewHistory) ? task.state.previewHistory : [];
        if (history.some((item) => item && item.status === 'success')) return 'success';
        return task.status === 'success' ? 'success' : 'idle';
    }

    function getThumb(task) {
        if (!task || task.type !== 'tool_image_gen') return null;
        ensureImageState(task);
        const history = Array.isArray(task.state && task.state.previewHistory) ? task.state.previewHistory : [];
        const latest = history.slice().reverse().find((item) => item && item.status === 'success' && item.image);
        if (latest && latest.image) return latest.image;
        if (task.state.resultBlob) return task.state.resultBlob;
        if (Array.isArray(task.state.resultBlobs) && task.state.resultBlobs.length) {
            return task.state.resultBlobs[task.state.resultBlobs.length - 1];
        }
        if (Array.isArray(task.state.images) && task.state.images[0]) return task.state.images[0];
        return null;
    }

    function getThumbVersion(task) {
        if (!task || !task.state) return '0';
        const history = Array.isArray(task.state.previewHistory) ? task.state.previewHistory : [];
        const latest = history.slice().reverse().find((item) => item && item.status === 'success' && item.image);
        if (latest) return latest.id || latest.createdAt || task.timestamp || 'result';
        if (task.state.resultBlob) return `result_${task.timestamp || 0}`;
        if (Array.isArray(task.state.resultBlobs) && task.state.resultBlobs.length) return `results_${task.state.resultBlobs.length}_${task.timestamp || 0}`;
        if (Array.isArray(task.state.images) && task.state.images[0]) return `base_${task.state.images.length}_${task.timestamp || 0}`;
        return 'empty';
    }

    function buildDefaultLabel(task, index = 0) {
        const rawTitle = String((task && (task.title || task.prompt || (task.state && task.state.prompt))) || '')
            .replace(/\s+/g, ' ')
            .trim();
        if (rawTitle) return rawTitle.length > 14 ? rawTitle.slice(0, 14) : rawTitle;
        const suffix = String(task && task.id ? task.id : '').replace(/[^a-z0-9]/gi, '').slice(-4).toUpperCase();
        return suffix ? `STG-${suffix}` : `STG-${String(index + 1).padStart(2, '0')}`;
    }

    function getIdentity(task, index = 0) {
        ensureImageState(task);
        const custom = String((task && task.state && task.state.stageLabel) || '').replace(/\s+/g, ' ').trim();
        return custom || buildDefaultLabel(task, index);
    }

    function getTitle(task, index = 0) {
        const identity = getIdentity(task, index);
        if (identity) return identity.length > 18 ? `${identity.slice(0, 18)}...` : identity;
        const fallback = `Image ${index + 1}`;
        const prompt = String((task && task.state && task.state.prompt) || '').replace(/\s+/g, ' ').trim();
        if (!prompt) return fallback;
        return prompt.length > 18 ? `${prompt.slice(0, 18)}...` : prompt;
    }

    function getMeta(task) {
        if (!task || task.type !== 'tool_image_gen') return 'IMAGE';
        ensureImageState(task);
        const mode = task.state.version === 'pro' ? 'PRO' : 'STABLE';
        const ratio = task.state.proRatio === 'custom'
            ? `${task.state.customW || 1}:${task.state.customH || 1}`
            : (task.state.proRatio || '1:1');
        return `${mode} / ${ratio} / ${getStatus(task).toUpperCase()}`;
    }

    function renderItem(task, index, activeId) {
        const status = getStatus(task);
        const thumb = getThumb(task);
        const thumbKey = `img_stage_${task.id}_${getThumbVersion(task)}`;
        const thumbUrl = thumb ? (callHook('getBlobUrl', thumbKey, thumb) || '') : '';
        const isActive = activeId === task.id || !!callHook('isTaskSelected', task.id);
        const title = getTitle(task, index);
        const identity = getIdentity(task, index);
        const thumbHtml = thumbUrl
            ? `<img src="${escapeAttr(thumbUrl)}" alt="${escapeAttr(title)}" loading="lazy">`
            : '<span class="material-symbols-outlined">auto_awesome</span>';

        return `
            <button class="img-gen-stage-item is-${status} ${isActive ? 'is-active' : ''}" type="button" onclick="focusImgGenStageCard(event, '${escapeAttr(task.id)}')" onmousedown="event.stopPropagation()" data-tip="释放到画布：${escapeAttr(title)}">
                <span class="img-gen-stage-dot"></span>
                <span class="img-gen-stage-thumb">${thumbHtml}</span>
                <span class="img-gen-stage-meta">
                    <strong>${escapeHtml(identity)}</strong>
                    <em>${escapeHtml(getMeta(task))}</em>
                </span>
                <span class="img-gen-stage-edit" onclick="renameImgGenStageLabel(event, '${escapeAttr(task.id)}')" data-tip="编辑识别符">
                    <span class="material-symbols-outlined">edit</span>
                </span>
            </button>
        `;
    }

    function isPointInRail(clientX, clientY) {
        const rail = document.getElementById('img-gen-stage-rail');
        if (!rail || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;
        const rect = rail.getBoundingClientRect();
        return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    }

    function isPointInDockZone(clientX, clientY) {
        const rail = document.getElementById('img-gen-stage-rail');
        if (!rail || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;
        const rect = rail.getBoundingClientRect();
        const expandedLeft = Math.max(0, rect.left - 24);
        const expandedRight = rect.right + 18;
        const expandedTop = Math.max(0, rect.top + 16);
        const expandedBottom = rect.bottom - 16;
        return clientX >= expandedLeft && clientX <= expandedRight && clientY >= expandedTop && clientY <= expandedBottom;
    }

    function isPointNearRail(clientX, clientY) {
        const rail = document.getElementById('img-gen-stage-rail');
        if (!rail || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;
        const rect = rail.getBoundingClientRect();
        return clientX >= rect.left - 96 && clientX <= rect.right + 12 && clientY >= rect.top - 24 && clientY <= rect.bottom + 24;
    }

    function canDockDrag(dragInfo, clientX, clientY) {
        const travel = dragInfo
            ? Math.hypot(
                toFiniteNumber(clientX, dragInfo.startMouseX) - toFiniteNumber(dragInfo.startMouseX, clientX),
                toFiniteNumber(clientY, dragInfo.startMouseY) - toFiniteNumber(dragInfo.startMouseY, clientY)
            )
            : 0;
        return !!(
            dragInfo &&
            dragInfo.fromCanvasCard === true &&
            dragInfo.startedInsideStageRail !== true &&
            dragInfo.startedNearStageRail !== true &&
            dragInfo.justCreated !== true &&
            !dragInfo.children &&
            dragInfo.task &&
            dragInfo.task.type === 'tool_image_gen' &&
            !isDocked(dragInfo.task) &&
            travel >= DOCK_MIN_TRAVEL &&
            isPointInDockZone(clientX, clientY)
        );
    }

    function getFingerprint(tasks, activeId) {
        return [
            state.collapsed ? '1' : '0',
            activeId || '',
            tasks.map((task) => {
                const taskState = task && task.state ? task.state : {};
                return [
                    task.id,
                    task.status || 'static',
                    task.timestamp || 0,
                    getPendingCount(task),
                    Array.isArray(taskState.previewHistory) ? taskState.previewHistory.length : 0,
                    taskState.stageLabel || '',
                    getThumbVersion(task)
                ].join(':');
            }).join('|')
        ].join('::');
    }

    async function render(tasksArg = null) {
        const rail = document.getElementById('img-gen-stage-rail');
        const listEl = document.getElementById('img-gen-stage-list');
        const countEl = document.getElementById('img-gen-stage-count');
        if (!rail || !listEl) return;

        const rawTasks = Array.isArray(tasksArg) ? tasksArg : await callHook('getAllTasks');
        const imgTasks = (Array.isArray(rawTasks) ? rawTasks : [])
            .filter((task) => task && task.type === 'tool_image_gen')
            .map(mergeTask)
            .filter((task) => task && isDocked(task))
            .sort((a, b) => {
                if (a.id === state.activeTaskId) return -1;
                if (b.id === state.activeTaskId) return 1;
                return toFiniteNumber(b.timestamp, 0) - toFiniteNumber(a.timestamp, 0);
            });

        const selectedId = (callHook('getSelectedTaskIds') || []).find((id) => imgTasks.some((task) => task.id === id));
        const activeId = state.activeTaskId || selectedId || '';
        const nextFingerprint = getFingerprint(imgTasks, activeId);
        rail.classList.toggle('is-collapsed', state.collapsed);
        rail.classList.toggle('is-empty', imgTasks.length === 0);
        if (nextFingerprint === state.fingerprint) return;
        state.fingerprint = nextFingerprint;

        if (countEl) countEl.textContent = String(imgTasks.length);
        if (imgTasks.length === 0) {
            listEl.innerHTML = `
                <div class="img-gen-stage-empty">
                    <span class="material-symbols-outlined">add_photo_alternate</span>
                    <span>把生图卡片拖到这里，暂存进台前调度</span>
                </div>
            `;
            return;
        }
        listEl.innerHTML = imgTasks.map((task, index) => renderItem(task, index, activeId)).join('');
    }

    function scheduleRender(delay = 80) {
        clearTimeout(state.renderTimer);
        state.renderTimer = setTimeout(() => {
            render().catch((err) => console.warn('Image stage rail render failed:', err));
        }, Math.max(0, delay));
    }

    function setDragOver(isOver) {
        const rail = document.getElementById('img-gen-stage-rail');
        if (rail) rail.classList.toggle('is-drag-over', !!isOver);
    }

    async function rename(event, taskId) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
        }
        if (!taskId) return;
        const task = callHook('getTaskShadow', taskId) || await callHook('getTask', taskId);
        if (!task || task.type !== 'tool_image_gen') return;
        ensureImageState(task);
        const current = getIdentity(task, 0);
        const nextRaw = window.prompt('输入调度识别符', current);
        if (nextRaw === null) return;
        const next = String(nextRaw).replace(/\s+/g, ' ').trim().slice(0, 24);
        task.state.stageLabel = next || buildDefaultLabel(task, 0);
        task.state.stageLabelCustom = !!next;
        task.timestamp = Date.now();
        callHook('setTaskShadow', task);
        state.fingerprint = '';
        await callHook('saveTask', task);
        await render();
        callHook('showToast', '识别符已更新', 'success');
    }

    function centerTaskInViewport(task) {
        const rect = callHook('getViewportRect') || { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
        const center = callHook('clientToBoard', rect.left + rect.width / 2, rect.top + rect.height / 2) || { x: 0, y: 0 };
        const fallback = callHook('getTaskFallbackSize', task) || { width: 360, height: 520 };
        const width = Math.max(1, toFiniteNumber(fallback.width, 360));
        const height = Math.max(1, toFiniteNumber(fallback.height, 520));
        task.x = Math.round(center.x - width / 2);
        task.y = Math.round(center.y - height / 2);
    }

    async function focus(event, taskId) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        if (!taskId) return;
        const stored = callHook('getTaskShadow', taskId) || await callHook('getTask', taskId);
        const task = mergeTask(stored);
        if (!task || task.type !== 'tool_image_gen') return;
        task.state.stageDocked = false;
        task.state.stageReleased = true;
        task.timestamp = Date.now();
        centerTaskInViewport(task);
        state.activeTaskId = task.id;
        state.fingerprint = '';
        callHook('setTaskShadow', task);
        await callHook('saveTask', task);
        await callHook('renderBoard');
        window.requestAnimationFrame(() => {
            const cardEl = callHook('getTaskElement', task.id);
            if (!cardEl) return;
            callHook('clearSelection');
            callHook('selectTask', task.id, cardEl);
            cardEl.classList.add('is-stage-spawning', 'is-stage-focused');
            cardEl.classList.remove('is-viewport-culled', 'is-stage-docked');
            cardEl.style.zIndex = callHook('nextZIndex');
            setTimeout(() => cardEl.classList.remove('is-stage-spawning', 'is-stage-focused'), 900);
            callHook('scheduleViewportCulling', 40);
            callHook('updateSelectionToolbar');
        });
        callHook('showToast', '已释放到当前画布视口', 'success');
    }

    async function dockDraggedTask(dragInfo) {
        if (!dragInfo || !dragInfo.task || dragInfo.task.type !== 'tool_image_gen') return false;
        const task = dragInfo.task;
        ensureImageState(task);
        task.state.stageDocked = true;
        task.state.stageReleased = false;
        task.timestamp = Date.now();
        state.activeTaskId = task.id;
        state.fingerprint = '';
        callHook('setTaskShadow', task);
        await callHook('saveTask', task);
        callHook('clearSelection');
        if (dragInfo.el && typeof dragInfo.el.remove === 'function') dragInfo.el.remove();
        await render();
        callHook('renderMinimap');
        callHook('scheduleViewportCulling', 40);
        callHook('updateSelectionToolbar');
        callHook('showToast', '已收纳到生图台前调度', 'success');
        return true;
    }

    function toggle(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        state.collapsed = !state.collapsed;
        try {
            window.localStorage.setItem('veo_img_gen_stage_collapsed', state.collapsed ? '1' : '0');
        } catch (err) {}
        state.fingerprint = '';
        render().catch(() => {});
    }

    function clearActiveTask(taskId) {
        if (!taskId || taskId === state.activeTaskId) state.activeTaskId = '';
        state.fingerprint = '';
        scheduleRender(40);
    }

    const api = {
        canDockDrag,
        clearActiveTask,
        configure,
        dockDraggedTask,
        focus,
        isDocked,
        isPointInRail,
        isPointNearRail,
        render,
        rename,
        scheduleRender,
        setDragOver,
        toggle
    };

    window.VeoImageStage = api;
})(window);

// Canvas task context menu and reusable-image actions.
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

    function getTaskReusableImage(task) {
        if (!task || typeof task !== 'object') return null;
        if (task.type === 'local_image') return task.src || null;
        if (task.type === 'tool_image_gen') {
            callHook('ensureImageState', task);
            const history = Array.isArray(task.state && task.state.previewHistory) ? task.state.previewHistory : [];
            const latest = history.slice().reverse().find((item) => item && item.status === 'success' && item.image);
            return latest ? latest.image : (task.state && (task.state.resultBlob || (Array.isArray(task.state.images) ? task.state.images[0] : null))) || null;
        }
        if (task.rawImages) {
            return task.rawImages.firstFrame || (Array.isArray(task.rawImages.references) ? task.rawImages.references[0] : null) || task.rawImages.lastFrame || null;
        }
        return null;
    }

    async function getLiveTask(taskId) {
        const element = callHook('getTaskElement', taskId);
        if (element && element.__veoTask) return element.__veoTask;
        return callHook('getTaskShadow', taskId) || await callHook('getTask', taskId);
    }

    async function sendTaskImageToConsole(taskId, target) {
        const task = await getLiveTask(taskId);
        const image = getTaskReusableImage(task);
        if (!image) {
            callHook('showToast', '该卡片没有可复用图片', 'warning');
            return false;
        }
        if (target === 'lastFrame') {
            callHook('setConsoleFrameImage', 'lastFrame', image);
            callHook('showToast', '已作为尾帧送入 Veo 控制台', 'success');
            return true;
        }
        if (target === 'reference') {
            if (callHook('addConsoleReferenceImage', image)) {
                callHook('showToast', '已作为参考图送入 Veo 控制台', 'success');
                return true;
            }
            return false;
        }
        callHook('setConsoleFrameImage', 'firstFrame', image);
        callHook('showToast', '已作为首帧送入 Veo 控制台', 'success');
        return true;
    }

    function close() {
        const menu = document.getElementById('canvas-card-context-menu');
        if (menu) menu.remove();
    }

    function menuButton(action, icon, label, extraClass = '') {
        const classAttr = extraClass ? ` class="${extraClass}"` : '';
        return `<button type="button" data-action="${action}"${classAttr}><span class="material-symbols-outlined">${icon}</span>${label}</button>`;
    }

    function open(event, taskId) {
        if (!taskId) return;
        event.preventDefault();
        event.stopPropagation();
        close();
        const task = callHook('getTaskElement', taskId)?.__veoTask || callHook('getTaskShadow', taskId);
        const hasImage = !!getTaskReusableImage(task);
        const menu = document.createElement('div');
        menu.id = 'canvas-card-context-menu';
        menu.className = 'canvas-card-context-menu';
        menu.innerHTML = [
            menuButton('focus', 'center_focus_strong', '聚焦卡片'),
            menuButton('duplicate', 'content_copy', '复制卡片'),
            hasImage ? '<div class="context-menu-divider"></div>' : '',
            hasImage ? menuButton('first', 'first_page', '作为首帧发送至 Veo') : '',
            hasImage ? menuButton('last', 'last_page', '作为尾帧发送至 Veo') : '',
            hasImage ? menuButton('ref', 'add_photo_alternate', '作为参考图发送至 Veo') : '',
            '<div class="context-menu-divider"></div>',
            menuButton('delete', 'delete', '删除卡片', 'danger')
        ].join('');
        menu.style.left = `${Math.min(window.innerWidth - 230, Math.max(12, event.clientX))}px`;
        menu.style.top = `${Math.min(window.innerHeight - 280, Math.max(12, event.clientY))}px`;
        menu.addEventListener('mousedown', (innerEvent) => innerEvent.stopPropagation());
        menu.addEventListener('click', async (innerEvent) => {
            const button = innerEvent.target.closest('button[data-action]');
            if (!button) return;
            innerEvent.preventDefault();
            innerEvent.stopPropagation();
            const action = button.dataset.action;
            close();
            if (action === 'focus') callHook('focusTask', taskId);
            if (action === 'duplicate') await callHook('duplicateTask', taskId);
            if (action === 'first') await sendTaskImageToConsole(taskId, 'firstFrame');
            if (action === 'last') await sendTaskImageToConsole(taskId, 'lastFrame');
            if (action === 'ref') await sendTaskImageToConsole(taskId, 'reference');
            if (action === 'delete') await callHook('removeTask', taskId);
        });
        document.body.appendChild(menu);
    }

    function bindGlobalClose(target = window) {
        target.addEventListener('click', close);
        target.addEventListener('blur', close);
    }

    const api = {
        bindGlobalClose,
        close,
        configure,
        getTaskReusableImage,
        open,
        sendTaskImageToConsole
    };

    window.VeoCanvasContextMenu = api;
})(window);

// Runtime task shadow cache and prompt draft persistence.
(function (window) {
    'use strict';

    const taskShadowCache = new Map();
    const imgGenPromptDraftTimers = new Map();

    function setTaskShadow(task) {
        if (!task || !task.id) return;
        taskShadowCache.set(task.id, task);
        const cardEl = document.getElementById('card-' + task.id);
        if (cardEl) cardEl.__veoTask = task;
    }

    function getTaskShadow(taskId) {
        if (!taskId) return null;
        const cardEl = document.getElementById('card-' + taskId);
        if (cardEl && cardEl.__veoTask) return cardEl.__veoTask;
        return taskShadowCache.get(taskId) || null;
    }

    function clearTaskShadow(taskId) {
        if (!taskId) return;
        taskShadowCache.delete(taskId);
    }

    function scheduleImgGenPromptPersist(taskId, value) {
        if (!taskId) return;
        const prevTimer = imgGenPromptDraftTimers.get(taskId);
        if (prevTimer) clearTimeout(prevTimer);
        const promptValue = typeof value === 'string' ? value : String(value || '');
        const timer = setTimeout(() => {
            imgGenPromptDraftTimers.delete(taskId);
            window.queueImgGenTaskUpdate(taskId, async () => {
                const baseTask = getTaskShadow(taskId) || await window.getTaskDB(taskId);
                if (!baseTask) return;
                const task = window.cloneTaskDeep(baseTask) || { ...baseTask };
                window.ensureImgGenState(task);
                task.state.prompt = promptValue;
                task.timestamp = Date.now();
                setTaskShadow(task);
                await window.saveTaskDB(task);
            }).catch(() => {});
        }, 360);
        imgGenPromptDraftTimers.set(taskId, timer);
    }

    function updateImgGenPromptDraft(taskId, value) {
        if (!taskId) return;
        const promptValue = String(value ?? '');
        const task = getTaskShadow(taskId);
        if (task && task.type === 'tool_image_gen') {
            window.ensureImgGenState(task);
            task.state.prompt = promptValue;
            task.timestamp = Date.now();
            setTaskShadow(task);
        }
        scheduleImgGenPromptPersist(taskId, promptValue);
    }

    function clearImgGenPromptDraftTimer(taskId) {
        const timer = imgGenPromptDraftTimers.get(taskId);
        if (timer) clearTimeout(timer);
        imgGenPromptDraftTimers.delete(taskId);
    }

    const api = {
        setTaskShadow,
        getTaskShadow,
        clearTaskShadow,
        scheduleImgGenPromptPersist,
        updateImgGenPromptDraft,
        clearImgGenPromptDraftTimer
    };

    window.VeoTaskCache = api;
    Object.keys(api).forEach((key) => {
        window[key] = api[key];
    });
})(window);

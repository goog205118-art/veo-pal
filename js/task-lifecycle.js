// Task deletion and runtime cleanup orchestration.
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

    function getSelectedTaskIds() {
        const ids = callHook('getSelectedTaskIds');
        return Array.isArray(ids) ? ids.filter(Boolean) : [];
    }

    function confirmDeleteSelected(count) {
        const customConfirm = callHook('confirmDeleteSelected', count);
        if (typeof customConfirm === 'boolean') return customConfirm;
        return window.confirm(`🗑️ 确定要彻底删除选中的 ${count} 个对象吗？(若包含项目组，内部卡片也会连锅端！)`);
    }

    function confirmRemoveTask() {
        const customConfirm = callHook('confirmRemoveTask');
        if (typeof customConfirm === 'boolean') return customConfirm;
        return window.confirm('确定删除这张卡片吗？');
    }

    function collectDirectChildIds(allTasks, parentIds) {
        const parentSet = new Set(parentIds);
        return (Array.isArray(allTasks) ? allTasks : [])
            .filter((task) => task && parentSet.has(task.parentId) && task.id)
            .map((task) => task.id);
    }

    function cleanupTaskRuntime(taskId) {
        if (!taskId) return;
        callHook('clearVideoPolling', taskId);
        callHook('clearImagePolling', taskId);
        callHook('clearPromptDraft', taskId);
        callHook('clearImageRuntime', taskId);
        callHook('destroyMaskStudio', taskId);
        callHook('destroyMaskEditor', taskId);
        callHook('clearTaskShadow', taskId);
    }

    async function deleteTaskAndCard(taskId) {
        if (!taskId) return;
        cleanupTaskRuntime(taskId);
        await callHook('deleteTask', taskId);
        callHook('removeCard', taskId);
        callHook('deselectTask', taskId);
    }

    function refreshAfterDelete(options = {}) {
        if (options.clearSelection) callHook('clearSelection');
        callHook('updateSelectionToolbar');
        callHook('scheduleViewportCulling', 40);
        callHook('renderMinimap');
    }

    async function deleteSelectedTasks() {
        const ids = getSelectedTaskIds();
        if (ids.length === 0) return;
        if (!confirmDeleteSelected(ids.length)) return;

        const allTasks = await callHook('getAllTasks');
        const idsToDelete = new Set([...ids, ...collectDirectChildIds(allTasks, ids)]);
        await Promise.all(Array.from(idsToDelete).map((id) => deleteTaskAndCard(id)));
        refreshAfterDelete({ clearSelection: true });
        callHook('showToast', '清理完成', 'success');
    }

    async function removeTask(taskId) {
        if (!taskId) return;
        if (!confirmRemoveTask()) return;
        await deleteTaskAndCard(taskId);
        refreshAfterDelete();
    }

    const api = {
        cleanupTaskRuntime,
        configure,
        deleteSelectedTasks,
        deleteTaskAndCard,
        removeTask
    };

    window.VeoTaskLifecycle = api;
})(window);

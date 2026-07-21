// Migration guards for retired task data from older workspace files.
(function (window) {
    'use strict';

    const retiredNodeTypes = new Set(['frame', 'note', 'tool_generator', 'tool_cropper']);

    function getRetiredNodeTypes() {
        return retiredNodeTypes;
    }

    function isRetiredTaskType(taskType) {
        return retiredNodeTypes.has(taskType);
    }

    function filterActiveTasks(tasks = []) {
        return (Array.isArray(tasks) ? tasks : []).filter((task) => !isRetiredTaskType(task && task.type));
    }

    window.VeoMigrationGuards = {
        filterActiveTasks,
        getRetiredNodeTypes,
        isRetiredTaskType
    };
})(window);

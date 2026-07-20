// Workspace import/export for .veo project files.
(function (window) {
    'use strict';

    const EXPORT_BLOB_OPTIONS = { mode: 'network', maxBytes: 10 * 1024 * 1024, maxEdge: 2048 };
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

    function isRetiredTask(task) {
        const retiredTypes = callHook('getRetiredNodeTypes');
        return !!(task && retiredTypes && typeof retiredTypes.has === 'function' && retiredTypes.has(task.type));
    }

    async function encodeBlobField(value) {
        if (!value) return value;
        const encoded = await callHook('blobToBase64', value, EXPORT_BLOB_OPTIONS);
        return encoded || value;
    }

    async function encodeBlobList(values) {
        if (!Array.isArray(values)) return values;
        const encoded = await callHook('blobsToBase64Sequential', values, EXPORT_BLOB_OPTIONS);
        return Array.isArray(encoded) ? encoded : values;
    }

    async function decodeBlobField(value) {
        if (typeof value !== 'string') return value;
        return fetch(value).then((response) => response.blob());
    }

    async function decodeBlobList(values) {
        if (!Array.isArray(values)) return values;
        return Promise.all(values.map((item) => decodeBlobField(item)));
    }

    async function serializeTask(task) {
        const clone = { ...task };
        if (clone.type === 'local_image' && clone.src) clone.src = await encodeBlobField(clone.src);
        if (clone.state) {
            clone.state = { ...clone.state };
            if (clone.state.images) clone.state.images = await encodeBlobList(clone.state.images);
            if (Array.isArray(clone.state.resultBlobs)) clone.state.resultBlobs = await encodeBlobList(clone.state.resultBlobs);
            if (clone.state.resultBlob) clone.state.resultBlob = await encodeBlobField(clone.state.resultBlob);
            if (clone.state.sourceBlob) clone.state.sourceBlob = await encodeBlobField(clone.state.sourceBlob);
        }
        if (clone.rawImages) {
            clone.rawImages = { ...clone.rawImages };
            if (clone.rawImages.firstFrame) clone.rawImages.firstFrame = await encodeBlobField(clone.rawImages.firstFrame);
            if (clone.rawImages.lastFrame) clone.rawImages.lastFrame = await encodeBlobField(clone.rawImages.lastFrame);
            if (clone.rawImages.references) clone.rawImages.references = await encodeBlobList(clone.rawImages.references);
        }
        return clone;
    }

    async function deserializeTask(task) {
        const clone = { ...task };
        if (clone.type === 'local_image' && typeof clone.src === 'string') clone.src = await decodeBlobField(clone.src);
        if (clone.state) {
            clone.state = { ...clone.state };
            if (clone.state.images) clone.state.images = await decodeBlobList(clone.state.images);
            if (Array.isArray(clone.state.resultBlobs)) clone.state.resultBlobs = await decodeBlobList(clone.state.resultBlobs);
            if (clone.state.resultBlob && typeof clone.state.resultBlob === 'string') clone.state.resultBlob = await decodeBlobField(clone.state.resultBlob);
            if (clone.state.sourceBlob && typeof clone.state.sourceBlob === 'string') clone.state.sourceBlob = await decodeBlobField(clone.state.sourceBlob);
        }
        if (clone.rawImages) {
            clone.rawImages = { ...clone.rawImages };
            if (typeof clone.rawImages.firstFrame === 'string') clone.rawImages.firstFrame = await decodeBlobField(clone.rawImages.firstFrame);
            if (typeof clone.rawImages.lastFrame === 'string') clone.rawImages.lastFrame = await decodeBlobField(clone.rawImages.lastFrame);
            if (clone.rawImages.references) clone.rawImages.references = await decodeBlobList(clone.rawImages.references);
        }
        return clone;
    }

    function downloadJsonFile(data, filename) {
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        URL.revokeObjectURL(url);
    }

    async function exportWorkspace() {
        const button = document.getElementById('export-btn');
        const originalHTML = button ? button.innerHTML : '';
        if (button) {
            button.innerHTML = '<svg class="spinner" viewBox="0 0 50 50" style="width:16px;height:16px;stroke:currentColor;margin-right:6px;"><circle cx="25" cy="25" r="20"></circle></svg> 打包中...';
        }
        try {
            const tasks = await callHook('getAllTasks');
            const exportData = [];
            for (const task of Array.isArray(tasks) ? tasks : []) {
                if (isRetiredTask(task)) continue;
                exportData.push(await serializeTask(task));
            }
            downloadJsonFile(exportData, `VeoStudio_Flow_${Date.now()}.veo`);
        } catch (error) {
            callHook('alert', `导出失败: ${error.message}`);
        } finally {
            if (button) button.innerHTML = originalHTML;
        }
    }

    async function importParsedTasks(rawTasks) {
        if (!Array.isArray(rawTasks)) throw new Error('Invalid workspace payload');
        const confirmed = callHook('confirmImport', rawTasks.length);
        if (!confirmed) return false;
        const importedTasks = [];
        for (const task of rawTasks) {
            if (isRetiredTask(task)) continue;
            importedTasks.push(await deserializeTask(task));
        }
        await callHook('saveTasks', importedTasks);
        await callHook('afterImport');
        return true;
    }

    async function importWorkspace(input) {
        const file = input && input.files && input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target.result);
                await importParsedTasks(data);
            } catch (error) {
                callHook('alert', '文件解析失败，请确保导入的是有效的 .veo 格式文件');
            } finally {
                input.value = '';
            }
        };
        reader.readAsText(file);
    }

    const api = {
        configure,
        exportWorkspace,
        importWorkspace,
        serializeTask,
        deserializeTask,
        importParsedTasks
    };

    window.VeoWorkspaceIO = api;
})(window);

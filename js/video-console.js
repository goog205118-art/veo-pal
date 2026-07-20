// Video console state, slot uploads, and mode UI synchronization.
(function (window) {
    'use strict';

    const state = {
        hooks: {},
        isBound: false
    };

    function configure(options = {}) {
        state.hooks = { ...state.hooks, ...(options.hooks || {}) };
        return api;
    }

    function callHook(name, ...args) {
        const fn = state.hooks && state.hooks[name];
        if (typeof fn !== 'function') return undefined;
        return fn(...args);
    }

    function getStoreState() {
        return globalStore.getState();
    }

    function getInputModeLabel(mode) {
        if (window.VeoVideoModels && typeof window.VeoVideoModels.getVideoInputModeLabel === 'function') {
            return window.VeoVideoModels.getVideoInputModeLabel(mode);
        }
        return getVideoInputModeLabel(mode);
    }

    function getModelDisplayName(modelValue, inputMode) {
        if (window.VeoVideoModels && typeof window.VeoVideoModels.getVideoModelDisplayName === 'function') {
            return window.VeoVideoModels.getVideoModelDisplayName(modelValue, inputMode);
        }
        return getVideoModelDisplayName(modelValue, inputMode);
    }

    function getQualityModel(modelValue) {
        if (window.VeoVideoModels && typeof window.VeoVideoModels.getVideoQualityModel === 'function') {
            return window.VeoVideoModels.getVideoQualityModel(modelValue);
        }
        return getVideoQualityModel(modelValue);
    }

    function getInputModeFromTask(task) {
        if (window.VeoVideoModels && typeof window.VeoVideoModels.getVideoInputModeFromTask === 'function') {
            return window.VeoVideoModels.getVideoInputModeFromTask(task);
        }
        return getVideoInputModeFromTask(task);
    }

    function toggleRefPopover(e) {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        const storeState = getStoreState();
        const refFile = document.getElementById('ref-file');
        const popover = document.getElementById('ref-popover');
        if (storeState.references.length === 0) {
            if (refFile) refFile.click();
            return;
        }
        if (popover) popover.style.display = popover.style.display === 'flex' ? 'none' : 'flex';
    }

    function syncModeUI() {
        const storeState = getStoreState();
        const mode = storeState.currentMode === 'frame' ? 'frame' : 'ref';
        const title = document.getElementById('console-mode-title');
        const timelineModel = document.getElementById('timeline-model-label');
        const advancedToggle = document.querySelector('.console-advanced-toggle');
        if (title) title.textContent = mode === 'frame' ? '首尾帧时间轴' : '参考图驱动';
        if (timelineModel) timelineModel.textContent = getModelDisplayName(storeState.model, mode);
        if (advancedToggle) {
            const panel = document.getElementById('console-advanced-panel');
            advancedToggle.classList.toggle('is-open', !!panel && !panel.classList.contains('is-collapsed'));
        }
    }

    function toggleAdvanced(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        const panel = document.getElementById('console-advanced-panel');
        const toggle = document.querySelector('.console-advanced-toggle');
        if (!panel) return;
        const nextCollapsed = !panel.classList.contains('is-collapsed');
        panel.classList.toggle('is-collapsed', nextCollapsed);
        if (toggle) toggle.classList.toggle('is-open', !nextCollapsed);
    }

    function toggleMinimized(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        const el = document.getElementById('floating-console');
        if (el) el.classList.toggle('minimized');
    }

    function expand() {
        const el = document.getElementById('floating-console');
        if (el) el.classList.remove('minimized');
    }

    function setFrameImage(type, imageBlob, options = {}) {
        if (!imageBlob) return false;
        const key = type === 'lastFrame' ? 'lastFrame' : 'firstFrame';
        const slotName = key === 'firstFrame' ? 'first' : 'last';
        getStoreState()[key] = imageBlob;
        const img = document.getElementById(`${slotName}-img`);
        const slot = document.getElementById(`slot-${slotName}-box`);
        if (img) img.src = callHook('getBlobUrl', `temp_${slotName}_${Date.now()}`, imageBlob);
        if (slot) slot.classList.add('has-img', 'slot-just-filled');
        setTimeout(() => { if (slot) slot.classList.remove('slot-just-filled'); }, 620);
        if (options.switchMode !== false) switchMode('frame');
        expand();
        return true;
    }

    function addReferenceImage(imageBlob) {
        if (!imageBlob) return false;
        const storeState = getStoreState();
        if (!Array.isArray(storeState.references)) storeState.references = [];
        if (storeState.references.length >= 3) {
            callHook('showToast', '参考图最大 3 张', 'warning');
            return false;
        }
        storeState.references.push(imageBlob);
        renderReferences();
        const popover = document.getElementById('ref-popover');
        if (popover) popover.style.display = 'flex';
        switchMode('ref');
        expand();
        return true;
    }

    function switchMode(mode) {
        const safeMode = mode === 'frame' ? 'frame' : 'ref';
        globalStore.dispatch('SET_MODE', safeMode);
        syncModeUI();
    }

    function updateInputMode(select) {
        if (select) switchMode(select.value);
    }

    function updateModel(select) {
        if (!select) return;
        globalStore.dispatch('SET_MODEL', { value: select.value, text: select.options[select.selectedIndex].text });
        syncModeUI();
    }

    function updateRatio(select) {
        if (!select) return;
        globalStore.dispatch('SET_RATIO', { value: select.value, text: select.options[select.selectedIndex].text });
    }

    function updateEnhance(select) {
        if (!select) return;
        globalStore.dispatch('SET_ENHANCE', { value: select.value, text: select.options[select.selectedIndex].text });
    }

    function updateUpsample(select) {
        if (!select) return;
        getStoreState().enableUpsample = select.value === 'true';
        const label = document.getElementById('upsample-text');
        if (label) label.innerText = select.options[select.selectedIndex].text;
    }

    function updateAutoRetry(select) {
        if (!select) return;
        getStoreState().autoRetry = select.value === 'true';
        const label = document.getElementById('retry-text');
        if (label) label.innerText = select.options[select.selectedIndex].text;
    }

    async function handleMultiRefs(input) {
        if (!input.files || input.files.length === 0) return;
        const storeState = getStoreState();
        if (storeState.references.length + input.files.length > 3) {
            input.value = '';
            callHook('alert', '最多仅支持 3 张图。');
            return;
        }
        for (const file of Array.from(input.files)) {
            storeState.references.push(await callHook('compressImage', file));
        }
        input.value = '';
        renderReferences();
        if (storeState.references.length > 0) {
            const popover = document.getElementById('ref-popover');
            if (popover) popover.style.display = 'flex';
        }
    }

    function removeReference(event, index) {
        if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
        getStoreState().references.splice(index, 1);
        renderReferences();
        if (getStoreState().references.length === 0) {
            const popover = document.getElementById('ref-popover');
            if (popover) popover.style.display = 'none';
        }
    }

    function clearReferences(e) {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        getStoreState().references = [];
        renderReferences();
        const popover = document.getElementById('ref-popover');
        if (popover) popover.style.display = 'none';
    }

    function renderReferences() {
        const box = document.getElementById('slot-ref-box');
        const imgEl = document.getElementById('ref-img');
        const countBadge = document.getElementById('ref-count-badge');
        const storeState = getStoreState();
        if (!Array.isArray(storeState.references)) storeState.references = [];
        if (storeState.references.length === 0) {
            if (box) box.classList.remove('has-img');
            if (imgEl) imgEl.src = '';
            if (countBadge) countBadge.style.display = 'none';
        } else {
            if (box) box.classList.add('has-img');
            if (imgEl) imgEl.src = callHook('getBlobUrl', `temp_ref_main_${Date.now()}`, storeState.references[0]);
            if (countBadge) {
                countBadge.style.display = storeState.references.length > 1 ? 'flex' : 'none';
                countBadge.innerText = storeState.references.length;
            }
        }

        const list = document.getElementById('ref-list-container');
        if (list) {
            list.innerHTML = storeState.references.map((blob, index) => {
                const url = callHook('getBlobUrl', `temp_ref_${index}_${Date.now()}`, blob);
                return `<div class="popover-img-item"><img src="${url}"><div class="popover-rm-btn" onclick="removeReference(event, ${index})">×</div></div>`;
            }).join('');
        }
        const add = document.getElementById('ref-popover-add');
        if (add) add.style.display = storeState.references.length >= 3 ? 'none' : 'flex';
    }

    async function handleSingleFrame(input, type) {
        if (!input.files || !input.files[0]) return;
        const blob = await callHook('compressImage', input.files[0]);
        setFrameImage(type, blob, { switchMode: true });
        input.value = '';
    }

    function clearFrame(event, type) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        getStoreState()[type] = null;
        const slotName = type === 'firstFrame' ? 'first' : 'last';
        const slot = document.getElementById(`slot-${slotName}-box`);
        const img = document.getElementById(`${slotName}-img`);
        if (slot) slot.classList.remove('has-img', 'slot-just-filled');
        if (img) img.src = '';
        callHook('revokeBlobPrefix', `temp_${slotName}`);
    }

    async function reuseTask(taskId) {
        const task = await callHook('getTask', taskId);
        if (!task) return false;

        const promptInput = document.getElementById('prompt-input');
        if (promptInput) promptInput.value = task.prompt || '';

        const modelSelect = document.getElementById('model-select');
        if (modelSelect) {
            const qualityModel = getQualityModel(task.modelVal);
            const option = modelSelect.querySelector(`option[value="${qualityModel}"]`);
            if (option) {
                modelSelect.value = qualityModel;
                updateModel(modelSelect);
            }
        }

        if (task.ratio) {
            const ratioSelect = document.getElementById('ratio-select');
            if (ratioSelect) {
                ratioSelect.value = task.ratio;
                updateRatio(ratioSelect);
            }
        }

        const restoredMode = getInputModeFromTask(task);
        const inputModeSelect = document.getElementById('input-mode-select');
        if (inputModeSelect) inputModeSelect.value = restoredMode;
        switchMode(restoredMode);

        if (task.rawImages) {
            const storeState = getStoreState();
            storeState.references = [...(task.rawImages.references || [])];
            if (task.rawImages.firstFrame) setFrameImage('firstFrame', task.rawImages.firstFrame, { switchMode: false });
            else clearFrame(null, 'firstFrame');
            if (task.rawImages.lastFrame) setFrameImage('lastFrame', task.rawImages.lastFrame, { switchMode: false });
            else clearFrame(null, 'lastFrame');
            renderReferences();
        }

        switchMode(restoredMode);
        expand();
        if (promptInput && typeof promptInput.focus === 'function') promptInput.focus();
        return true;
    }

    function bindBus() {
        if (state.isBound || typeof sysBus === 'undefined') return;
        sysBus.on('UI:SWITCH_MODE', (mode) => {
            const safeMode = mode === 'frame' ? 'frame' : 'ref';
            document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.slot-group').forEach(s => s.classList.remove('active'));
            const legacyTab = document.getElementById(`tab-${safeMode}`);
            const slotGroup = document.getElementById(`slots-${safeMode}`);
            const inputModeSelect = document.getElementById('input-mode-select');
            const inputModeText = document.getElementById('input-mode-text');
            if (legacyTab) legacyTab.classList.add('active');
            if (slotGroup) slotGroup.classList.add('active');
            if (inputModeSelect && inputModeSelect.value !== safeMode) inputModeSelect.value = safeMode;
            if (inputModeText) inputModeText.innerText = getInputModeLabel(safeMode);
            syncModeUI();
            callHook('updateEstimatedCost');
        });
        sysBus.on('UI:UPDATE_MODEL_TEXT', (text) => {
            const modelText = document.getElementById('model-text');
            if (modelText) modelText.innerText = text;
            syncModeUI();
        });
        sysBus.on('UI:UPDATE_RATIO', (data) => {
            const ratioText = document.getElementById('ratio-text');
            const ratioIcon = document.getElementById('ratio-icon');
            if (ratioText) ratioText.innerText = data.text;
            if (ratioIcon) ratioIcon.innerText = data.value === '16:9' ? 'crop_16_9' : 'crop_portrait';
        });
        sysBus.on('UI:UPDATE_ENHANCE_TEXT', (text) => {
            const enhanceText = document.getElementById('enhance-text');
            if (enhanceText) enhanceText.innerText = text;
        });
        state.isBound = true;
    }

    const api = {
        addReferenceImage,
        bindBus,
        clearFrame,
        clearReferences,
        configure,
        expand,
        handleMultiRefs,
        handleSingleFrame,
        removeReference,
        renderReferences,
        reuseTask,
        setFrameImage,
        switchMode,
        syncModeUI,
        toggleAdvanced,
        toggleMinimized,
        toggleRefPopover,
        updateAutoRetry,
        updateEnhance,
        updateInputMode,
        updateModel,
        updateRatio,
        updateUpsample
    };

    window.VeoVideoConsole = api;
})(window);

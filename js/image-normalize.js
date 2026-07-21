// Image generation route limits and task-state normalization.
(function (window) {
    'use strict';

    function getMaxReferenceCount(task) {
        return window.VeoMedia.getImgGenMaxReferenceCount(task);
    }

    function limitReferencesForRoute(task, incomingImages = []) {
        return window.VeoMedia.limitImgGenReferencesForRoute(task, incomingImages);
    }

    function normalizeRoute(raw = '') {
        return window.VeoImageCore.normalizeRoute(raw);
    }

    function getModelForRoute(route) {
        return window.VeoImageCore.getModelForRoute(route);
    }

    function enforceRouteReferenceLimit(task) {
        if (!task || task.type !== 'tool_image_gen') return false;
        if (!task.state || typeof task.state !== 'object') task.state = {};
        const before = Array.isArray(task.state.images) ? task.state.images : [];
        const limited = limitReferencesForRoute(task, before);
        const changed = before.length !== limited.length || before.some((item, index) => item !== limited[index]);
        if (!changed) return false;
        const baseChanged = before[0] !== limited[0];
        task.state.images = limited;
        if (baseChanged) {
            task.state.maskBlob = null;
            task.state.maskImage = null;
            task.state.maskEditMode = false;
            if (task.id) {
                window.revokeBlobPrefixSafe(`${task.id}_mask_preview_`);
                window.revokeBlobPrefixSafe(`${task.id}_mask_studio_`);
                window.destroyImgMaskStudio(task.id);
                window.destroyImgMaskEditor(task.id);
            }
        }
        return true;
    }

    function ensureState(task) {
        if (!task || task.type !== 'tool_image_gen') return;
        if (!task.state || typeof task.state !== 'object') task.state = {};
        if (window.VeoImageCardProfile) window.VeoImageCardProfile.applyDefaults(task.state, task);
        if (!Array.isArray(task.state.images)) task.state.images = [];
        const route = normalizeRoute(task.state.providerSort || task.state.modelSuffix || task.state.routeMode);
        task.state.version = route.version === 'pro' ? 'pro' : 'trial';
        task.state.providerSort = route.key;
        task.state.modelSuffix = route.suffix;
        task.state.routeMode = route.mode;
        task.state.channel = route.channel || (route.key === 'stable_channel_2' ? 'channel_2' : 'channel_1');
        task.state.imageModel = getModelForRoute(route);
        enforceRouteReferenceLimit(task);
        if (!task.state.quality) task.state.quality = 'auto';
        if (!task.state.format) task.state.format = 'png';
        if (!task.state.background) task.state.background = 'auto';
        if (!task.state.moderation) task.state.moderation = 'auto';
        task.state.n = 1;
        if (!task.state.size && task.state.size !== '') task.state.size = '1024x1024';
        if (!task.state.proRatio) task.state.proRatio = '1:1';
        if (!task.state.proResolution) task.state.proResolution = '1k';
        if (task.state.version !== 'pro') task.state.proResolution = '1k';
        const ratioCustomW = parseInt(task.state.customW, 10);
        const ratioCustomH = parseInt(task.state.customH, 10);
        if (!Number.isFinite(ratioCustomW) || ratioCustomW < 1) task.state.customW = 9;
        if (!Number.isFinite(ratioCustomH) || ratioCustomH < 1) task.state.customH = 16;
        if (!task.state.prompt) task.state.prompt = '';
        if (typeof task.state.autoRetry !== 'boolean') task.state.autoRetry = false;
        if (typeof task.state.seedLocked !== 'boolean') task.state.seedLocked = false;
        const parsedSeed = parseInt(task.state.seed, 10);
        task.state.seed = Number.isFinite(parsedSeed) && parsedSeed >= 0 ? parsedSeed : '';
        window.normalizeImgGenRefControls(task);
        if (typeof task.state.previewCollapsed !== 'boolean') task.state.previewCollapsed = false;
        if (task.state.imgGenUiV2 !== true) {
            task.state.paramsCollapsed = true;
            task.state.promptToolsCollapsed = true;
            task.state.maskPanelCollapsed = true;
            task.state.imgGenUiV2 = true;
        }
        if (typeof task.state.paramsCollapsed !== 'boolean') task.state.paramsCollapsed = true;
        if (typeof task.state.promptToolsCollapsed !== 'boolean') task.state.promptToolsCollapsed = true;
        if (typeof task.state.maskPanelCollapsed !== 'boolean') task.state.maskPanelCollapsed = true;
        const lastUsageCost = window.toFiniteNumber(task.state.lastUsageCost, NaN);
        task.state.lastUsageCost = Number.isFinite(lastUsageCost) && lastUsageCost >= 0 ? lastUsageCost : null;
        if (!task.state.lastUsageDetail) task.state.lastUsageDetail = '';
        const openW = parseInt(task.state.cardWidthOpen, 10);
        const collapsedW = parseInt(task.state.cardWidthCollapsed, 10);
        const cardH = parseInt(task.state.cardHeight, 10);
        task.state.cardWidthOpen = Number.isFinite(openW) && openW >= 560 ? Math.min(1200, openW) : 680;
        task.state.cardWidthCollapsed = Number.isFinite(collapsedW) && collapsedW >= 320 ? Math.min(760, collapsedW) : 360;
        task.state.cardHeight = Number.isFinite(cardH) && cardH >= 420 ? Math.min(1100, cardH) : 520;
        if (typeof task.state.maskBlob === 'undefined') task.state.maskBlob = null;
        if (typeof task.state.maskImage === 'undefined') task.state.maskImage = null;
        if (typeof task.state.maskEditMode !== 'boolean') task.state.maskEditMode = false;
        const brushVal = parseInt(task.state.maskBrushSize, 10);
        task.state.maskBrushSize = Number.isFinite(brushVal) && brushVal > 0 ? window.clampImgMaskBrushSize(brushVal) : 20;
        task.state.maskStageHeight = window.clampImgMaskStageHeight(task.state.maskStageHeight);
        if (!task.state.maskBlob && task.state.maskImage) task.state.maskBlob = task.state.maskImage;
        if (!task.state.maskImage && task.state.maskBlob) task.state.maskImage = task.state.maskBlob;
        if (!Array.isArray(task.state.images) || task.state.images.length === 0) {
            if (task.id && (task.state.maskBlob || task.state.maskImage)) {
                window.revokeBlobPrefixSafe(`${task.id}_mask_preview_`);
                window.revokeBlobPrefixSafe(`${task.id}_mask_studio_`);
            }
            task.state.maskEditMode = false;
            task.state.maskBlob = null;
            task.state.maskImage = null;
        }
        if (!Array.isArray(task.state.resultBlobs)) task.state.resultBlobs = [];
        if (task.state.resultBlob && task.state.resultBlobs.length === 0) task.state.resultBlobs = [task.state.resultBlob];
        window.normalizeImgGenPreviewHistory(task);
        const detected = window.VeoImageCore.detectProPresetFromSize(task.state.size);
        if (!task.state.proRatio || task.state.proRatio === 'auto') task.state.proRatio = detected.proRatio;
        if (!task.state.proResolution) task.state.proResolution = detected.proResolution;
        if (task.state.version !== 'pro') task.state.proResolution = '1k';
        task.state.size = window.VeoImageCore.resolveSize(task.state);
        window.recalcImgGenTaskStatus(task);
    }

    window.VeoImageNormalize = {
        enforceRouteReferenceLimit,
        ensureState,
        getMaxReferenceCount,
        getModelForRoute,
        limitReferencesForRoute,
        normalizeRoute
    };
})(window);

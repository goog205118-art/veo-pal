// Image generation card profile and default state.
(function (window) {
    'use strict';

    const DEFAULT_PROFILE_KEY = 'gpt-image';

    const profiles = {
        [DEFAULT_PROFILE_KEY]: {
            key: DEFAULT_PROFILE_KEY,
            title: 'AI Image Node',
            modelBadge: 'Stable 1K',
            routeLabel: 'Stable 1K Channel 1',
            helperTip: 'Generate, edit, and blend up to 5 image references',
            uploadNote: 'Image 1 is Base. The other slots are references for style, product, detail, or layout.',
            promptPlaceholder: 'Describe the image. You can attach 1-5 reference images.',
            maxReferenceSlots: 5,
            previewLimit: 6,
            supportsMask: true,
            defaults: {
                version: 'trial',
                providerSort: 'stable_channel_1',
                modelSuffix: '',
                routeMode: 'stable',
                imageModel: 'gpt-image-2-c',
                channel: 'channel_1',
                quality: 'auto',
                format: 'png',
                n: 1,
                size: '1024x1024',
                proRatio: '1:1',
                proResolution: '1k',
                customW: 9,
                customH: 16,
                background: 'auto',
                moderation: 'auto',
                prompt: '',
                images: [],
                refControls: [],
                seedLocked: false,
                seed: '',
                maskImage: null,
                maskBlob: null,
                maskEditMode: false,
                maskBrushSize: 20,
                maskStageHeight: 220,
                resultUrl: null,
                resultBlob: null,
                resultBlobs: [],
                previewHistory: [],
                previewCollapsed: false,
                paramsCollapsed: true,
                promptToolsCollapsed: true,
                maskPanelCollapsed: true,
                imgGenUiV2: true,
                cardWidthOpen: 680,
                cardWidthCollapsed: 360,
                cardHeight: 520,
                autoRetry: false,
                nextSubmitAt: 0,
                lastUsageCost: null,
                lastUsageDetail: ''
            }
        }
    };

    function clone(value) {
        if (Array.isArray(value)) return value.map(clone);
        if (value && typeof value === 'object') {
            return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
        }
        return value;
    }

    function profileForTask(task) {
        const profileKey = task && task.state && task.state.imageCardProfile;
        return profiles[profileKey] || profiles[DEFAULT_PROFILE_KEY];
    }

    function createDefaultState(overrides = {}) {
        const profile = profiles[DEFAULT_PROFILE_KEY];
        return {
            ...clone(profile.defaults),
            imageCardProfile: profile.key,
            ...clone(overrides)
        };
    }

    function applyDefaults(state = {}, task = null) {
        const profile = profileForTask({ state });
        const defaults = clone(profile.defaults);
        Object.entries(defaults).forEach(([key, value]) => {
            if (typeof state[key] === 'undefined') state[key] = value;
        });
        state.imageCardProfile = profile.key;
        if (task && task.type === 'tool_image_gen') task.state = state;
        return state;
    }

    function getPreviewLimit() {
        const configLimit = Number(window.VeoImageConfig && window.VeoImageConfig.previewLimit);
        if (Number.isFinite(configLimit) && configLimit > 0) return Math.round(configLimit);
        return profiles[DEFAULT_PROFILE_KEY].previewLimit;
    }

    function viewModel(task) {
        const profile = profileForTask(task);
        const state = (task && task.state) || {};
        const route = window.VeoImageCore && typeof window.VeoImageCore.normalizeRoute === 'function'
            ? window.VeoImageCore.normalizeRoute(state.providerSort || state.routeMode || profile.defaults.providerSort)
            : { label: profile.routeLabel, key: state.providerSort || profile.defaults.providerSort, version: state.version || 'trial' };
        const routeVersion = route.version === 'pro' ? 'pro' : 'trial';
        const model = state.imageModel || route.model || profile.defaults.imageModel;
        const maxReferenceSlots = Math.max(1, Math.min(5, Number(route.maxRefs || profile.maxReferenceSlots || 5)));
        const uploadNote = routeVersion === 'pro'
            ? `Pro: GPT Image 2 full controls, up to ${maxReferenceSlots} uploaded images.`
            : `Stable: ${route.label || '1K channel'}, 1K output only, up to ${maxReferenceSlots} uploaded images.`;
        const promptPlaceholder = routeVersion === 'pro'
            ? 'Pro GPT Image 2 prompt. Supports 1K/2K/4K, edit, mask, quality, format, and up to 5 images.'
            : 'Stable prompt. 1K output only. Attach up to 5 images for reference.';
        return {
            ...profile,
            route,
            model,
            modelBadge: routeVersion === 'pro' ? 'Pro GPT Image 2' : 'Stable 1K',
            maxReferenceSlots,
            routeLabel: route.label || profile.routeLabel,
            previewLimit: getPreviewLimit(),
            uploadNote,
            promptPlaceholder
        };
    }

    window.VeoImageCardProfile = {
        applyDefaults,
        createDefaultState,
        getPreviewLimit,
        profileForTask,
        viewModel
    };
})(window);

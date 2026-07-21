// Image generation card profile and default state.
(function (window) {
    'use strict';

    const DEFAULT_PROFILE_KEY = 'gpt-image';

    const profiles = {
        [DEFAULT_PROFILE_KEY]: {
            key: DEFAULT_PROFILE_KEY,
            title: 'AI 多模态生图',
            modelBadge: 'GPT Image 2',
            routeLabel: 'GPT Image 2',
            helperTip: '用于生成、重绘和参考图融合的 AI 节点',
            uploadNote: '第 1 张为 Base 图，右侧参考位用于风格、角色、产品或构图约束。',
            promptPlaceholder: '输入画面提示词，可垫入 1-5 张图配合描述...',
            maxReferenceSlots: 5,
            previewLimit: 6,
            supportsMask: true,
            defaults: {
                version: 'pro',
                providerSort: 'ai666',
                modelSuffix: '',
                routeMode: 'ai666',
                imageModel: 'gpt-image-2',
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
            : { label: profile.routeLabel, key: state.providerSort || profile.defaults.providerSort };
        const model = state.imageModel || route.model || profile.defaults.imageModel;
        const maxReferenceSlots = Math.max(1, Number(route.maxRefs || profile.maxReferenceSlots || 1));
        const referenceText = maxReferenceSlots <= 1
            ? '当前通道支持 1 张 Base 图；需要多参考图时先切换到支持多图的模型通道。'
            : `第 1 张为 Base 图，右侧 ${maxReferenceSlots - 1} 格为 Reference。拖拽图片到此处会自动吸附。`;
        const promptPlaceholder = maxReferenceSlots <= 1
            ? '输入画面提示词，可搭配 1 张 Base 图进行生成或局部重绘...'
            : `输入画面提示词，可垫入 1-${maxReferenceSlots} 张图配合描述...`;
        return {
            ...profile,
            route,
            model,
            modelBadge: profile.modelBadge,
            maxReferenceSlots,
            routeLabel: route.label || profile.routeLabel,
            previewLimit: getPreviewLimit(),
            uploadNote: referenceText,
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

// Video model routing and billing metadata.
// This is the single place to add, remove, or rename video model interfaces.

const FALLBACK_VIDEO_MODEL_ROUTES = {
    'veo3.1': {
        label: 'Veo 3.1 普通',
        frameModel: 'veo3.1',
        refModel: 'veo3.1-components',
        unitCost: 0.35,
    },
    'veo3.1-4k': {
        label: 'Veo 3.1 4K',
        frameModel: 'veo3.1-4k',
        refModel: 'veo3.1-components-4k',
        unitCost: 0.50,
    },
};

const FALLBACK_VIDEO_SUBMIT_MODEL_META = {
    'veo3.1': { cost: 0.35, detail: 'Veo 3.1 (首尾帧)' },
    'veo3.1-components': { cost: 0.35, detail: 'Veo 3.1 Cmp (参考图)' },
    'veo3.1-4k': { cost: 0.50, detail: 'Veo 3.1 4K (首尾帧)' },
    'veo3.1-components-4k': { cost: 0.50, detail: 'Veo 3.1 Cmp 4K (参考图)' },
};

const VIDEO_MODEL_ROUTES = window.VeoModelRegistry
    ? window.VeoModelRegistry.getFamily('video.quality')
    : FALLBACK_VIDEO_MODEL_ROUTES;
const VIDEO_SUBMIT_MODEL_META = window.VeoModelRegistry
    ? window.VeoModelRegistry.getFamily('video.submit')
    : FALLBACK_VIDEO_SUBMIT_MODEL_META;

function getVideoInputModeLabel(mode) {
    return mode === 'frame' ? '首尾帧' : '参考图';
}

function getVideoQualityModel(modelValue) {
    const raw = String(modelValue || '').toLowerCase();
    if (window.VeoModelRegistry) {
        const registered = window.VeoModelRegistry.resolve('video.quality', raw, raw.includes('4k') ? 'veo3.1-4k' : 'veo3.1');
        if (registered) return registered.key;
    }
    return raw.includes('4k') ? 'veo3.1-4k' : 'veo3.1';
}

function getVideoInputModeFromTask(task) {
    const rawMode = task && (task.inputMode || task.mode);
    if (rawMode === 'frame' || rawMode === 'ref') return rawMode;
    return task && String(task.modelVal || '').includes('components') ? 'ref' : 'frame';
}

function buildVideoSubmitModel(modelValue, inputMode) {
    const qualityModel = getVideoQualityModel(modelValue);
    const route = VIDEO_MODEL_ROUTES[qualityModel] || VIDEO_MODEL_ROUTES['veo3.1'];
    return inputMode === 'frame' ? route.frameModel : route.refModel;
}

function getVideoUnitCost(modelValue) {
    const raw = String(modelValue || '').toLowerCase();
    if (raw.includes('lite')) return 0.20;

    const exactMeta = VIDEO_SUBMIT_MODEL_META[raw];
    if (exactMeta) return exactMeta.cost;

    const qualityModel = getVideoQualityModel(raw);
    const route = VIDEO_MODEL_ROUTES[qualityModel] || VIDEO_MODEL_ROUTES['veo3.1'];
    return route.unitCost;
}

function getVideoBillingInfo(modelValue) {
    const model = String(modelValue || '').toLowerCase();
    if (model.includes('lite')) return { cost: 0.20, detail: '极速特惠版模型' };
    if (window.VeoModelRegistry) {
        return window.VeoModelRegistry.resolve('video.submit', model, 'veo3.1') || VIDEO_SUBMIT_MODEL_META['veo3.1'];
    }
    return VIDEO_SUBMIT_MODEL_META[model] || VIDEO_SUBMIT_MODEL_META['veo3.1'];
}

function getVideoModelDisplayName(modelValue, inputMode) {
    const raw = String(modelValue || '').toLowerCase();
    if (raw.includes('lite')) return '极速特惠版';

    const qualityModel = getVideoQualityModel(modelValue);
    const route = VIDEO_MODEL_ROUTES[qualityModel] || VIDEO_MODEL_ROUTES['veo3.1'];
    return `${route.label} · ${getVideoInputModeLabel(inputMode)}`;
}

window.VeoVideoModels = {
    routes: VIDEO_MODEL_ROUTES,
    submitMeta: VIDEO_SUBMIT_MODEL_META,
    buildVideoSubmitModel,
    getVideoBillingInfo,
    getVideoInputModeFromTask,
    getVideoInputModeLabel,
    getVideoModelDisplayName,
    getVideoQualityModel,
    getVideoUnitCost,
};

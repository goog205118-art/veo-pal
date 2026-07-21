// Image generation request builder and single-submit transport.
// Kept as a classic script so the current global runtime can adopt it gradually.
(function () {
    'use strict';

    function toNumber(value, fallback = 0) {
        const num = Number(value);
        return Number.isFinite(num) ? num : fallback;
    }

    function resolvePromptContext(task) {
        const state = task && task.state && typeof task.state === 'object' ? task.state : {};
        return {
            finalPrompt: state.prompt || ''
        };
    }

    function normalizeOutputCompression(state) {
        const source = state && typeof state === 'object' ? state : {};
        const rawValue = source.outputCompression !== undefined ? source.outputCompression : source.output_compression;
        const value = toNumber(rawValue, NaN);
        return Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : undefined;
    }

    function measureEncodedPayloadBytes(imagesBase64, maskBase64) {
        const images = Array.isArray(imagesBase64) ? imagesBase64 : [];
        return images.reduce((sum, item) => sum + String(item || '').length, 0) + String(maskBase64 || '').length;
    }

    function buildUnifiedPayload(options = {}) {
        const task = options.task || {};
        const state = task.state && typeof task.state === 'object' ? task.state : {};
        const route = options.route && typeof options.route === 'object'
            ? options.route
            : window.VeoImageCore.normalizeRoute(state.providerSort || state.routeMode || state.modelSuffix);
        const version = route.version === 'pro' ? 'pro' : 'trial';
        const referenceControls = Array.isArray(options.referenceControls) ? options.referenceControls : [];
        const imagePayloadFields = options.imagePayloadFields && typeof options.imagePayloadFields === 'object' ? options.imagePayloadFields : {};
        const promptContext = options.promptContext || resolvePromptContext(task);
        const clientRequestId = options.clientRequestId || `${task.id || 'img'}_${options.previewItemId || Date.now()}`;
        const outputCompression = normalizeOutputCompression(state);
        const imageModel = options.imageModel || window.VeoImageCore.getModelForRoute(route);
        const ratio = state.proRatio || '1:1';
        const resolution = version === 'pro' ? (state.proResolution || '1k') : '1k';
        const lockedSeed = state.seedLocked && state.seed !== '' ? parseInt(state.seed, 10) : null;

        return {
            action: 'generate',
            version,
            mode: options.mode || window.VeoImageCore.resolveMode(state),
            model: imageModel,
            imageModel,
            modelSuffix: route.suffix,
            routeMode: route.mode,
            channel: route.channel || state.channel || 'channel_1',
            routeChannel: route.channel || state.channel || 'channel_1',
            route_channel: route.channel || state.channel || 'channel_1',
            ratio,
            aspect_ratio: ratio,
            resolution,
            proRatio: state.proRatio || '1:1',
            proResolution: resolution,
            pro_resolution: resolution,
            prompt: promptContext.finalPrompt,
            size: options.sizeToSend || state.size || '1024x1024',
            providerSort: route.key,
            providerKey: route.key,
            provider_key: route.key,
            provider: { key: route.key, sort: route.mode, suffix: route.suffix, model: imageModel },
            quality: state.quality || 'auto',
            format: state.format || 'png',
            output_format: state.format || 'png',
            outputCompression,
            output_compression: outputCompression,
            background: state.background || 'auto',
            moderation: state.moderation || 'auto',
            n: 1,
            clientRequestId,
            client_request_id: clientRequestId,
            previewItemId: options.previewItemId || '',
            preview_item_id: options.previewItemId || '',
            requestId: clientRequestId,
            request_id: clientRequestId,
            seed: Number.isFinite(lockedSeed) ? lockedSeed : undefined,
            seedLocked: state.seedLocked === true,
            seed_locked: state.seedLocked === true,
            referenceControls,
            reference_controls: referenceControls,
            imageControls: referenceControls,
            image_controls: referenceControls,
            imageWeights: referenceControls.map((item) => item.weight),
            image_weights: referenceControls.map((item) => item.weight),
            imageIntents: referenceControls.map((item) => item.intent),
            image_intents: referenceControls.map((item) => item.intent),
            ...imagePayloadFields
        };
    }

    async function submitUnifiedOnce(payload) {
        const response = await window.VeoApi.postEndpoint('image.unified', payload);

        if (response.status === 401 || response.status === 403) {
            if (typeof window.handleAuthError === 'function') window.handleAuthError();
            throw new Error('密钥校验失败');
        }
        if (!response.ok) throw new Error(`API 异常: ${response.status}`);

        const rawData = await parseImgGenHttpResponse(response, 'processing');
        const resData = unwrapImgGenResponseData(rawData);
        const returnedUrls = extractImageUrlsFromResponse(rawData);
        return { rawData, resData, returnedUrls };
    }

    window.VeoImageRequest = {
        resolvePromptContext,
        normalizeOutputCompression,
        measureEncodedPayloadBytes,
        buildUnifiedPayload,
        submitUnifiedOnce
    };
})();

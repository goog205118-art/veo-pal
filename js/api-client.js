(function (window) {
    'use strict';

    const trimOverride = (value) => (value && String(value).trim()) || '';

    const config = {
        videoSubmit: 'https://api.wallyai.top/webhook/proxy-submit',
        videoPoll: 'https://api.wallyai.top/webhook/proxy-poll',
        imageUnified: trimOverride(window.VEO_IMAGE_UNIFIED_WEBHOOK) || 'https://api.wallyai.top/webhook/proxy-image-unified',
        imagePoll: trimOverride(window.VEO_IMAGE_POLL_WEBHOOK),
        balanceQuery: trimOverride(window.VEO_BALANCE_WEBHOOK) || trimOverride(window.VEO_IMAGE_UNIFIED_WEBHOOK) || 'https://api.wallyai.top/webhook/proxy-image-unified',
        imageAuth: trimOverride(window.VEO_WEBHOOK_AUTH)
    };

    const endpointRegistry = {
        'video.submit': { key: 'video.submit', urlKey: 'videoSubmit', auth: 'session' },
        'video.poll': { key: 'video.poll', urlKey: 'videoPoll', auth: 'session' },
        'image.unified': { key: 'image.unified', urlKey: 'imageUnified', auth: 'image' },
        'image.poll': { key: 'image.poll', urlKey: 'imagePoll', auth: 'image', optional: true },
        'balance.query': { key: 'balance.query', urlKey: 'balanceQuery', auth: 'session' }
    };

    function normalizeEndpoint(rawUrl) {
        const raw = String(rawUrl || '').trim();
        if (!raw) return '';
        try {
            const url = new URL(raw, window.location.href);
            return `${url.origin}${url.pathname.replace(/\/+$/, '')}`.toLowerCase();
        } catch (err) {
            return raw.split('?')[0].replace(/\/+$/, '').toLowerCase();
        }
    }

    function isSameEndpoint(a, b) {
        const left = normalizeEndpoint(a);
        const right = normalizeEndpoint(b);
        return !!left && !!right && left === right;
    }

    function isUnifiedImageEndpoint(rawUrl) {
        return normalizeEndpoint(rawUrl).endsWith('/proxy-image-unified');
    }

    function isImageGenerationEndpoint(rawUrl) {
        const endpoint = normalizeEndpoint(rawUrl);
        return endpoint.endsWith('/proxy-image-unified');
    }

    function resolveImagePollEndpoint() {
        const url = String(config.imagePoll || '').trim();
        if (!url) {
            return isUnifiedImageEndpoint(config.imageUnified)
                ? { url: config.imageUnified, reason: 'unified_fallback' }
                : { url: '', reason: 'missing' };
        }
        if (isUnifiedImageEndpoint(url) || (isSameEndpoint(url, config.imageUnified) && isUnifiedImageEndpoint(config.imageUnified))) {
            return { url, reason: 'unified_poll' };
        }
        return { url, reason: '' };
    }

    function authHeaders(options = {}) {
        const headers = { 'Content-Type': 'application/json' };
        const pwd = window.sessionStorage && window.sessionStorage.getItem('veo_admin_pwd');
        if (pwd) headers.wally123 = pwd;
        if (options.includeImageAuth && config.imageAuth) headers.Authorization = config.imageAuth;
        return headers;
    }

    function getEndpointMeta(endpointKey) {
        const meta = endpointRegistry[endpointKey];
        if (!meta) return null;
        const url = trimOverride(config[meta.urlKey]);
        return {
            ...meta,
            url,
            normalizedUrl: normalizeEndpoint(url)
        };
    }

    function resolveEndpoint(endpointKeyOrUrl) {
        const meta = getEndpointMeta(endpointKeyOrUrl);
        if (meta) return meta.url;
        return trimOverride(endpointKeyOrUrl);
    }

    function registerEndpoint(endpointKey, options = {}) {
        if (!endpointKey || typeof endpointKey !== 'string') return false;
        const key = endpointKey.trim();
        if (!key) return false;
        endpointRegistry[key] = {
            key,
            urlKey: options.urlKey || key,
            auth: options.auth || 'session',
            optional: options.optional === true
        };
        if (options.url !== undefined) config[endpointRegistry[key].urlKey] = trimOverride(options.url);
        return true;
    }

    async function parseResponse(response, fallbackStatus = 'accepted') {
        if (!response) return { status: fallbackStatus, accepted: true, empty_response: true };
        const httpStatus = response.status;
        let rawText = '';
        try {
            rawText = await response.text();
        } catch (err) {
            return {
                status: fallbackStatus,
                accepted: response.ok,
                empty_response: true,
                http_status: httpStatus,
                parse_warning: err && err.message ? err.message : String(err || '')
            };
        }
        const text = String(rawText || '').trim();
        if (!text) {
            return {
                status: fallbackStatus,
                accepted: response.ok,
                empty_response: true,
                http_status: httpStatus
            };
        }
        try {
            return JSON.parse(text);
        } catch (err) {
            return text;
        }
    }

    async function postJson(url, payload, options = {}) {
        return fetch(url, {
            method: 'POST',
            headers: options.headers || authHeaders(options),
            body: JSON.stringify(payload),
            signal: options.signal
        });
    }

    function postEndpoint(endpointKeyOrUrl, payload, options = {}) {
        const meta = getEndpointMeta(endpointKeyOrUrl);
        const url = meta ? meta.url : trimOverride(endpointKeyOrUrl);
        if (!url) {
            return Promise.reject(new Error(`Missing API endpoint: ${endpointKeyOrUrl || 'unknown'}`));
        }
        const includeImageAuth = options.includeImageAuth !== undefined
            ? options.includeImageAuth
            : !!(meta && meta.auth === 'image');
        return postJson(url, payload, { ...options, includeImageAuth });
    }

    function videoSubmit(payload, options = {}) {
        return postEndpoint('video.submit', payload, options);
    }

    function videoPoll(payload, options = {}) {
        return postEndpoint('video.poll', payload, options);
    }

    function imageSubmit(url, payload, options = {}) {
        return postEndpoint(url, payload, { ...options, includeImageAuth: true });
    }

    function imagePoll(url, payload, options = {}) {
        return postEndpoint(url, payload, { ...options, includeImageAuth: true });
    }

    function balanceQuery(payload = {}, options = {}) {
        return postEndpoint('balance.query', payload, options);
    }

    window.VeoApi = {
        config,
        endpoints: config,
        endpointRegistry,
        authHeaders,
        balanceQuery,
        getEndpointMeta,
        imagePoll,
        imageSubmit,
        isImageGenerationEndpoint,
        isSameEndpoint,
        isUnifiedImageEndpoint,
        normalizeEndpoint,
        parseResponse,
        postEndpoint,
        registerEndpoint,
        resolveEndpoint,
        resolveImagePollEndpoint,
        videoPoll,
        videoSubmit
    };
})(window);

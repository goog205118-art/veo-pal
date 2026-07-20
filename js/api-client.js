(function (window) {
    'use strict';

    const trimOverride = (value) => (value && String(value).trim()) || '';

    const config = {
        videoSubmit: 'https://api.wallyai.top/webhook/proxy-submit',
        videoPoll: 'https://api.wallyai.top/webhook/proxy-poll',
        imageUnified: trimOverride(window.VEO_IMAGE_UNIFIED_WEBHOOK) || 'https://api.wallyai.top/webhook/proxy-image-unified',
        imagePoll: trimOverride(window.VEO_IMAGE_POLL_WEBHOOK),
        imageAuth: trimOverride(window.VEO_WEBHOOK_AUTH)
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

    function videoSubmit(payload, options = {}) {
        return postJson(config.videoSubmit, payload, options);
    }

    function videoPoll(payload, options = {}) {
        return postJson(config.videoPoll, payload, options);
    }

    function imageSubmit(url, payload, options = {}) {
        return postJson(url, payload, { ...options, includeImageAuth: true });
    }

    function imagePoll(url, payload, options = {}) {
        return postJson(url, payload, { ...options, includeImageAuth: true });
    }

    window.VeoApi = {
        config,
        endpoints: config,
        authHeaders,
        imagePoll,
        imageSubmit,
        isImageGenerationEndpoint,
        isSameEndpoint,
        isUnifiedImageEndpoint,
        normalizeEndpoint,
        parseResponse,
        resolveImagePollEndpoint,
        videoPoll,
        videoSubmit
    };
})(window);

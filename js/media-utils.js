(function (window) {
    'use strict';

    const DEFAULT_IMAGE_ROUTE = 'stable_channel_1';
    const fallbackRouteConfig = {
        stable_channel_1: {
            key: 'stable_channel_1',
            aliases: ['stable', 'stable_1', 'trial', 'trial_channel_1', 'channel_1'],
            suffix: '',
            mode: 'stable',
            channel: 'channel_1',
            version: 'trial',
            label: 'Stable 1K Channel 1',
            model: 'gpt-image-2-all',
            maxRefs: 5,
            resolutions: ['1k'],
            supportsAdvanced: false
        },
        stable_channel_2: {
            key: 'stable_channel_2',
            aliases: ['stable_2', 'trial_channel_2', 'channel_2'],
            suffix: '',
            mode: 'stable',
            channel: 'channel_2',
            version: 'trial',
            label: 'Stable 1K Channel 2',
            model: 'gpt-image-2-all',
            maxRefs: 5,
            resolutions: ['1k'],
            supportsAdvanced: false
        },
        pro: {
            key: 'pro',
            aliases: ['professional', 'gpt-image-2', 'gptimage2', 'yunwu_pro', 'ai666'],
            suffix: '',
            mode: 'stable',
            channel: 'channel_1',
            version: 'pro',
            label: 'Pro GPT Image 2',
            model: 'gpt-image-2',
            maxRefs: 5,
            resolutions: ['1k', '2k', '4k'],
            supportsAdvanced: true
        }
    };
    const routeConfig = window.VeoModelRegistry
        ? window.VeoModelRegistry.getFamily('image.routes')
        : fallbackRouteConfig;

    const refIntents = [
        { value: 'structure', label: 'Structure', hint: 'Product silhouette, depth, perspective, and composition' },
        { value: 'style', label: 'Style', hint: 'Mood, lighting, atmosphere, and visual language' },
        { value: 'color', label: 'Color', hint: 'Palette, material color, and contrast balance' },
        { value: 'detail', label: 'Detail', hint: 'Texture, accessories, finish, and small marks' },
        { value: 'layout', label: 'Layout', hint: 'Poster layout, negative space, framing, and placement' }
    ];

    function finiteNumber(value, fallback = 0) {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    }

    async function blobsToBase64Sequential(blobs, options = {}) {
        const list = Array.isArray(blobs) ? blobs : [];
        const out = [];
        for (const blob of list) {
            out.push(await window.blobToBase64(blob, options));
        }
        return out;
    }

    function buildImgGenImagePayloadFields(imagesBase64, maskBase64 = null, maxImages = 5) {
        const maxCount = Math.max(1, Math.min(5, parseInt(maxImages, 10) || 5));
        const images = Array.isArray(imagesBase64) ? imagesBase64.filter(Boolean).slice(0, maxCount) : [];
        return {
            images,
            image_urls: images,
            mask: maskBase64 || null,
            mask_url: maskBase64 || null,
            image_count: images.length,
            reference_count: Math.max(0, images.length - 1)
        };
    }

    function normalizeImgGenRoute(raw = DEFAULT_IMAGE_ROUTE) {
        if (window.VeoModelRegistry) {
            const registered = window.VeoModelRegistry.resolve('image.routes', raw, DEFAULT_IMAGE_ROUTE);
            if (registered) return registered;
        }
        const key = String(raw || DEFAULT_IMAGE_ROUTE).trim().toLowerCase().replace(/^:/, '');
        for (const route of Object.values(routeConfig)) {
            if (route.key === key || (Array.isArray(route.aliases) && route.aliases.includes(key))) {
                return { ...route };
            }
        }
        return { ...routeConfig[DEFAULT_IMAGE_ROUTE] };
    }

    function getImgGenModelForRoute(route) {
        const safeRoute = route && typeof route === 'object' ? route : normalizeImgGenRoute(route || DEFAULT_IMAGE_ROUTE);
        return safeRoute.model || `gpt-image-2${safeRoute.suffix || ''}`;
    }

    function getImgGenMaxReferenceCount(task) {
        if (!task || task.type !== 'tool_image_gen') return 5;
        const state = task.state && typeof task.state === 'object' ? task.state : {};
        const route = normalizeImgGenRoute(state.providerSort || state.routeMode || state.modelSuffix);
        return Math.max(1, Math.min(5, parseInt(route.maxRefs, 10) || 5));
    }

    function limitImgGenReferencesForRoute(task, incomingImages = []) {
        const images = Array.isArray(incomingImages) ? incomingImages.filter(Boolean) : [];
        return images.slice(0, getImgGenMaxReferenceCount(task));
    }

    function resolveImgGenNetworkEncodeOptions(routeKey, kind = 'image') {
        const route = normalizeImgGenRoute(routeKey || DEFAULT_IMAGE_ROUTE);
        if (route && route.encode && route.encode[kind]) return { ...route.encode[kind] };
        if (route.version === 'trial') {
            if (kind === 'mask') {
                return {
                    mode: 'network',
                    maxBytes: 2 * 1024 * 1024,
                    maxEdge: 1280,
                    maxPixels: 1280 * 1280,
                    forceResize: true,
                    keepPng: true,
                    outputType: 'image/png'
                };
            }
            return {
                mode: 'network',
                maxBytes: 1536 * 1024,
                maxEdge: 1280,
                maxPixels: 1280 * 1280,
                forceResize: true,
                outputType: 'image/jpeg',
                quality: 0.78
            };
        }
        return { mode: 'network', maxBytes: 8 * 1024 * 1024, maxEdge: 2048 };
    }

    async function buildBlobSignature(blob) {
        if (!blob) return '';
        if (typeof blob === 'string') return `str_${blob.length}_${blob.slice(-120)}`;
        const size = finiteNumber(blob.size, 0);
        const type = blob.type || 'application/octet-stream';
        const head = await blob.slice(0, 64).arrayBuffer().catch(() => null);
        const tailStart = Math.max(0, size - 64);
        const tail = await blob.slice(tailStart, size).arrayBuffer().catch(() => null);
        const headArr = head ? Array.from(new Uint8Array(head)).join(',') : '';
        const tailArr = tail ? Array.from(new Uint8Array(tail)).join(',') : '';
        return `${type}|${size}|${headArr}|${tailArr}`;
    }

    async function readImageMeta(imageLike) {
        if (!imageLike) return null;
        try {
            if (typeof imageLike !== 'string' && typeof window.createImageBitmap === 'function') {
                const bitmap = await window.createImageBitmap(imageLike);
                const width = finiteNumber(bitmap.width, 0);
                const height = finiteNumber(bitmap.height, 0);
                try { bitmap.close(); } catch (err) {}
                if (width > 0 && height > 0) {
                    const ratio = width / height;
                    return {
                        width,
                        height,
                        ratio,
                        layout: ratio >= 1.2 ? 'landscape' : (ratio <= 0.85 ? 'portrait' : 'square')
                    };
                }
            }
        } catch (err) {}

        try {
            const src = typeof imageLike === 'string' ? imageLike : window.URL.createObjectURL(imageLike);
            const meta = await new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    const width = finiteNumber(img.naturalWidth || img.width, 0);
                    const height = finiteNumber(img.naturalHeight || img.height, 0);
                    if (width > 0 && height > 0) {
                        const ratio = width / height;
                        resolve({
                            width,
                            height,
                            ratio,
                            layout: ratio >= 1.2 ? 'landscape' : (ratio <= 0.85 ? 'portrait' : 'square')
                        });
                    } else {
                        resolve(null);
                    }
                };
                img.onerror = () => resolve(null);
                img.src = src;
            });
            if (typeof imageLike !== 'string') {
                try { window.URL.revokeObjectURL(src); } catch (err) {}
            }
            return meta;
        } catch (err) {
            return null;
        }
    }

    window.VeoMedia = {
        DEFAULT_IMAGE_ROUTE,
        buildBlobSignature,
        buildImgGenImagePayloadFields,
        blobsToBase64Sequential,
        getImgGenMaxReferenceCount,
        getImgGenModelForRoute,
        limitImgGenReferencesForRoute,
        normalizeImgGenRoute,
        readImageMeta,
        refIntents,
        resolveImgGenNetworkEncodeOptions,
        routeConfig
    };
})(window);

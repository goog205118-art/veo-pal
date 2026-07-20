(function (window) {
    'use strict';

    const routeConfig = {
        ai666: { key: 'ai666', aliases: ['ai666', 'ai_ai666', 'ai666_gpt_image_2', 'ai666-gpt-image-2'], suffix: '', mode: 'ai666', label: 'AI666 中转站', maxRefs: 1 }
    };

    const refIntents = [
        { value: 'structure', label: '结构', hint: '产品轮廓 / 深度 / 构图' },
        { value: 'style', label: '风格', hint: '影调 / 氛围 / 电影感' },
        { value: 'color', label: '色彩', hint: '配色 / 材质倾向' },
        { value: 'detail', label: '细节', hint: '局部纹理 / 功能点' },
        { value: 'layout', label: '版式', hint: '海报排版 / 留白' }
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

    function normalizeImgGenRoute(raw = 'ai666') {
        const key = String(raw || 'ai666').trim().toLowerCase().replace(/^:/, '');
        for (const route of Object.values(routeConfig)) {
            if (route.key === key || (Array.isArray(route.aliases) && route.aliases.includes(key))) {
                return { ...route };
            }
        }
        return { ...routeConfig.ai666 };
    }

    function getImgGenModelForRoute(route) {
        const safeRoute = route && typeof route === 'object' ? route : normalizeImgGenRoute(route || 'ai666');
        return `gpt-image-2${safeRoute.suffix || ''}`;
    }

    function getImgGenMaxReferenceCount(task) {
        if (!task || task.type !== 'tool_image_gen') return 5;
        const state = task.state && typeof task.state === 'object' ? task.state : {};
        const route = normalizeImgGenRoute(state.providerSort || state.routeMode || state.modelSuffix);
        return route.maxRefs || 5;
    }

    function limitImgGenReferencesForRoute(task, incomingImages = []) {
        const images = Array.isArray(incomingImages) ? incomingImages.filter(Boolean) : [];
        const maxCount = getImgGenMaxReferenceCount(task);
        return maxCount <= 1 ? images.slice(-1) : images.slice(0, 5);
    }

    function resolveImgGenNetworkEncodeOptions(routeKey, kind = 'image') {
        if (routeKey === 'ai666') {
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

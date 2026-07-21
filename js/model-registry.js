// Central model and route registry for image/video generation.
(function (window) {
    'use strict';

    const families = Object.create(null);

    function normalizeKey(value) {
        return String(value || '').trim().toLowerCase().replace(/^:/, '');
    }

    function cloneMeta(meta) {
        if (!meta || typeof meta !== 'object') return {};
        return {
            ...meta,
            aliases: Array.isArray(meta.aliases) ? [...meta.aliases] : []
        };
    }

    function ensureFamily(familyName) {
        const family = String(familyName || '').trim();
        if (!family) return null;
        if (!families[family]) {
            families[family] = {
                records: Object.create(null),
                aliases: Object.create(null)
            };
        }
        return families[family];
    }

    function register(familyName, key, meta = {}) {
        const family = ensureFamily(familyName);
        const normalizedKey = normalizeKey(key);
        if (!family || !normalizedKey) return null;

        const record = {
            ...cloneMeta(meta),
            key: normalizedKey
        };
        const aliases = new Set([normalizedKey, ...(record.aliases || []).map(normalizeKey).filter(Boolean)]);
        record.aliases = Array.from(aliases);
        family.records[normalizedKey] = record;
        record.aliases.forEach((alias) => {
            family.aliases[alias] = normalizedKey;
        });
        return cloneMeta(record);
    }

    function registerMany(familyName, records = {}) {
        if (Array.isArray(records)) {
            records.forEach((record) => {
                if (record && record.key) register(familyName, record.key, record);
            });
            return;
        }
        Object.entries(records || {}).forEach(([key, meta]) => register(familyName, key, meta));
    }

    function resolve(familyName, rawKey, fallbackKey = '') {
        const family = families[familyName];
        if (!family) return null;
        const normalizedKey = normalizeKey(rawKey || fallbackKey);
        const resolvedKey = family.aliases[normalizedKey] || family.aliases[normalizeKey(fallbackKey)] || normalizeKey(fallbackKey);
        const record = family.records[resolvedKey];
        return record ? cloneMeta(record) : null;
    }

    function get(familyName, key) {
        const family = families[familyName];
        if (!family) return null;
        const record = family.records[normalizeKey(key)];
        return record ? cloneMeta(record) : null;
    }

    function getFamily(familyName) {
        const family = families[familyName];
        if (!family) return {};
        return Object.fromEntries(Object.entries(family.records).map(([key, record]) => [key, cloneMeta(record)]));
    }

    function list(familyName) {
        const family = families[familyName];
        if (!family) return [];
        return Object.values(family.records).map(cloneMeta);
    }

    registerMany('image.routes', {
        ai666: {
            aliases: ['ai666', 'ai_ai666', 'ai666_gpt_image_2', 'ai666-gpt-image-2'],
            suffix: '',
            mode: 'ai666',
            label: 'AI666 GPT Image 2',
            model: 'gpt-image-2',
            maxRefs: 1,
            encode: {
                image: {
                    mode: 'network',
                    maxBytes: 1536 * 1024,
                    maxEdge: 1280,
                    maxPixels: 1280 * 1280,
                    forceResize: true,
                    outputType: 'image/jpeg',
                    quality: 0.78
                },
                mask: {
                    mode: 'network',
                    maxBytes: 2 * 1024 * 1024,
                    maxEdge: 1280,
                    maxPixels: 1280 * 1280,
                    forceResize: true,
                    keepPng: true,
                    outputType: 'image/png'
                }
            }
        }
    });

    registerMany('video.quality', {
        'veo3.1': {
            label: 'Veo 3.1 普通',
            frameModel: 'veo3.1',
            refModel: 'veo3.1-components',
            unitCost: 0.35
        },
        'veo3.1-4k': {
            label: 'Veo 3.1 4K',
            aliases: ['veo3.1_4k', 'veo31-4k'],
            frameModel: 'veo3.1-4k',
            refModel: 'veo3.1-components-4k',
            unitCost: 0.50
        }
    });

    registerMany('video.submit', {
        'veo3.1': { cost: 0.35, detail: 'Veo 3.1 (首尾帧)' },
        'veo3.1-components': { cost: 0.35, detail: 'Veo 3.1 Cmp (参考图)' },
        'veo3.1-4k': { cost: 0.50, detail: 'Veo 3.1 4K (首尾帧)' },
        'veo3.1-components-4k': { cost: 0.50, detail: 'Veo 3.1 Cmp 4K (参考图)' }
    });

    window.VeoModelRegistry = {
        get,
        getFamily,
        list,
        normalizeKey,
        register,
        registerMany,
        resolve
    };
})(window);

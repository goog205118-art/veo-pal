(function () {
    const PRO_INPUT_PRICE_PER_1M = 5;
    const PRO_OUTPUT_PRICE_PER_1M = 30;
    const PROXY_RECHARGE_FACTOR = 0.5;
    const PRO_FALLBACK_COST = 0.12;

    const PRO_SIZE_PRESETS = Object.freeze({
        '1:1': Object.freeze({ '1k': '1024x1024', '2k': '2048x2048', '4k': '4096x4096' }),
        '3:2': Object.freeze({ '1k': '1536x1024', '2k': '3072x2048', '4k': '3840x2560' }),
        '2:3': Object.freeze({ '1k': '1024x1536', '2k': '2048x3072', '4k': '2560x3840' }),
        '16:9': Object.freeze({ '1k': '1024x576', '2k': '2048x1152', '4k': '3840x2160' }),
        '9:16': Object.freeze({ '1k': '576x1024', '2k': '1152x2048', '4k': '2160x3840' })
    });

    const PRO_SIZE_RULES = Object.freeze({
        MAX_SIDE: 3840,
        GRID: 16,
        MAX_RATIO: 3,
        MIN_PIXELS: 655360,
        MAX_PIXELS: 8294400
    });

    function toNumber(value, fallback = 0) {
        const num = Number(value);
        return Number.isFinite(num) ? num : fallback;
    }

    function clampNumber(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function snapToGrid(value, grid) {
        const safeGrid = Math.max(1, parseInt(grid, 10) || 1);
        return Math.max(safeGrid, Math.round(value / safeGrid) * safeGrid);
    }

    function parseSizeValue(sizeStr) {
        if (typeof sizeStr !== 'string') return null;
        const match = sizeStr.trim().match(/^(\d+)\s*x\s*(\d+)$/i);
        if (!match) return null;
        const width = parseInt(match[1], 10);
        const height = parseInt(match[2], 10);
        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
        return { width, height };
    }

    function detectProPresetFromSize(sizeValue) {
        if (sizeValue === '') return { proRatio: 'custom', proResolution: '1k' };
        if (!sizeValue || sizeValue === 'auto') return { proRatio: 'auto', proResolution: '1k' };
        const value = String(sizeValue).trim().toLowerCase();
        for (const ratioKey of Object.keys(PRO_SIZE_PRESETS)) {
            const perRes = PRO_SIZE_PRESETS[ratioKey];
            for (const resKey of Object.keys(perRes)) {
                if (perRes[resKey].toLowerCase() === value) return { proRatio: ratioKey, proResolution: resKey };
            }
        }

        const parsed = parseSizeValue(value);
        if (!parsed) return { proRatio: '1:1', proResolution: '1k' };
        const ratioNum = parsed.width / parsed.height;
        const ratioCandidates = [
            { key: '1:1', num: 1 },
            { key: '3:2', num: 3 / 2 },
            { key: '2:3', num: 2 / 3 },
            { key: '16:9', num: 16 / 9 },
            { key: '9:16', num: 9 / 16 }
        ];
        let best = ratioCandidates[0];
        let bestDiff = Infinity;
        for (const item of ratioCandidates) {
            const diff = Math.abs(item.num - ratioNum);
            if (diff < bestDiff) {
                bestDiff = diff;
                best = item;
            }
        }
        const maxSide = Math.max(parsed.width, parsed.height);
        const proResolution = maxSide >= 3200 ? '4k' : (maxSide >= 1900 ? '2k' : '1k');
        return { proRatio: best.key, proResolution };
    }

    function buildCustomSizeByResolution(customW, customH, proResolution) {
        const ratioW = Math.max(1, parseInt(customW, 10) || 1);
        const ratioH = Math.max(1, parseInt(customH, 10) || 1);
        const longSideBase = proResolution === '4k' ? 3840 : (proResolution === '2k' ? 2048 : 1024);
        const scale = longSideBase / Math.max(ratioW, ratioH);
        const snappedW = Math.max(64, Math.round((ratioW * scale) / 64) * 64);
        const snappedH = Math.max(64, Math.round((ratioH * scale) / 64) * 64);
        return `${snappedW}x${snappedH}`;
    }

    function enforceProSizeRules(sizeValue) {
        const rules = PRO_SIZE_RULES;
        const fallback = { width: 1024, height: 1024 };
        const parsed = parseSizeValue(sizeValue) || fallback;
        let width = parsed.width;
        let height = parsed.height;
        const original = `${width}x${height}`;

        for (let i = 0; i < 8; i++) {
            width = Math.max(rules.GRID, width);
            height = Math.max(rules.GRID, height);

            const ratio = width / height;
            if (ratio > rules.MAX_RATIO) width = height * rules.MAX_RATIO;
            else if (ratio < (1 / rules.MAX_RATIO)) height = width * rules.MAX_RATIO;

            let maxSide = Math.max(width, height);
            if (maxSide > rules.MAX_SIDE) {
                const scaleDown = rules.MAX_SIDE / maxSide;
                width *= scaleDown;
                height *= scaleDown;
            }

            let pixels = width * height;
            if (pixels > rules.MAX_PIXELS) {
                const scaleDownPixels = Math.sqrt(rules.MAX_PIXELS / pixels);
                width *= scaleDownPixels;
                height *= scaleDownPixels;
            }

            pixels = width * height;
            if (pixels < rules.MIN_PIXELS) {
                const scaleUpPixels = Math.sqrt(rules.MIN_PIXELS / Math.max(1, pixels));
                width *= scaleUpPixels;
                height *= scaleUpPixels;
            }

            maxSide = Math.max(width, height);
            if (maxSide > rules.MAX_SIDE) {
                const scaleDownAgain = rules.MAX_SIDE / maxSide;
                width *= scaleDownAgain;
                height *= scaleDownAgain;
            }

            width = snapToGrid(width, rules.GRID);
            height = snapToGrid(height, rules.GRID);
        }

        width = clampNumber(snapToGrid(width, rules.GRID), rules.GRID, rules.MAX_SIDE);
        height = clampNumber(snapToGrid(height, rules.GRID), rules.GRID, rules.MAX_SIDE);

        if (width / height > rules.MAX_RATIO) width = snapToGrid(height * rules.MAX_RATIO, rules.GRID);
        if (height / width > rules.MAX_RATIO) height = snapToGrid(width * rules.MAX_RATIO, rules.GRID);

        width = clampNumber(width, rules.GRID, rules.MAX_SIDE);
        height = clampNumber(height, rules.GRID, rules.MAX_SIDE);

        let area = width * height;
        if (area > rules.MAX_PIXELS) {
            const scale = Math.sqrt(rules.MAX_PIXELS / area);
            width = clampNumber(snapToGrid(width * scale, rules.GRID), rules.GRID, rules.MAX_SIDE);
            height = clampNumber(snapToGrid(height * scale, rules.GRID), rules.GRID, rules.MAX_SIDE);
            area = width * height;
        }
        if (area < rules.MIN_PIXELS) {
            const scale = Math.sqrt(rules.MIN_PIXELS / Math.max(1, area));
            width = clampNumber(snapToGrid(width * scale, rules.GRID), rules.GRID, rules.MAX_SIDE);
            height = clampNumber(snapToGrid(height * scale, rules.GRID), rules.GRID, rules.MAX_SIDE);
            area = width * height;
        }

        if (area < rules.MIN_PIXELS) {
            if (width >= height) {
                height = clampNumber(snapToGrid(Math.sqrt(rules.MIN_PIXELS / Math.max(1, width / height)), rules.GRID), rules.GRID, rules.MAX_SIDE);
                width = clampNumber(snapToGrid(Math.min(rules.MAX_SIDE, height * (width / height)), rules.GRID), rules.GRID, rules.MAX_SIDE);
            } else {
                width = clampNumber(snapToGrid(Math.sqrt(rules.MIN_PIXELS / Math.max(1, height / width)), rules.GRID), rules.GRID, rules.MAX_SIDE);
                height = clampNumber(snapToGrid(Math.min(rules.MAX_SIDE, width * (height / width)), rules.GRID), rules.GRID, rules.MAX_SIDE);
            }
            area = width * height;
        }

        const normalized = `${width}x${height}`;
        return {
            size: normalized,
            changed: normalized !== original,
            isValid:
                Math.max(width, height) <= rules.MAX_SIDE &&
                (width % rules.GRID === 0) &&
                (height % rules.GRID === 0) &&
                (Math.max(width / height, height / width) <= rules.MAX_RATIO) &&
                (area >= rules.MIN_PIXELS && area <= rules.MAX_PIXELS)
        };
    }

    function resolveSize(state) {
        if (!state || typeof state !== 'object') return '1024x1024';
        const ratio = state.proRatio || '1:1';
        const resolution = state.proResolution || '1k';
        if (ratio === 'auto') return 'auto';
        if (ratio === 'custom') return enforceProSizeRules(buildCustomSizeByResolution(state.customW, state.customH, resolution)).size;
        const preset = PRO_SIZE_PRESETS[ratio];
        if (preset && preset[resolution]) return enforceProSizeRules(preset[resolution]).size;
        return enforceProSizeRules('1024x1024').size;
    }

    function normalizeRoute(raw = '') {
        return window.VeoMedia.normalizeImgGenRoute(raw);
    }

    function getModelForRoute(route) {
        return window.VeoMedia.getImgGenModelForRoute(route);
    }

    function resolveMode(state) {
        const imageCount = Array.isArray(state && state.images) ? state.images.length : 0;
        if (imageCount === 0) return 'text2img';
        if (state.maskBlob || state.maskImage) return 'mask_edit';
        return 'img2img';
    }

    function formatMoney(amount) {
        const value = toNumber(amount, NaN);
        if (!Number.isFinite(value) || value < 0) return '';
        return `\u00a5${value.toFixed(4)}`;
    }

    function extractUsage(rawData) {
        const roots = [];
        const queue = [];
        const seen = typeof WeakSet === 'function' ? new WeakSet() : null;
        const pushCandidate = (candidate) => {
            if (!candidate || typeof candidate !== 'object') return;
            queue.push(candidate);
        };
        if (Array.isArray(rawData)) rawData.forEach(pushCandidate);
        else pushCandidate(rawData);

        while (queue.length > 0 && roots.length < 24) {
            const current = queue.shift();
            if (!current || typeof current !== 'object') continue;
            if (seen) {
                if (seen.has(current)) continue;
                seen.add(current);
            }
            roots.push(current);
            if (current.json && typeof current.json === 'object') queue.push(current.json);
            if (current.body && typeof current.body === 'object') queue.push(current.body);
            if (current.result && typeof current.result === 'object') queue.push(current.result);
            if (current.response && typeof current.response === 'object') queue.push(current.response);
            if (current.data && typeof current.data === 'object' && !Array.isArray(current.data)) queue.push(current.data);
        }

        const pickNumber = (obj, keys) => {
            for (const key of keys) {
                const value = obj && obj[key];
                const num = toNumber(value, NaN);
                if (Number.isFinite(num) && num >= 0) return num;
            }
            return NaN;
        };

        const normalizeDetails = (details) => {
            if (!details || typeof details !== 'object') return { textTokens: 0, imageTokens: 0 };
            const textTokens = pickNumber(details, ['text_tokens', 'textTokens', 'token_text', 'text']);
            const imageTokens = pickNumber(details, ['image_tokens', 'imageTokens', 'token_image', 'image']);
            return {
                textTokens: Number.isFinite(textTokens) ? textTokens : 0,
                imageTokens: Number.isFinite(imageTokens) ? imageTokens : 0
            };
        };

        for (const root of roots) {
            const usage = root.usage || root.token_usage || root.tokenUsage || root.usage_stats || root.usageStats || null;
            const source = usage && typeof usage === 'object' ? usage : root;
            const inputTokens = pickNumber(source, ['input_tokens', 'inputTokens', 'prompt_tokens', 'promptTokens', 'input_token_count']);
            const outputTokens = pickNumber(source, ['output_tokens', 'outputTokens', 'completion_tokens', 'completionTokens', 'output_token_count']);
            const totalTokens = pickNumber(source, ['total_tokens', 'totalTokens', 'tokens', 'token_count']);
            const inputDetails = normalizeDetails(source.input_tokens_details || source.inputTokensDetails || source.prompt_tokens_details || source.promptTokensDetails);
            const outputDetails = normalizeDetails(source.output_tokens_details || source.outputTokensDetails || source.completion_tokens_details || source.completionTokensDetails);
            const hasAny =
                Number.isFinite(inputTokens) || Number.isFinite(outputTokens) || Number.isFinite(totalTokens) ||
                inputDetails.textTokens > 0 || inputDetails.imageTokens > 0 || outputDetails.textTokens > 0 || outputDetails.imageTokens > 0;
            if (!hasAny) continue;

            const resolvedInputTokens = Number.isFinite(inputTokens)
                ? inputTokens
                : (inputDetails.textTokens + inputDetails.imageTokens);
            const resolvedOutputTokens = Number.isFinite(outputTokens)
                ? outputTokens
                : (outputDetails.textTokens + outputDetails.imageTokens);

            return {
                inputTokens: Math.max(0, Math.round(resolvedInputTokens || 0)),
                outputTokens: Math.max(0, Math.round(resolvedOutputTokens || 0)),
                totalTokens: Math.max(0, Math.round(Number.isFinite(totalTokens) ? totalTokens : (resolvedInputTokens + resolvedOutputTokens || 0))),
                inputDetails,
                outputDetails
            };
        }
        return null;
    }

    function calculateBilling(task, rawData) {
        const usage = extractUsage(rawData);
        if (usage && (usage.inputTokens > 0 || usage.outputTokens > 0)) {
            const meteredCost = ((usage.inputTokens * PRO_INPUT_PRICE_PER_1M) + (usage.outputTokens * PRO_OUTPUT_PRICE_PER_1M)) / 1000000;
            const cost = meteredCost * PROXY_RECHARGE_FACTOR;
            return {
                cost,
                detail: `AI生图 GPT Image 2 · 输入 ${usage.inputTokens} / 输出 ${usage.outputTokens} tokens · 中转半价`,
                usage
            };
        }
        return {
            cost: PRO_FALLBACK_COST,
            detail: 'AI生图 GPT Image 2 · usage 缺失兜底',
            usage: null
        };
    }

    window.VeoImageCore = {
        constants: {
            PRO_INPUT_PRICE_PER_1M,
            PRO_OUTPUT_PRICE_PER_1M,
            PROXY_RECHARGE_FACTOR,
            PRO_FALLBACK_COST,
            PRO_SIZE_PRESETS,
            PRO_SIZE_RULES
        },
        clampNumber,
        snapToGrid,
        parseSizeValue,
        detectProPresetFromSize,
        buildCustomSizeByResolution,
        enforceProSizeRules,
        resolveSize,
        normalizeRoute,
        getModelForRoute,
        resolveMode,
        formatMoney,
        extractUsage,
        calculateBilling
    };
})();

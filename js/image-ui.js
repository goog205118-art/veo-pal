function renderImgGenRatioOptions(selected, includeAuto = false) {
    const presets = [
        ['1:1', '比例 1:1'],
        ['3:2', '比例 3:2'],
        ['2:3', '比例 2:3'],
        ['16:9', '比例 16:9'],
        ['9:16', '比例 9:16'],
        ['custom', '自定义比例']
    ];
    if (includeAuto) presets.push(['auto', 'Auto 比例']);
    return presets.map(([value, label]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`).join('');
}

function clampImgGenRefWeight(value) {
    const num = toFiniteNumber(value, NaN);
    if (!Number.isFinite(num)) return 0.6;
    return Math.max(0, Math.min(1, num > 1 ? num / 100 : num));
}

function getImgGenDefaultRefIntent(index) {
    if (index === 0) return 'structure';
    if (index === 1) return 'style';
    if (index === 2) return 'color';
    if (index === 3) return 'detail';
    return 'layout';
}

function createImgGenRefControl(index, existing = {}) {
    const allowed = new Set(IMG_GEN_REF_INTENTS.map((item) => item.value));
    const intent = allowed.has(existing.intent) ? existing.intent : getImgGenDefaultRefIntent(index);
    const fallbackWeight = index === 0 ? 0.9 : (intent === 'style' ? 0.62 : 0.55);
    const weight = clampImgGenRefWeight(typeof existing.weight === 'undefined' ? fallbackWeight : existing.weight);
    return {
        intent,
        weight,
        locked: existing.locked === true
    };
}

function normalizeImgGenRefControls(task) {
    if (!task || !task.state) return [];
    const images = Array.isArray(task.state.images) ? task.state.images : [];
    const source = Array.isArray(task.state.refControls) ? task.state.refControls : [];
    task.state.refControls = images.map((_, index) => createImgGenRefControl(index, source[index] || {}));
    return task.state.refControls;
}

function renderImgGenRefIntentOptions(selected) {
    return IMG_GEN_REF_INTENTS.map((item) => (
        `<option value="${escapeAttr(item.value)}" ${selected === item.value ? 'selected' : ''}>${escapeHtml(item.label)}</option>`
    )).join('');
}

function renderImgGenRefControl(task, index) {
    const controls = normalizeImgGenRefControls(task);
    const control = createImgGenRefControl(index, controls[index] || {});
    const percent = Math.round(control.weight * 100);
    const hint = (IMG_GEN_REF_INTENTS.find((item) => item.value === control.intent) || IMG_GEN_REF_INTENTS[0]).hint;
    return `
        <div class="img-gen-ref-control" onclick="event.stopPropagation()" onmousedown="event.stopPropagation()" data-tip="${escapeAttr(hint)}">
            <select class="img-gen-ref-intent" onchange="updateImgGenRefControl('${task.id}', ${index}, 'intent', this.value)">
                ${renderImgGenRefIntentOptions(control.intent)}
            </select>
            <label class="img-gen-ref-weight">
                <span>${percent}</span>
                <input type="range" min="0" max="100" step="5" value="${percent}" oninput="this.previousElementSibling.textContent=this.value" onchange="updateImgGenRefControl('${task.id}', ${index}, 'weight', this.value)">
            </label>
        </div>
    `;
}

function buildImgGenRefControlPayload(task) {
    ensureImgGenState(task);
    const controls = normalizeImgGenRefControls(task);
    return controls.map((control, index) => ({
        index,
        role: index === 0 ? 'base' : 'reference',
        intent: control.intent,
        weight: Number(clampImgGenRefWeight(control.weight).toFixed(2)),
        locked: control.locked === true
    }));
}

function renderImgGenPromptChips(task) {
    ensureImgGenState(task);
    const collapsed = task.state.promptToolsCollapsed === true;
    const chips = IMG_GEN_PROMPT_TAGS.map((tag, index) => {
        const label = tag.label || tag.text.split(',')[0] || tag.text;
        return `
        <button class="img-gen-prompt-chip" type="button" onclick="appendImgGenPromptTag(event, '${task.id}', ${index})" data-tip="${escapeAttr(`点击填入英文提示词：${tag.text}`)}">
            <span>${escapeHtml(tag.group)}</span>${escapeHtml(label)}
        </button>
    `;
    }).join('');
    return `
        <div class="img-gen-prompt-assist img-gen-mini-panel ${collapsed ? 'is-collapsed' : 'is-open'}">
            ${collapsed ? '' : `
                <div class="img-gen-mini-panel-head">
                    <span><span class="material-symbols-outlined">auto_awesome</span> 快捷提示词</span>
                    <button type="button" onclick="toggleImgGenPromptTools(event, '${task.id}')" data-tip="收起快捷提示词">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div class="img-gen-prompt-chip-row">${chips}</div>
            `}
        </div>
    `;
}

function renderImgGenMiniToolDock(task) {
    ensureImgGenState(task);
    const isPro = task.state.version === 'pro';
    const promptOpen = task.state.promptToolsCollapsed !== true;
    const maskOpen = isPro && task.state.maskPanelCollapsed !== true;
    const hasMaskReady = isPro && !!(task.state.maskBlob || task.state.maskImage);
    return `
        <div class="img-gen-mini-tool-dock">
            <button class="img-gen-mini-tool ${promptOpen ? 'is-open' : ''}" type="button" onclick="toggleImgGenPromptTools(event, '${task.id}')" data-tip="${promptOpen ? '收起快捷提示词' : '展开快捷提示词'}">
                <span class="material-symbols-outlined">auto_awesome</span>
                <span>提示词</span>
            </button>
            ${isPro ? `
                <button class="img-gen-mini-tool ${maskOpen ? 'is-open' : ''} ${hasMaskReady ? 'is-ready' : ''}" type="button" onclick="toggleImgGenMaskTools(event, '${task.id}')" data-tip="${maskOpen ? '收起蒙版工具' : '展开蒙版工具'}">
                    <span class="material-symbols-outlined">gesture</span>
                    <span>蒙版</span>
                    ${hasMaskReady ? '<i></i>' : ''}
                </button>
            ` : ''}
        </div>
    `;
}

function renderImgGenSlots(task) {
    ensureImgGenState(task);
    normalizeImgGenRefControls(task);
    const isPro = task.state.version === 'pro';
    const images = Array.isArray(task.state.images) ? task.state.images : [];
    const hasMaskReady = isPro && !!(task.state.maskBlob || task.state.maskImage);
    const maxImageCount = getImgGenMaxReferenceCount(task);
    const isSingleRefRoute = maxImageCount === 1;
    const slots = [];

    for (let i = 0; i < maxImageCount; i++) {
        const img = images[i] || null;
        const isBase = i === 0;
        const slotClass = [
            'img-gen-slot',
            isBase ? 'img-gen-slot-base' : 'img-gen-slot-ref',
            img ? 'has-image' : 'is-empty',
            isBase && hasMaskReady ? 'has-mask' : ''
        ].filter(Boolean).join(' ');
        const label = isBase ? (isPro ? 'BASE / MASK' : 'BASE') : `REF ${i}`;
        const hint = isBase ? (isPro ? '蒙版底图' : '试用底图') : '参考图';

        if (img) {
            const slotUrl = getBlobUrl(`${task.id}_img_${i}_${task.timestamp || ''}`, img);
            slots.push(`
                <div class="${slotClass}" data-slot-index="${i}">
                    <img src="${escapeAttr(slotUrl)}" ondblclick="openLightbox(this.src)" data-tip="双击预览垫图">
                    <span class="img-gen-slot-label">${escapeHtml(label)}</span>
                    ${isBase && hasMaskReady ? '<span class="img-gen-slot-mask-dot">MASK</span>' : ''}
                    ${renderImgGenRefControl(task, i)}
                    <button class="popover-rm-btn remove-badge" type="button" onclick="removeGenImage(event, '${task.id}', ${i})" data-tip="移除此垫图">×</button>
                </div>
            `);
        } else {
            slots.push(`
                <div class="${slotClass}" data-slot-index="${i}" onclick="document.getElementById('file-input-${task.id}').click()" data-tip="点击上传或拖入图片">
                    <div class="img-gen-slot-placeholder">
                        <span class="material-symbols-outlined">${isBase ? 'add_photo_alternate' : 'image'}</span>
                        <strong>${escapeHtml(label)}</strong>
                        <small>${escapeHtml(hint)}</small>
                    </div>
                </div>
            `);
        }
    }

    return `
        <div class="img-gen-slots img-gen-slots-fixed ${isSingleRefRoute ? 'is-single-ref-route' : ''}" id="img-gen-zone-${task.id}" ondragover="event.preventDefault(); this.classList.add('drag-over');" ondragleave="this.classList.remove('drag-over');" ondrop="handleGenImageDrop(event, '${task.id}')">
            <input type="file" id="file-input-${task.id}" class="img-gen-file-input" ${isSingleRefRoute ? '' : 'multiple'} accept="image/*" onchange="handleGenImageUpload(this, '${task.id}')" onclick="event.stopPropagation()">
            ${slots.join('')}
            <div class="img-gen-drop-overlay">
                <span class="material-symbols-outlined">move_to_inbox</span>
                <strong>${isSingleRefRoute ? 'AI666 通道仅保留 1 张参考图，拖入新图会自动替换' : '释放图片，吸附到生图节点'}</strong>
            </div>
        </div>
    `;
}

function renderImgGenParams(task) {
    ensureImgGenState(task);
    const state = task.state;
    const isPro = state.version === 'pro';
    const paramsCollapsed = state.paramsCollapsed === true;
    const resolvedSize = resolveImgGenSize(state);
    const ratioKey = isPro ? 'proRatio' : 'trialRatio';
    const ratioValue = isPro ? state.proRatio : state.trialRatio;
    const showCustomRatio = ratioValue === 'custom';
    const route = normalizeImgGenRoute(state.providerSort || state.routeMode || 'stable');
    const routeLabel = isPro ? `GPT Image 2 · ${route.label} · ${resolvedSize}` : `${state.channel === 'channel_2' ? '试用通道 2' : '试用通道 1'} · 1K`;
    const seedValue = String(state.seed || '');
    const seedControlHtml = `
        <label class="img-gen-field img-gen-seed-field">
            <span>Seed</span>
            <div class="img-gen-seed-row">
                <button class="img-gen-seed-lock ${state.seedLocked ? 'is-locked' : ''}" type="button" onclick="updateImgGenState('${task.id}', 'seedLocked', ${state.seedLocked ? 'false' : 'true'})" data-tip="${state.seedLocked ? '解除种子锁定' : '锁定种子，便于复现与变体'}">
                    <span class="material-symbols-outlined">${state.seedLocked ? 'lock' : 'lock_open'}</span>
                </button>
                <input class="img-gen-select img-gen-seed-input" type="number" placeholder="auto" value="${escapeAttr(seedValue)}" onchange="updateImgGenState('${task.id}', 'seed', this.value)">
            </div>
        </label>
    `;

    const customRatioHtml = showCustomRatio ? `
        <div class="img-gen-custom-ratio">
            <span class="material-symbols-outlined">aspect_ratio</span>
            <span class="img-gen-custom-label">自定义比例</span>
            <input type="number" class="img-gen-select img-gen-ratio-input" value="${escapeAttr(state.customW || 9)}" onchange="updateImgGenState('${task.id}', 'customW', this.value)">
            <span class="img-gen-ratio-colon">:</span>
            <input type="number" class="img-gen-select img-gen-ratio-input" value="${escapeAttr(state.customH || 16)}" onchange="updateImgGenState('${task.id}', 'customH', this.value)">
            <span class="img-gen-size-hint">输出尺寸: ${escapeHtml(resolvedSize)}</span>
        </div>
    ` : '';

    const advancedHtml = isPro ? `
        <div class="img-gen-controls img-gen-controls-pro">
            ${seedControlHtml}
            <label class="img-gen-field">
                <span>专业通道</span>
                <select class="img-gen-select" onchange="updateImgGenState('${task.id}', 'providerSort', this.value)" data-tip="专业版模型中转通道，不影响试用版">
                    ${Object.values(IMG_GEN_ROUTE_CONFIG).map((item) => `<option value="${item.key}" ${route.key === item.key ? 'selected' : ''}>${item.label}</option>`).join('')}
                </select>
            </label>
            <label class="img-gen-field">
                <span>分辨率</span>
                <select class="img-gen-select" onchange="updateImgGenState('${task.id}', 'proResolution', this.value)" data-tip="专业版：分辨率档位">
                    <option value="1k" ${state.proResolution === '1k' ? 'selected' : ''}>1K</option>
                    <option value="2k" ${state.proResolution === '2k' ? 'selected' : ''}>2K</option>
                    <option value="4k" ${state.proResolution === '4k' ? 'selected' : ''}>4K</option>
                </select>
            </label>
            <label class="img-gen-field">
                <span>质量</span>
                <select class="img-gen-select" onchange="updateImgGenState('${task.id}', 'quality', this.value)">
                    <option value="auto" ${state.quality === 'auto' ? 'selected' : ''}>自动质量</option>
                    <option value="high" ${state.quality === 'high' ? 'selected' : ''}>高质量</option>
                    <option value="medium" ${state.quality === 'medium' ? 'selected' : ''}>中质量</option>
                    <option value="low" ${state.quality === 'low' ? 'selected' : ''}>低质量</option>
                </select>
            </label>
            <label class="img-gen-field">
                <span>格式</span>
                <select class="img-gen-select" onchange="updateImgGenState('${task.id}', 'format', this.value)">
                    <option value="png" ${state.format === 'png' ? 'selected' : ''}>PNG</option>
                    <option value="jpeg" ${state.format === 'jpeg' ? 'selected' : ''}>JPEG</option>
                    <option value="webp" ${state.format === 'webp' ? 'selected' : ''}>WEBP</option>
                </select>
            </label>
            <label class="img-gen-field">
                <span>背景</span>
                <select class="img-gen-select" onchange="updateImgGenState('${task.id}', 'background', this.value)">
                    <option value="auto" ${state.background === 'auto' ? 'selected' : ''}>auto</option>
                    <option value="transparent" ${state.background === 'transparent' ? 'selected' : ''}>transparent</option>
                    <option value="opaque" ${state.background === 'opaque' ? 'selected' : ''}>opaque</option>
                </select>
            </label>
            <label class="img-gen-field">
                <span>审核</span>
                <select class="img-gen-select" onchange="updateImgGenState('${task.id}', 'moderation', this.value)">
                    <option value="auto" ${state.moderation === 'auto' ? 'selected' : ''}>auto</option>
                    <option value="low" ${state.moderation === 'low' ? 'selected' : ''}>low</option>
                </select>
            </label>
            <label class="img-gen-field">
                <span>重试</span>
                <select class="img-gen-select" onchange="updateImgGenState('${task.id}', 'autoRetry', this.value === 'true')">
                    <option value="false" ${!state.autoRetry ? 'selected' : ''}>单次</option>
                    <option value="true" ${state.autoRetry ? 'selected' : ''}>自动重试</option>
                </select>
            </label>
            <div class="img-gen-size-chip">输出尺寸: ${escapeHtml(resolvedSize)}</div>
        </div>
    ` : `
        <div class="img-gen-controls">
            ${seedControlHtml}
            <label class="img-gen-field">
                <span>试用通道</span>
                <select class="img-gen-select" onchange="updateImgGenState('${task.id}', 'channel', this.value)" data-tip="试用版双通道切换">
                    <option value="channel_1" ${state.channel === 'channel_1' || !state.channel ? 'selected' : ''}>通道 1 主</option>
                    <option value="channel_2" ${state.channel === 'channel_2' ? 'selected' : ''}>通道 2 备</option>
                </select>
            </label>
            <label class="img-gen-field">
                <span>分辨率</span>
                <select class="img-gen-select" disabled data-tip="试用版分辨率固定为 1K">
                    <option selected>1K 锁定</option>
                </select>
            </label>
            <label class="img-gen-field">
                <span>重试</span>
                <select class="img-gen-select" onchange="updateImgGenState('${task.id}', 'autoRetry', this.value === 'true')">
                    <option value="false" ${!state.autoRetry ? 'selected' : ''}>单次</option>
                    <option value="true" ${state.autoRetry ? 'selected' : ''}>自动重试</option>
                </select>
            </label>
            <div class="img-gen-size-chip">输出尺寸: ${escapeHtml(resolvedSize)}</div>
        </div>
    `;

    return `
        <div class="img-gen-primary-panel">
            <label class="img-gen-field">
                <span>模型</span>
                <select class="img-gen-select" onchange="updateImgGenState('${task.id}', 'version', this.value)" data-tip="试用版走旧模型双通道，专业版走 GPT Image 2">
                    <option value="trial" ${state.version === 'trial' ? 'selected' : ''} ${IMG_GEN_TRIAL_AVAILABLE ? '' : 'disabled'}>试用版 Legacy${IMG_GEN_TRIAL_AVAILABLE ? '' : '（服务关闭）'}</option>
                    <option value="pro" ${state.version === 'pro' ? 'selected' : ''}>专业版 GPT Image 2</option>
                </select>
            </label>
            <label class="img-gen-field">
                <span>画幅</span>
                <select class="img-gen-select" onchange="updateImgGenState('${task.id}', '${ratioKey}', this.value)" data-tip="${isPro ? '专业版画幅比例' : '试用版固定 1K，仅按比例构图'}">
                    ${renderImgGenRatioOptions(ratioValue, isPro)}
                </select>
            </label>
            <button class="img-gen-advanced-chip ${paramsCollapsed ? '' : 'is-open'}" type="button" onclick="toggleImgGenParamsPanel(event, '${task.id}')" data-tip="${paramsCollapsed ? '展开高级参数' : '收起高级参数'}">
                <span class="material-symbols-outlined">settings</span>
                高级
            </button>
        </div>
        ${customRatioHtml}
        <div class="img-gen-param-panel img-gen-advanced-panel ${paramsCollapsed ? 'is-collapsed' : ''}">
            <button class="img-gen-param-head" type="button" onclick="toggleImgGenParamsPanel(event, '${task.id}')">
                <span class="img-gen-param-title"><span class="material-symbols-outlined">tune</span> 高级参数</span>
                <span class="img-gen-param-summary">${escapeHtml(routeLabel)}</span>
                <span class="material-symbols-outlined">${paramsCollapsed ? 'expand_more' : 'expand_less'}</span>
            </button>
            ${paramsCollapsed ? '' : `<div class="img-gen-param-body">${advancedHtml}</div>`}
        </div>
    `;
}

function renderImgGenMaskPanel(task) {
    ensureImgGenState(task);
    if (task.state.version !== 'pro') return '';
    const imageList = Array.isArray(task.state.images) ? task.state.images : [];
    const baseImage = imageList[0] || null;
    const hasMaskReady = !!(task.state.maskBlob || task.state.maskImage);
    const collapsed = task.state.maskPanelCollapsed === true;
    if (collapsed) return '';

    if (!baseImage) {
        return `
            <div class="img-gen-mask-block img-gen-mini-panel is-readonly is-empty">
                <div class="img-gen-mini-panel-head">
                    <span><span class="material-symbols-outlined">gesture</span> 蒙版工具</span>
                    <button type="button" onclick="toggleImgGenMaskTools(event, '${task.id}')" data-tip="收起蒙版工具">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div class="img-gen-mask-empty">专业版蒙版需要先放入第 1 张底图。</div>
            </div>
        `;
    }

    const baseUrl = getBlobUrl(`${task.id}_mask_preview_${task.timestamp || ''}`, baseImage);
    return `
        <div class="img-gen-mask-block img-gen-mini-panel is-readonly ${hasMaskReady ? 'has-mask' : ''}">
            <div class="img-gen-mini-panel-head">
                <span><span class="material-symbols-outlined">gesture</span> 蒙版工具</span>
                <button type="button" onclick="toggleImgGenMaskTools(event, '${task.id}')" data-tip="收起蒙版工具">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            <div class="img-gen-mask-toolbar">
                <button class="img-gen-mask-btn is-primary" type="button" onclick="openImgGenMaskStudio(event, '${task.id}')" data-tip="打开大画布蒙版编辑器">
                    <span class="material-symbols-outlined">gesture</span>
                    编辑蒙版
                </button>
                <button class="img-gen-mask-btn" type="button" onclick="removeImgGenMask(event, '${task.id}')" ${!hasMaskReady ? 'disabled' : ''} data-tip="移除已保存蒙版">
                    <span class="material-symbols-outlined">layers_clear</span>
                    移除
                </button>
                <span class="img-gen-mask-pill ${hasMaskReady ? 'is-ready' : ''}">${hasMaskReady ? '蒙版已保存' : '未绘制蒙版'}</span>
            </div>
            <button class="img-gen-mask-preview ${hasMaskReady ? 'has-mask' : ''}" type="button" onclick="openImgGenMaskStudio(event, '${task.id}')" ondblclick="openImgGenMaskStudio(event, '${task.id}')" data-tip="点击进入大画布蒙版编辑">
                <img src="${escapeAttr(baseUrl)}" alt="mask-preview">
                <span class="img-gen-mask-preview-label">底图 / 蒙版源</span>
                ${hasMaskReady ? '<span class="img-gen-mask-preview-glow">局部重绘蒙版已就绪</span>' : '<span class="img-gen-mask-preview-glow is-muted">点击开始绘制蒙版</span>'}
            </button>
        </div>
    `;
}

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
    const promptOpen = task.state.promptToolsCollapsed !== true;
    const maskOpen = task.state.maskPanelCollapsed !== true;
    const hasMaskReady = !!(task.state.maskBlob || task.state.maskImage);
    return `
        <div class="img-gen-mini-tool-dock">
            <button class="img-gen-mini-tool ${promptOpen ? 'is-open' : ''}" type="button" onclick="toggleImgGenPromptTools(event, '${task.id}')" data-tip="${promptOpen ? '收起快捷提示词' : '展开快捷提示词'}">
                <span class="material-symbols-outlined">auto_awesome</span>
                <span>提示词</span>
            </button>
            <button class="img-gen-mini-tool ${maskOpen ? 'is-open' : ''} ${hasMaskReady ? 'is-ready' : ''}" type="button" onclick="toggleImgGenMaskTools(event, '${task.id}')" data-tip="${maskOpen ? '收起蒙版工具' : '展开蒙版工具'}">
                <span class="material-symbols-outlined">gesture</span>
                <span>蒙版</span>
                ${hasMaskReady ? '<i></i>' : ''}
            </button>
        </div>
    `;
}

function renderImgGenSlots(task) {
    ensureImgGenState(task);
    normalizeImgGenRefControls(task);
    const images = Array.isArray(task.state.images) ? task.state.images : [];
    const hasMaskReady = !!(task.state.maskBlob || task.state.maskImage);
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
        const label = isBase ? 'BASE / MASK' : `REF ${i}`;
        const hint = isBase ? '蒙版底图' : '参考图';

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
    const paramsCollapsed = state.paramsCollapsed === true;
    const resolvedSize = resolveImgGenSize(state);
    const ratioValue = state.proRatio;
    const showCustomRatio = ratioValue === 'custom';
    const routeLabel = `GPT Image 2 · ${resolvedSize}`;
    const seedValue = String(state.seed || '');
    const seedControlHtml = `
        <label class="img-gen-field img-gen-seed-field">
            <span>Seed</span>
            <div class="img-gen-seed-row">
                <button class="img-gen-seed-lock ${state.seedLocked ? 'is-locked' : ''}" type="button" onclick="updateImgGenState('${task.id}', 'seedLocked', ${state.seedLocked ? 'false' : 'true'})" data-tip="${state.seedLocked ? '解除种子锁定' : '锁定种子，便于复现'}">
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

    const advancedHtml = `
        <div class="img-gen-controls img-gen-controls-pro">
            ${seedControlHtml}
            <label class="img-gen-field">
                <span>分辨率</span>
                <select class="img-gen-select" onchange="updateImgGenState('${task.id}', 'proResolution', this.value)" data-tip="GPT Image 2 分辨率档位">
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
    `;

    return `
        <div class="img-gen-primary-panel">
            <label class="img-gen-field">
                <span>画幅</span>
                <select class="img-gen-select" onchange="updateImgGenState('${task.id}', 'proRatio', this.value)" data-tip="GPT Image 2 画幅比例">
                    ${renderImgGenRatioOptions(ratioValue, true)}
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
                <div class="img-gen-mask-empty">蒙版需要先放入第 1 张底图。</div>
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

function renderImgGenPendingItem(item, task) {
    const proStages = ['正在连接 GPT-Image 2...', '正在渲染画面细节...', '正在进行超分处理...', '正在封装输出图像...'];
    const stages = proStages;
    const itemId = item && item.id ? item.id : '';
    const startedAt = toFiniteNumber(item && item.createdAt, Date.now());
    return `
        <div class="img-gen-preview-item img-gen-preview-pending" data-preview-id="${escapeAttr(itemId)}">
            <button class="img-gen-preview-delete" type="button" onclick="removeImgGenPreviewItem(event, '${task.id}', '${itemId}')" data-tip="删除这条生成中记录">
                <span class="material-symbols-outlined">close</span>
            </button>
            <div class="img-gen-preview-skeleton">
                <div class="img-gen-skeleton-sheen"></div>
                <div class="img-gen-skeleton-orb"></div>
            </div>
            <div class="img-gen-preview-pending-inner">
                <svg class="spinner" viewBox="0 0 50 50"><circle cx="25" cy="25" r="20"></circle></svg>
                <div class="img-gen-preview-placeholder-title">生成中...</div>
                <div class="img-gen-preview-timer">
                    <span class="material-symbols-outlined">timer</span>
                    <span class="veo-dynamic-timer" data-start-time="${startedAt}">00:00</span>
                </div>
                <div class="img-gen-preview-stage-lines">
                    ${stages.map((stage) => `<span>${escapeHtml(stage)}</span>`).join('')}
                </div>
            </div>
        </div>
    `;
}

function renderImgGenFailedItem(item, task) {
    const reason = item && item.errorReason ? item.errorReason : '通道响应异常或超时';
    const itemId = item && item.id ? item.id : '';
    return `
        <div class="img-gen-preview-item img-gen-preview-failed" data-preview-id="${escapeAttr(itemId)}">
            <button class="img-gen-preview-delete" type="button" onclick="removeImgGenPreviewItem(event, '${task.id}', '${itemId}')" data-tip="删除这条失败记录">
                <span class="material-symbols-outlined">close</span>
            </button>
            <div class="img-gen-preview-pending-inner">
                <span class="material-symbols-outlined">warning</span>
                <div class="img-gen-preview-placeholder-title">本次失败</div>
                <div class="img-gen-preview-placeholder-sub">${escapeHtml(reason)}</div>
                <button class="img-gen-retry-route-btn" type="button" onclick="retryImgGenPreviewItem(event, '${task.id}')">
                    <span class="material-symbols-outlined">refresh</span>
                    重试
                </button>
            </div>
        </div>
    `;
}

function renderImgGenPreviewFeed(task, previewEntries) {
    const entries = Array.isArray(previewEntries) ? previewEntries.filter((item) => item && item.hidden !== true) : [];
    if (entries.length === 0) {
        return `<div class="img-gen-preview-placeholder"><span class="material-symbols-outlined">play_circle</span><div class="img-gen-preview-placeholder-title">点击生成开始预览</div><div class="img-gen-preview-placeholder-sub">结果将按时间顺序向下堆叠，最多保留 6 张</div></div>`;
    }

    const sorted = entries.slice().sort((a, b) => {
        const aPending = a && a.status === 'pending' ? 0 : 1;
        const bPending = b && b.status === 'pending' ? 0 : 1;
        if (aPending !== bPending) return aPending - bPending;
        return toFiniteNumber(b && b.createdAt, 0) - toFiniteNumber(a && a.createdAt, 0);
    });

    let successDragIndex = -1;
    return `<div class="img-gen-preview-feed">${
        sorted.map((item) => {
            if (!item) return '';
            if (item.status === 'pending') return renderImgGenPendingItem(item, task);
            if (item.status === 'failed') return renderImgGenFailedItem(item, task);
            if (item.status === 'success' && item.image) {
                successDragIndex++;
                const imgKey = `${task.id}_feed_${item.id}_${task.timestamp || ''}`;
                const imgUrl = getBlobUrl(imgKey, item.image);
                const safeRatio = Number.isFinite(Number(item.ratio)) && Number(item.ratio) > 0 ? Number(item.ratio) : 1;
                const layoutClass = item.layout === 'landscape' ? 'is-landscape' : (item.layout === 'portrait' ? 'is-portrait' : 'is-square');
                return `<div class="img-gen-preview-item ${layoutClass}" data-preview-id="${escapeAttr(item.id)}" style="--preview-aspect:${safeRatio};">
                    <button class="img-gen-preview-delete" type="button" onclick="removeImgGenPreviewItem(event, '${task.id}', '${item.id}')" data-tip="删除这张预览图">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                    <div class="img-gen-preview-actions" onmousedown="event.stopPropagation()" onclick="event.stopPropagation()">
                        <button type="button" onclick="sendImgGenPreviewToMask(event, '${task.id}', '${item.id}')" data-tip="把这张图作为 Base 打开蒙版重绘">
                            <span class="material-symbols-outlined">gesture</span>
                        </button>
                    </div>
                    <img src="${escapeAttr(imgUrl)}" draggable="true" ondragstart="event.dataTransfer.setData('application/json', JSON.stringify({taskId: '${task.id}', type: 'gen_result', previewId: '${item.id}', index: ${successDragIndex}}))" ondblclick="openLightbox(this.src)" data-tip="双击全屏高清预览，按住可拖动复用">
                </div>`;
            }
            return '';
        }).join('')
    }</div>`;
}

function renderImgGenHelpContent() {
    return `
        <section class="img-gen-help-section">
            <p class="img-gen-help-kicker">Veo Studio AI 生图指南</p>
            <h3>这个节点能做什么</h3>
            <p>AI 多模生图节点是工作台里的“图像发动机”：既能文生图，也能用参考图做变体，还能用蒙版局部重绘。当前一次点击只生成 1 张，右侧预览会保留最近 6 张结果，方便你连续试稿。</p>
            <div class="img-gen-help-tag-row">
                <span class="img-gen-help-tag">文生图</span>
                <span class="img-gen-help-tag">垫图变体</span>
                <span class="img-gen-help-tag">蒙版重绘</span>
                <span class="img-gen-help-tag">参考权重</span>
            </div>
        </section>
        <section class="img-gen-help-section">
            <h3>模型版本</h3>
            <div class="img-gen-help-grid">
                <div class="img-gen-help-card">
                    <strong>GPT Image 2</strong>
                    <p>GPT Image 2 面向正式图、产品海报、局部重绘和多参考图融合。支持高保真图片输入、1K/2K/4K 分辨率档位、质量和格式控制。</p>
                </div>
            </div>
            <p class="img-gen-help-note">使用边界：GPT Image 2 支持文字和图片输入并输出图片；透明背景目前不支持，背景建议使用 auto 或 opaque。</p>
        </section>
        <section class="img-gen-help-section">
            <h3>价格体系</h3>
            <div class="img-gen-help-table">
                <div><strong>输入</strong><span>￥5.0000 / 1M tokens。</span></div>
                <div><strong>输出</strong><span>￥30.0000 / 1M tokens。</span></div>
                <div><strong>中转折扣</strong><span>按上述 token 价格计算后再 × 1/2 入账。</span></div>
                <div><strong>计费方式</strong><span>按返回的 usage 里的 input_tokens / output_tokens 实时计费；示例：1643 + 1413 tokens 原价约 ￥0.0506，半价入账约 ￥0.0253。</span></div>
            </div>
        </section>
        <section class="img-gen-help-section">
            <h3>输入图槽位怎么用</h3>
            <ul>
                        <li><strong>底图 / 蒙版源</strong>：第一张主控图。做蒙版重绘时，蒙版会作用在这张图上，也是最强的结构参考。</li>
                <li><strong>REF 1-4</strong>：参考图槽。适合放产品细节、材质、风格、配色、版式灵感。它们会帮助 AI 理解“感觉”和“元素”，但不等于像素级复制。</li>
                <li><strong>参考意图 / 权重</strong>：每张垫图悬停后可设置“结构、风格、色彩、细节、版式”和 0-100 权重。产品白底图建议结构 85-95；环境图建议风格 45-70；配色板建议色彩 35-60。</li>
                <li><strong>拖放规则</strong>：可以从电脑、素材库或生成结果直接拖入槽位。第一张建议放要保留主体的图，其余放风格或局部细节参考。</li>
            </ul>
        </section>
        <section class="img-gen-help-section">
            <h3>高频参数</h3>
            <div class="img-gen-help-table">
                <div><strong>画幅比例</strong><span>决定横竖构图，例如 16:9 适合 YouTube 横版封面，9:16 适合 Shorts / Reels，1:1 适合社媒方图。</span></div>
                <div><strong>分辨率</strong><span>可选 1K/2K/4K。1K 适合快速试稿，2K 适合正式发布，4K 适合产品细节但更慢更贵。</span></div>
                <div><strong>Prompt</strong><span>建议写清主体、场景、风格、构图、光线、用途。做改图时要写“保留什么”和“只修改什么”。</span></div>
            </div>
            <p class="img-gen-help-note">后台会按“比例 + 分辨率档位”自动换算到 GPT Image 2 的有效尺寸范围，避免无效尺寸导致请求失败。</p>
        </section>
        <section class="img-gen-help-section">
                    <h3>高级参数字典</h3>
            <div class="img-gen-help-table">
                <div><strong>质量</strong><span>low 适合草稿和缩略图，medium 是速度/画质平衡，high 适合终稿。高质量 + 4K 会显著增加等待时间。</span></div>
                <div><strong>格式</strong><span>PNG 适合图文、UI、清晰边缘和后续再编辑；JPEG 速度快、体积小；WebP 适合网页展示和压缩存储。</span></div>
                <div><strong>背景</strong><span>GPT Image 2 建议 auto 或 opaque。透明背景不是 GPT Image 2 当前支持项，如果需要抠图请后续走单独抠图/去背工具。</span></div>
                <div><strong>审核</strong><span>auto 是标准安全过滤；low 更宽松但不能绕过安全策略。若被拦截，优先改 Prompt 的敏感描述。</span></div>
                <div><strong>重试</strong><span>单次适合避免重复扣费；失败面板里的“重试”会使用当前参数重新提交一次，不再自动切换通道。</span></div>
                <div><strong>Seed</strong><span>锁定后会尽量复现构图与随机性，适合在同一张产品图上连续做细节微调。</span></div>
            </div>
        </section>
        <section class="img-gen-help-section">
            <h3>结果图快捷流转</h3>
            <ul>
                <li><strong>蒙版</strong>：点击手势按钮会把该结果图送回当前节点作为 Base，并自动打开蒙版工作室，用于局部修瑕或换背景。</li>
            </ul>
        </section>
        <section class="img-gen-help-section">
            <h3>蒙版工作室</h3>
            <ol>
                <li>把要修改的底图拖入左侧 Base 大格。</li>
                <li>切换到 Pro 版本，点击 <strong>编辑蒙版</strong> 打开大画布工作室。</li>
                <li>在绘画模式下用<strong>左键涂抹</strong>需要修改的区域。</li>
                <li><strong>右键单击</strong>切换绘画模式 / 抓手模式；抓手模式下用左键拖动画布。</li>
                <li>用<strong>鼠标滚轮</strong>缩放视图，用 <strong>Ctrl+Z</strong> 回退上一笔。</li>
                <li>在 Prompt 里写清楚希望涂抹区域变成什么，再点击生成。</li>
            </ol>
            <p class="img-gen-help-note">重要：GPT Image 的蒙版是“提示词引导式”蒙版。模型会优先参考红色区域，但不保证像传统 PS 选区一样完全硬边精确；如果要更稳，请在 Prompt 里明确写“只修改蒙版区域，保留未涂抹区域”。</p>
        </section>
        <section class="img-gen-help-section">
            <h3>实战玩法：产品图与社媒图</h3>
            <ul>
                <li><strong>产品海报</strong>：Base 放产品实拍，REF 放品牌版式或竞品构图，Prompt 写清“保留产品结构、Logo、接口位置，生成高级商业海报”。</li>
                <li><strong>局部换物</strong>：只涂抹要换的物体，Prompt 用“replace the masked area with...”并补充材质、光影和透视。</li>
                <li><strong>版式变体</strong>：把上一张成功图拖回参考槽，Prompt 要求“same product, new layout, clean spacing, readable headline”。</li>
                <li><strong>连续试稿</strong>：先用 1K + low 快速找方向，满意后切 2K/4K + high 出终稿。右侧预览保留最近 6 张，方便回看和拖拽复用。</li>
            </ul>
        </section>
        <section class="img-gen-help-section">
            <h3>已知边界</h3>
            <ul>
                <li><strong>文字排版</strong>：GPT Image 2 的文字能力更强，但复杂小字、严密表格和品牌字体仍可能漂移。</li>
                <li><strong>主体一致性</strong>：多轮生成能保持大体风格，但人脸、Logo、精密产品结构仍建议用 Base 图和明确 Prompt 约束。</li>
                <li><strong>等待时间</strong>：复杂 Prompt、参考图、4K 和 high 质量会更慢，复杂请求可能需要较长处理时间。</li>
                <li><strong>成本意识</strong>：Pro 的参考图会按高保真输入处理，参考图越多、分辨率越高，成本和延迟越容易上升。</li>
            </ul>
        </section>
    `;
}

function closeImgGenHelp(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    const existing = document.getElementById('img-gen-help-drawer');
    if (!existing) return;
    existing.classList.remove('show');
    setTimeout(() => {
        if (existing.parentNode) existing.remove();
    }, 220);
}

function openImgGenHelp(e, taskId = '') {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    closeImgGenHelp();
    const drawer = document.createElement('div');
    drawer.id = 'img-gen-help-drawer';
    drawer.className = 'img-gen-help-drawer';
    drawer.innerHTML = `
        <div class="img-gen-help-backdrop" onclick="closeImgGenHelp(event)"></div>
        <aside class="img-gen-help-panel" role="dialog" aria-modal="true" aria-label="AI 生图节点说明书">
            <header class="img-gen-help-head">
                <div>
                    <span class="img-gen-help-eyebrow">NODE MANUAL</span>
                    <h2>AI 生图节点说明书</h2>
                </div>
                <button class="img-gen-help-close" type="button" onclick="closeImgGenHelp(event)" data-tip="关闭说明">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </header>
            <div class="img-gen-help-body">
                ${renderImgGenHelpContent()}
            </div>
        </aside>
    `;
    document.body.appendChild(drawer);
    drawer.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeImgGenHelp(event);
    }, true);
    setTimeout(() => {
        drawer.classList.add('show');
        const panel = drawer.querySelector('.img-gen-help-panel');
        if (panel) {
            panel.setAttribute('tabindex', '-1');
            try { panel.focus({ preventScroll: true }); } catch (err) {}
        }
    }, 20);
}

function renderImgGenCardHTML(task) {
    ensureImgGenState(task);
    const isFailed = task.status === 'failed';
    const previewCollapsed = task.state.previewCollapsed === true;
    const lastUsageCost = toFiniteNumber(task.state.lastUsageCost, NaN);
    const currentCost = Number.isFinite(lastUsageCost) && lastUsageCost > 0 ? formatImgGenMoney(lastUsageCost) : 'Token计费';
    const previewEntries = Array.isArray(task.state.previewHistory) ? task.state.previewHistory : [];
    const pendingCount = previewEntries.filter((item) => item && item.status === 'pending' && item.hidden !== true).length;
    const cooldownMs = Math.max(0, toFiniteNumber(task.state.nextSubmitAt, 0) - Date.now());
    const cooldownSec = Math.ceil(cooldownMs / 1000);
    const isBtnCooling = cooldownSec > 0;
    const retryTxt = task.retryCount ? ` (重试 ${task.retryCount})` : '';
    const safePrompt = escapeHtml(task.state.prompt || '');

    let btnContent = `<span class="material-symbols-outlined">draw</span> 生成 <span class="img-gen-btn-price">${currentCost}</span>`;
    if (pendingCount > 0) {
        btnContent = `
            <div class="img-gen-processing-wrap">
                <div class="img-gen-processing-head">
                    <div class="img-gen-processing-left">
                        <svg class="spinner" viewBox="0 0 50 50"><circle cx="25" cy="25" r="20"></circle></svg>
                        生成中 ${pendingCount} 项${retryTxt}
                    </div>
                    <div class="img-gen-runtime">${cooldownSec > 0 ? `冷却 ${cooldownSec}s` : '可再次生成'}</div>
                </div>
                <div class="img-gen-progress"><div class="img-gen-progress-bar"></div></div>
            </div>
        `;
    } else if (cooldownSec > 0) {
        btnContent = `<span class="material-symbols-outlined">schedule</span> 冷却中 ${cooldownSec}s`;
    }
    if (isFailed && pendingCount === 0 && cooldownSec === 0) {
        btnContent = `<span class="material-symbols-outlined">refresh</span> 失败，点击重试`;
    }

    const dockToggleIcon = previewCollapsed ? 'keyboard_arrow_right' : 'keyboard_arrow_left';
    const dockToggleTip = previewCollapsed ? '展开右侧预览面板' : '收纳右侧预览面板';

    return `<div class="card-header img-gen-card-header"><span class="img-gen-card-title"><span class="material-symbols-outlined">brush</span> AI 多模生图</span><div class="img-gen-card-actions"><button class="img-gen-help-trigger" type="button" onclick="openImgGenHelp(event, '${task.id}')" data-tip="用于生成、重绘和参考图融合的 AI 节点"><span class="material-symbols-outlined">info</span></button><button class="img-gen-card-close" onclick="removeTask('${task.id}')" data-tip="删除该组件"><span class="material-symbols-outlined">close</span></button></div></div>
    <div class="img-gen-shell">
        <div class="img-gen-split ${previewCollapsed ? 'preview-collapsed' : ''}">
            <div class="img-gen-left">
                <div class="img-gen-panel-head">
                    <span class="img-gen-panel-title">INPUT</span>
                    <button class="img-gen-dock-toggle" onclick="toggleImgGenPreviewPanel(event, '${task.id}')" data-tip="${dockToggleTip}">
                        <span class="material-symbols-outlined">${dockToggleIcon}</span>
                    </button>
                </div>
                <div class="img-gen-input-body">
                    <div class="img-gen-statusbar">
                        <span class="img-gen-status-badge is-pro">GPT Image 2</span>
                        <span class="img-gen-size-chip">${(task.state.proRatio === 'custom') ? `${task.state.customW}:${task.state.customH}` : task.state.proRatio} / ${(task.state.proResolution || '1k').toUpperCase()}</span>
                    </div>
                    ${renderImgGenSlots(task)}
                    <div class="img-gen-upload-note">第 1 张为 Base 图，右侧 4 格为 Reference。拖拽图片到此处会自动吸附。</div>
                    ${renderImgGenParams(task)}
                    ${renderImgGenMiniToolDock(task)}
                    ${renderImgGenMaskPanel(task)}
                    ${renderImgGenPromptChips(task)}
                    <textarea class="img-gen-prompt" oninput="updateImgGenPromptDraft('${task.id}', this.value)" placeholder="输入画面提示词，可垫入 1-5 张图配合描述...">${safePrompt}</textarea>
                    <button class="img-gen-btn ${(pendingCount > 0 || isBtnCooling) ? 'is-running' : ''} ${isFailed && pendingCount === 0 ? 'is-failed' : ''}" onclick="submitImgGen('${task.id}')" ${isBtnCooling ? 'disabled' : ''}>${btnContent}</button>
                </div>
            </div>
            <aside class="img-gen-preview-panel ${previewCollapsed ? 'is-collapsed' : ''} ${pendingCount > 0 ? 'is-running' : ''}">
                <div class="img-gen-preview-head">
                    <div class="img-gen-preview-head-main">
                        <span class="img-gen-preview-title">OUTPUT</span>
                        <div class="img-gen-preview-tabs">
                            <button class="img-gen-preview-tab is-active" type="button">Preview</button>
                            <button class="img-gen-preview-tab" type="button" disabled>JSON</button>
                        </div>
                    </div>
                    <button class="img-gen-preview-toggle" onclick="toggleImgGenPreviewPanel(event, '${task.id}')" data-tip="收纳预览面板">
                        <span class="material-symbols-outlined">keyboard_arrow_right</span>
                    </button>
                </div>
                <div class="img-gen-preview-body">
                    ${renderImgGenPreviewFeed(task, previewEntries)}
                </div>
            </aside>
        </div>
    </div>`;
}

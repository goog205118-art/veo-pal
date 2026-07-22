function renderImgGenParams(task) {
    ensureImgGenState(task);
    const state = task.state;
    const cardView = window.VeoImageCardProfile ? window.VeoImageCardProfile.viewModel(task) : { routeLabel: 'GPT Image 2' };
    const paramsCollapsed = state.paramsCollapsed === true;
    const resolvedSize = resolveImgGenSize(state);
    const ratioValue = state.proRatio;
    const showCustomRatio = ratioValue === 'custom';
    const route = cardView.route || normalizeImgGenRoute(state.providerSort || state.routeMode || state.modelSuffix || state.channel);
    const routeValue = route.key || 'stable_channel_1';
    const isProRoute = route.version === 'pro';
    const resolutionValue = isProRoute ? (state.proResolution || '1k') : '1k';
    const routeOptionsHtml = [
        ['stable_channel_1', 'Stable 1K - Channel 1'],
        ['stable_channel_2', 'Stable 1K - Channel 2'],
        ['pro', 'Pro - GPT Image 2']
    ].map(([value, label]) => `<option value="${value}" ${routeValue === value ? 'selected' : ''}>${label}</option>`).join('');
    const routeLabel = `${cardView.routeLabel || 'GPT Image 2'} 路 ${resolvedSize}`;

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
            <label class="img-gen-field">
                <span>分辨率</span>
                <select class="img-gen-select" onchange="updateImgGenState('${task.id}', 'proResolution', this.value)" data-tip="GPT Image 2 分辨率档位">
                    <option value="1k" ${resolutionValue === '1k' ? 'selected' : ''}>1K</option>
                    <option value="2k" ${resolutionValue === '2k' ? 'selected' : ''} ${isProRoute ? '' : 'disabled'}>2K</option>
                    <option value="4k" ${resolutionValue === '4k' ? 'selected' : ''} ${isProRoute ? '' : 'disabled'}>4K</option>
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
            <div class="img-gen-size-chip">输出尺寸: ${escapeHtml(resolvedSize)}</div>
        </div>
    `;

    return `
        <div class="img-gen-primary-panel">
            <label class="img-gen-field">
                <span>Route</span>
                <select class="img-gen-select" onchange="updateImgGenState('${task.id}', 'providerSort', this.value)" data-tip="Stable 保持 1K 输出；Pro 开放 GPT Image 2 全部能力">
                    ${routeOptionsHtml}
                </select>
            </label>
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

function renderImgGenHelpContent() {
    return `
        <section class="img-gen-help-section">
            <p class="img-gen-help-kicker">Veo Studio AI 生图指南</p>
            <h3>这个节点能做什么</h3>
            <p>支持文生图、垫图变体和蒙版局部重绘。单次生成 1 张，右侧预览最多保留最近 6 张结果。</p>
        </section>
        <section class="img-gen-help-section">
            <h3>模型版本</h3>
            <p><strong>GPT Image 2</strong> 面向正式图、产品海报、局部重绘和多参考图融合。</p>
        </section>
        <section class="img-gen-help-section">
            <h3>参数说明</h3>
            <ul>
                <li>Stable 仅保留 1K 输出。</li>
                <li>Pro 开放 GPT Image 2 的全部能力。</li>
                <li>推荐按比例 + 分辨率来控制最终尺寸。</li>
            </ul>
        </section>
        <section class="img-gen-help-section">
            <h3>计费说明</h3>
            <ul>
                <li>Pro 按 token 计费。</li>
                <li>stable_channel_1 固定 0.06。</li>
                <li>stable_channel_2 固定 0.084。</li>
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
    const state = task.state;
    const cardView = window.VeoImageCardProfile ? window.VeoImageCardProfile.viewModel(task) : {
        title: 'AI 多模生图',
        modelBadge: 'GPT Image 2',
        helperTip: '用于生成、重绘和参考图融合的 AI 节点',
        uploadNote: '第 1 张为 Base 图，右侧 4 格为 Reference。拖拽图片到此处会自动吸附。',
        promptPlaceholder: '输入画面提示词，可放 1-5 张图配合描述...'
    };
    const route = cardView.route || normalizeImgGenRoute(state.providerSort || state.routeMode || state.modelSuffix || state.channel);
    const routePrice = route.version === 'pro'
        ? null
        : (route.key === 'stable_channel_1' ? 0.06 : (route.key === 'stable_channel_2' ? 0.084 : null));
    const isFailed = task.status === 'failed';
    const previewCollapsed = state.previewCollapsed === true;
    const lastUsageCost = toFiniteNumber(state.lastUsageCost, NaN);
    const currentCost = Number.isFinite(routePrice)
        ? formatImgGenMoney(routePrice)
        : (Number.isFinite(lastUsageCost) && lastUsageCost > 0 ? formatImgGenMoney(lastUsageCost) : 'Token计费');
    const previewEntries = Array.isArray(state.previewHistory) ? state.previewHistory : [];
    const cooldownMs = Math.max(0, toFiniteNumber(state.nextSubmitAt, 0) - Date.now());
    const cooldownSec = Math.ceil(cooldownMs / 1000);
    const isBtnCooling = cooldownSec > 0;
    const safePrompt = escapeHtml(state.prompt || '');
    const dockToggleIcon = previewCollapsed ? 'keyboard_arrow_right' : 'keyboard_arrow_left';
    const dockToggleTip = previewCollapsed ? '展开右侧预览面板' : '收纳右侧预览面板';

    let btnContent = `<span class="material-symbols-outlined">draw</span> 生成 <span class="img-gen-btn-price">${currentCost}</span>`;
    if (cooldownSec > 0) {
        btnContent = `<span class="material-symbols-outlined">schedule</span> 冷却中 ${cooldownSec}s`;
    }
    if (isFailed && cooldownSec === 0) {
        btnContent = `<span class="material-symbols-outlined">refresh</span> 失败，点击重试`;
    }

    return `<div class="card-header img-gen-card-header"><span class="img-gen-card-title"><span class="material-symbols-outlined">brush</span> ${escapeHtml(cardView.title)}</span><div class="img-gen-card-actions"><button class="img-gen-help-trigger" type="button" onclick="openImgGenHelp(event, '${task.id}')" data-tip="${escapeAttr(cardView.helperTip)}"><span class="material-symbols-outlined">info</span></button><button class="img-gen-card-close" onclick="removeTask('${task.id}')" data-tip="删除该组件"><span class="material-symbols-outlined">close</span></button></div></div>
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
                        <span class="img-gen-status-badge is-pro">${escapeHtml(cardView.modelBadge)}</span>
                        <span class="img-gen-size-chip">${(state.proRatio === 'custom') ? `${state.customW}:${state.customH}` : state.proRatio} / ${(state.proResolution || '1k').toUpperCase()}</span>
                    </div>
                    ${renderImgGenSlots(task)}
                    <div class="img-gen-upload-note">${escapeHtml(cardView.uploadNote)}</div>
                    ${renderImgGenParams(task)}
                    ${renderImgGenMiniToolDock(task)}
                    ${renderImgGenMaskPanel(task)}
                    ${renderImgGenPromptChips(task)}
                    <textarea class="img-gen-prompt" oninput="updateImgGenPromptDraft('${task.id}', this.value)" onkeydown="return handleImgGenPromptKeydown(event, '${task.id}')" placeholder="${escapeAttr(cardView.promptPlaceholder)}">${safePrompt}</textarea>
                    <button class="img-gen-btn ${isFailed && cooldownSec === 0 ? 'is-failed' : ''}" onclick="submitImgGen('${task.id}')" ${isBtnCooling ? 'disabled' : ''}>${btnContent}</button>
                </div>
            </div>
            <aside class="img-gen-preview-panel ${previewCollapsed ? 'is-collapsed' : ''}">
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

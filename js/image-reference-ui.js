// Image generation reference slots, prompt chips, and compact tool controls.
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
    const refIntents = window.VeoImageConfig.getRefIntents();
    const allowed = new Set(refIntents.map((item) => item.value));
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
    return window.VeoImageConfig.getRefIntents().map((item) => (
        `<option value="${escapeAttr(item.value)}" ${selected === item.value ? 'selected' : ''}>${escapeHtml(item.label)}</option>`
    )).join('');
}

function renderImgGenRefControl(task, index) {
    const controls = normalizeImgGenRefControls(task);
    const control = createImgGenRefControl(index, controls[index] || {});
    const percent = Math.round(control.weight * 100);
    const refIntents = window.VeoImageConfig.getRefIntents();
    const hint = (refIntents.find((item) => item.value === control.intent) || refIntents[0] || {}).hint || '';
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
    const chips = window.VeoImageConfig.promptTags.map((tag, index) => {
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
                <strong>${isSingleRefRoute ? 'Current route keeps 1 reference; dropping a new image replaces it' : '释放图片，吸附到生图节点'}</strong>
            </div>
        </div>
    `;
}

window.VeoImageReferenceUI = {
    buildRefControlPayload: buildImgGenRefControlPayload,
    clampRefWeight: clampImgGenRefWeight,
    createRefControl: createImgGenRefControl,
    getDefaultRefIntent: getImgGenDefaultRefIntent,
    normalizeRefControls: normalizeImgGenRefControls,
    renderMiniToolDock: renderImgGenMiniToolDock,
    renderPromptChips: renderImgGenPromptChips,
    renderRatioOptions: renderImgGenRatioOptions,
    renderRefControl: renderImgGenRefControl,
    renderRefIntentOptions: renderImgGenRefIntentOptions,
    renderSlots: renderImgGenSlots
};

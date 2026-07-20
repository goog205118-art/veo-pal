// Image mask editor runtime and card actions.
// Loaded as a classic script so render hooks and inline handlers keep resolving globals.

const imgMaskEditorInstances = new Map();

function stopMaskEditorEvent(event, needPreventDefault = false) {
    if (!event) return;
    if (needPreventDefault && typeof event.preventDefault === 'function') event.preventDefault();
    if (typeof event.stopPropagation === 'function') event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
}

function clampImgMaskBrushSize(size) {
    return Math.max(4, Math.min(192, Math.round(toFiniteNumber(size, 20))));
}

function clampImgMaskStageHeight(size) {
    return Math.max(140, Math.min(560, Math.round(toFiniteNumber(size, 220))));
}

function syncImgGenMaskBrushControls(taskId, nextSize) {
    if (!taskId || !document) return;
    const safeSize = clampImgMaskBrushSize(nextSize);
    document.querySelectorAll(`[data-mask-brush-input="${cssEscapeSafe(taskId)}"]`).forEach((input) => {
        input.value = String(safeSize);
    });
    document.querySelectorAll(`[data-mask-brush-label="${cssEscapeSafe(taskId)}"]`).forEach((label) => {
        label.textContent = `${safeSize}px`;
    });
}

function syncImgGenMaskStageSizeControls(taskId, nextHeight) {
    if (!taskId || !document) return;
    const safeHeight = clampImgMaskStageHeight(nextHeight);
    document.querySelectorAll(`[data-mask-stage-input="${cssEscapeSafe(taskId)}"]`).forEach((input) => {
        input.value = String(safeHeight);
    });
    document.querySelectorAll(`[data-mask-stage-label="${cssEscapeSafe(taskId)}"]`).forEach((label) => {
        label.textContent = `${safeHeight}px`;
    });
    document.querySelectorAll(`[data-mask-stage-size="${cssEscapeSafe(taskId)}"]`).forEach((stage) => {
        stage.style.height = `${safeHeight}px`;
    });
}

async function persistImgGenMaskBrushSize(taskId, size) {
    const nextSize = clampImgMaskBrushSize(size);
    syncImgGenMaskBrushControls(taskId, nextSize);
    const cardEl = document.getElementById('card-' + taskId);
    if (cardEl) cardEl.setAttribute('data-sync-mask-brush', String(nextSize));
    const liveTask = getTaskShadow(taskId);
    if (liveTask && liveTask.type === 'tool_image_gen') {
        ensureImgGenState(liveTask);
        liveTask.state.maskBrushSize = nextSize;
        liveTask.timestamp = Date.now();
        setTaskShadow(liveTask);
    }
    const editor = imgMaskEditorInstances.get(taskId);
    if (editor) editor.setBrushSize(nextSize);
    return queueImgGenTaskUpdate(taskId, async () => {
        const baseTask = getTaskShadow(taskId) || await getTaskDB(taskId);
        if (!baseTask) return;
        const task = cloneTaskDeep(baseTask) || { ...baseTask };
        ensureImgGenState(task);
        task.state.maskBrushSize = nextSize;
        task.timestamp = Date.now();
        setTaskShadow(task);
        await saveTaskDB(task);
    }).catch(() => {});
}

async function persistImgGenMaskStageHeight(taskId, height) {
    const nextHeight = clampImgMaskStageHeight(height);
    syncImgGenMaskStageSizeControls(taskId, nextHeight);
    const cardEl = document.getElementById('card-' + taskId);
    if (cardEl) cardEl.setAttribute('data-sync-mask-height', String(nextHeight));
    const liveTask = getTaskShadow(taskId);
    if (liveTask && liveTask.type === 'tool_image_gen') {
        ensureImgGenState(liveTask);
        liveTask.state.maskStageHeight = nextHeight;
        liveTask.timestamp = Date.now();
        setTaskShadow(liveTask);
    }
    return queueImgGenTaskUpdate(taskId, async () => {
        const baseTask = getTaskShadow(taskId) || await getTaskDB(taskId);
        if (!baseTask) return;
        const task = cloneTaskDeep(baseTask) || { ...baseTask };
        ensureImgGenState(task);
        task.state.maskStageHeight = nextHeight;
        task.timestamp = Date.now();
        setTaskShadow(task);
        await saveTaskDB(task);
    }).catch(() => {});
}

class ImgMaskEditor {
    constructor(options = {}) {
        this.taskId = options.taskId || '';
        this.stageEl = options.stageEl || null;
        this.baseImgEl = options.baseImgEl || null;
        this.canvasEl = options.canvasEl || null;
        this.sourceRef = options.sourceRef || null;
        this.initialMask = options.initialMask || null;
        this.brushSize = clampImgMaskBrushSize(options.brushSize);
        this.onBrushSizePreview = typeof options.onBrushSizePreview === 'function' ? options.onBrushSizePreview : null;
        this.onBrushSizeCommit = typeof options.onBrushSizeCommit === 'function' ? options.onBrushSizeCommit : null;
        this.onStageDblClick = typeof options.onStageDblClick === 'function' ? options.onStageDblClick : null;
        this.ctx = null;
        this.isDrawing = false;
        this.pointerId = null;
        this.hasStroke = !!options.hasStroke;
        this.listeners = [];
        this.history = [];
        this.maxHistory = 24;
        this.isActive = false;
        this.isPanning = false;
        this.panPointerId = null;
        this.panStartX = 0;
        this.panStartY = 0;
        this.panStartOffsetX = 0;
        this.panStartOffsetY = 0;
        this.panX = 0;
        this.panY = 0;
        this.viewScale = 1;
        this.toolMode = 'paint';
        this.modeLabelEl = options.modeLabelEl || null;
    }

    _listen(target, type, handler, options) {
        if (!target || typeof target.addEventListener !== 'function') return;
        target.addEventListener(type, handler, options);
        this.listeners.push({ target, type, handler, options });
    }

    _releaseAllListeners() {
        this.listeners.forEach((item) => {
            if (!item || !item.target || typeof item.target.removeEventListener !== 'function') return;
            item.target.removeEventListener(item.type, item.handler, item.options);
        });
        this.listeners = [];
    }

    async _waitImageReady() {
        const imgEl = this.baseImgEl;
        if (!imgEl) return false;
        if (imgEl.complete && toFiniteNumber(imgEl.naturalWidth || imgEl.width, 0) > 0) return true;
        return new Promise((resolve) => {
            const done = (ok) => {
                imgEl.removeEventListener('load', onLoad);
                imgEl.removeEventListener('error', onError);
                resolve(ok);
            };
            const onLoad = () => done(true);
            const onError = () => done(false);
            imgEl.addEventListener('load', onLoad, { once: true });
            imgEl.addEventListener('error', onError, { once: true });
            setTimeout(() => done(imgEl.complete && toFiniteNumber(imgEl.naturalWidth || imgEl.width, 0) > 0), 1800);
        });
    }

    _getCanvasPoint(event) {
        const rect = this.canvasEl && typeof this.canvasEl.getBoundingClientRect === 'function'
            ? this.canvasEl.getBoundingClientRect()
            : null;
        if (!rect || rect.width <= 0 || rect.height <= 0) return null;
        const displayRect = this._getCanvasDisplayRect(rect);
        if (!displayRect || displayRect.width <= 0 || displayRect.height <= 0) return null;
        const clientX = toFiniteNumber(event && event.clientX, NaN);
        const clientY = toFiniteNumber(event && event.clientY, NaN);
        if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
        if (clientX < displayRect.left || clientX > displayRect.left + displayRect.width || clientY < displayRect.top || clientY > displayRect.top + displayRect.height) return null;
        const scaleX = this.canvasEl.width / displayRect.width;
        const scaleY = this.canvasEl.height / displayRect.height;
        return {
            x: Math.max(0, Math.min(this.canvasEl.width, (clientX - displayRect.left) * scaleX)),
            y: Math.max(0, Math.min(this.canvasEl.height, (clientY - displayRect.top) * scaleY))
        };
    }

    _setActive(active) {
        this.isActive = !!active;
    }

    _getCanvasDisplayRect(rect) {
        if (!this.canvasEl || !rect || rect.width <= 0 || rect.height <= 0) return rect;
        const canvasW = toFiniteNumber(this.canvasEl.width, 0);
        const canvasH = toFiniteNumber(this.canvasEl.height, 0);
        if (canvasW <= 0 || canvasH <= 0) return rect;
        const canvasRatio = canvasW / canvasH;
        const boxRatio = rect.width / rect.height;
        if (!Number.isFinite(canvasRatio) || canvasRatio <= 0 || !Number.isFinite(boxRatio) || boxRatio <= 0) return rect;
        let width = rect.width;
        let height = rect.height;
        let left = rect.left;
        let top = rect.top;
        if (boxRatio > canvasRatio) {
            height = rect.height;
            width = height * canvasRatio;
            left = rect.left + (rect.width - width) / 2;
        } else {
            width = rect.width;
            height = width / canvasRatio;
            top = rect.top + (rect.height - height) / 2;
        }
        return { left, top, width, height };
    }

    _applyViewTransform() {
        const transformValue = `translate(${this.panX}px, ${this.panY}px) scale(${this.viewScale})`;
        [this.baseImgEl, this.canvasEl].forEach((el) => {
            if (!el || !el.style) return;
            el.style.transformOrigin = '0 0';
            el.style.transform = transformValue;
        });
        if (this.stageEl) {
            this.stageEl.classList.toggle('is-panning', this.isPanning);
            this.stageEl.classList.toggle('is-pan-mode', this.toolMode === 'pan');
        }
        this._syncToolModeLabel();
    }

    _setBrushSize(size, notifyPreview = false) {
        this.brushSize = clampImgMaskBrushSize(size);
        if (notifyPreview && this.onBrushSizePreview) {
            try { this.onBrushSizePreview(this.brushSize); } catch (err) {}
        }
        return this.brushSize;
    }

    _syncToolModeLabel() {
        if (!this.modeLabelEl) return;
        this.modeLabelEl.textContent = this.toolMode === 'pan' ? '抓手模式' : '绘画模式';
        this.modeLabelEl.classList.toggle('is-pan', this.toolMode === 'pan');
    }

    _toggleToolMode(event) {
        stopMaskEditorEvent(event, true);
        this._setActive(true);
        this.toolMode = this.toolMode === 'pan' ? 'paint' : 'pan';
        this._applyViewTransform();
    }

    _startPan(event) {
        stopMaskEditorEvent(event, true);
        this.isPanning = true;
        this.panPointerId = event.pointerId;
        this.panStartX = event.clientX;
        this.panStartY = event.clientY;
        this.panStartOffsetX = this.panX;
        this.panStartOffsetY = this.panY;
        try { this.canvasEl.setPointerCapture(event.pointerId); } catch (err) {}
        this._applyViewTransform();
    }

    _pushHistory() {
        if (!this.ctx || !this.canvasEl) return;
        try {
            const snapshot = this.hasStroke
                ? this.ctx.getImageData(0, 0, this.canvasEl.width, this.canvasEl.height)
                : null;
            this.history.push(snapshot);
            if (this.history.length > this.maxHistory) this.history.shift();
        } catch (err) {}
    }

    undo() {
        if (!this.ctx || !this.canvasEl || this.history.length === 0) return;
        const snapshot = this.history.pop();
        this.ctx.clearRect(0, 0, this.canvasEl.width, this.canvasEl.height);
        if (snapshot) {
            try {
                this.ctx.putImageData(snapshot, 0, 0);
                this.hasStroke = true;
                return;
            } catch (err) {}
        }
        this.hasStroke = false;
    }

    _zoomAt(event) {
        if (!event || !this.stageEl) return;
        const rect = this.stageEl.getBoundingClientRect();
        if (!rect || rect.width <= 0 || rect.height <= 0) return;
        const oldScale = this.viewScale;
        const delta = toFiniteNumber(event.deltaY, 0);
        const factor = delta < 0 ? 1.12 : 0.88;
        const nextScale = Math.max(0.4, Math.min(6, oldScale * factor));
        if (Math.abs(nextScale - oldScale) < 0.001) return;
        const mx = toFiniteNumber(event.clientX, rect.left + rect.width / 2) - rect.left;
        const my = toFiniteNumber(event.clientY, rect.top + rect.height / 2) - rect.top;
        const worldX = (mx - this.panX) / oldScale;
        const worldY = (my - this.panY) / oldScale;
        this.viewScale = nextScale;
        this.panX = mx - worldX * nextScale;
        this.panY = my - worldY * nextScale;
        this._applyViewTransform();
    }

    _bindDrawEvents() {
        if (!this.canvasEl || !this.ctx) return;
        const sharedStop = (event) => stopMaskEditorEvent(event, true);

        this.stageEl.setAttribute('tabindex', '0');
        this._listen(this.stageEl, 'pointerenter', () => this._setActive(true));
        this._listen(this.stageEl, 'pointerleave', () => {
            if (!this.isDrawing && !this.isPanning) this._setActive(false);
        });
        this._listen(this.stageEl, 'focusin', () => this._setActive(true));
        this._listen(this.stageEl, 'focusout', () => {
            if (!this.isDrawing && !this.isPanning) this._setActive(false);
        });
        this._listen(this.stageEl, 'mousedown', (event) => stopMaskEditorEvent(event, true), true);
        this._listen(this.stageEl, 'mouseup', (event) => stopMaskEditorEvent(event, false), true);
        this._listen(this.stageEl, 'click', (event) => stopMaskEditorEvent(event, false), true);
        this._listen(this.stageEl, 'dblclick', (event) => {
            stopMaskEditorEvent(event, true);
            if (this.onStageDblClick) {
                try { this.onStageDblClick(event); } catch (err) {}
            }
        }, true);
        this._listen(this.stageEl, 'contextmenu', (event) => stopMaskEditorEvent(event, true), true);
        this._listen(this.stageEl, 'wheel', (event) => {
            stopMaskEditorEvent(event, true);
            this._zoomAt(event);
        }, { capture: true, passive: false });
        this._listen(this.stageEl, 'touchstart', sharedStop, { capture: true, passive: false });
        this._listen(this.stageEl, 'touchmove', sharedStop, { capture: true, passive: false });
        this._listen(this.stageEl, 'touchend', sharedStop, { capture: true, passive: false });
        this._listen(window, 'keydown', (event) => {
            if (!this.isActive) return;
            const tagName = event.target && event.target.tagName ? event.target.tagName : '';
            if (tagName === 'INPUT' || tagName === 'TEXTAREA' || (event.target && event.target.isContentEditable)) return;
            if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === 'z') {
                stopMaskEditorEvent(event, true);
                this.undo();
            }
        }, true);

        this._listen(this.canvasEl, 'pointerdown', (event) => {
            stopMaskEditorEvent(event, true);
            this._setActive(true);
            try { this.stageEl.focus({ preventScroll: true }); } catch (err) {}
            if (event.button === 2) {
                this._toggleToolMode(event);
                return;
            }
            if (event.button !== undefined && event.button !== 0) return;
            if (this.toolMode === 'pan') {
                this._startPan(event);
                return;
            }
            const point = this._getCanvasPoint(event);
            if (!point) return;
            this._pushHistory();
            this.isDrawing = true;
            this.pointerId = event.pointerId;
            try { this.canvasEl.setPointerCapture(event.pointerId); } catch (err) {}
            this.ctx.beginPath();
            this.ctx.moveTo(point.x, point.y);
            this.ctx.lineWidth = this.brushSize;
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            this.ctx.strokeStyle = 'rgba(255, 0, 0, 1)';
            this.ctx.globalCompositeOperation = 'source-over';
        });

        this._listen(this.canvasEl, 'pointermove', (event) => {
            if (this.isPanning) {
                if (this.panPointerId !== null && event.pointerId !== this.panPointerId) return;
                stopMaskEditorEvent(event, true);
                this.panX = this.panStartOffsetX + (event.clientX - this.panStartX);
                this.panY = this.panStartOffsetY + (event.clientY - this.panStartY);
                this._applyViewTransform();
                return;
            }
            if (!this.isDrawing) return;
            if (this.pointerId !== null && event.pointerId !== this.pointerId) return;
            stopMaskEditorEvent(event, true);
            const point = this._getCanvasPoint(event);
            if (!point) return;
            this.ctx.lineTo(point.x, point.y);
            this.ctx.stroke();
            this.hasStroke = true;
        });

        const stopDrawing = (event) => {
            if (this.isPanning) {
                if (this.panPointerId !== null && event.pointerId !== undefined && event.pointerId !== this.panPointerId) return;
                stopMaskEditorEvent(event, true);
                this.isPanning = false;
                this.panPointerId = null;
                this._applyViewTransform();
                return;
            }
            if (!this.isDrawing) return;
            if (this.pointerId !== null && event.pointerId !== undefined && event.pointerId !== this.pointerId) return;
            stopMaskEditorEvent(event, true);
            this.isDrawing = false;
            this.pointerId = null;
            try { this.ctx.closePath(); } catch (err) {}
        };

        this._listen(this.canvasEl, 'pointerup', stopDrawing);
        this._listen(this.canvasEl, 'pointercancel', stopDrawing);
        this._listen(this.canvasEl, 'pointerleave', stopDrawing);
    }

    async _drawMaskLayer(maskBlobOrUrl) {
        if (!maskBlobOrUrl || !this.ctx || !this.canvasEl) return;
        let src = '';
        let localUrl = '';
        if (typeof maskBlobOrUrl === 'string') src = maskBlobOrUrl;
        else {
            localUrl = URL.createObjectURL(maskBlobOrUrl);
            src = localUrl;
        }
        try {
            await new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    this.ctx.drawImage(img, 0, 0, this.canvasEl.width, this.canvasEl.height);
                    resolve();
                };
                img.onerror = () => resolve();
                img.src = src;
            });
            this.hasStroke = true;
        } finally {
            if (localUrl) {
                try { URL.revokeObjectURL(localUrl); } catch (err) {}
            }
        }
    }

    async init() {
        if (!this.stageEl || !this.baseImgEl || !this.canvasEl) return false;
        const imageReady = await this._waitImageReady();
        if (!imageReady) return false;
        const width = Math.max(1, Math.round(toFiniteNumber(this.baseImgEl.naturalWidth || this.baseImgEl.width, 1)));
        const height = Math.max(1, Math.round(toFiniteNumber(this.baseImgEl.naturalHeight || this.baseImgEl.height, 1)));
        this.canvasEl.width = width;
        this.canvasEl.height = height;
        this.ctx = this.canvasEl.getContext('2d');
        if (!this.ctx) return false;
        this.ctx.clearRect(0, 0, width, height);
        this._bindDrawEvents();
        if (this.initialMask) await this._drawMaskLayer(this.initialMask);
        this._applyViewTransform();
        return true;
    }

    setBrushSize(size) {
        this._setBrushSize(size, false);
    }

    clear(recordHistory = true) {
        if (!this.ctx || !this.canvasEl) return;
        if (recordHistory) this._pushHistory();
        this.ctx.clearRect(0, 0, this.canvasEl.width, this.canvasEl.height);
        this.hasStroke = false;
    }

    async exportMaskBlob() {
        if (!this.canvasEl || !this.ctx || !this.hasStroke) return null;
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = this.canvasEl.width;
        exportCanvas.height = this.canvasEl.height;
        const eCtx = exportCanvas.getContext('2d');
        if (!eCtx) return null;
        eCtx.fillStyle = '#000000';
        eCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
        eCtx.globalCompositeOperation = 'destination-out';
        eCtx.drawImage(this.canvasEl, 0, 0);
        return new Promise((resolve) => {
            exportCanvas.toBlob((blob) => resolve(blob || null), 'image/png');
        });
    }

    destroy() {
        if (this.brushHudTimer) clearTimeout(this.brushHudTimer);
        this._releaseAllListeners();
        this.stageEl = null;
        this.baseImgEl = null;
        this.canvasEl = null;
        this.modeLabelEl = null;
        this.ctx = null;
        this.isDrawing = false;
        this.pointerId = null;
        this.brushHudEl = null;
    }
}

function destroyImgMaskEditor(taskId) {
    if (!taskId) return;
    const inst = imgMaskEditorInstances.get(taskId);
    if (inst && typeof inst.destroy === 'function') inst.destroy();
    imgMaskEditorInstances.delete(taskId);
}

async function syncImgMaskEditor(cardEl, task) {
    if (!cardEl || !task || task.type !== 'tool_image_gen') return;
    ensureImgGenState(task);
    const taskId = task.id;
    const imageList = Array.isArray(task.state.images) ? task.state.images : [];
    const hasSourceImage = imageList.length > 0 && !!imageList[0];
    const shouldMount = task.state.maskEditMode === true && hasSourceImage;
    if (!shouldMount) {
        destroyImgMaskEditor(taskId);
        return;
    }

    const stageEl = cardEl.querySelector(`#img-mask-stage-${taskId}`);
    const baseImgEl = stageEl ? stageEl.querySelector(`#img-mask-base-${taskId}`) : null;
    const canvasEl = stageEl ? stageEl.querySelector(`#img-mask-canvas-${taskId}`) : null;
    if (!stageEl || !baseImgEl || !canvasEl) {
        destroyImgMaskEditor(taskId);
        return;
    }

    const sourceRef = imageList[0];
    const existing = imgMaskEditorInstances.get(taskId);
    if (existing && existing.stageEl === stageEl && existing.canvasEl === canvasEl && existing.sourceRef === sourceRef) {
        existing.setBrushSize(task.state.maskBrushSize);
        return;
    }

    destroyImgMaskEditor(taskId);
    const editor = new ImgMaskEditor({
        taskId,
        stageEl,
        baseImgEl,
        canvasEl,
        sourceRef,
        brushSize: task.state.maskBrushSize,
        initialMask: task.state.maskBlob || task.state.maskImage || null,
        hasStroke: !!(task.state.maskBlob || task.state.maskImage),
        onBrushSizePreview: (nextSize) => syncImgGenMaskBrushControls(taskId, nextSize),
        onBrushSizeCommit: (nextSize) => persistImgGenMaskBrushSize(taskId, nextSize),
        onStageDblClick: (event) => openImgGenMaskStudio(event, taskId)
    });
    const ok = await editor.init();
    if (!ok) {
        editor.destroy();
        return;
    }
    imgMaskEditorInstances.set(taskId, editor);
}

async function captureImgMaskFromEditor(taskId, task, options = {}) {
    const editor = imgMaskEditorInstances.get(taskId);
    if (!editor || !task || !task.state) return null;
    const maskBlob = await editor.exportMaskBlob();
    if (maskBlob) {
        task.state.maskBlob = maskBlob;
        task.state.maskImage = maskBlob;
    } else if (options.clearIfEmpty) {
        task.state.maskBlob = null;
        task.state.maskImage = null;
    }
    return maskBlob;
}

function buildImgMaskStudioKey(taskId) {
    return `studio:${taskId}`;
}

function getImgMaskStudioEl(taskId) {
    return document.getElementById(`img-mask-studio-${taskId}`);
}

function destroyImgMaskStudio(taskId) {
    const studioKey = buildImgMaskStudioKey(taskId);
    destroyImgMaskEditor(studioKey);
    const existing = getImgMaskStudioEl(taskId);
    if (existing) existing.remove();
}

async function openImgGenMaskStudio(e, taskId) {
    stopMaskEditorEvent(e, true);
    const baseTask = getTaskShadow(taskId) || await getTaskDB(taskId);
    const task = baseTask ? (cloneTaskDeep(baseTask) || { ...baseTask }) : null;
    if (!task || task.type !== 'tool_image_gen') return;
    ensureImgGenState(task);
    if (task.state.version !== 'pro') {
        showToast('试用版不支持蒙版编辑，请切换专业版 GPT Image 2', 'warning');
        return;
    }
    if (!Array.isArray(task.state.images) || !task.state.images[0]) {
        showToast('请先添加垫图，再打开大蒙版编辑器', 'warning');
        return;
    }

    try {
        await captureImgMaskFromEditor(taskId, task, { clearIfEmpty: false });
    } catch (err) {}

    task.state.maskEditMode = false;
    task.timestamp = Date.now();
    setTaskShadow(task);
    await saveTaskDB(task).catch(() => {});
    renderCard(taskId, task);

    destroyImgMaskStudio(taskId);
    const studioKey = buildImgMaskStudioKey(taskId);
    const maskSourceUrl = getBlobUrl(`${task.id}_mask_studio_${task.timestamp || ''}`, task.state.images[0]);
    const safeBrush = clampImgMaskBrushSize(task.state.maskBrushSize);
    const overlay = document.createElement('div');
    overlay.id = `img-mask-studio-${taskId}`;
    overlay.className = 'img-gen-mask-studio';
    overlay.innerHTML = `
        <div class="img-gen-mask-studio-backdrop"></div>
        <section class="img-gen-mask-studio-panel" role="dialog" aria-modal="true" aria-label="蒙版大画布编辑器">
            <header class="img-gen-mask-studio-head">
                <div>
                    <div class="img-gen-mask-studio-kicker">MASK STUDIO</div>
                    <div class="img-gen-mask-studio-title">大画布蒙版编辑</div>
                </div>
                <div class="img-gen-mask-studio-actions">
                    <label class="img-gen-mask-control">
                        <span class="material-symbols-outlined">radio_button_checked</span>
                        <span>笔刷</span>
                        <input type="range" min="4" max="192" step="1" value="${safeBrush}" data-mask-brush-input="${taskId}" oninput="updateImgGenMaskBrush(event, '${taskId}', this.value)">
                        <strong data-mask-brush-label="${taskId}">${safeBrush}px</strong>
                    </label>
                    <span class="img-gen-mask-mode-pill" id="img-mask-mode-${studioKey}">绘画模式</span>
                    <button class="img-gen-mask-btn is-primary" type="button" onclick="applyImgGenMaskStudio(event, '${taskId}')">
                        <span class="material-symbols-outlined">done_all</span>
                        应用并返回
                    </button>
                    <button class="img-gen-mask-btn" type="button" onclick="closeImgGenMaskStudio(event, '${taskId}')">
                        <span class="material-symbols-outlined">close</span>
                        取消
                    </button>
                </div>
            </header>
            <div class="img-gen-mask-studio-body">
                <div class="img-gen-mask-stage img-gen-mask-stage-large" id="img-mask-stage-${studioKey}">
                    <img class="img-gen-mask-base" id="img-mask-base-${studioKey}" src="${maskSourceUrl}" alt="mask-base-large">
                    <canvas class="img-gen-mask-canvas" id="img-mask-canvas-${studioKey}"></canvas>
                </div>
            </div>
            <footer class="img-gen-mask-studio-foot">
                <span>红色区域会作为重绘蒙版发送到后端。</span>
                <span>右键单击切换绘画/抓手 · 左键执行当前模式 · 鼠标滚轮缩放 · Ctrl+Z 回退</span>
            </footer>
        </section>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('mousedown', (event) => {
        if (typeof event.stopPropagation === 'function') event.stopPropagation();
    });
    overlay.addEventListener('wheel', (event) => {
        if (typeof event.stopPropagation === 'function') event.stopPropagation();
    }, { passive: false });
    overlay.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeImgGenMaskStudio(event, taskId);
    }, true);

    const stageEl = overlay.querySelector(`#img-mask-stage-${cssEscapeSafe(studioKey)}`);
    const baseImgEl = overlay.querySelector(`#img-mask-base-${cssEscapeSafe(studioKey)}`);
    const canvasEl = overlay.querySelector(`#img-mask-canvas-${cssEscapeSafe(studioKey)}`);
    const modeLabelEl = overlay.querySelector(`#img-mask-mode-${cssEscapeSafe(studioKey)}`);
    const editor = new ImgMaskEditor({
        taskId: studioKey,
        stageEl,
        baseImgEl,
        canvasEl,
        modeLabelEl,
        sourceRef: task.state.images[0],
        brushSize: safeBrush,
        initialMask: task.state.maskBlob || task.state.maskImage || null,
        hasStroke: !!(task.state.maskBlob || task.state.maskImage),
        onBrushSizePreview: (nextSize) => syncImgGenMaskBrushControls(taskId, nextSize),
        onBrushSizeCommit: (nextSize) => persistImgGenMaskBrushSize(taskId, nextSize)
    });
    const ok = await editor.init();
    if (!ok) {
        editor.destroy();
        destroyImgMaskStudio(taskId);
        showToast('大蒙版编辑器初始化失败，请重新打开', 'error');
        return;
    }
    imgMaskEditorInstances.set(studioKey, editor);
    try { stageEl.focus({ preventScroll: true }); } catch (err) {}
    setTimeout(() => overlay.classList.add('show'), 20);
}

async function applyImgGenMaskStudio(e, taskId) {
    stopMaskEditorEvent(e, true);
    const studioKey = buildImgMaskStudioKey(taskId);
    const editor = imgMaskEditorInstances.get(studioKey);
    if (!editor) {
        destroyImgMaskStudio(taskId);
        return;
    }
    await queueImgGenTaskUpdate(taskId, async () => {
        const baseTask = getTaskShadow(taskId) || await getTaskDB(taskId);
        if (!baseTask) return;
        const task = cloneTaskDeep(baseTask) || { ...baseTask };
        ensureImgGenState(task);
        const maskBlob = await editor.exportMaskBlob();
        task.state.maskBrushSize = clampImgMaskBrushSize(editor.brushSize);
        task.state.maskEditMode = false;
        task.state.maskBlob = maskBlob || null;
        task.state.maskImage = maskBlob || null;
        task.timestamp = Date.now();
        setTaskShadow(task);
        renderCard(taskId, task);
        await saveTaskDB(task);
        showToast(maskBlob ? '大蒙版已应用' : '蒙版为空，已清空', maskBlob ? 'success' : 'info');
    }).catch(() => {
        showToast('大蒙版应用失败', 'error');
    });
    destroyImgMaskStudio(taskId);
}

function closeImgGenMaskStudio(e, taskId) {
    stopMaskEditorEvent(e, true);
    destroyImgMaskStudio(taskId);
}

async function toggleImgGenMaskEditor(e, taskId) {
    return openImgGenMaskStudio(e, taskId);
}

async function updateImgGenMaskBrush(e, taskId, val) {
    stopMaskEditorEvent(e, false);
    const nextSize = clampImgMaskBrushSize(val);
    const editor = imgMaskEditorInstances.get(taskId);
    if (editor) editor.setBrushSize(nextSize);
    const studioEditor = imgMaskEditorInstances.get(buildImgMaskStudioKey(taskId));
    if (studioEditor) studioEditor.setBrushSize(nextSize);
    syncImgGenMaskBrushControls(taskId, nextSize);
    await persistImgGenMaskBrushSize(taskId, nextSize);
}

async function updateImgGenMaskStageHeight(e, taskId, val) {
    stopMaskEditorEvent(e, false);
    const nextHeight = clampImgMaskStageHeight(val);
    syncImgGenMaskStageSizeControls(taskId, nextHeight);
    await persistImgGenMaskStageHeight(taskId, nextHeight);
}

async function saveImgGenMask(e, taskId, options = {}) {
    stopMaskEditorEvent(e, true);
    const silent = !!(options && options.silent);
    return queueImgGenTaskUpdate(taskId, async () => {
        const baseTask = getTaskShadow(taskId) || await getTaskDB(taskId);
        if (!baseTask) return false;
        const task = cloneTaskDeep(baseTask) || { ...baseTask };
        ensureImgGenState(task);
        const maskBlob = await captureImgMaskFromEditor(taskId, task, { clearIfEmpty: true });
        task.timestamp = Date.now();
        setTaskShadow(task);
        renderCard(taskId, task);
        await saveTaskDB(task);
        if (!silent) showToast(maskBlob ? '蒙版已应用' : '蒙版为空，已清空', maskBlob ? 'success' : 'info');
        return !!maskBlob;
    }).catch(() => {
        if (!silent) showToast('应用蒙版失败', 'error');
        return false;
    });
}

async function clearImgGenMask(e, taskId) {
    stopMaskEditorEvent(e, true);
    const editor = imgMaskEditorInstances.get(taskId);
    if (editor) editor.clear();
    await queueImgGenTaskUpdate(taskId, async () => {
        const baseTask = getTaskShadow(taskId) || await getTaskDB(taskId);
        if (!baseTask) return;
        const task = cloneTaskDeep(baseTask) || { ...baseTask };
        ensureImgGenState(task);
        revokeBlobPrefixSafe(`${taskId}_mask_preview_`);
        revokeBlobPrefixSafe(`${taskId}_mask_studio_`);
        task.state.maskBlob = null;
        task.state.maskImage = null;
        task.timestamp = Date.now();
        setTaskShadow(task);
        renderCard(taskId, task);
        await saveTaskDB(task);
    }).catch(() => {
        showToast('清空蒙版失败', 'error');
    });
}

async function removeImgGenMask(e, taskId) {
    stopMaskEditorEvent(e, true);
    const editor = imgMaskEditorInstances.get(taskId);
    if (editor) editor.clear();
    await queueImgGenTaskUpdate(taskId, async () => {
        const baseTask = getTaskShadow(taskId) || await getTaskDB(taskId);
        if (!baseTask) return;
        const task = cloneTaskDeep(baseTask) || { ...baseTask };
        ensureImgGenState(task);
        revokeBlobPrefixSafe(`${taskId}_mask_preview_`);
        revokeBlobPrefixSafe(`${taskId}_mask_studio_`);
        task.state.maskBlob = null;
        task.state.maskImage = null;
        task.state.maskEditMode = false;
        task.timestamp = Date.now();
        setTaskShadow(task);
        renderCard(taskId, task);
        await saveTaskDB(task);
    }).then(() => {
        showToast('已移除蒙版', 'success');
    }).catch(() => {
        showToast('移除蒙版失败', 'error');
    });
}

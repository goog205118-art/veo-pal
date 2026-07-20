// ==========================================
// Task board orchestration and legacy global adapters (Veo Studio)
// ==========================================
const IMG_GEN_PRO_INPUT_PRICE_PER_1M = window.VeoImageCore.constants.PRO_INPUT_PRICE_PER_1M;
const IMG_GEN_PRO_OUTPUT_PRICE_PER_1M = window.VeoImageCore.constants.PRO_OUTPUT_PRICE_PER_1M;
const IMG_GEN_PROXY_RECHARGE_FACTOR = window.VeoImageCore.constants.PROXY_RECHARGE_FACTOR;
const IMG_GEN_PRO_FALLBACK_COST = window.VeoImageCore.constants.PRO_FALLBACK_COST;
const IMG_GEN_PREVIEW_LIMIT = 6;
const IMG_GEN_CLICK_COOLDOWN_MS = 3000;
const IMG_GEN_STAGE_DOCK_MIN_TRAVEL = 96;
const RETIRED_NODE_TYPES = new Set(['frame', 'note', 'tool_generator', 'tool_cropper']);
const IMG_GEN_ROUTE_CONFIG = window.VeoMedia.routeConfig;
function normalizeWebhookEndpointForCompare(rawUrl) {
    return window.VeoApi.normalizeEndpoint(rawUrl);
}

function isSameWebhookEndpoint(a, b) {
    return window.VeoApi.isSameEndpoint(a, b);
}

function isImageGenerationWebhookEndpoint(rawUrl) {
    return window.VeoApi.isImageGenerationEndpoint(rawUrl);
}

function isUnifiedImageWebhookEndpoint(rawUrl) {
    return window.VeoApi.isUnifiedImageEndpoint(rawUrl);
}

function resolveImgGenPollEndpoint() {
    return window.VeoApi.resolveImagePollEndpoint();
}

const IMG_GEN_REF_INTENTS = window.VeoMedia.refIntents;
const IMG_GEN_PROMPT_TAGS = [
    { group: '环境', label: '高山岩地', text: 'rugged alpine terrain, weathered rocks, expedition campsite' },
    { group: '环境', label: '沙漠硬光', text: 'remote desert plateau, dust in the air, hard sunlight' },
    { group: '光影', label: '金色电影光', text: 'cinematic golden hour lighting, long shadows, premium outdoor commercial look' },
    { group: '光影', label: '阴天轮廓光', text: 'dramatic overcast sky, high contrast rim light, volumetric atmosphere' },
    { group: '镜头', label: '35mm 主视觉', text: '35mm product hero shot, shallow depth of field, realistic perspective' },
    { group: '镜头', label: '微距细节', text: 'macro detail shot, tactile material texture, crisp industrial design' },
    { group: '材质', label: '硬核工业材质', text: 'matte black anodized aluminum, reinforced nylon, rugged utilitarian finish' },
    { group: '社媒', label: '海报留白', text: 'clean negative space for headline, premium e-commerce hero composition' }
];
let imgGenStageRailCollapsed = false;
let imgGenStageRailTimer = null;
let activeImgGenStageTaskId = '';
let imgGenStageRailFingerprint = '';
let activeImgGenStageReleasedTaskId = '';

try {
    imgGenStageRailCollapsed = localStorage.getItem('veo_img_gen_stage_collapsed') === '1';
} catch (err) {
    imgGenStageRailCollapsed = false;
}

async function blobsToBase64Sequential(blobs, options = {}) {
    return window.VeoMedia.blobsToBase64Sequential(blobs, options);
}

function buildImgGenImagePayloadFields(imagesBase64, maskBase64 = null, maxImages = 5) {
    return window.VeoMedia.buildImgGenImagePayloadFields(imagesBase64, maskBase64, maxImages);
}

function getImgGenMaxReferenceCount(task) {
    return window.VeoMedia.getImgGenMaxReferenceCount(task);
}

function limitImgGenReferencesForRoute(task, incomingImages = []) {
    return window.VeoMedia.limitImgGenReferencesForRoute(task, incomingImages);
}

function enforceImgGenRouteReferenceLimit(task) {
    if (!task || task.type !== 'tool_image_gen') return false;
    if (!task.state || typeof task.state !== 'object') task.state = {};
    const before = Array.isArray(task.state.images) ? task.state.images : [];
    const limited = limitImgGenReferencesForRoute(task, before);
    const changed = before.length !== limited.length || before.some((item, index) => item !== limited[index]);
    if (!changed) return false;
    const baseChanged = before[0] !== limited[0];
    task.state.images = limited;
    if (baseChanged) {
        task.state.maskBlob = null;
        task.state.maskImage = null;
        task.state.maskEditMode = false;
        if (task.id) {
            revokeBlobPrefixSafe(`${task.id}_mask_preview_`);
            revokeBlobPrefixSafe(`${task.id}_mask_studio_`);
            destroyImgMaskStudio(task.id);
            destroyImgMaskEditor(task.id);
        }
    }
    return true;
}

function resolveImgGenNetworkEncodeOptions(routeKey, kind = 'image') {
    return window.VeoMedia.resolveImgGenNetworkEncodeOptions(routeKey, kind);
}

async function buildBlobSignature(blob) {
    return window.VeoMedia.buildBlobSignature(blob);
}

async function readImageMeta(imageLike) {
    return window.VeoMedia.readImageMeta(imageLike);
}

function clearTaskPolling(taskId, removeActive = true) { return window.VeoVideoTasks.clearPolling(taskId, removeActive); }

function buildImgGenPollKey(taskId, previewItemId = '') {
    return window.VeoImageTasks.buildPollKey(taskId, previewItemId);
}

function clearImgGenPolling(taskId, previewItemId = null) {
    return window.VeoImageTasks.clearPolling(taskId, previewItemId);
}

function hasImgGenPolling(taskId, previewItemId = null) {
    return window.VeoImageTasks.hasPolling(taskId, previewItemId);
}

function isImgGenTaskStageDocked(task) { return false; }
function isPointInImgGenStageRail(clientX, clientY) { return false; }
function isPointNearImgGenStageRail(clientX, clientY) { return false; }
function setImgGenStageDragOver(isOver) {}
function canDragInfoDockToImgGenStage(dragInfo, clientX, clientY) { return false; }
function restoreMountedImgGenStageCards(exceptTaskId = '') { return []; }
async function restoreVisibleImgGenStageCards(exceptTaskId = '') { return []; }
async function renderImgGenStageRail(tasksArg = null) {}
function scheduleImgGenStageRailRender(delay = 80) {}
function toggleImgGenStageRail(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
}
async function focusImgGenStageCard(event, taskId) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
}
async function dockImgGenCardToStage(dragInfo) { return false; }
async function dockImgGenTaskById(event, taskId) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
}
function resolveTaskIdFromCardElement(cardEl) {
    if (!cardEl || !cardEl.id || !String(cardEl.id).startsWith('card-')) return '';
    return String(cardEl.id).slice(5);
}

function removeActiveTask(id) { return window.VeoVideoTasks.removeActive(id); }
function toggleDrawer() {
}
function toggleMaterialDrawer() { window.VeoMaterials.toggleDrawer(); }

function handleAuthError() {
    if (!sessionStorage.getItem('veo_admin_pwd')) return;
    sessionStorage.removeItem('veo_admin_pwd');
    showToast("密钥验证失败或已过期，即将退回登录舱", "error");
    setTimeout(() => {
        if (isReducedMotion()) {
            location.reload();
            return;
        }
        startRouteTransition('SESSION EXPIRED');
        setTimeout(() => location.reload(), ROUTE_TRANSITION_MS);
    }, 1500);
}

// ==========================================
// 🗂️ 智能素材库管理引擎
// ==========================================
async function renderMaterialLibrary() {
    return window.VeoMaterials.render();
}

async function deduplicateMaterials(event) {
    return window.VeoMaterials.deduplicate(event);
}

async function clearAllMaterials() {
    return window.VeoMaterials.clearAll();
}

async function deleteMaterial(e, id) {
    return window.VeoMaterials.deleteOne(e, id);
}

async function updateBillingUI() { return window.VeoBilling.updateTopBar(); }
async function openBillingModal() { return window.VeoBilling.openModal(); }
function closeBillingModal() { return window.VeoBilling.closeModal(); }
function updateEstimatedCost() { return window.VeoBilling.updateEstimatedCost(); }
function updateBatchCount(select) { return window.VeoBilling.updateBatchCount(select); }

async function alignSelectedCards() {
    const tasks = await getAllTasksDB();
    if (tasks.length === 0) return showToast("画布上目前没有任何卡片", "info");
    let targetIds = selectedTasks.size > 0 ? Array.from(selectedTasks) : tasks.map(t => t.id);
    let cardsToAlign = tasks.filter(t => targetIds.includes(t.id) && t.type !== 'local_image' && t.type !== 'frame' && !t.parentId);

    if(cardsToAlign.length === 0) return showToast("没有可排版的散落卡片", "info");

    cardsToAlign.forEach(normalizeTaskPosition);
    cardsToAlign.sort((a, b) => (Math.abs(a.y) + Math.abs(a.x)) - (Math.abs(b.y) + Math.abs(b.x)));

    // 先确保 DOM 已挂载，再使用真实包围盒做排版，避免固定宽高引发重叠与穿模
    await renderBoard();

    const minX = Math.min(...cardsToAlign.map(c => toFiniteNumber(c.x, 0)));
    const minY = Math.min(...cardsToAlign.map(c => toFiniteNumber(c.y, 0)));
    const gapX = 28;
    const gapY = 30;
    const viewportWidthBoard = Math.max(600, Math.floor(window.innerWidth / Math.max(0.1, toFiniteNumber(transform.scale, 1))));

    const sizeCache = new Map();
    cardsToAlign.forEach((task) => sizeCache.set(task.id, measureTaskAABB(task)));
    const widest = Math.max(...cardsToAlign.map(task => (sizeCache.get(task.id) || { width: 340 }).width), 340);
    const usableWidth = Math.max(widest + gapX, viewportWidthBoard - 120);

    let cursorX = minX;
    let cursorY = minY;
    let rowMaxHeight = 0;

    for (const task of cardsToAlign) {
        const size = sizeCache.get(task.id) || { width: 340, height: 400 };
        const nextRight = (cursorX - minX) + size.width;
        const shouldWrap = (cursorX !== minX) && (nextRight > usableWidth);
        if (shouldWrap) {
            cursorX = minX;
            cursorY += rowMaxHeight + gapY;
            rowMaxHeight = 0;
        }

        task.x = cursorX;
        task.y = cursorY;
        cursorX += size.width + gapX;
        rowMaxHeight = Math.max(rowMaxHeight, size.height);
    }

    if (typeof saveTaskBatchDB === 'function') await saveTaskBatchDB(cardsToAlign);
    else await Promise.all(cardsToAlign.map(saveTaskDB));
    await renderBoard();
    showToast(`🪄 空间清理完成：已按真实尺寸自动排版`, "success");
}

function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) { container = document.createElement('div'); container.id = 'toast-container'; document.body.appendChild(container); }
    const safeType = ['error', 'success', 'warning', 'info'].includes(type) ? type : 'info';
    const toast = document.createElement('div'); toast.className = `veo-toast toast-${safeType}`;
    let icon = safeType === 'error' ? 'error' : (safeType === 'success' ? 'check_circle' : (safeType === 'warning' ? 'warning' : 'info'));
    toast.innerHTML = `<span class="material-symbols-outlined icon" style="font-size: 16px;">${icon}</span> <span class="toast-message">${escapeHtml(message)}</span>`;
    container.appendChild(toast); setTimeout(() => { toast.classList.add('fade-out'); setTimeout(() => toast.remove(), 300); }, 3000);
}
window.alert = (msg) => showToast(msg, 'error');

let tooltipTimer = null;
document.addEventListener('mouseover', (e) => {
    const target = e.target.closest('[data-tip]'); if (!target) return;
    tooltipTimer = setTimeout(() => {
        const tipText = target.getAttribute('data-tip'); if (!tipText) return;
        const globalTooltip = document.getElementById('global-tooltip'); globalTooltip.innerText = tipText;
        const rect = target.getBoundingClientRect(); let x = rect.left + rect.width / 2, y = rect.top;
        if (y < 60) { y = rect.bottom; globalTooltip.classList.add('tooltip-bottom'); } else { globalTooltip.classList.remove('tooltip-bottom'); }
        globalTooltip.style.left = `${x}px`; globalTooltip.style.top = `${y}px`; globalTooltip.classList.add('show');
    }, 500);
});
document.addEventListener('mouseout', (e) => { const target = e.target.closest('[data-tip]'); if (!target) return; clearTimeout(tooltipTimer); document.getElementById('global-tooltip').classList.remove('show'); });

function openHelpModal() { const modal = document.getElementById('help-modal'); modal.style.display = 'flex'; modal.offsetHeight; modal.classList.add('show'); }
function closeHelpModal() { const modal = document.getElementById('help-modal'); modal.classList.remove('show'); setTimeout(() => modal.style.display = 'none', 300); }

const FRAME_SAFE_PADDING = 36;

function fitTaskInsideFrameBounds(task, frame, padding = FRAME_SAFE_PADDING) {
    if (!task || !frame || task.type === 'frame') return { taskChanged: false, frameChanged: false };
    normalizeTaskPosition(task);
    normalizeTaskPosition(frame);
    const safePad = Math.max(20, toFiniteNumber(padding, FRAME_SAFE_PADDING));
    const size = measureTaskAABB(task);
    let taskChanged = false;
    let frameChanged = false;
    const minFrameW = Math.max(340, size.width + safePad * 2);
    const minFrameH = Math.max(160, size.height + safePad * 2);
    if (toFiniteNumber(frame.width, 0) < minFrameW) {
        frame.width = minFrameW;
        frameChanged = true;
    }
    if (toFiniteNumber(frame.height, 0) < minFrameH) {
        frame.height = minFrameH;
        frameChanged = true;
    }
    const minX = frame.x + safePad;
    const minY = frame.y + safePad;
    const maxX = Math.max(minX, frame.x + frame.width - safePad - size.width);
    const maxY = Math.max(minY, frame.y + frame.height - safePad - size.height);
    const nextX = clampWorldValue(toFiniteNumber(task.x, 0), minX, maxX);
    const nextY = clampWorldValue(toFiniteNumber(task.y, 0), minY, maxY);
    if (Math.abs(nextX - task.x) > 0.1) {
        task.x = nextX;
        taskChanged = true;
    }
    if (Math.abs(nextY - task.y) > 0.1) {
        task.y = nextY;
        taskChanged = true;
    }
    return { taskChanged, frameChanged };
}

async function createFrame() {
    if (typeof showToast === 'function') showToast('Frame nodes are retired. Use AI image nodes instead.', 'info');
}

async function checkGroupDrop(draggedInfo) {
    if (!draggedInfo || !draggedInfo.task) return;
    if (draggedInfo.task.parentId) {
        draggedInfo.task.parentId = null;
        await saveTaskDB(draggedInfo.task);
    }
}

const viewport = document.getElementById('canvas-viewport'), board = document.getElementById('canvas-board'), marquee = document.getElementById('selection-marquee');
const canvasCamera = window.VeoCanvasCamera.configure({
    viewport,
    board,
    hooks: {
        syncMinimapViewport: () => syncMinimapViewport(),
        updateSelectionToolbar: () => updateSelectionToolbar(),
        scheduleViewportCulling: (delay) => scheduleViewportCulling(delay),
        renderMinimap: () => renderMinimap()
    }
});
const canvasSelection = window.VeoCanvasSelection.configure({ marquee });
let transform = canvasCamera.transform;
const viewportCulling = window.VeoViewportCulling.configure({
    viewport,
    board,
    transform,
    hooks: {
        clampScale: (value) => clampCanvasScale(value),
        getDraggingCardInfo: () => getDraggingCardInfo(),
        getTaskFallbackSize: (task) => getTaskFallbackSize(task),
        measureTaskAABB: (task) => measureTaskAABB(task),
        toFiniteNumber: (value, fallback) => toFiniteNumber(value, fallback)
    }
});
const minimap = window.VeoMinimap.configure({
    transform,
    hooks: {
        animateCameraTo: (target, options) => animateCameraTo(target, options),
        getAllTasks: () => getAllTasksDB(),
        getRetiredNodeTypes: () => RETIRED_NODE_TYPES,
        isStageDocked: (task) => isImgGenTaskStageDocked(task)
    }
});
window.VeoWorkspaceIO.configure({
    hooks: {
        alert: (message) => alert(message),
        afterImport: async () => {
            await renderBoard();
            await renderMaterialLibrary();
            await updateBillingUI();
            await renderMinimap();
        },
        blobToBase64: (blob, options) => blobToBase64(blob, options),
        blobsToBase64Sequential: (blobs, options) => blobsToBase64Sequential(blobs, options),
        confirmImport: (count) => confirm(`导入解析成功，共 ${count} 个节点。是否合并到当前画布？`),
        getAllTasks: () => getAllTasksDB(),
        getRetiredNodeTypes: () => RETIRED_NODE_TYPES,
        saveTasks: async (tasks) => {
            if (typeof saveTaskBatchDB === 'function') await saveTaskBatchDB(tasks);
            else for (const task of tasks) await saveTaskDB(task);
        }
    }
});
window.VeoWorkspaceInputs.configure({
    hooks: {
        addConsoleReferenceImage: (image) => addConsoleReferenceImage(image),
        compressImage: (file, maxEdge) => compressImageToBlob(file, maxEdge),
        getTask: (taskId) => getTaskDB(taskId),
        openMaterialDrawer: () => window.VeoMaterials.openDrawer(),
        renderMaterialLibrary: () => renderMaterialLibrary(),
        saveTask: (task) => saveTaskDB(task),
        setConsoleFrameImage: (stateKey, image) => setConsoleFrameImage(stateKey, image),
        showToast: (message, type) => showToast(message, type)
    }
});
window.VeoVideoConsole.configure({
    hooks: {
        alert: (message) => alert(message),
        compressImage: (file, maxEdge) => compressImageToBlob(file, maxEdge),
        getBlobUrl: (id, blob) => getBlobUrl(id, blob),
        getTask: (taskId) => getTaskDB(taskId),
        revokeBlobPrefix: (prefix) => revokeBlobPrefixSafe(prefix),
        showToast: (message, type) => showToast(message, type),
        updateEstimatedCost: () => updateEstimatedCost()
    }
});
window.VeoVideoConsole.bindBus();
window.VeoCanvasContextMenu.configure({
    hooks: {
        addConsoleReferenceImage: (image) => addConsoleReferenceImage(image),
        duplicateTask: async (taskId) => {
            const source = getTaskShadow(taskId) || await getTaskDB(taskId);
            if (!source) return;
            clearSelection();
            selectedTasks.add(taskId);
            await duplicateSelectedTasks();
        },
        ensureImageState: (task) => ensureImgGenState(task),
        focusTask: (taskId) => focusTaskById(taskId),
        getTask: (taskId) => getTaskDB(taskId),
        getTaskElement: (taskId) => document.getElementById('card-' + taskId),
        getTaskShadow: (taskId) => getTaskShadow(taskId),
        removeTask: (taskId) => removeTask(taskId),
        setConsoleFrameImage: (stateKey, image) => setConsoleFrameImage(stateKey, image),
        showToast: (message, type) => showToast(message, type)
    }
});
window.VeoCanvasCards.configure({
    hooks: {
        clampMaskBrushSize: (value) => clampImgMaskBrushSize(value),
        clampMaskStageHeight: (value) => clampImgMaskStageHeight(value),
        ensureImageState: (task) => ensureImgGenState(task),
        getPreviewFingerprint: (task) => getImgGenPreviewFingerprint(task),
        getTaskShadow: (taskId) => getTaskShadow(taskId),
        queueTaskUpdate: (taskId, updater) => queueImgGenTaskUpdate(taskId, updater),
        saveTask: (task) => saveTaskDB(task),
        setTaskShadow: (task) => setTaskShadow(task),
        toFiniteNumber: (value, fallback) => toFiniteNumber(value, fallback)
    }
});
window.VeoTaskActions.configure({
    hooks: {
        clearSelection: () => clearSelection(),
        clientToBoard: (clientX, clientY) => clientToBoard(clientX, clientY),
        cloneTask: (task) => cloneTaskDeep(task),
        createImagePreviewId: () => createImgGenPreviewId(),
        ensureImageState: (task) => ensureImgGenState(task),
        getImagePreviewLimit: () => IMG_GEN_PREVIEW_LIMIT,
        getSelectedTaskIds: () => Array.from(selectedTasks),
        getTask: (taskId) => getTaskDB(taskId),
        getTaskElement: (taskId) => document.getElementById('card-' + taskId),
        getTaskShadow: (taskId) => getTaskShadow(taskId),
        getViewportRect: () => viewport && typeof viewport.getBoundingClientRect === 'function'
            ? viewport.getBoundingClientRect()
            : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight },
        nextZIndex: () => {
            highestZIndex++;
            return highestZIndex;
        },
        recalcImageTaskStatus: (task) => recalcImgGenTaskStatus(task),
        renderBoard: () => renderBoard(),
        saveTask: (task) => saveTaskDB(task),
        scheduleViewportCulling: (delay) => scheduleViewportCulling(delay),
        selectTask: (taskId, el) => canvasSelection.selectTask(taskId, el),
        showToast: (message, type) => showToast(message, type),
        toFiniteNumber: (value, fallback) => toFiniteNumber(value, fallback),
        updateSelectionToolbar: () => updateSelectionToolbar()
    }
});
window.VeoTaskLifecycle.configure({
    hooks: {
        clearActiveStageTask: () => { activeImgGenStageTaskId = ''; },
        clearImagePolling: (taskId) => clearImgGenPolling(taskId),
        clearImageRuntime: (taskId) => clearImgGenStateRuntime(taskId),
        clearPromptDraft: (taskId) => clearImgGenPromptDraftTimer(taskId),
        clearSelection: () => clearSelection(),
        clearTaskShadow: (taskId) => clearTaskShadow(taskId),
        clearVideoPolling: (taskId) => clearTaskPolling(taskId),
        deleteTask: (taskId) => deleteTaskDB(taskId),
        deselectTask: (taskId) => selectedTasks.delete(taskId),
        destroyMaskEditor: (taskId) => destroyImgMaskEditor(taskId),
        destroyMaskStudio: (taskId) => destroyImgMaskStudio(taskId),
        getAllTasks: () => getAllTasksDB(),
        getSelectedTaskIds: () => Array.from(selectedTasks),
        isActiveStageTask: (taskId) => taskId === activeImgGenStageTaskId,
        removeCard: (taskId) => {
            const card = document.getElementById('card-' + taskId);
            if (card) card.remove();
        },
        renderMinimap: () => renderMinimap(),
        scheduleStageRailRender: (delay) => scheduleImgGenStageRailRender(delay),
        scheduleViewportCulling: (delay) => scheduleViewportCulling(delay),
        showToast: (message, type) => showToast(message, type),
        updateSelectionToolbar: () => updateSelectionToolbar()
    }
});
window.VeoCanvasRenderer.configure({
    hooks: {
        applyImageCardFrame: (cardEl, task) => applyImgGenCardFrame(cardEl, task),
        applySyncAttributes: (cardEl, task, syncSnapshot) => window.VeoCanvasCards.applySyncAttributes(cardEl, task, syncSnapshot),
        bindCardDrag: (cardEl, task) => bindCardDrag(cardEl, task),
        bindImageCardResizeSave: (cardEl, task) => bindImgGenCardResizeSave(cardEl, task),
        deselectTask: (taskId) => selectedTasks.delete(taskId),
        destroyMaskEditor: (taskId) => destroyImgMaskEditor(taskId),
        destroyMaskStudio: (taskId) => destroyImgMaskStudio(taskId),
        ensureVideoPollingTask: (task) => window.VeoVideoTasks.ensurePollingTask(task),
        getAllTasks: () => getAllTasksDB(),
        getBoardElement: () => board,
        getSyncSnapshot: (task) => window.VeoCanvasCards.getSyncSnapshot(task),
        getTask: (taskId) => getTaskDB(taskId),
        getTaskElement: (taskId) => document.getElementById('card-' + taskId),
        hasImagePolling: (taskId, previewItemId) => hasImgGenPolling(taskId, previewItemId),
        isRetiredTaskType: (taskType) => RETIRED_NODE_TYPES.has(taskType),
        isStageDocked: (task) => isImgGenTaskStageDocked(task),
        mergeImageTaskWithShadow: (task) => mergeImgGenTaskWithShadow(task, getTaskShadow(task.id), { protectedIds: getImgGenProtectedPreviewIds(task.id) }),
        morphCardDOM: (cardEl, html) => morphCardDOM(cardEl, html),
        normalizeTaskPosition: (task) => normalizeTaskPosition(task),
        renderImageCardHTML: (task) => renderImgGenCardHTML(task),
        renderMinimap: () => renderMinimap(),
        renderStageRail: (tasks) => renderImgGenStageRail(tasks),
        renderVideoCardHTML: (task) => renderVideoTaskCardHTML(task),
        resolveTaskIdFromCardElement: (cardEl) => resolveTaskIdFromCardElement(cardEl),
        scheduleStageRailRender: (delay) => scheduleImgGenStageRailRender(delay),
        scheduleViewportCulling: (delay) => scheduleViewportCulling(delay),
        setTaskShadow: (task) => setTaskShadow(task),
        shouldRefreshCard: (cardEl, task, syncSnapshot) => window.VeoCanvasCards.shouldRefresh(cardEl, task, syncSnapshot),
        startImagePolling: (taskId, remoteTaskId, previewItemId) => startImgGenTaskPolling(taskId, remoteTaskId, previewItemId),
        syncCardViewportMetrics: (cardEl, task) => syncCardViewportMetrics(cardEl, task),
        syncMaskEditor: (cardEl, task) => syncImgMaskEditor(cardEl, task),
        toFiniteNumber: (value, fallback) => toFiniteNumber(value, fallback),
        updateSelectionToolbar: () => updateSelectionToolbar()
    }
});
window.VeoCanvasInteractions.configure({
    viewport,
    board,
    transform,
    selection: canvasSelection,
    hooks: {
        activateImageStageTask: (task) => {
            if (!task || task.type !== 'tool_image_gen') return;
            activeImgGenStageTaskId = task.id;
            if (isImgGenTaskStageDocked(task)) scheduleImgGenStageRailRender(80);
        },
        applyCanvasTransform: (options) => applyCanvasTransform(options),
        buildSelectionCandidates: () => buildSelectionCandidates(),
        canDockToStage: (dragInfo, clientX, clientY) => canDragInfoDockToImgGenStage(dragInfo, clientX, clientY),
        cancelCameraAnimation: () => cancelCameraAnimation(),
        cancelCanvasInertia: () => cancelCanvasInertia(),
        checkGroupDrop: (dragInfo) => checkGroupDrop(dragInfo),
        clearSelection: () => clearSelection(),
        deleteSelectedTasks: () => deleteSelectedTasks(),
        dockToStage: (dragInfo) => dockImgGenCardToStage(dragInfo),
        duplicateSelectedTasks: () => duplicateSelectedTasks(),
        duplicateTask: (task, event) => duplicateTask(task, event),
        isPointInStageRail: (clientX, clientY) => isPointInImgGenStageRail(clientX, clientY),
        isPointNearStageRail: (clientX, clientY) => isPointNearImgGenStageRail(clientX, clientY),
        isTaskSelected: (taskId) => selectedTasks.has(taskId),
        nextZIndex: () => {
            highestZIndex++;
            return highestZIndex;
        },
        openTaskContextMenu: (event, taskId) => openCanvasTaskContextMenu(event, taskId),
        panCanvasBy: (deltaX, deltaY, options) => panCanvasBy(deltaX, deltaY, options),
        recordPanSample: (clientX, clientY) => recordPanSample(clientX, clientY),
        renderMinimap: () => renderMinimap(),
        requestSelectionToolbarUpdate: () => requestSelectionToolbarUpdate(),
        saveTask: (task) => saveTaskDB(task),
        scheduleViewportCulling: (delay) => scheduleViewportCulling(delay),
        setCanvasMoving: (active) => setCanvasMoving(active),
        setStageDragOver: (isOver) => setImgGenStageDragOver(isOver),
        showToast: (message, type) => showToast(message, type),
        startCanvasInertia: () => startCanvasInertia(),
        syncCardViewportMetrics: (cardEl, task) => syncCardViewportMetrics(cardEl, task),
        toFiniteNumber: (value, fallback) => toFiniteNumber(value, fallback),
        updateSelectionToolbar: () => updateSelectionToolbar(),
        zoomCanvasAt: (clientX, clientY, nextScale, options) => zoomCanvasAt(clientX, clientY, nextScale, options)
    }
});
let highestZIndex = 10;
const selectedTasks = canvasSelection.selectedTasks;

function clientToBoard(clientX, clientY) {
    return window.VeoCanvasCamera.clientToBoard(clientX, clientY);
}

function getEventClientPoint(e) {
    if (!e) return null;
    const hasClient = Number.isFinite(e.clientX) && Number.isFinite(e.clientY);
    if (hasClient) {
        return { x: e.clientX, y: e.clientY };
    }
    const hasPage = Number.isFinite(e.pageX) && Number.isFinite(e.pageY);
    if (hasPage) {
        return { x: e.pageX - window.scrollX, y: e.pageY - window.scrollY };
    }
    return null;
}

function normalizeTaskPosition(task) {
    if (!task || typeof task !== 'object') return;
    task.x = toFiniteNumber(task.x, 0);
    task.y = toFiniteNumber(task.y, 0);
}

function getTaskFallbackSize(task) {
    if (!task || typeof task !== 'object') return { width: 340, height: 400 };
    if (task.type === 'tool_image_gen') {
        ensureImgGenState(task);
        const isCollapsed = task.state.previewCollapsed === true;
        return {
            width: isCollapsed
                ? Math.max(320, Math.min(760, toFiniteNumber(task.state.cardWidthCollapsed, 360)))
                : Math.max(560, Math.min(1200, toFiniteNumber(task.state.cardWidthOpen, 680))),
            height: Math.max(420, Math.min(1100, toFiniteNumber(task.state.cardHeight, 520)))
        };
    }
    return {
        width: Math.max(280, toFiniteNumber(task.width, 340)),
        height: Math.max(220, toFiniteNumber(task.height, 400))
    };
}

function createDefaultImageGenTask(spawnX, spawnY) {
    return window.VeoTaskActions.createDefaultImageGenTask(spawnX, spawnY);
}

async function createImageGenNode(x = NaN, y = NaN) {
    return window.VeoTaskActions.createImageGenNode(x, y);
}

function measureTaskAABB(task) {
    const fallback = getTaskFallbackSize(task);
    const cardEl = task && task.id ? document.getElementById('card-' + task.id) : null;
    if (!cardEl) return fallback;
    const w = Math.round(toFiniteNumber(cardEl.offsetWidth, 0) || toFiniteNumber(cardEl.getBoundingClientRect && cardEl.getBoundingClientRect().width, 0));
    const h = Math.round(toFiniteNumber(cardEl.offsetHeight, 0) || toFiniteNumber(cardEl.getBoundingClientRect && cardEl.getBoundingClientRect().height, 0));
    return {
        width: Math.max(1, w || fallback.width),
        height: Math.max(1, h || fallback.height)
    };
}

function getVisibleWorldRect(screenPadding = 80) {
    return window.VeoCanvasCamera.getVisibleWorldRect(screenPadding);
}

function clampWorldValue(value, min, max) {
    if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) return value;
    return Math.max(min, Math.min(max, value));
}

function resolveLinkedNodePosition(sourceTask, targetSize = {}, options = {}) {
    const sourceSize = measureTaskAABB(sourceTask);
    const targetW = Math.max(240, toFiniteNumber(targetSize.width, 340));
    const targetH = Math.max(180, toFiniteNumber(targetSize.height, 420));
    const gap = Math.max(20, toFiniteNumber(options.gap, 36));
    const sourceX = toFiniteNumber(sourceTask && sourceTask.x, 0);
    const sourceY = toFiniteNumber(sourceTask && sourceTask.y, 0);
    const sourceBounds = {
        left: sourceX,
        top: sourceY,
        right: sourceX + sourceSize.width,
        bottom: sourceY + sourceSize.height
    };
    const visible = getVisibleWorldRect(96);
    const yBase = sourceY + toFiniteNumber(options.yOffset, 0);
    const xBase = sourceX + toFiniteNumber(options.xOffset, 0);
    const visibleCenterX = (visible.left + visible.right) / 2;
    const preferLeft = sourceX + sourceSize.width / 2 > visibleCenterX;
    const rightX = sourceBounds.right + gap;
    const leftX = sourceBounds.left - targetW - gap;
    const belowY = sourceBounds.bottom + gap;
    const aboveY = sourceBounds.top - targetH - gap;
    const clampY = (value) => clampWorldValue(value, visible.top, visible.bottom - targetH);
    const clampX = (value) => clampWorldValue(value, visible.left, visible.right - targetW);
    const candidates = [
        { x: rightX, y: clampY(yBase), side: 'right' },
        { x: leftX, y: clampY(yBase), side: 'left' },
        { x: clampX(xBase), y: belowY, side: 'below' },
        { x: clampX(xBase), y: aboveY, side: 'above' }
    ];
    if (preferLeft) candidates.splice(0, 2, candidates[1], candidates[0]);

    const fitsVisible = (pos) => (
        pos.x >= visible.left &&
        pos.y >= visible.top &&
        pos.x + targetW <= visible.right &&
        pos.y + targetH <= visible.bottom
    );
    const isOutsideSource = (pos) => (
        pos.x + targetW <= sourceBounds.left ||
        pos.x >= sourceBounds.right ||
        pos.y + targetH <= sourceBounds.top ||
        pos.y >= sourceBounds.bottom
    );
    const visibleHit = candidates.find((pos) => fitsVisible(pos) && isOutsideSource(pos));
    if (visibleHit) return { x: visibleHit.x, y: visibleHit.y };

    // If the source card fills the screen, still spawn outside its real bounds,
    // then camera focus will track the new linked node into view.
    const fallback = preferLeft && leftX >= visible.left - targetW * 1.4
        ? { x: leftX, y: clampY(yBase) }
        : { x: rightX, y: clampY(yBase) };
    return fallback;
}

function selectAndFocusTaskIds(taskIds) {
    const ids = Array.isArray(taskIds) ? taskIds.filter(Boolean) : [];
    if (!ids.length) return;
    clearSelection();
    ids.forEach((id) => {
        selectedTasks.add(id);
        const el = document.getElementById('card-' + id);
        if (el) {
            el.classList.add('selected');
            el.classList.remove('is-viewport-culled');
            highestZIndex++;
            el.style.zIndex = highestZIndex;
        }
    });
    updateSelectionToolbar();
    focusSelectedTasks();
}

function detectToolPluginType(el) {
    return '';
}

function clampCanvasScale(value) {
    return window.VeoCanvasCamera.clampScale(value);
}

function cancelCameraAnimation() {
    return window.VeoCanvasCamera.cancelAnimation();
}

function cancelCanvasInertia() {
    return window.VeoCanvasCamera.cancelInertia();
}

function setCanvasMoving(active) {
    return window.VeoCanvasCamera.setMoving(active);
}

function beginCanvasPan(e) {
    return window.VeoCanvasInteractions.beginCanvasPan(e);
}

function wakeMinimap(duration = 900) {
    return window.VeoCanvasCamera.wakeMinimap(duration);
}

function updateDynamicGrid() {
    return window.VeoCanvasCamera.updateDynamicGrid();
}

function applyCanvasTransform(options = {}) {
    return window.VeoCanvasCamera.applyTransform(options);
}

function zoomCanvasAt(clientX, clientY, nextScale, options = {}) {
    return window.VeoCanvasCamera.zoomAt(clientX, clientY, nextScale, options);
}

function panCanvasBy(deltaX, deltaY, options = {}) {
    return window.VeoCanvasCamera.panBy(deltaX, deltaY, options);
}

function animateCameraTo(target, options = {}) {
    return window.VeoCanvasCamera.animateTo(target, options);
}

function recordPanSample(clientX, clientY) {
    return window.VeoCanvasCamera.recordPanSample(clientX, clientY);
}

function startCanvasInertia() {
    return window.VeoCanvasCamera.startInertia();
}

function getCardWorldSize(cardEl, task) {
    return window.VeoViewportCulling.getCardWorldSize(cardEl, task);
}

function syncCardViewportMetrics(cardEl, task) {
    return window.VeoViewportCulling.syncCardViewportMetrics(cardEl, task);
}

function updateViewportCulling() {
    return window.VeoViewportCulling.updateViewportCulling();
}

function scheduleViewportCulling(delay = 120) {
    return window.VeoViewportCulling.scheduleViewportCulling(delay);
}

function getSelectionToolbarContext() {
    return {
        selectedTaskIds: Array.from(selectedTasks),
        isPanning: window.VeoCanvasInteractions.isPanning(),
        isSelecting: canvasSelection.isSelecting,
        actions: {
            focus: focusSelectedTasks,
            duplicate: duplicateSelectedTasks,
            delete: deleteSelectedTasks,
            clear: clearSelection
        }
    };
}

function getSelectedCanvasElements() {
    return window.VeoSelectionToolbar.getSelectedCanvasElements(Array.from(selectedTasks));
}

function ensureSelectionToolbar() {
    return window.VeoSelectionToolbar.ensureSelectionToolbar(getSelectionToolbarContext().actions);
}

function updateSelectionToolbar() {
    return window.VeoSelectionToolbar.updateSelectionToolbar(getSelectionToolbarContext());
}

function requestSelectionToolbarUpdate() {
    return window.VeoSelectionToolbar.requestSelectionToolbarUpdate(getSelectionToolbarContext());
}

function buildSelectionCandidates() {
    return canvasSelection.buildSelectionCandidates();
}

function clearSelection() {
    canvasSelection.clearSelection();
    updateSelectionToolbar();
    scheduleViewportCulling(40);
}

function consumeNestedCanvasWheel(e) {
    return window.VeoCanvasInteractions.consumeNestedCanvasWheel(e);
}

function startFrameResize(e, id) {
    return window.VeoCanvasInteractions.startFrameResize(e, id);
}

function bindCardDrag(cardEl, task) {
    return window.VeoCanvasInteractions.bindCardDrag(cardEl, task);
}

function getDraggingCardInfo() {
    return window.VeoCanvasInteractions.getDraggingCardInfo();
}

window.VeoCanvasInteractions.bind();

function buildDuplicateTaskPayload(originalTask, offsetX = 40, offsetY = 40) {
    return window.VeoTaskActions.buildDuplicateTaskPayload(originalTask, offsetX, offsetY);
}

function sanitizeImgGenCloneState(clone) {
    return window.VeoTaskActions.sanitizeImgGenCloneState(clone);
}

async function duplicateSelectedTasks() {
    return window.VeoTaskActions.duplicateSelectedTasks();
}

function getSelectedWorldBounds() {
    const elements = getSelectedCanvasElements();
    if (elements.length === 0) return null;
    return elements.reduce((acc, el) => {
        const task = el.__veoTask;
        if (!task) return acc;
        const size = getCardWorldSize(el, task);
        const left = toFiniteNumber(task.x, 0);
        const top = toFiniteNumber(task.y, 0);
        return {
            left: Math.min(acc.left, left),
            top: Math.min(acc.top, top),
            right: Math.max(acc.right, left + size.width),
            bottom: Math.max(acc.bottom, top + size.height)
        };
    }, { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
}

function focusSelectedTasks() {
    const bounds = getSelectedWorldBounds();
    if (!bounds || !Number.isFinite(bounds.left) || !Number.isFinite(bounds.right)) return;
    const width = Math.max(1, bounds.right - bounds.left);
    const height = Math.max(1, bounds.bottom - bounds.top);
    const marginX = Math.min(260, Math.max(120, window.innerWidth * 0.18));
    const marginY = Math.min(220, Math.max(110, window.innerHeight * 0.18));
    const nextScale = clampCanvasScale(Math.min((window.innerWidth - marginX) / width, (window.innerHeight - marginY) / height, 1.55));
    const centerX = bounds.left + width / 2;
    const centerY = bounds.top + height / 2;
    animateCameraTo({
        x: window.innerWidth / 2 - centerX * nextScale,
        y: window.innerHeight / 2 - centerY * nextScale,
        scale: nextScale
    }, { duration: 430 });
}

function focusTaskById(taskId) {
    const el = document.getElementById('card-' + taskId);
    const task = el && el.__veoTask;
    if (!el || !task) return;
    clearSelection();
    canvasSelection.selectTask(taskId, el);
    el.classList.remove('is-viewport-culled');
    highestZIndex++;
    el.style.zIndex = highestZIndex;
    updateSelectionToolbar();
    focusSelectedTasks();
    if (task.type === 'tool_image_gen') {
        activeImgGenStageTaskId = taskId;
        scheduleImgGenStageRailRender(40);
    }
}

async function deleteSelectedTasks() {
    return window.VeoTaskLifecycle.deleteSelectedTasks();
}

async function renderMinimap() {
    return window.VeoMinimap.render();
}

function syncMinimapViewport() {
    return window.VeoMinimap.syncViewport();
}

function handleMinimapClick(e) {
    return window.VeoMinimap.handleClick(e);
}

let lightboxEl = null;
function openLightbox(src) {
    if (!lightboxEl) { lightboxEl = document.createElement('div'); lightboxEl.className = 'image-lightbox'; lightboxEl.innerHTML = `<img>`; lightboxEl.onclick = () => { lightboxEl.classList.remove('show'); setTimeout(() => lightboxEl.style.display = 'none', 200); }; document.body.appendChild(lightboxEl); }
    lightboxEl.querySelector('img').src = src; lightboxEl.style.display = 'flex'; lightboxEl.offsetHeight; lightboxEl.classList.add('show');
}

window.VeoWorkspaceInputs.bindClipboardIngest();

const consoleEl = document.getElementById('floating-console');
document.addEventListener('click', (e) => {
    const popover = document.getElementById('ref-popover'), slotBox = document.getElementById('slot-ref-box');
    if (popover && popover.style.display === 'flex' && !popover.contains(e.target) && !slotBox.contains(e.target)) popover.style.display = 'none';
    if (e.target === viewport || e.target === board) {
        consoleEl.classList.add('minimized');
        document.getElementById('material-drawer').classList.remove('open');
    } else if (consoleEl.contains(e.target)) consoleEl.classList.remove('minimized');
});

viewport.addEventListener('dblclick', (e) => {
    if (e.target === viewport || e.target === board) {
        const p = clientToBoard(e.clientX, e.clientY);
        createImageGenNode(p.x, p.y);
    }
});

async function exportWorkspace() {
    return window.VeoWorkspaceIO.exportWorkspace();
}

async function importWorkspace(input) {
    return window.VeoWorkspaceIO.importWorkspace(input);
}
window.VeoWorkspaceInputs.preventGlobalFileDrop();
window.VeoWorkspaceInputs.bindViewportDrop(viewport);

// 🌟 强力拖放解析引擎 (通杀所有数据格式)
async function parseDroppedImage(e) {
    return window.VeoWorkspaceInputs.parseDroppedImage(e);
}

function getTaskReusableImage(task) {
    return window.VeoCanvasContextMenu.getTaskReusableImage(task);
}

async function sendTaskImageToConsole(taskId, target) {
    return window.VeoCanvasContextMenu.sendTaskImageToConsole(taskId, target);
}

function closeCanvasContextMenu() {
    return window.VeoCanvasContextMenu.close();
}

function openCanvasTaskContextMenu(e, taskId) {
    return window.VeoCanvasContextMenu.open(e, taskId);
}

window.VeoCanvasContextMenu.bindGlobalClose();

// ==========================================
// 🚀 核心：单节点局部渲染引擎 (彻底告别全局闪烁)
// ==========================================
function applyImgGenCardFrame(cardEl, task) {
    return window.VeoCanvasCards.applyImageCardFrame(cardEl, task);
}

function bindImgGenCardResizeSave(cardEl, task) {
    return window.VeoCanvasCards.bindImageCardResizeSave(cardEl, task);
}

async function renderCard(taskId, taskOverride = null) {
    return window.VeoCanvasRenderer.renderCard(taskId, taskOverride);
}

function bindMainConsoleDrop(slotId, stateKey) {
    return window.VeoWorkspaceInputs.bindMainConsoleDrop(slotId, stateKey);
}

function toggleRefPopover(e) { return window.VeoVideoConsole.toggleRefPopover(e); }
function syncVideoConsoleModeUI() { return window.VeoVideoConsole.syncModeUI(); }
function toggleConsoleAdvanced(e) { return window.VeoVideoConsole.toggleAdvanced(e); }
function toggleVideoConsoleMinimized(e) { return window.VeoVideoConsole.toggleMinimized(e); }
function expandVideoConsole() { return window.VeoVideoConsole.expand(); }
function setConsoleFrameImage(type, imageBlob, options = {}) { return window.VeoVideoConsole.setFrameImage(type, imageBlob, options); }
function addConsoleReferenceImage(imageBlob) { return window.VeoVideoConsole.addReferenceImage(imageBlob); }
function switchMode(mode) { return window.VeoVideoConsole.switchMode(mode); }
function updateInputMode(select) { return window.VeoVideoConsole.updateInputMode(select); }
function updateModel(select) { return window.VeoVideoConsole.updateModel(select); }
function updateRatio(select) { return window.VeoVideoConsole.updateRatio(select); }
function updateEnhance(select) { return window.VeoVideoConsole.updateEnhance(select); }
function updateUpsample(select) { return window.VeoVideoConsole.updateUpsample(select); }
function updateAutoRetry(select) { return window.VeoVideoConsole.updateAutoRetry(select); }

function formatImgGenMoney(amount) {
    return window.VeoImageCore.formatMoney(amount);
}

function extractImgGenUsage(rawData) {
    return window.VeoImageCore.extractUsage(rawData);
}

function calculateImgGenBilling(task, rawData) {
    return window.VeoImageCore.calculateBilling(task, rawData);
}
function handleMultiRefs(input) { return window.VeoVideoConsole.handleMultiRefs(input); }
function removeReference(event, index) { return window.VeoVideoConsole.removeReference(event, index); }
function clearReferences(e) { return window.VeoVideoConsole.clearReferences(e); }
function renderReferences() { return window.VeoVideoConsole.renderReferences(); }
function handleSingleFrame(input, type) { return window.VeoVideoConsole.handleSingleFrame(input, type); }
function clearFrame(event, type) { return window.VeoVideoConsole.clearFrame(event, type); }

async function submitBatchTask() { return window.VeoVideoTasks.submitBatchTask(); }
async function executeSubmission(params, promptText, offsetIndex = 0) { return window.VeoVideoTasks.executeSubmission(params, promptText, offsetIndex); }
async function retryTask(taskId, btnElement) { return window.VeoVideoTasks.retryTask(taskId, btnElement); }
function startTaskPolling(taskId) { return window.VeoVideoTasks.startPolling(taskId); }

async function reuseTask(taskId) { return window.VeoVideoConsole.reuseTask(taskId); }

function generateCardHTML(task) {
    return window.VeoCanvasRenderer.generateCardHTML(task);
}

// 🌟 初次挂载与排版专用的全局刷新函数
async function renderBoard() {
    return window.VeoCanvasRenderer.renderBoard();
}

async function removeTask(id) {
    return window.VeoTaskLifecycle.removeTask(id);
}
function downloadVideo(url) { const a = document.createElement('a'); a.href = url; a.target = "_blank"; a.download = `Studio_${Date.now()}.mp4`; a.click(); }

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initDB();
        applyCanvasTransform({ cull: false, revealMinimap: false });
        await renderBoard(); await renderMaterialLibrary();
        bindMainConsoleDrop('slot-ref-box', 'references'); bindMainConsoleDrop('slot-first-box', 'firstFrame'); bindMainConsoleDrop('slot-last-box', 'lastFrame');
        await updateBillingUI(); updateEstimatedCost();
    } catch (err) {
        console.error('主工作台初始化失败:', err);
        showToast('初始化失败，请刷新重试', 'error');
    }
});

// ==========================================
// 🌟 智能克隆引擎 (Alt + Drag 专用)
// ==========================================
async function duplicateTask(originalTask, mouseEvent) {
    if (!originalTask || typeof originalTask !== 'object') return;
    const pointerState = window.VeoCanvasInteractions.getPointerState();
    const cascadeOffset = !mouseEvent || !pointerState.isPrimaryPointerDown ? 40 : 0;
    const clone = buildDuplicateTaskPayload(originalTask, cascadeOffset, cascadeOffset);
    if (!clone) return;
    const newId = clone.id;

    await saveTaskDB(clone);
    await renderBoard();
    await renderCard(newId);

    const newCardEl = document.getElementById('card-' + newId);
    if (!newCardEl) {
        showToast("已克隆，但渲染节点未挂载，请重试一次", "error");
        return;
    }
    if (newCardEl.__veoTask) normalizeTaskPosition(newCardEl.__veoTask);
    normalizeTaskPosition(clone);
    const settledX = newCardEl.__veoTask ? toFiniteNumber(newCardEl.__veoTask.x, clone.x) : clone.x;
    const settledY = newCardEl.__veoTask ? toFiniteNumber(newCardEl.__veoTask.y, clone.y) : clone.y;
    clone.x = settledX;
    clone.y = settledY;
    if (newCardEl.__veoTask) {
        newCardEl.__veoTask.x = settledX;
        newCardEl.__veoTask.y = settledY;
    }

    highestZIndex++;
    newCardEl.style.zIndex = highestZIndex;
    newCardEl.style.willChange = 'transform';
    newCardEl.style.transform = `translate3d(${clone.x}px, ${clone.y}px, 0)`;

    clearSelection();
    selectedTasks.add(newId);
    newCardEl.classList.add('selected');
    updateSelectionToolbar();
    scheduleViewportCulling(40);

    // 仅在鼠标仍按下时接管拖拽，避免异步克隆后的错位
    if (pointerState.isPrimaryPointerDown && newCardEl.__veoTask && mouseEvent) {
        const dragStartX = toFiniteNumber(mouseEvent.clientX, pointerState.lastPointerClientX);
        const dragStartY = toFiniteNumber(mouseEvent.clientY, pointerState.lastPointerClientY);
        window.VeoCanvasInteractions.setDraggingCardInfo({
            el: newCardEl,
            task: newCardEl.__veoTask,
            startMouseX: dragStartX,
            startMouseY: dragStartY,
            initialX: toFiniteNumber(newCardEl.__veoTask.x, clone.x),
            initialY: toFiniteNumber(newCardEl.__veoTask.y, clone.y),
            fromCanvasCard: true,
            startedInsideStageRail: isPointInImgGenStageRail(dragStartX, dragStartY),
            startedNearStageRail: isPointNearImgGenStageRail(dragStartX, dragStartY),
            justCreated: true
        });
    } else {
        newCardEl.style.willChange = 'auto';
        // 若用户已松手，立即落库校正后坐标，避免刷新后回弹到旧位置
        try { await saveTaskDB(newCardEl.__veoTask || clone); } catch(err) { console.warn('clone settle save failed:', err); }
    }

    showToast("🪄 已克隆组件及参数", "success");
}

// ==========================================
// Image generation core wrappers. Domain rules live in js/image-core.js.
const IMG_GEN_PRO_SIZE_PRESETS = window.VeoImageCore.constants.PRO_SIZE_PRESETS;
const IMG_GEN_PRO_RULES = window.VeoImageCore.constants.PRO_SIZE_RULES;

function clampNumber(v, min, max) {
    return window.VeoImageCore.clampNumber(v, min, max);
}

function snapToGrid(v, grid) {
    return window.VeoImageCore.snapToGrid(v, grid);
}

function parseImgSizeValue(sizeStr) {
    return window.VeoImageCore.parseSizeValue(sizeStr);
}

function detectProPresetFromSize(sizeValue) {
    return window.VeoImageCore.detectProPresetFromSize(sizeValue);
}

function buildCustomSizeByResolution(customW, customH, proResolution) {
    return window.VeoImageCore.buildCustomSizeByResolution(customW, customH, proResolution);
}

function enforceProSizeRules(sizeValue) {
    return window.VeoImageCore.enforceProSizeRules(sizeValue);
}

function resolveImgGenSize(state) {
    return window.VeoImageCore.resolveSize(state);
}

function normalizeImgGenRoute(raw = 'ai666') {
    return window.VeoImageCore.normalizeRoute(raw);
}

function getImgGenModelForRoute(route) {
    return window.VeoImageCore.getModelForRoute(route);
}
function ensureImgGenState(task) {
    if (!task || task.type !== 'tool_image_gen') return;
    if (!task.state || typeof task.state !== 'object') task.state = {};
    if (!Array.isArray(task.state.images)) task.state.images = [];
    task.state.version = 'pro';
    const route = normalizeImgGenRoute(task.state.providerSort || task.state.modelSuffix || task.state.routeMode || 'ai666');
    task.state.providerSort = route.key;
    task.state.modelSuffix = route.suffix;
    task.state.routeMode = route.mode;
    task.state.imageModel = getImgGenModelForRoute(route);
    enforceImgGenRouteReferenceLimit(task);
    if (!task.state.quality) task.state.quality = 'auto';
    if (!task.state.format) task.state.format = 'png';
    if (!task.state.background) task.state.background = 'auto';
    if (!task.state.moderation) task.state.moderation = 'auto';
    task.state.stageDocked = false;
    task.state.stageReleased = false;
    task.state.n = 1;
    if (!task.state.size && task.state.size !== '') task.state.size = '1024x1024';
    if (!task.state.proRatio) task.state.proRatio = '1:1';
    if (!task.state.proResolution) task.state.proResolution = '1k';
    const ratioCustomW = parseInt(task.state.customW, 10);
    const ratioCustomH = parseInt(task.state.customH, 10);
    if (!Number.isFinite(ratioCustomW) || ratioCustomW < 1) task.state.customW = 9;
    if (!Number.isFinite(ratioCustomH) || ratioCustomH < 1) task.state.customH = 16;
    if (!task.state.prompt) task.state.prompt = '';
    if (typeof task.state.autoRetry !== 'boolean') task.state.autoRetry = false;
    if (typeof task.state.seedLocked !== 'boolean') task.state.seedLocked = false;
    const parsedSeed = parseInt(task.state.seed, 10);
    task.state.seed = Number.isFinite(parsedSeed) && parsedSeed >= 0 ? parsedSeed : '';
    normalizeImgGenRefControls(task);
    if (typeof task.state.previewCollapsed !== 'boolean') task.state.previewCollapsed = false;
    if (task.state.imgGenUiV2 !== true) {
        task.state.paramsCollapsed = true;
        task.state.promptToolsCollapsed = true;
        task.state.maskPanelCollapsed = true;
        task.state.imgGenUiV2 = true;
    }
    if (typeof task.state.paramsCollapsed !== 'boolean') task.state.paramsCollapsed = true;
    if (typeof task.state.promptToolsCollapsed !== 'boolean') task.state.promptToolsCollapsed = true;
    if (typeof task.state.maskPanelCollapsed !== 'boolean') task.state.maskPanelCollapsed = true;
    const lastUsageCost = toFiniteNumber(task.state.lastUsageCost, NaN);
    task.state.lastUsageCost = Number.isFinite(lastUsageCost) && lastUsageCost >= 0 ? lastUsageCost : null;
    if (!task.state.lastUsageDetail) task.state.lastUsageDetail = '';
    const openW = parseInt(task.state.cardWidthOpen, 10);
    const collapsedW = parseInt(task.state.cardWidthCollapsed, 10);
    const cardH = parseInt(task.state.cardHeight, 10);
    task.state.cardWidthOpen = Number.isFinite(openW) && openW >= 560 ? Math.min(1200, openW) : 680;
    task.state.cardWidthCollapsed = Number.isFinite(collapsedW) && collapsedW >= 320 ? Math.min(760, collapsedW) : 360;
    task.state.cardHeight = Number.isFinite(cardH) && cardH >= 420 ? Math.min(1100, cardH) : 520;
    if (typeof task.state.maskBlob === 'undefined') task.state.maskBlob = null;
    if (typeof task.state.maskImage === 'undefined') task.state.maskImage = null;
    if (typeof task.state.maskEditMode !== 'boolean') task.state.maskEditMode = false;
    const brushVal = parseInt(task.state.maskBrushSize, 10);
    task.state.maskBrushSize = Number.isFinite(brushVal) && brushVal > 0 ? clampImgMaskBrushSize(brushVal) : 20;
    task.state.maskStageHeight = clampImgMaskStageHeight(task.state.maskStageHeight);
    if (!task.state.maskBlob && task.state.maskImage) task.state.maskBlob = task.state.maskImage;
    if (!task.state.maskImage && task.state.maskBlob) task.state.maskImage = task.state.maskBlob;
    if (!Array.isArray(task.state.images) || task.state.images.length === 0) {
        if (task.id && (task.state.maskBlob || task.state.maskImage)) {
            revokeBlobPrefixSafe(`${task.id}_mask_preview_`);
            revokeBlobPrefixSafe(`${task.id}_mask_studio_`);
        }
        task.state.maskEditMode = false;
        task.state.maskBlob = null;
        task.state.maskImage = null;
    }
    if (!Array.isArray(task.state.resultBlobs)) task.state.resultBlobs = [];
    if (task.state.resultBlob && task.state.resultBlobs.length === 0) task.state.resultBlobs = [task.state.resultBlob];
    normalizeImgGenPreviewHistory(task);
    const detected = detectProPresetFromSize(task.state.size);
    if (!task.state.proRatio || task.state.proRatio === 'auto') task.state.proRatio = detected.proRatio;
    if (!task.state.proResolution) task.state.proResolution = detected.proResolution;
    task.state.size = resolveImgGenSize(task.state);
    recalcImgGenTaskStatus(task);
}

function resolveImgGenMode(state) {
    return window.VeoImageCore.resolveMode(state);
}

function getImgGenPreviewFingerprint(task) {
    if (!task || task.type !== 'tool_image_gen') return 'na';
    const list = getImgGenPreviewList(task);
    return list.map((item) => {
        if (!item) return 'x';
        const imageSig = item.image ? (typeof item.image === 'string' ? `url${item.image.length}` : `blob${toFiniteNumber(item.image.size, 0)}`) : 'noimg';
        return [
            item.id || '',
            item.status || '',
            item.remoteTaskId || '',
            item.errorReason || '',
            imageSig,
            toFiniteNumber(item.costTime, -1)
        ].join(':');
    }).join('|');
}

function scheduleNextPaint(callback) {
    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(callback);
        return;
    }
    setTimeout(callback, 16);
}

function waitNextPaint() {
    return new Promise((resolve) => scheduleNextPaint(resolve));
}

function forceRenderImgGenPreviewPanel(task, focusItemId = '') {
    if (!task || task.type !== 'tool_image_gen') return false;
    ensureImgGenState(task);
    const cardEl = document.getElementById('card-' + task.id);
    if (!cardEl) return false;

    task.state.previewCollapsed = false;
    setTaskShadow(task);

    const splitEl = cardEl.querySelector('.img-gen-split');
    const panelEl = cardEl.querySelector('.img-gen-preview-panel');
    const bodyEl = cardEl.querySelector('.img-gen-preview-body');
    const pendingCount = getVisibleImgGenPendingCount(task);

    if (splitEl) splitEl.classList.remove('preview-collapsed');
    if (panelEl) {
        panelEl.classList.remove('is-collapsed');
        panelEl.classList.toggle('is-running', pendingCount > 0);
    }
    if (bodyEl) {
        bodyEl.innerHTML = renderImgGenPreviewFeed(task, task.state.previewHistory || []);
    }
    applyImgGenCardFrame(cardEl, task);

    cardEl.setAttribute('data-sync-status', task.status || 'static');
    cardEl.setAttribute('data-sync-retry', task.retryCount || 0);
    cardEl.setAttribute('data-sync-preview-collapsed', 'false');
    cardEl.setAttribute('data-sync-preview-feed', getImgGenPreviewFingerprint(task));
    cardEl.__veoTask = task;

    if (focusItemId) scrollImgGenPreviewToItem(task.id, focusItemId);
    return true;
}

function scrollImgGenPreviewToItem(taskId, itemId) {
    if (!taskId || !itemId) return;
    scheduleNextPaint(() => {
        const cardEl = document.getElementById('card-' + taskId);
        if (!cardEl) return;
        const feed = cardEl.querySelector('.img-gen-preview-feed');
        const target = cardEl.querySelector(`[data-preview-id="${cssEscapeSafe(itemId)}"]`) || cardEl.querySelector('.img-gen-preview-pending');
        if (feed) {
            try { feed.scrollTo({ top: 0, behavior: 'smooth' }); } catch (err) { feed.scrollTop = 0; }
        }
        if (target && typeof target.animate === 'function') {
            target.animate([
                { transform: 'scale(0.985)', filter: 'brightness(1.18)' },
                { transform: 'scale(1)', filter: 'brightness(1)' }
            ], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' });
        }
    });
}

// ==========================================
// ⏱️ 动态秒表引擎 (Vanilla JS DOM 侧渲染，不触发重绘)
// ==========================================
setInterval(() => {
    document.querySelectorAll('.veo-dynamic-timer').forEach(el => {
        const startTime = parseInt(el.getAttribute('data-start-time'));
        if (!startTime) return;

        const diff = Math.floor((Date.now() - startTime) / 1000);
        const m = String(Math.floor(diff / 60)).padStart(2, '0');
        const s = String(diff % 60).padStart(2, '0');

        el.innerText = `${m}:${s}`;
    });
}, 1000);

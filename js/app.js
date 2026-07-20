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
let isSpacePanningKeyDown = false;
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
let transform = canvasCamera.transform, isPanning = false, startPanX = 0, startPanY = 0, ticking = false;
const viewportCulling = window.VeoViewportCulling.configure({
    viewport,
    board,
    transform,
    hooks: {
        clampScale: (value) => clampCanvasScale(value),
        getDraggingCardInfo: () => draggingCardInfo,
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
let draggingCardInfo = null, highestZIndex = 10, scrollTimeout;
const selectedTasks = canvasSelection.selectedTasks;
let isPrimaryPointerDown = false;
let lastPointerClientX = 0;
let lastPointerClientY = 0;
let resizeRefreshTimer = null;

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
    return {
        id: 'tool_img_' + Date.now(),
        type: 'tool_image_gen',
        x: toFiniteNumber(spawnX, 0),
        y: toFiniteNumber(spawnY, 0),
        timestamp: Date.now(),
        status: 'idle',
        state: {
            version: 'pro',
            providerSort: 'ai666',
            modelSuffix: '',
            routeMode: 'ai666',
            imageModel: 'gpt-image-2',
            quality: 'auto',
            format: 'png',
            n: 1,
            size: '1024x1024',
            proRatio: '1:1',
            proResolution: '1k',
            customW: 9,
            customH: 16,
            background: 'auto',
            moderation: 'auto',
            prompt: '',
            images: [],
            refControls: [],
            seedLocked: false,
            seed: '',
            maskImage: null,
            maskBlob: null,
            maskEditMode: false,
            maskBrushSize: 20,
            maskStageHeight: 220,
            resultUrl: null,
            resultBlob: null,
            resultBlobs: [],
            previewCollapsed: false,
            paramsCollapsed: true,
            imgGenUiV2: true,
            cardWidthOpen: 680,
            cardWidthCollapsed: 360,
            cardHeight: 520,
            autoRetry: false,
            stageDocked: false,
            stageReleased: false
        },
        retryCount: 0
    };
}

async function createImageGenNode(x = NaN, y = NaN) {
    let spawnX = toFiniteNumber(x, NaN);
    let spawnY = toFiniteNumber(y, NaN);
    if (!Number.isFinite(spawnX) || !Number.isFinite(spawnY)) {
        const rect = viewport && typeof viewport.getBoundingClientRect === 'function'
            ? viewport.getBoundingClientRect()
            : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
        const center = clientToBoard(rect.left + rect.width / 2, rect.top + rect.height / 2);
        spawnX = center.x - 340;
        spawnY = center.y - 260;
    }
    const task = createDefaultImageGenTask(spawnX, spawnY);
    ensureImgGenState(task);
    await saveTaskDB(task);
    await renderBoard();
    showToast('已新建 AI 生图节点', 'success');
    return task;
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
    cancelCameraAnimation();
    cancelCanvasInertia();
    clearSelection();
    isPanning = true;
    setCanvasMoving(true);
    startPanX = e.clientX - transform.x;
    startPanY = e.clientY - transform.y;
    recordPanSample(e.clientX, e.clientY);
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
        isPanning,
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

window.addEventListener('mousedown', (e) => {
    if (e.button === 0) isPrimaryPointerDown = true;
    if (Number.isFinite(e.clientX)) lastPointerClientX = e.clientX;
    if (Number.isFinite(e.clientY)) lastPointerClientY = e.clientY;
}, true);

function clearSelection() {
    canvasSelection.clearSelection();
    updateSelectionToolbar();
    scheduleViewportCulling(40);
}

window.addEventListener('mousemove', (e) => {
    if (Number.isFinite(e.clientX)) lastPointerClientX = e.clientX;
    if (Number.isFinite(e.clientY)) lastPointerClientY = e.clientY;
    if (!ticking) {
        requestAnimationFrame(() => {
            if (isPanning) {
                transform.x = e.clientX - startPanX;
                transform.y = e.clientY - startPanY;
                recordPanSample(e.clientX, e.clientY);
                applyCanvasTransform({ cull: false, minimapDuration: 900 });
            }
            else if (canvasSelection.isSelecting) {
                canvasSelection.updateMarqueeSelection(e.clientX, e.clientY);
                requestSelectionToolbarUpdate();
            }
            else if (draggingCardInfo) {
                const dx = (e.clientX - draggingCardInfo.startMouseX) / transform.scale, dy = (e.clientY - draggingCardInfo.startMouseY) / transform.scale;
                const dragBaseX = toFiniteNumber(draggingCardInfo.initialX, 0);
                const dragBaseY = toFiniteNumber(draggingCardInfo.initialY, 0);
                draggingCardInfo.task.x = dragBaseX + dx; draggingCardInfo.task.y = dragBaseY + dy;
                draggingCardInfo.el.style.transform = `translate3d(${draggingCardInfo.task.x}px, ${draggingCardInfo.task.y}px, 0)`;
                setImgGenStageDragOver(canDragInfoDockToImgGenStage(draggingCardInfo, e.clientX, e.clientY));
                if (draggingCardInfo.children) {
                    draggingCardInfo.children.forEach(child => {
                        const childBaseX = toFiniteNumber(child.initialX, 0);
                        const childBaseY = toFiniteNumber(child.initialY, 0);
                        child.task.x = childBaseX + dx; child.task.y = childBaseY + dy;
                        child.el.style.transform = `translate3d(${child.task.x}px, ${child.task.y}px, 0)`;
                    });
                }
                requestSelectionToolbarUpdate();
            }
            ticking = false;
        });
        ticking = true;
    }
});

viewport.addEventListener('mousedown', (e) => {
    if (!isSpacePanningKeyDown) return;
    const interactive = e.target && typeof e.target.closest === 'function'
        ? e.target.closest('input, textarea, select, button, .img-gen-preview-panel, .img-gen-mask-block')
        : null;
    if (interactive) return;
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    beginCanvasPan(e);
}, true);

viewport.addEventListener('mousedown', (e) => {
    if (e.target === viewport || e.target === board) {
        cancelCameraAnimation();
        cancelCanvasInertia();
        if (e.shiftKey) {
            canvasSelection.startMarqueeSelection(e.clientX, e.clientY, buildSelectionCandidates());
            updateSelectionToolbar();
        }
        else {
            beginCanvasPan(e);
        }
    }
});

window.addEventListener('mouseup', async () => {
    isPrimaryPointerDown = false;
    const wasPanning = isPanning;
    isPanning = false;
    setCanvasMoving(false);
    if (wasPanning) startCanvasInertia();
    if (canvasSelection.finishMarqueeSelection()) {
        scheduleViewportCulling(40);
        updateSelectionToolbar();
    }

    if (draggingCardInfo) {
        draggingCardInfo.el.style.willChange = 'auto';
        const dockedToStage = await dockImgGenCardToStage(draggingCardInfo);
        if (dockedToStage) {
            draggingCardInfo = null;
            return;
        }
        setImgGenStageDragOver(false);
        syncCardViewportMetrics(draggingCardInfo.el, draggingCardInfo.task);
        await saveTaskDB(draggingCardInfo.task);

        if (draggingCardInfo.children) {
            for(let child of draggingCardInfo.children) { child.el.style.willChange = 'auto'; syncCardViewportMetrics(child.el, child.task); await saveTaskDB(child.task); }
        } else {
            await checkGroupDrop(draggingCardInfo);
        }
        draggingCardInfo = null;
        scheduleViewportCulling(40);
        updateSelectionToolbar();
        renderMinimap();
    }
});

function consumeNestedCanvasWheel(e) {
    const target = e && e.target && typeof e.target.closest === 'function' ? e.target : null;
    if (!target) return false;
    const promptRail = target.closest('.img-gen-prompt-chip-row');
    if (promptRail) {
        const modeFactor = e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? window.innerHeight : 1);
        const deltaX = toFiniteNumber(e.deltaX, 0) * modeFactor;
        const deltaY = toFiniteNumber(e.deltaY, 0) * modeFactor;
        const amount = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
        if (amount !== 0) {
            e.preventDefault();
            promptRail.scrollLeft += amount;
        }
        return true;
    }
    if (target.closest('.img-gen-input-body, .img-gen-preview-panel, .img-gen-preview-body, .img-gen-help-body')) {
        return true;
    }
    return false;
}

viewport.addEventListener('wheel', (e) => {
    const wheelTarget = e.target && typeof e.target.closest === 'function' ? e.target : null;
    if (e.target.tagName === 'TEXTAREA' || e.target.closest('textarea')) return;
    if (consumeNestedCanvasWheel(e)) return;
    if (draggingCardInfo) return;
    e.preventDefault();
    cancelCameraAnimation();
    cancelCanvasInertia();
    setCanvasMoving(true);
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
        setCanvasMoving(false);
        scheduleViewportCulling(40);
        renderMinimap();
    }, 170);

    const modeFactor = e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? window.innerHeight : 1);
    const deltaX = toFiniteNumber(e.deltaX, 0) * modeFactor;
    const deltaY = toFiniteNumber(e.deltaY, 0) * modeFactor;
    const trackpadPan = !e.ctrlKey && (Math.abs(deltaX) > 0.5 || (e.deltaMode === 0 && Math.abs(deltaY) < 48) || e.shiftKey);

    if (trackpadPan) {
        panCanvasBy(-deltaX, -deltaY, { cull: false, minimapDuration: 700 });
    } else {
        const factor = Math.exp(-deltaY * 0.0012);
        zoomCanvasAt(e.clientX, e.clientY, transform.scale * factor, { cull: false, minimapDuration: 700 });
    }
}, { passive: false });

window.addEventListener('resize', () => {
    clearTimeout(resizeRefreshTimer);
    resizeRefreshTimer = setTimeout(() => {
        applyCanvasTransform({ cull: false, revealMinimap: false });
        scheduleViewportCulling(60);
        renderMinimap();
        updateSelectionToolbar();
    }, 90);
});

function startFrameResize(e, id) {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
}

// ✅ 替换为支持 Alt 克隆的拖拽绑定引擎
function bindCardDrag(cardEl, task) {
    cardEl.__veoTask = task;
    cardEl.oncontextmenu = (e) => {
        const interactive = e.target && typeof e.target.closest === 'function'
            ? e.target.closest('input, textarea, select, button, video, .img-gen-mask-block, .img-gen-preview-panel')
            : null;
        if (interactive) return;
        openCanvasTaskContextMenu(e, task.id);
    };
    cardEl.onmousedown = (e) => {
        if(e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') {
            highestZIndex++; cardEl.style.zIndex = highestZIndex;
            if (task.type === 'tool_image_gen') {
                activeImgGenStageTaskId = task.id;
                if (isImgGenTaskStageDocked(task)) scheduleImgGenStageRailRender(80);
            }
        }
    };

    const header = cardEl.querySelector('.card-header');
    if(header) {
        // 🌟 改为 async 函数，因为克隆需要查库
        header.onmousedown = async (e) => {
            if(e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
            cancelCameraAnimation();
            cancelCanvasInertia();
            setCanvasMoving(false);

            // 🌟🌟🌟 新增：侦测到按住 Alt 键，直接执行克隆并阻断原卡片的拖拽
            if (e.altKey) {
                e.preventDefault();
                e.stopPropagation();
                if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
                await duplicateTask(task, e);
                return;
            }

            highestZIndex++; cardEl.style.zIndex = highestZIndex; cardEl.style.willChange = 'transform';
            if (task.type === 'tool_image_gen') {
                activeImgGenStageTaskId = task.id;
                if (isImgGenTaskStageDocked(task)) scheduleImgGenStageRailRender(80);
            }
            if (e.shiftKey || e.ctrlKey || e.metaKey) {
                canvasSelection.toggleTask(task.id, cardEl);
            } else {
                if (!selectedTasks.has(task.id)) { clearSelection(); canvasSelection.selectTask(task.id, cardEl); }
            }
            draggingCardInfo = {
                el: cardEl,
                task: cardEl.__veoTask,
                startMouseX: e.clientX,
                startMouseY: e.clientY,
                initialX: toFiniteNumber(cardEl.__veoTask && cardEl.__veoTask.x, 0),
                initialY: toFiniteNumber(cardEl.__veoTask && cardEl.__veoTask.y, 0),
                fromCanvasCard: true,
                startedInsideStageRail: isPointInImgGenStageRail(e.clientX, e.clientY),
                startedNearStageRail: isPointNearImgGenStageRail(e.clientX, e.clientY),
                justCreated: false
            };

            if (task.type === 'frame') return;
            e.stopPropagation();
        };
    }
}

function buildDuplicateTaskPayload(originalTask, offsetX = 40, offsetY = 40) {
    if (!originalTask || typeof originalTask !== 'object') return null;
    const baseType = originalTask.type ? originalTask.type : 'task';
    const clone = cloneTaskDeep(originalTask) || { ...originalTask };
    clone.id = `${baseType}_copy_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    clone.timestamp = Date.now();
    delete clone.parentId;

    if (clone.type === 'tool_image_gen') {
        sanitizeImgGenCloneState(clone);
    }
    normalizeTaskPosition(clone);
    clone.x += offsetX;
    clone.y += offsetY;
    return clone;
}

function sanitizeImgGenCloneState(clone) {
    if (!clone || clone.type !== 'tool_image_gen') return clone;
    ensureImgGenState(clone);
    const successHistory = Array.isArray(clone.state.previewHistory)
        ? clone.state.previewHistory
            .filter((item) => item && item.status === 'success' && item.image)
            .slice(-IMG_GEN_PREVIEW_LIMIT)
            .map((item) => ({
                ...item,
                id: createImgGenPreviewId(),
                status: 'success',
                remoteTaskId: '',
                errorReason: ''
            }))
        : [];
    clone.state.previewHistory = successHistory;
    clone.state.resultBlobs = successHistory.map((item) => item.image).filter(Boolean);
    clone.state.resultBlob = clone.state.resultBlobs.length ? clone.state.resultBlobs[clone.state.resultBlobs.length - 1] : null;
    clone.state.resultUrl = null;
    clone.state.startTime = null;
    clone.state.nextSubmitAt = 0;
    clone.state.maskImage = null;
    clone.state.maskBlob = null;
    clone.state.maskEditMode = false;
    clone.state.stageDocked = false;
    clone.state.stageReleased = false;
    clone.genTaskId = null;
    clone.retryCount = 0;
    clone.isBilled = false;
    recalcImgGenTaskStatus(clone);
    if (clone.status === 'processing') clone.status = 'idle';
    return clone;
}

async function duplicateSelectedTasks() {
    const ids = Array.from(selectedTasks);
    if (ids.length === 0) return;
    const clones = [];
    for (let i = 0; i < ids.length; i++) {
        const original = getTaskShadow(ids[i]) || await getTaskDB(ids[i]);
        if (!original) continue;
        const offset = 44 + i * 14;
        const clone = buildDuplicateTaskPayload(original, offset, offset);
        if (!clone) continue;
        clones.push(clone);
        await saveTaskDB(clone);
    }
    if (clones.length === 0) return;
    await renderBoard();
    clearSelection();
    clones.forEach((clone) => {
        const el = document.getElementById('card-' + clone.id);
        canvasSelection.selectTask(clone.id, el);
        if (el) {
            el.classList.remove('is-viewport-culled');
            highestZIndex++;
            el.style.zIndex = highestZIndex;
        }
    });
    scheduleViewportCulling(40);
    updateSelectionToolbar();
    showToast(`已复制 ${clones.length} 个节点`, 'success');
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
    if (selectedTasks.size === 0) return;
    const ids = Array.from(selectedTasks);
    if (!confirm(`🗑️ 确定要彻底删除选中的 ${ids.length} 个对象吗？(若包含项目组，内部卡片也会连锅端！)`)) return;
    const deletePromises = ids.map(async (id) => {
        clearImgGenPromptDraftTimer(id);
        destroyImgMaskStudio(id);
        destroyImgMaskEditor(id);
        await deleteTaskDB(id);
        const card = document.getElementById('card-' + id);
        if (card) card.remove();
        const allTasks = await getAllTasksDB();
        for(let t of allTasks) {
            if(t.parentId === id) {
                clearImgGenPromptDraftTimer(t.id);
                destroyImgMaskStudio(t.id);
                destroyImgMaskEditor(t.id);
                await deleteTaskDB(t.id);
                const childEl = document.getElementById('card-' + t.id);
                if(childEl) childEl.remove();
            }
        }
    });
    await Promise.all(deletePromises);
    if (ids.includes(activeImgGenStageTaskId)) activeImgGenStageTaskId = '';
    selectedTasks.clear();
    updateSelectionToolbar();
    scheduleViewportCulling(40);
    renderMinimap();
    scheduleImgGenStageRailRender(40);
    showToast(`清理完成`, "success");
}

window.addEventListener('keydown', async (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
    if (e.code === 'Space') {
        isSpacePanningKeyDown = true;
        document.body.classList.add('space-pan-ready');
        e.preventDefault();
        return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault(); canvasSelection.selectVisibleCards(); updateSelectionToolbar(); scheduleViewportCulling(40); showToast(`已全选可视节点`, "info");
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        await duplicateSelectedTasks();
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
        await deleteSelectedTasks();
    }
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
        isSpacePanningKeyDown = false;
        document.body.classList.remove('space-pan-ready');
    }
});

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
    if (!cardEl || !task || task.type !== 'tool_image_gen') return;
    ensureImgGenState(task);
    const isOpen = task.state.previewCollapsed !== true;
    const collapsedWidth = Math.max(320, Math.min(760, toFiniteNumber(task.state.cardWidthCollapsed, 360)));
    const expandedWidth = Math.max(560, Math.min(1200, toFiniteNumber(task.state.cardWidthOpen, 680)));
    const cardHeight = Math.max(420, Math.min(1100, toFiniteNumber(task.state.cardHeight, 520)));
    cardEl.classList.toggle('is-preview-open', isOpen);
    cardEl.style.setProperty('--img-gen-card-height', `${cardHeight}px`);
    cardEl.style.width = `${isOpen ? expandedWidth : collapsedWidth}px`;
    cardEl.style.height = `${cardHeight}px`;
}

function bindImgGenCardResizeSave(cardEl, task) {
    if (!cardEl || !task || task.type !== 'tool_image_gen' || cardEl.__imgGenResizeBound) return;
    cardEl.__imgGenResizeBound = true;
    cardEl.addEventListener('mouseup', () => {
        const liveTask = cardEl.__veoTask || getTaskShadow(task.id) || task;
        if (!liveTask || liveTask.type !== 'tool_image_gen') return;
        ensureImgGenState(liveTask);
        const width = Math.round(toFiniteNumber(cardEl.offsetWidth, 0));
        const height = Math.round(toFiniteNumber(cardEl.offsetHeight, 0));
        if (width <= 0 || height <= 0) return;
        const isCollapsed = liveTask.state.previewCollapsed === true;
        const nextWidth = isCollapsed
            ? Math.max(320, Math.min(760, width))
            : Math.max(560, Math.min(1200, width));
        const nextHeight = Math.max(420, Math.min(1100, height));
        const widthKey = isCollapsed ? 'cardWidthCollapsed' : 'cardWidthOpen';
        if (Math.abs(toFiniteNumber(liveTask.state[widthKey], 0) - nextWidth) < 2 && Math.abs(toFiniteNumber(liveTask.state.cardHeight, 0) - nextHeight) < 2) return;
        liveTask.state[widthKey] = nextWidth;
        liveTask.state.cardHeight = nextHeight;
        cardEl.style.width = `${nextWidth}px`;
        cardEl.style.height = `${nextHeight}px`;
        cardEl.style.setProperty('--img-gen-card-height', `${nextHeight}px`);
        liveTask.timestamp = Date.now();
        setTaskShadow(liveTask);
        queueImgGenTaskUpdate(liveTask.id, async () => {
            const latest = getTaskShadow(liveTask.id) || liveTask;
            await saveTaskDB(latest);
        }).catch(() => {});
    });
}

async function renderCard(taskId, taskOverride = null) {
    let task = taskOverride || await getTaskDB(taskId); if (!task) return;
    if (task.type === 'tool_image_gen') {
        const shadowTask = getTaskShadow(taskId);
        task = mergeImgGenTaskWithShadow(task, shadowTask, { protectedIds: getImgGenProtectedPreviewIds(taskId) });
    }
    setTaskShadow(task);
    const cardEl = document.getElementById('card-' + taskId); if (!cardEl) return;

    // 仅重绘当前的这一张卡片
    morphCardDOM(cardEl, generateCardHTML(task));
    applyImgGenCardFrame(cardEl, task);
    const isStageDocked = isImgGenTaskStageDocked(task);
    cardEl.classList.toggle('is-stage-docked', isStageDocked);
    if (isStageDocked) {
        selectedTasks.delete(task.id);
        cardEl.classList.remove('selected');
    }
    syncImgMaskEditor(cardEl, task).catch(() => {});
    bindImgGenCardResizeSave(cardEl, task);
    bindCardDrag(cardEl, task);
    syncCardViewportMetrics(cardEl, task);
    scheduleViewportCulling(40);
    updateSelectionToolbar();

    // 同步追踪属性，防止后续被误刷
    const currentImgLen = (task.state && task.state.images) ? task.state.images.length : 0;
    const currentProgress = task.progress || '';
    const cropSrc = task.state && task.state.sourceBlob ? 'hasSrc' : 'noSrc';
    const cropRes = task.state && task.state.resultBlob ? 'hasRes' : 'noRes';
    const currentVersion = (task.state && task.state.version) ? task.state.version : 'pro';
    const currentPreviewCollapsed = (task.type === 'tool_image_gen' && task.state) ? String(task.state.previewCollapsed === true) : 'na';
    const currentPreviewFeed = (task.type === 'tool_image_gen' && task.state) ? getImgGenPreviewFingerprint(task) : 'na';
    const currentParamsCollapsed = (task.type === 'tool_image_gen' && task.state) ? String(task.state.paramsCollapsed === true) : 'na';
    const currentPromptToolsCollapsed = (task.type === 'tool_image_gen' && task.state) ? String(task.state.promptToolsCollapsed === true) : 'na';
    const currentMaskPanelCollapsed = (task.type === 'tool_image_gen' && task.state) ? String(task.state.maskPanelCollapsed === true) : 'na';
    const currentMaskEditMode = (task.type === 'tool_image_gen' && task.state) ? String(task.state.maskEditMode === true) : 'na';
    const currentMaskBrushSize = (task.type === 'tool_image_gen' && task.state) ? String(clampImgMaskBrushSize(task.state.maskBrushSize)) : 'na';
    const currentMaskStageHeight = (task.type === 'tool_image_gen' && task.state) ? String(clampImgMaskStageHeight(task.state.maskStageHeight)) : 'na';

    cardEl.setAttribute('data-sync-status', task.status || 'static');
    cardEl.setAttribute('data-sync-retry', task.retryCount || 0);
    cardEl.setAttribute('data-sync-img-len', currentImgLen);
    cardEl.setAttribute('data-sync-progress', currentProgress);
    cardEl.setAttribute('data-sync-crop-src', cropSrc);
    cardEl.setAttribute('data-sync-crop-res', cropRes);
    cardEl.setAttribute('data-sync-version', currentVersion);
    cardEl.setAttribute('data-sync-preview-collapsed', currentPreviewCollapsed);
    cardEl.setAttribute('data-sync-preview-feed', currentPreviewFeed);
    cardEl.setAttribute('data-sync-params-collapsed', currentParamsCollapsed);
    cardEl.setAttribute('data-sync-prompt-tools-collapsed', currentPromptToolsCollapsed);
    cardEl.setAttribute('data-sync-mask-panel-collapsed', currentMaskPanelCollapsed);
    cardEl.setAttribute('data-sync-mask-edit', currentMaskEditMode);
    cardEl.setAttribute('data-sync-mask-brush', currentMaskBrushSize);
    cardEl.setAttribute('data-sync-mask-height', currentMaskStageHeight);
    cardEl.setAttribute('data-sync-title', task.title || '');
    cardEl.setAttribute('data-sync-collapsed', String(task.isCollapsed));
    if (task.type === 'tool_image_gen' && isStageDocked) scheduleImgGenStageRailRender(40);
}

function bindMainConsoleDrop(slotId, stateKey) {
    return window.VeoWorkspaceInputs.bindMainConsoleDrop(slotId, stateKey);
}

function toggleRefPopover(e) { e.stopPropagation(); if (globalStore.getState().references.length === 0) document.getElementById('ref-file').click(); else { const p = document.getElementById('ref-popover'); p.style.display = p.style.display === 'flex' ? 'none' : 'flex'; } }

function syncVideoConsoleModeUI() {
    const state = globalStore.getState();
    const mode = state.currentMode === 'frame' ? 'frame' : 'ref';
    const title = document.getElementById('console-mode-title');
    const timelineModel = document.getElementById('timeline-model-label');
    const advancedToggle = document.querySelector('.console-advanced-toggle');
    if (title) title.textContent = mode === 'frame' ? '首尾帧时间轴' : '参考图驱动';
    if (timelineModel) timelineModel.textContent = getVideoModelDisplayName(state.model, mode);
    if (advancedToggle) {
        const panel = document.getElementById('console-advanced-panel');
        advancedToggle.classList.toggle('is-open', !!panel && !panel.classList.contains('is-collapsed'));
    }
}

function toggleConsoleAdvanced(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    const panel = document.getElementById('console-advanced-panel');
    const toggle = document.querySelector('.console-advanced-toggle');
    if (!panel) return;
    const nextCollapsed = !panel.classList.contains('is-collapsed');
    panel.classList.toggle('is-collapsed', nextCollapsed);
    if (toggle) toggle.classList.toggle('is-open', !nextCollapsed);
}

function toggleVideoConsoleMinimized(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    const el = document.getElementById('floating-console');
    if (el) el.classList.toggle('minimized');
}

function expandVideoConsole() {
    const el = document.getElementById('floating-console');
    if (el) el.classList.remove('minimized');
}

function setConsoleFrameImage(type, imageBlob, options = {}) {
    if (!imageBlob) return false;
    const key = type === 'lastFrame' ? 'lastFrame' : 'firstFrame';
    const t = key === 'firstFrame' ? 'first' : 'last';
    globalStore.getState()[key] = imageBlob;
    const img = document.getElementById(`${t}-img`);
    const slot = document.getElementById(`slot-${t}-box`);
    if (img) img.src = getBlobUrl(`temp_${t}_${Date.now()}`, imageBlob);
    if (slot) slot.classList.add('has-img', 'slot-just-filled');
    setTimeout(() => { if (slot) slot.classList.remove('slot-just-filled'); }, 620);
    if (options.switchMode !== false) switchMode('frame');
    expandVideoConsole();
    return true;
}

function addConsoleReferenceImage(imageBlob) {
    if (!imageBlob) return false;
    const state = globalStore.getState();
    if (!Array.isArray(state.references)) state.references = [];
    if (state.references.length >= 3) {
        showToast('参考图最多 3 张', 'warning');
        return false;
    }
    state.references.push(imageBlob);
    renderReferences();
    const popover = document.getElementById('ref-popover');
    if (popover) popover.style.display = 'flex';
    switchMode('ref');
    expandVideoConsole();
    return true;
}

function switchMode(mode) {
    const safeMode = mode === 'frame' ? 'frame' : 'ref';
    globalStore.dispatch('SET_MODE', safeMode);
    syncVideoConsoleModeUI();
}
function updateInputMode(select) { if (select) switchMode(select.value); }
function updateModel(select) { globalStore.dispatch('SET_MODEL', { value: select.value, text: select.options[select.selectedIndex].text }); syncVideoConsoleModeUI(); }
function updateRatio(select) { globalStore.dispatch('SET_RATIO', { value: select.value, text: select.options[select.selectedIndex].text }); }
function updateEnhance(select) { globalStore.dispatch('SET_ENHANCE', { value: select.value, text: select.options[select.selectedIndex].text }); }
function updateUpsample(select) { globalStore.getState().enableUpsample = select.value === 'true'; document.getElementById('upsample-text').innerText = select.options[select.selectedIndex].text; }
function updateAutoRetry(select) { globalStore.getState().autoRetry = select.value === 'true'; document.getElementById('retry-text').innerText = select.options[select.selectedIndex].text; }
function formatImgGenMoney(amount) {
    return window.VeoImageCore.formatMoney(amount);
}

function extractImgGenUsage(rawData) {
    return window.VeoImageCore.extractUsage(rawData);
}

function calculateImgGenBilling(task, rawData) {
    return window.VeoImageCore.calculateBilling(task, rawData);
}
sysBus.on('UI:SWITCH_MODE', (mode) => {
    const safeMode = mode === 'frame' ? 'frame' : 'ref';
    document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.slot-group').forEach(s => s.classList.remove('active'));
    const legacyTab = document.getElementById(`tab-${safeMode}`);
    const slotGroup = document.getElementById(`slots-${safeMode}`);
    const inputModeSelect = document.getElementById('input-mode-select');
    const inputModeText = document.getElementById('input-mode-text');
    if (legacyTab) legacyTab.classList.add('active');
    if (slotGroup) slotGroup.classList.add('active');
    if (inputModeSelect && inputModeSelect.value !== safeMode) inputModeSelect.value = safeMode;
    if (inputModeText) inputModeText.innerText = getVideoInputModeLabel(safeMode);
    syncVideoConsoleModeUI();
    updateEstimatedCost();
});
sysBus.on('UI:UPDATE_MODEL_TEXT', (text) => {
    document.getElementById('model-text').innerText = text;
    syncVideoConsoleModeUI();
});
sysBus.on('UI:UPDATE_RATIO', (data) => { document.getElementById('ratio-text').innerText = data.text; document.getElementById('ratio-icon').innerText = data.value === '16:9' ? 'crop_16_9' : 'crop_portrait'; });
sysBus.on('UI:UPDATE_ENHANCE_TEXT', (text) => document.getElementById('enhance-text').innerText = text);

async function handleMultiRefs(input) {
    if (!input.files || input.files.length === 0) return; if (globalStore.getState().references.length + input.files.length > 3) { input.value = ''; return alert(`最多仅支持 3 张图。`); }
    for (let file of Array.from(input.files)) globalStore.getState().references.push(await compressImageToBlob(file));
    input.value = ''; renderReferences(); if(globalStore.getState().references.length > 0) document.getElementById('ref-popover').style.display = 'flex';
}
function removeReference(event, index) { event.stopPropagation(); globalStore.getState().references.splice(index, 1); renderReferences(); if(globalStore.getState().references.length === 0) document.getElementById('ref-popover').style.display = 'none'; }
function clearReferences(e) { e.stopPropagation(); globalStore.getState().references = []; renderReferences(); document.getElementById('ref-popover').style.display = 'none'; }
function renderReferences() {
    const box = document.getElementById('slot-ref-box'), imgEl = document.getElementById('ref-img'), countBadge = document.getElementById('ref-count-badge'), state = globalStore.getState();
    if (state.references.length === 0) {
        box.classList.remove('has-img'); imgEl.src = ''; countBadge.style.display = 'none';
    }
    else {
        box.classList.add('has-img');
        // 🌟 核心：加上 Date.now()
        imgEl.src = getBlobUrl(`temp_ref_main_${Date.now()}`, state.references[0]);
        countBadge.style.display = state.references.length > 1 ? 'flex' : 'none';
        countBadge.innerText = state.references.length;
    }
    // 🌟 列表渲染同样加上时间戳
    document.getElementById('ref-list-container').innerHTML = state.references.map((b, index) => `<div class="popover-img-item"><img src="${getBlobUrl(`temp_ref_${index}_${Date.now()}`, b)}"><div class="popover-rm-btn" onclick="removeReference(event, ${index})">×</div></div>`).join('');
    document.getElementById('ref-popover-add').style.display = state.references.length >= 3 ? 'none' : 'flex';
}

async function handleSingleFrame(input, type) {
    if (!input.files[0]) return;
    const blob = await compressImageToBlob(input.files[0]);
    setConsoleFrameImage(type, blob, { switchMode: true });
    input.value = '';
}
function clearFrame(event, type) {
    if(event) { event.preventDefault(); event.stopPropagation(); }
    globalStore.getState()[type] = null;
    const t = type === 'firstFrame' ? 'first' : 'last';
    const slot = document.getElementById(`slot-${t}-box`);
    const img = document.getElementById(`${t}-img`);
    if (slot) slot.classList.remove('has-img', 'slot-just-filled');
    if (img) img.src = '';
    revokeBlobPrefixSafe(`temp_${t}`);
}

async function submitBatchTask() { return window.VeoVideoTasks.submitBatchTask(); }
async function executeSubmission(params, promptText, offsetIndex = 0) { return window.VeoVideoTasks.executeSubmission(params, promptText, offsetIndex); }
async function retryTask(taskId, btnElement) { return window.VeoVideoTasks.retryTask(taskId, btnElement); }
function startTaskPolling(taskId) { return window.VeoVideoTasks.startPolling(taskId); }

async function reuseTask(taskId) {
    const task = await getTaskDB(taskId); if(!task) return;
    document.getElementById('prompt-input').value = task.prompt || '';
    const modelSelect = document.getElementById('model-select');
    if (modelSelect) {
        const qualityModel = getVideoQualityModel(task.modelVal);
        if(modelSelect.querySelector(`option[value="${qualityModel}"]`)) { modelSelect.value = qualityModel; updateModel(modelSelect); }
    }
    if (task.ratio) { document.getElementById('ratio-select').value = task.ratio; updateRatio(document.getElementById('ratio-select')); }
    const restoredMode = getVideoInputModeFromTask(task);
    const inputModeSelect = document.getElementById('input-mode-select');
    if (inputModeSelect) inputModeSelect.value = restoredMode;
    switchMode(restoredMode);
    if (task.rawImages) {
        const state = globalStore.getState();
        state.references = [...(task.rawImages.references || [])];
        if (task.rawImages.firstFrame) setConsoleFrameImage('firstFrame', task.rawImages.firstFrame, { switchMode: false });
        else clearFrame(null, 'firstFrame');
        if (task.rawImages.lastFrame) setConsoleFrameImage('lastFrame', task.rawImages.lastFrame, { switchMode: false });
        else clearFrame(null, 'lastFrame');
        renderReferences();
    }
    switchMode(restoredMode);
    document.getElementById('floating-console').classList.remove('minimized'); document.getElementById('prompt-input').focus();
}

function generateCardHTML(task) {
    if (RETIRED_NODE_TYPES.has(task.type)) return '';

    if (task.type === 'tool_image_gen') return renderImgGenCardHTML(task);

    return renderVideoTaskCardHTML(task);
}

// 🌟 初次挂载与排版专用的全局刷新函数
async function renderBoard() {
    const tasks = await getAllTasksDB(); const boardTasks = tasks.filter(t => t.type !== 'local_image' && !RETIRED_NODE_TYPES.has(t.type)), boardTaskIds = new Set(boardTasks.map(t => 'card-' + t.id));
    const existingCards = Array.from(board.children); existingCards.forEach(card => {
        if (!boardTaskIds.has(card.id)) {
            const removedTaskId = resolveTaskIdFromCardElement(card);
            if (removedTaskId) {
                destroyImgMaskStudio(removedTaskId);
                destroyImgMaskEditor(removedTaskId);
            }
            card.remove();
        }
    });

    boardTasks.forEach(task => {
        if (task && task.type === 'tool_image_gen') {
            task = mergeImgGenTaskWithShadow(task, getTaskShadow(task.id), { protectedIds: getImgGenProtectedPreviewIds(task.id) });
        }
        normalizeTaskPosition(task);
        setTaskShadow(task);
        let cardEl = document.getElementById('card-' + task.id);
        const currentImgLen = (task.state && task.state.images) ? task.state.images.length : 0;
        const currentProgress = task.progress || '';
        const cropSrc = task.state && task.state.sourceBlob ? 'hasSrc' : 'noSrc';
        const cropRes = task.state && task.state.resultBlob ? 'hasRes' : 'noRes';
        const currentVersion = (task.state && task.state.version) ? task.state.version : 'pro';
        const currentPreviewCollapsed = (task.type === 'tool_image_gen' && task.state) ? String(task.state.previewCollapsed === true) : 'na';
        const currentPreviewFeed = (task.type === 'tool_image_gen' && task.state) ? getImgGenPreviewFingerprint(task) : 'na';
        const currentParamsCollapsed = (task.type === 'tool_image_gen' && task.state) ? String(task.state.paramsCollapsed === true) : 'na';
        const currentPromptToolsCollapsed = (task.type === 'tool_image_gen' && task.state) ? String(task.state.promptToolsCollapsed === true) : 'na';
        const currentMaskPanelCollapsed = (task.type === 'tool_image_gen' && task.state) ? String(task.state.maskPanelCollapsed === true) : 'na';
        const currentMaskEditMode = (task.type === 'tool_image_gen' && task.state) ? String(task.state.maskEditMode === true) : 'na';
        const currentMaskBrushSize = (task.type === 'tool_image_gen' && task.state) ? String(clampImgMaskBrushSize(task.state.maskBrushSize)) : 'na';
        const currentMaskStageHeight = (task.type === 'tool_image_gen' && task.state) ? String(clampImgMaskStageHeight(task.state.maskStageHeight)) : 'na';

        let isHiddenInFrame = false;
        const isStageDocked = isImgGenTaskStageDocked(task);

        if (!cardEl) {
            cardEl = document.createElement('div'); cardEl.id = 'card-' + task.id;

            cardEl.className = task.type === 'tool_image_gen' ? 'video-card tool-image-gen' : 'video-card';

            cardEl.style.transform = `translate3d(${task.x}px, ${task.y}px, 0)`; morphCardDOM(cardEl, generateCardHTML(task)); board.appendChild(cardEl);
            applyImgGenCardFrame(cardEl, task);
            syncImgMaskEditor(cardEl, task).catch(() => {});
            bindImgGenCardResizeSave(cardEl, task);
            window.VeoVideoTasks.ensurePollingTask(task);
        } else {
            cardEl.style.transform = `translate3d(${task.x}px, ${task.y}px, 0)`;

            const oldStatus = cardEl.getAttribute('data-sync-status'), oldRetry = cardEl.getAttribute('data-sync-retry'), oldImgLen = cardEl.getAttribute('data-sync-img-len'), oldProgress = cardEl.getAttribute('data-sync-progress'), oldCropSrc = cardEl.getAttribute('data-sync-crop-src'), oldCropRes = cardEl.getAttribute('data-sync-crop-res'), oldVersion = cardEl.getAttribute('data-sync-version'), oldPreviewCollapsed = cardEl.getAttribute('data-sync-preview-collapsed'), oldPreviewFeed = cardEl.getAttribute('data-sync-preview-feed'), oldParamsCollapsed = cardEl.getAttribute('data-sync-params-collapsed'), oldPromptToolsCollapsed = cardEl.getAttribute('data-sync-prompt-tools-collapsed'), oldMaskPanelCollapsed = cardEl.getAttribute('data-sync-mask-panel-collapsed'), oldMaskEditMode = cardEl.getAttribute('data-sync-mask-edit'), oldMaskBrushSize = cardEl.getAttribute('data-sync-mask-brush'), oldMaskStageHeight = cardEl.getAttribute('data-sync-mask-height');
            const oldFrameTitle = cardEl.getAttribute('data-sync-title'), oldFrameCollapsed = cardEl.getAttribute('data-sync-collapsed');

            if (oldStatus !== task.status || oldRetry != task.retryCount || oldImgLen != currentImgLen || oldProgress !== currentProgress || oldCropSrc !== cropSrc || oldCropRes !== cropRes || oldVersion !== currentVersion || oldPreviewCollapsed !== currentPreviewCollapsed || oldPreviewFeed !== currentPreviewFeed || oldParamsCollapsed !== currentParamsCollapsed || oldPromptToolsCollapsed !== currentPromptToolsCollapsed || oldMaskPanelCollapsed !== currentMaskPanelCollapsed || oldMaskEditMode !== currentMaskEditMode || oldMaskBrushSize !== currentMaskBrushSize || oldMaskStageHeight !== currentMaskStageHeight || oldFrameTitle !== task.title || oldFrameCollapsed !== String(task.isCollapsed)) {
                morphCardDOM(cardEl, generateCardHTML(task));
            }
            applyImgGenCardFrame(cardEl, task);
            syncImgMaskEditor(cardEl, task).catch(() => {});
            bindImgGenCardResizeSave(cardEl, task);
        }

        if (task.type === 'tool_image_gen' && task.status === 'processing') {
            const pendingItems = Array.isArray(task.state && task.state.previewHistory)
                ? task.state.previewHistory.filter((entry) => entry && entry.status === 'pending' && entry.remoteTaskId)
                : [];
            if (pendingItems.length > 0) {
                pendingItems.forEach((entry) => {
                    if (!hasImgGenPolling(task.id, entry.id)) {
                        startImgGenTaskPolling(task.id, entry.remoteTaskId, entry.id);
                    }
                });
            } else if (task.genTaskId && !hasImgGenPolling(task.id)) {
                startImgGenTaskPolling(task.id, task.genTaskId, task.genTaskId);
            }
        }

        if (isHiddenInFrame) cardEl.classList.add('hidden-in-frame'); else cardEl.classList.remove('hidden-in-frame');
        cardEl.classList.toggle('is-stage-docked', isStageDocked);
        if (isStageDocked) {
            selectedTasks.delete(task.id);
            cardEl.classList.remove('selected');
        }
        cardEl.classList.toggle('is-auto-retrying', task.status === 'processing' && toFiniteNumber(task.retryCount, 0) > 0);

        bindCardDrag(cardEl, task);
        syncCardViewportMetrics(cardEl, task);

        cardEl.setAttribute('data-sync-status', task.status || 'static'); cardEl.setAttribute('data-sync-retry', task.retryCount || 0); cardEl.setAttribute('data-sync-img-len', currentImgLen); cardEl.setAttribute('data-sync-progress', currentProgress); cardEl.setAttribute('data-sync-crop-src', cropSrc); cardEl.setAttribute('data-sync-crop-res', cropRes); cardEl.setAttribute('data-sync-version', currentVersion); cardEl.setAttribute('data-sync-preview-collapsed', currentPreviewCollapsed); cardEl.setAttribute('data-sync-preview-feed', currentPreviewFeed); cardEl.setAttribute('data-sync-params-collapsed', currentParamsCollapsed); cardEl.setAttribute('data-sync-prompt-tools-collapsed', currentPromptToolsCollapsed); cardEl.setAttribute('data-sync-mask-panel-collapsed', currentMaskPanelCollapsed); cardEl.setAttribute('data-sync-mask-edit', currentMaskEditMode); cardEl.setAttribute('data-sync-mask-brush', currentMaskBrushSize); cardEl.setAttribute('data-sync-mask-height', currentMaskStageHeight);
        cardEl.setAttribute('data-sync-title', task.title || ''); cardEl.setAttribute('data-sync-collapsed', String(task.isCollapsed));
    });

    renderMinimap();
    scheduleViewportCulling(40);
    updateSelectionToolbar();
    renderImgGenStageRail(boardTasks).catch(() => {});
}

async function removeTask(id) {
    if (!confirm('确定删除这张卡片吗？')) return;
    clearTaskPolling(id);
    clearImgGenPolling(id);
    clearImgGenPromptDraftTimer(id);
    clearImgGenStateRuntime(id);
    destroyImgMaskStudio(id);
    destroyImgMaskEditor(id);
    await deleteTaskDB(id);
    clearTaskShadow(id);
    selectedTasks.delete(id);
    if (id === activeImgGenStageTaskId) activeImgGenStageTaskId = '';
    const card = document.getElementById('card-' + id);
    if (card) card.remove();
    updateSelectionToolbar();
    scheduleViewportCulling(40);
    renderMinimap();
    scheduleImgGenStageRailRender(40);
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
    const baseType = originalTask.type ? originalTask.type : 'task';
    const newId = `${baseType}_copy_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const clone = { ...originalTask, id: newId, timestamp: Date.now() };

    // 解除从属关系，让克隆出的卡片自由散落
    delete clone.parentId;

    // 深拷贝内部状态，避免引用串联污染
    if (originalTask && originalTask.state) {
        clone.state = { ...originalTask.state };
        if (Array.isArray(originalTask.state.images)) clone.state.images = [...originalTask.state.images];
        if (originalTask.state.cropParams) clone.state.cropParams = { ...originalTask.state.cropParams };

        if (clone.type === 'tool_image_gen') {
            sanitizeImgGenCloneState(clone);
        }
    }

    if (originalTask && originalTask.rawImages) {
        clone.rawImages = { ...originalTask.rawImages };
        if (Array.isArray(originalTask.rawImages.references)) clone.rawImages.references = [...originalTask.rawImages.references];
    }

    normalizeTaskPosition(clone);
    if (!mouseEvent || !isPrimaryPointerDown) {
        const cascadeOffset = 40;
        clone.x += cascadeOffset;
        clone.y += cascadeOffset;
    }

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
    if (isPrimaryPointerDown && newCardEl.__veoTask && mouseEvent) {
        const dragStartX = toFiniteNumber(mouseEvent.clientX, lastPointerClientX);
        const dragStartY = toFiniteNumber(mouseEvent.clientY, lastPointerClientY);
        draggingCardInfo = {
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
        };
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

// ==========================================
// Task board orchestration and legacy global adapters (Veo Studio)
// ==========================================
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

async function blobsToBase64Sequential(blobs, options = {}) {
    return window.VeoMedia.blobsToBase64Sequential(blobs, options);
}

function buildImgGenImagePayloadFields(imagesBase64, maskBase64 = null, maxImages = 5) {
    return window.VeoMedia.buildImgGenImagePayloadFields(imagesBase64, maskBase64, maxImages);
}

function getImgGenMaxReferenceCount(task) {
    return window.VeoImageNormalize.getMaxReferenceCount(task);
}

function limitImgGenReferencesForRoute(task, incomingImages = []) {
    return window.VeoImageNormalize.limitReferencesForRoute(task, incomingImages);
}

function enforceImgGenRouteReferenceLimit(task) {
    return window.VeoImageNormalize.enforceRouteReferenceLimit(task);
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

function resolveTaskIdFromCardElement(cardEl) {
    if (!cardEl || !cardEl.id || !String(cardEl.id).startsWith('card-')) return '';
    return String(cardEl.id).slice(5);
}

function removeActiveTask(id) { return window.VeoVideoTasks.removeActive(id); }
function toggleDrawer() {
}
function toggleMaterialDrawer() { window.VeoMaterials.toggleDrawer(); }

function handleAuthError() {
    return window.VeoAppShell.handleAuthError();
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

async function alignSelectedCards() { return window.VeoCanvasLayout.alignSelectedCards(); }

function showToast(message, type = 'info') { return window.VeoAppShell.showToast(message, type); }
function openHelpModal() { return window.VeoAppShell.openHelpModal(); }
function closeHelpModal() { return window.VeoAppShell.closeHelpModal(); }

function fitTaskInsideFrameBounds(task, frame, padding) { return window.VeoCanvasLayout.fitTaskInsideFrameBounds(task, frame, padding); }
async function createFrame() { return window.VeoCanvasLayout.createFrame(); }
async function checkGroupDrop(draggedInfo) { return window.VeoCanvasLayout.checkGroupDrop(draggedInfo); }

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
window.VeoSelectionToolbar.configure({
    hooks: {
        getSelectedTaskIds: () => Array.from(selectedTasks),
        isPanning: () => window.VeoCanvasInteractions.isPanning(),
        isSelecting: () => canvasSelection.isSelecting
    },
    actions: {
        focus: focusSelectedTasks,
        duplicate: duplicateSelectedTasks,
        delete: deleteSelectedTasks,
        clear: clearSelection
    }
});
window.VeoCanvasLayout.configure({
    hooks: {
        addSelectedTask: (taskId) => selectedTasks.add(taskId),
        animateCameraTo: (target, options) => animateCameraTo(target, options),
        clampCanvasScale: (value) => clampCanvasScale(value),
        clearSelection: () => clearSelection(),
        ensureImageState: (task) => ensureImgGenState(task),
        getAllTasks: () => getAllTasksDB(),
        getCanvasScale: () => transform.scale,
        getCardWorldSize: (el, task) => getCardWorldSize(el, task),
        getSelectedCanvasElements: () => getSelectedCanvasElements(),
        getSelectedTaskIds: () => Array.from(selectedTasks),
        getTaskElement: (taskId) => document.getElementById('card-' + taskId),
        getVisibleWorldRect: (padding) => getVisibleWorldRect(padding),
        nextZIndex: () => {
            highestZIndex++;
            return highestZIndex;
        },
        renderBoard: () => renderBoard(),
        saveTask: (task) => saveTaskDB(task),
        saveTasks: async (tasks) => {
            if (typeof saveTaskBatchDB === 'function') await saveTaskBatchDB(tasks);
            else await Promise.all(tasks.map((task) => saveTaskDB(task)));
        },
        selectTask: (taskId, el) => canvasSelection.selectTask(taskId, el),
        showToast: (message, type) => showToast(message, type),
        toFiniteNumber: (value, fallback) => toFiniteNumber(value, fallback),
        updateSelectionToolbar: () => updateSelectionToolbar()
    }
});
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
        getRetiredNodeTypes: () => window.VeoMigrationGuards.getRetiredNodeTypes()
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
        getRetiredNodeTypes: () => window.VeoMigrationGuards.getRetiredNodeTypes(),
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
window.VeoImageRender.configure({
    hooks: {
        applyCardFrame: (cardEl, task) => applyImgGenCardFrame(cardEl, task),
        cssEscape: (value) => cssEscapeSafe(value),
        ensureImageState: (task) => ensureImgGenState(task),
        getPreviewList: (task) => getImgGenPreviewList(task),
        getTaskElement: (taskId) => document.getElementById('card-' + taskId),
        getVisiblePendingCount: (task) => getVisibleImgGenPendingCount(task),
        renderPreviewFeed: (task, previewEntries) => renderImgGenPreviewFeed(task, previewEntries),
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
        getImagePreviewLimit: () => window.VeoImageConfig.previewLimit,
        getPointerState: () => window.VeoCanvasInteractions.getPointerState(),
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
        renderCard: (taskId) => renderCard(taskId),
        saveTask: (task) => saveTaskDB(task),
        scheduleViewportCulling: (delay) => scheduleViewportCulling(delay),
        selectTask: (taskId, el) => canvasSelection.selectTask(taskId, el),
        setDraggingCardInfo: (dragInfo) => window.VeoCanvasInteractions.setDraggingCardInfo(dragInfo),
        showToast: (message, type) => showToast(message, type),
        toFiniteNumber: (value, fallback) => toFiniteNumber(value, fallback),
        updateSelectionToolbar: () => updateSelectionToolbar()
    }
});
window.VeoTaskLifecycle.configure({
    hooks: {
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
        removeCard: (taskId) => {
            const card = document.getElementById('card-' + taskId);
            if (card) card.remove();
        },
        renderMinimap: () => renderMinimap(),
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
        isRetiredTaskType: (taskType) => window.VeoMigrationGuards.isRetiredTaskType(taskType),
        mergeImageTaskWithShadow: (task) => mergeImgGenTaskWithShadow(task, getTaskShadow(task.id), { protectedIds: getImgGenProtectedPreviewIds(task.id) }),
        morphCardDOM: (cardEl, html) => morphCardDOM(cardEl, html),
        normalizeTaskPosition: (task) => normalizeTaskPosition(task),
        renderImageCardHTML: (task) => renderImgGenCardHTML(task),
        renderMinimap: () => renderMinimap(),
        renderVideoCardHTML: (task) => renderVideoTaskCardHTML(task),
        resolveTaskIdFromCardElement: (cardEl) => resolveTaskIdFromCardElement(cardEl),
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
        applyCanvasTransform: (options) => applyCanvasTransform(options),
        buildSelectionCandidates: () => buildSelectionCandidates(),
        cancelCameraAnimation: () => cancelCameraAnimation(),
        cancelCanvasInertia: () => cancelCanvasInertia(),
        checkGroupDrop: (dragInfo) => checkGroupDrop(dragInfo),
        clearSelection: () => clearSelection(),
        deleteSelectedTasks: () => deleteSelectedTasks(),
        duplicateSelectedTasks: () => duplicateSelectedTasks(),
        duplicateTask: (task, event) => duplicateTask(task, event),
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
    return window.VeoCanvasLayout.normalizeTaskPosition(task);
}

function getTaskFallbackSize(task) {
    return window.VeoCanvasLayout.getTaskFallbackSize(task);
}

function createDefaultImageGenTask(spawnX, spawnY) {
    return window.VeoTaskActions.createDefaultImageGenTask(spawnX, spawnY);
}

async function createImageGenNode(x = NaN, y = NaN) {
    return window.VeoTaskActions.createImageGenNode(x, y);
}

function measureTaskAABB(task) {
    return window.VeoCanvasLayout.measureTaskAABB(task);
}

function getVisibleWorldRect(screenPadding = 80) {
    return window.VeoCanvasCamera.getVisibleWorldRect(screenPadding);
}

function clampWorldValue(value, min, max) {
    return window.VeoCanvasLayout.clampWorldValue(value, min, max);
}

function resolveLinkedNodePosition(sourceTask, targetSize = {}, options = {}) {
    return window.VeoCanvasLayout.resolveLinkedNodePosition(sourceTask, targetSize, options);
}

function selectAndFocusTaskIds(taskIds) {
    return window.VeoCanvasLayout.selectAndFocusTaskIds(taskIds);
}

function detectToolPluginType(el) {
    return window.VeoCanvasLayout.detectToolPluginType(el);
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

function getSelectedCanvasElements() {
    return window.VeoSelectionToolbar.getSelectedCanvasElements();
}

function ensureSelectionToolbar() {
    return window.VeoSelectionToolbar.ensureSelectionToolbar();
}

function updateSelectionToolbar() {
    return window.VeoSelectionToolbar.updateSelectionToolbar();
}

function requestSelectionToolbarUpdate() {
    return window.VeoSelectionToolbar.requestSelectionToolbarUpdate();
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
    return window.VeoCanvasLayout.getSelectedWorldBounds();
}

function focusSelectedTasks() {
    return window.VeoCanvasLayout.focusSelectedTasks();
}

function focusTaskById(taskId) {
    return window.VeoCanvasLayout.focusTaskById(taskId);
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

function openLightbox(src) {
    return window.VeoAppShell.openLightbox(src);
}

window.VeoWorkspaceInputs.bindClipboardIngest();

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

// ==========================================
// 🌟 智能克隆引擎 (Alt + Drag 专用)
// ==========================================
async function duplicateTask(originalTask, mouseEvent) {
    return window.VeoTaskActions.duplicateTask(originalTask, mouseEvent);
}
// ==========================================
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
    return window.VeoImageNormalize.normalizeRoute(raw);
}

function getImgGenModelForRoute(route) {
    return window.VeoImageNormalize.getModelForRoute(route);
}

function ensureImgGenState(task) {
    return window.VeoImageNormalize.ensureState(task);
}

function resolveImgGenMode(state) {
    return window.VeoImageCore.resolveMode(state);
}

function getImgGenPreviewFingerprint(task) {
    return window.VeoImageRender.getPreviewFingerprint(task);
}

function scheduleNextPaint(callback) {
    return window.VeoImageRender.scheduleNextPaint(callback);
}

function waitNextPaint() {
    return window.VeoImageRender.waitNextPaint();
}

function forceRenderImgGenPreviewPanel(task, focusItemId = '') {
    return window.VeoImageRender.forcePreviewPanel(task, focusItemId);
}

function scrollImgGenPreviewToItem(taskId, itemId) {
    return window.VeoImageRender.scrollPreviewToItem(taskId, itemId);
}

// ==========================================
// 🚀 Veo Flow 核心节点引擎 V2 (加入动态拉线状态机)
// ==========================================

// 🌟 自动注入：工作流专属的赛博朋克电流特效 CSS
const flowStyleInj = document.createElement('style');
flowStyleInj.innerHTML = `
    @keyframes dataFlowAnim { to { stroke-dashoffset: -24; } }
    .link-flowing {
        stroke-dasharray: 8 8 !important;
        animation: dataFlowAnim 0.4s linear infinite;
        stroke-width: 4px !important;
        filter: drop-shadow(0 0 8px currentColor);
    }
    
    /* 👇 新增：左侧节点工具站样式（高平滑度升级版） */
    .node-palette {
        position: absolute; left: 0; top: 50px; width: 220px; height: calc(100vh - 50px);
        background: #111113; border-right: 1px solid rgba(255,255,255,0.05);
        z-index: 100; display: flex; flex-direction: column; overflow-y: auto;
        padding: 12px; box-sizing: border-box; box-shadow: 5px 0 20px rgba(0,0,0,0.5);
        transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .palette-group-title { font-size: 11px; color: #666; font-weight: 600; margin: 16px 0 8px 8px; letter-spacing: 1px; }
    .palette-item {
        padding: 10px 12px; border-radius: 6px; color: #ccc; font-size: 13px;
        display: flex; align-items: center; gap: 8px; cursor: grab; margin-bottom: 4px;
        transition: all 0.2s; border: 1px solid transparent; background: rgba(255,255,255,0.02);
    }
    .palette-item:hover { background: rgba(255,255,255,0.08); color: #fff; border-color: rgba(255,255,255,0.15); transform: translateX(2px); }
    .palette-item:active { cursor: grabbing; }
    
    /* 🌟 核心：画布视口加入平滑过渡过渡轨 */
    .flow-viewport {
        left: 220px !important; width: calc(100vw - 220px) !important;
        transition: left 0.3s cubic-bezier(0.16, 1, 0.3, 1), width 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        cursor: grab; touch-action: none; overscroll-behavior: none;
    }
    #flow-canvas {
        transform-origin: 0 0;
        will-change: transform;
        contain: layout style paint;
    }
    .flow-viewport.is-panning,
    .flow-viewport.space-pan-ready { cursor: grab !important; }
    .flow-viewport.is-panning-active { cursor: grabbing !important; }
    .flow-viewport.is-panning-active .veo-node,
    .flow-viewport.is-panning-active #svg-layer { pointer-events: none; }
    .flow-viewport.is-linking { cursor: crosshair !important; }
    .port-text { border-color: #fbbf24 !important; color: #fbbf24 !important; } 

    /* 👇 工作流工具组（挂载到头部按钮区） */
    .flow-top-toolbar {
        display: flex; gap: 8px; align-items: center;
    }
    .flow-tool-btn {
        background: var(--flow-btn-bg, rgba(255,255,255,0.05));
        border: 1px solid var(--flow-border, rgba(255,255,255,0.1));
        color: var(--flow-btn-text, #fff);
        padding: 6px 12px;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        transition: 0.2s;
    }
    .flow-tool-btn:hover { background: var(--flow-btn-bg-hover, rgba(255,255,255,0.15)); transform: translateY(-1px); }
    .flow-tool-divider {
        width: 1px;
        height: 16px;
        background: var(--flow-border, rgba(255,255,255,0.1));
        margin: 0 2px;
    }
    .flow-tool-btn.danger { border-color: rgba(239, 68, 68, 0.25); color: #f87171; }
    .flow-tool-btn.danger:hover { background: rgba(239, 68, 68, 0.14); color: #ef4444; border-color: rgba(239, 68, 68, 0.35); }

    /* 🌟 核心：收缩状态类联动机制 */
    .palette-collapsed .node-palette { transform: translateX(-220px); }
    .palette-collapsed .flow-viewport { left: 0 !important; width: 100vw !important; }
    
    .palette-toggle-btn {
        position: absolute; top: 62px; left: 232px; z-index: 102;
        background: #111113; border: 1px solid rgba(255,255,255,0.08);
        color: #888; border-radius: 6px; width: 24px; height: 24px;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    }
    .palette-toggle-btn:hover { color: #fff; border-color: rgba(255,255,255,0.2); }
    .palette-collapsed .palette-toggle-btn { left: 12px; transform: rotate(180deg); }

    /* 👇 新增：Shift 全局多选与框选样式 */
    .veo-node.is-selected {
        border-color: #a78bfa !important; /* 选中时边框呈现高级紫 */
        box-shadow: 0 0 25px 2px rgba(167, 139, 250, 0.35) !important;
    }
    .veo-node {
        will-change: transform;
        contain: layout style paint;
        transition: border-color 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
    }
    .veo-node.is-selection-preview {
        filter: brightness(1.08) saturate(1.08);
        box-shadow: 0 0 18px rgba(56, 189, 248, 0.22), 0 0 0 1px rgba(56, 189, 248, 0.24) !important;
    }
    .veo-node.is-viewport-culled {
        content-visibility: visible;
        pointer-events: auto;
        opacity: 1;
    }
    .flow-selection-box {
        position: absolute; border: 1px dashed #a78bfa; background: rgba(167, 139, 250, 0.08);
        pointer-events: none; z-index: 1000; display: none; border-radius: 8px;
        box-shadow: 0 0 0 1px rgba(255,255,255,0.05), 0 12px 32px rgba(0,0,0,0.22);
        backdrop-filter: blur(2px);
    }
    .flow-selection-box.is-window {
        border: 1px solid rgba(59, 130, 246, 0.88);
        background: rgba(59, 130, 246, 0.11);
    }
    .flow-selection-box.is-crossing {
        border: 1px dashed rgba(34, 197, 94, 0.92);
        background: rgba(34, 197, 94, 0.09);
    }
    .flow-selection-toolbar {
        position: fixed; z-index: 1200; display: none; align-items: center; gap: 6px;
        padding: 6px; border-radius: 999px;
        background: rgba(12, 12, 16, 0.82); border: 1px solid rgba(255,255,255,0.12);
        box-shadow: 0 16px 44px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.06);
        backdrop-filter: blur(18px); transform: translate(-50%, -100%);
    }
    .flow-selection-toolbar.is-visible { display: inline-flex; }
    .flow-selection-toolbar button {
        width: 30px; height: 30px; border-radius: 999px; border: 1px solid transparent;
        background: rgba(255,255,255,0.06); color: #e5e7eb; cursor: pointer;
        display: inline-flex; align-items: center; justify-content: center;
        transition: 0.16s ease;
    }
    .flow-selection-toolbar button:hover {
        color: #fff; background: rgba(167, 139, 250, 0.18);
        border-color: rgba(167, 139, 250, 0.28); transform: translateY(-1px);
    }
    .flow-selection-toolbar button.danger:hover {
        background: rgba(239, 68, 68, 0.18); border-color: rgba(239, 68, 68, 0.28); color: #fecaca;
    }
    .flow-selection-toolbar .material-symbols-outlined { font-size: 17px; }
    :root[data-theme='light'] .flow-selection-toolbar {
        background: rgba(255,255,255,0.84); border-color: rgba(15, 23, 42, 0.12);
        box-shadow: 0 16px 38px rgba(15,23,42,0.16);
    }
    :root[data-theme='light'] .flow-selection-toolbar button {
        background: rgba(15,23,42,0.055); color: #0f172a;
    }

    /* 👇 新增：右下角全景导航小地图 (Minimap) */
    .flow-minimap-container {
        position: absolute; right: 24px; bottom: 24px; width: 180px; height: 120px;
        background: rgba(15, 15, 19, 0.85); backdrop-filter: blur(12px);
        border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; z-index: 101;
        box-shadow: 0 10px 30px rgba(0,0,0,0.6); overflow: hidden; 
        pointer-events: auto; cursor: crosshair; /* 🚨 修复：允许点击与交互穿透 */
        opacity: 0.24; transform: scale(0.96); transform-origin: right bottom;
        transition: opacity 0.22s ease, transform 0.22s ease, border-color 0.22s ease;
    }
    .flow-minimap-container:hover,
    .flow-minimap-container.is-active,
    .flow-viewport.is-panning-active ~ .flow-minimap-container {
        opacity: 1; transform: scale(1); border-color: rgba(167,139,250,0.24);
    }
    .flow-minimap-viewport {
        position: absolute; border: 1px solid rgba(167, 139, 250, 0.4);
        background: rgba(167, 139, 250, 0.03); pointer-events: none;
    }
    .flow-minimap-node {
        position: absolute; background: rgba(255,255,255,0.15); border-radius: 1px;
    }
    /* 👇 新增：{{ 智能变量感知面板样式 */
    .flow-autocomplete-dropdown {
        position: fixed; z-index: 9999; width: 280px; max-height: 220px;
        background: rgba(20, 20, 25, 0.96); backdrop-filter: blur(15px);
        border: 1px solid rgba(167, 139, 250, 0.25); border-radius: 8px;
        box-shadow: 0 12px 40px rgba(0,0,0,0.7), 0 0 15px rgba(167, 139, 250, 0.1);
        overflow-y: auto; display: none; padding: 6px; box-sizing: border-box;
    }
    .autocomplete-item {
        padding: 8px 10px; border-radius: 6px; font-size: 12px; color: #ccc;
        display: flex; align-items: center; justify-content: space-between;
        cursor: pointer; transition: all 0.15s ease; margin-bottom: 2px;
    }
    .autocomplete-item:hover, .autocomplete-item.is-active {
        background: rgba(167, 139, 250, 0.15); color: #fff;
        transform: translateX(2px);
    }
    .autocomplete-tag {
        font-size: 9px; padding: 2px 6px; border-radius: 4px; font-family: monospace;
        font-weight: bold; text-transform: uppercase;
    }
    .tag-local { background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); }
    .tag-cross { background: rgba(167, 139, 250, 0.15); color: #a78bfa; border: 1px solid rgba(167, 139, 250, 0.3); }

    .node-image-upload {
        display: flex;
        gap: 8px;
        align-items: center;
        margin-top: 4px;
        padding: 2px;
        border: 1px dashed transparent;
        border-radius: 6px;
        transition: 0.2s;
    }
    .node-image-upload-large {
        display: block;
        position: relative;
        padding: 0;
        border-style: dashed;
        border-color: rgba(56, 189, 248, 0.35);
        background: rgba(56, 189, 248, 0.06);
        min-height: 112px;
        overflow: hidden;
    }
    .node-image-upload-large.has-image {
        border-style: solid;
        border-color: rgba(56, 189, 248, 0.45);
    }
    .node-image-upload-large.node-image-drag-over {
        border-color: var(--accent);
        box-shadow: inset 0 0 0 1px rgba(255,255,255,0.2);
    }
    .node-image-upload-empty {
        min-height: 112px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: #7dd3fc;
        font-size: 12px;
        gap: 4px;
        pointer-events: none;
    }
    .node-image-upload-empty .material-symbols-outlined { font-size: 22px; }
    .img-preview-large {
        width: 100%;
        height: 112px;
        display: block;
        object-fit: contain;
        background: rgba(0,0,0,0.28);
    }
    .node-image-upload-overlay {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 8px 10px;
        font-size: 11px;
        background: linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 100%);
        color: #e0f2fe;
        cursor: pointer;
        transition: 0.2s;
    }
    .node-image-upload-overlay:hover { filter: brightness(1.06); }
    .node-image-upload-overlay .material-symbols-outlined { font-size: 14px; }
    .veo-node.is-frozen { border-color: rgba(245,158,11,0.55) !important; box-shadow: 0 0 24px rgba(245,158,11,0.16), 0 4px 15px rgba(0,0,0,0.35) !important; }
    .veo-node.is-running { box-shadow: 0 0 30px 5px rgba(56, 189, 248, 0.4) !important; border-color: #38bdf8 !important; }
    .veo-node.is-error { box-shadow: 0 0 30px 5px rgba(239, 68, 68, 0.3) !important; border-color: #ef4444 !important; }
    .veo-node.is-success { box-shadow: 0 0 30px 5px rgba(34, 197, 94, 0.3) !important; border-color: #22c55e !important; }
    .node-header-main { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; }
    .node-header-tools { display: inline-flex; align-items: center; gap: 4px; }
    .node-freeze-btn {
        width: 22px; height: 22px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.1);
        background: rgba(255,255,255,0.04); color: #8a8a8a; cursor: pointer;
        display: inline-flex; align-items: center; justify-content: center; transition: 0.2s ease;
    }
    .node-freeze-btn .material-symbols-outlined { font-size: 14px; }
    .node-freeze-btn.is-frozen { color: #f59e0b; border-color: rgba(245,158,11,0.45); background: rgba(245,158,11,0.12); }

    :root[data-theme='light'] .flow-tool-btn.danger { color: #dc2626; border-color: rgba(220, 38, 38, 0.25); }
    :root[data-theme='light'] .node-image-upload-large { background: rgba(14, 116, 144, 0.07); border-color: rgba(14, 116, 144, 0.28); }
    :root[data-theme='light'] .node-image-upload-empty { color: #0369a1; }
    :root[data-theme='light'] .img-preview-large { background: rgba(15, 23, 42, 0.05); }
    :root[data-theme='light'] .node-image-upload-overlay { color: #f8fafc; }
`; 
document.head.appendChild(flowStyleInj);

function escapeFlowHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeFlowAttr(value) {
    return escapeFlowHtml(value);
}

function escapeFlowJsString(value) {
    return String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
}

const viewport = document.getElementById('flow-viewport');
const canvas = document.getElementById('flow-canvas');
const svgLayer = document.getElementById('svg-layer');
const nodeBoard = document.getElementById('node-board');
const FLOW_THEME_MODE_KEY = 'veo_theme_mode';
const FLOW_THEME_DARK = 'dark';
const FLOW_THEME_LIGHT = 'light';

function normalizeFlowThemeMode(rawMode) {
    if (rawMode === FLOW_THEME_LIGHT || rawMode === 'mono') return FLOW_THEME_LIGHT;
    return FLOW_THEME_DARK;
}

function applyFlowThemeMode(mode) {
    const nextMode = normalizeFlowThemeMode(mode);
    const isLight = nextMode === FLOW_THEME_LIGHT;
    document.documentElement.setAttribute('data-theme', nextMode);

    const iconEl = document.getElementById('flow-theme-toggle-icon');
    const btnEl = document.getElementById('flow-theme-toggle-btn');
    const labelEl = document.getElementById('flow-theme-toggle-label');
    if (iconEl) iconEl.innerText = isLight ? 'light_mode' : 'dark_mode';
    if (labelEl) labelEl.innerText = isLight ? '日间' : '夜间';
    if (btnEl) btnEl.title = isLight ? '切换到夜间模式' : '切换到日间模式';
}

function initFlowThemeMode() {
    const saved = localStorage.getItem(FLOW_THEME_MODE_KEY);
    const nextMode = normalizeFlowThemeMode(saved);
    localStorage.setItem(FLOW_THEME_MODE_KEY, nextMode);
    applyFlowThemeMode(nextMode);
}

window.toggleFlowThemeMode = function() {
    const current = normalizeFlowThemeMode(localStorage.getItem(FLOW_THEME_MODE_KEY));
    const next = current === FLOW_THEME_LIGHT ? FLOW_THEME_DARK : FLOW_THEME_LIGHT;
    localStorage.setItem(FLOW_THEME_MODE_KEY, next);
    applyFlowThemeMode(next);
};

window.toggleMonoTheme = window.toggleFlowThemeMode;

// 🌟 修复 SVG 容器折叠导致的连线消失问题
canvas.style.width = '1px'; canvas.style.height = '1px'; canvas.style.overflow = 'visible';
svgLayer.style.width = '1px'; svgLayer.style.height = '1px'; svgLayer.style.overflow = 'visible';

// 1. 全局状态机 (扩容高级多选、批量框选、协同控制核心)
let flowState = {
    transform: { x: 0, y: 0, scale: 1 },
    isPanning: false, startX: 0, startY: 0,
    isSpacePanning: false,
    activeNode: null,
    drawingLink: { active: false, sourceNode: null, sourcePort: null, type: null, startX: 0, startY: 0, currentX: 0, currentY: 0 },
    nodes: [], 
    links: [],
    // 🌟 新增高级交互状态
    selectedNodeIds: new Set(), 
    selectionBox: { active: false, startX: 0, startY: 0 },
    selectionBoxMode: 'intersect',
    minimap: { minX: 0, minY: 0, scale: 1 }, // 🚨 新增：小地图逆向映射锚点
    history: {
        undo: [],
        redo: [],
        maxSteps: 30,
        isApplying: false
    },
    edgeScroll: {
        threshold: 40,
        maxStep: 18
    }
};

const flowLinkIndexByNode = new Map();
const flowLinkPathCache = new Map();
const FLOW_MIN_SCALE = 0.16;
const FLOW_MAX_SCALE = 3.6;
const FLOW_CULL_PADDING = 760;
const FLOW_CAMERA_EASE_MS = 360;
let flowPanSamples = [];
let flowInertiaFrame = 0;
let flowCameraFrame = 0;
let flowCullTimer = 0;
let flowMinimapActiveTimer = 0;
let flowWheelSaveTimer = 0;
let flowSelectionCandidates = [];
let flowSelectionToolbarEl = null;
let flowSelectionToolbarFrame = 0;

// 动态挂载原生框选框 DOM 到页面
const dragSelectBox = document.createElement('div');
dragSelectBox.className = 'flow-selection-box';
dragSelectBox.id = 'flow-selection-box';
document.body.appendChild(dragSelectBox);

function clampFlowScale(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 1;
    return Math.min(FLOW_MAX_SCALE, Math.max(FLOW_MIN_SCALE, numeric));
}

function isFlowFormTarget(target) {
    if (!target || typeof target.closest !== 'function') return false;
    return !!target.closest('input, textarea, select, option, button, label, .node-input, .flow-autocomplete-dropdown, .flow-selection-toolbar');
}

function shouldAllowNativeWheel(e) {
    const target = e.target;
    if (!target || target === viewport || target === canvas || target === nodeBoard || target === svgLayer) return false;
    if (isFlowFormTarget(target)) return true;
    if (typeof target.closest !== 'function') return false;

    const scrollHost = target.closest('.flow-autocomplete-dropdown, .node-palette, .node-inputs-container, .node-body');
    if (!scrollHost || e.ctrlKey) return false;
    const canScrollY = scrollHost.scrollHeight > scrollHost.clientHeight + 2;
    const canScrollX = scrollHost.scrollWidth > scrollHost.clientWidth + 2;
    return canScrollY || canScrollX;
}

function markFlowMinimapActive(duration = 900) {
    const minimap = document.getElementById('flow-minimap-container');
    if (!minimap) return;
    minimap.classList.add('is-active');
    clearTimeout(flowMinimapActiveTimer);
    flowMinimapActiveTimer = setTimeout(() => minimap.classList.remove('is-active'), duration);
}

function scheduleFlowViewportCulling(delay = 120) {
    clearTimeout(flowCullTimer);
    flowCullTimer = setTimeout(updateFlowViewportCulling, Math.max(0, delay));
}

function getFlowViewportWorldRect(padding = 0) {
    const rect = viewport.getBoundingClientRect();
    const scale = clampFlowScale(flowState.transform.scale);
    const left = (0 - flowState.transform.x) / scale - padding;
    const top = (0 - flowState.transform.y) / scale - padding;
    const right = (rect.width - flowState.transform.x) / scale + padding;
    const bottom = (rect.height - flowState.transform.y) / scale + padding;
    return { left, top, right, bottom, width: right - left, height: bottom - top };
}

function updateFlowViewportCulling() {
    if (!nodeBoard || !viewport || !flowState || !Array.isArray(flowState.nodes)) return;
    // Safety first: the DOM-based flow canvas has variable-sized nodes and saved camera states.
    // A stale culling decision can make every node look "deleted", so for now we only clear
    // previous culling marks and keep all workflow nodes visible.
    nodeBoard.querySelectorAll('.veo-node.is-viewport-culled').forEach((nodeEl) => {
        nodeEl.classList.remove('is-viewport-culled');
    });
    return;

    const worldRect = getFlowViewportWorldRect(FLOW_CULL_PADDING);

    flowState.nodes.forEach((node) => {
        if (!node || !node.id) return;
        const nodeEl = document.getElementById(node.id);
        if (!nodeEl) return;
        const isProtected = flowState.selectedNodeIds.has(node.id)
            || (flowState.activeNode && flowState.activeNode.id === node.id)
            || nodeEl.classList.contains('is-running')
            || nodeEl.classList.contains('is-error');
        if (isProtected) {
            nodeEl.classList.remove('is-viewport-culled');
            return;
        }

        const measuredWidth = nodeEl.offsetWidth || 0;
        const measuredHeight = nodeEl.offsetHeight || 0;
        if (!nodeEl.classList.contains('is-viewport-culled') && measuredWidth > 0 && measuredHeight > 0) {
            nodeEl.__flowMeasuredSize = { width: measuredWidth, height: measuredHeight };
        }
        const cachedSize = nodeEl.__flowMeasuredSize || {};
        const width = cachedSize.width || measuredWidth || node.width || 260;
        const height = cachedSize.height || measuredHeight || node.height || 160;
        const nodeLeft = Number(node.x) || 0;
        const nodeTop = Number(node.y) || 0;
        const isOutside = nodeLeft + width < worldRect.left
            || nodeLeft > worldRect.right
            || nodeTop + height < worldRect.top
            || nodeTop > worldRect.bottom;
        nodeEl.classList.toggle('is-viewport-culled', isOutside);
    });
}

function cancelFlowInertia() {
    if (flowInertiaFrame) {
        cancelAnimationFrame(flowInertiaFrame);
        flowInertiaFrame = 0;
    }
    flowPanSamples = [];
}

function recordFlowPanSample(clientX, clientY) {
    const now = performance.now();
    flowPanSamples.push({ x: clientX, y: clientY, t: now });
    flowPanSamples = flowPanSamples.filter(sample => now - sample.t <= 120);
}

function panFlowBy(dx, dy, options = {}) {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    flowState.transform.x += dx;
    flowState.transform.y += dy;
    updateCanvasTransform();
    if (options.markActive !== false) markFlowMinimapActive();
}

function startFlowInertia() {
    if (flowPanSamples.length < 2) return;
    const first = flowPanSamples[0];
    const last = flowPanSamples[flowPanSamples.length - 1];
    const dt = Math.max(16, last.t - first.t);
    let vx = (last.x - first.x) / dt;
    let vy = (last.y - first.y) / dt;
    const speed = Math.hypot(vx, vy);
    if (speed < 0.18) return;

    cancelFlowInertia();
    let prev = performance.now();
    const tick = (now) => {
        const frameDt = Math.min(32, now - prev);
        prev = now;
        panFlowBy(vx * frameDt, vy * frameDt, { markActive: true });
        vx *= 0.91;
        vy *= 0.91;
        if (Math.hypot(vx, vy) > 0.035) {
            flowInertiaFrame = requestAnimationFrame(tick);
        } else {
            flowInertiaFrame = 0;
            viewport.classList.remove('is-panning-active');
            if (typeof saveFlowToDB === 'function') saveFlowToDB();
        }
    };
    viewport.classList.add('is-panning-active');
    flowInertiaFrame = requestAnimationFrame(tick);
}

function zoomFlowAt(clientX, clientY, nextScale) {
    const rect = viewport.getBoundingClientRect();
    const scale = clampFlowScale(nextScale);
    const prevScale = clampFlowScale(flowState.transform.scale);
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;
    const worldX = (mouseX - flowState.transform.x) / prevScale;
    const worldY = (mouseY - flowState.transform.y) / prevScale;

    flowState.transform.scale = scale;
    flowState.transform.x = mouseX - worldX * scale;
    flowState.transform.y = mouseY - worldY * scale;
    updateCanvasTransform();
    markFlowMinimapActive();
}

function animateFlowCameraTo(targetTransform, duration = FLOW_CAMERA_EASE_MS) {
    if (!targetTransform) return;
    if (flowCameraFrame) cancelAnimationFrame(flowCameraFrame);
    cancelFlowInertia();

    const start = {
        x: flowState.transform.x,
        y: flowState.transform.y,
        scale: clampFlowScale(flowState.transform.scale)
    };
    const target = {
        x: Number.isFinite(targetTransform.x) ? targetTransform.x : start.x,
        y: Number.isFinite(targetTransform.y) ? targetTransform.y : start.y,
        scale: clampFlowScale(targetTransform.scale)
    };
    const begin = performance.now();
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const tick = (now) => {
        const t = Math.min(1, (now - begin) / Math.max(1, duration));
        const k = easeOutCubic(t);
        flowState.transform.x = start.x + (target.x - start.x) * k;
        flowState.transform.y = start.y + (target.y - start.y) * k;
        flowState.transform.scale = start.scale + (target.scale - start.scale) * k;
        updateCanvasTransform();
        markFlowMinimapActive(500);
        if (t < 1) {
            flowCameraFrame = requestAnimationFrame(tick);
        } else {
            flowCameraFrame = 0;
            if (typeof saveFlowToDB === 'function') saveFlowToDB();
        }
    };
    flowCameraFrame = requestAnimationFrame(tick);
}

function getFlowNodesWorldBounds(nodeIds) {
    const ids = Array.isArray(nodeIds) ? nodeIds : Array.from(nodeIds || []);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    ids.forEach((id) => {
        const node = flowState.nodes.find(n => n.id === id);
        const nodeEl = document.getElementById(id);
        if (!node || !nodeEl) return;
        const width = nodeEl.offsetWidth || node.width || 260;
        const height = nodeEl.offsetHeight || node.height || 160;
        const x = Number(node.x) || 0;
        const y = Number(node.y) || 0;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + width);
        maxY = Math.max(maxY, y + height);
    });
    if (!Number.isFinite(minX)) return null;
    return { minX, minY, maxX, maxY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

function focusFlowNodes(nodeIds = flowState.selectedNodeIds) {
    const bounds = getFlowNodesWorldBounds(nodeIds);
    if (!bounds) return;
    const rect = viewport.getBoundingClientRect();
    const pad = Math.min(180, Math.max(80, Math.min(rect.width, rect.height) * 0.12));
    const nextScale = clampFlowScale(Math.min(
        (rect.width - pad * 2) / bounds.width,
        (rect.height - pad * 2) / bounds.height,
        1.35
    ));
    const targetX = (rect.width - bounds.width * nextScale) / 2 - bounds.minX * nextScale;
    const targetY = (rect.height - bounds.height * nextScale) / 2 - bounds.minY * nextScale;
    animateFlowCameraTo({ x: targetX, y: targetY, scale: nextScale });
}

function ensureFlowNodesVisibleAfterBoot() {
    if (!viewport || !Array.isArray(flowState.nodes) || flowState.nodes.length === 0) return;
    updateFlowViewportCulling();
    requestAnimationFrame(() => {
        const vpRect = viewport.getBoundingClientRect();
        if (!vpRect.width || !vpRect.height) return;
        const margin = 24;
        const hasVisibleNode = flowState.nodes.some((node) => {
            const nodeEl = node && node.id ? document.getElementById(node.id) : null;
            if (!nodeEl) return false;
            const rect = nodeEl.getBoundingClientRect();
            if (rect.width <= 4 || rect.height <= 4) return false;
            return rect.right >= vpRect.left + margin
                && rect.left <= vpRect.right - margin
                && rect.bottom >= vpRect.top + margin
                && rect.top <= vpRect.bottom - margin;
        });
        if (!hasVisibleNode) {
            focusFlowNodes(flowState.nodes.map((node) => node.id));
        }
    });
}

function buildFlowSelectionCandidates() {
    flowSelectionCandidates = [];
    flowState.nodes.forEach((node) => {
        const nodeEl = document.getElementById(node.id);
        if (!nodeEl || nodeEl.classList.contains('is-viewport-culled')) return;
        flowSelectionCandidates.push({ id: node.id, rect: nodeEl.getBoundingClientRect() });
    });
}

function updateFlowSelectionFromPointer(e) {
    const box = flowState.selectionBox;
    const left = Math.min(box.startX, e.clientX);
    const top = Math.min(box.startY, e.clientY);
    const right = Math.max(box.startX, e.clientX);
    const bottom = Math.max(box.startY, e.clientY);
    const width = right - left;
    const height = bottom - top;
    const leftToRight = e.clientX >= box.startX;

    flowState.selectionBoxMode = leftToRight ? 'contain' : 'intersect';
    dragSelectBox.style.left = left + 'px';
    dragSelectBox.style.top = top + 'px';
    dragSelectBox.style.width = width + 'px';
    dragSelectBox.style.height = height + 'px';
    dragSelectBox.classList.toggle('is-window', leftToRight);
    dragSelectBox.classList.toggle('is-crossing', !leftToRight);

    flowState.selectedNodeIds.clear();
    if (width > 4 && height > 4) {
        flowSelectionCandidates.forEach((candidate) => {
            const rect = candidate.rect;
            const isIntersect = !(rect.left > right || rect.right < left || rect.top > bottom || rect.bottom < top);
            const isContain = rect.left >= left && rect.right <= right && rect.top >= top && rect.bottom <= bottom;
            const hit = leftToRight ? isContain : isIntersect;
            if (hit) flowState.selectedNodeIds.add(candidate.id);
        });
    }
    updateSelectionStyles();
}

function ensureFlowSelectionToolbar() {
    if (flowSelectionToolbarEl) return flowSelectionToolbarEl;
    flowSelectionToolbarEl = document.createElement('div');
    flowSelectionToolbarEl.className = 'flow-selection-toolbar';
    flowSelectionToolbarEl.innerHTML = `
        <button type="button" data-action="focus" title="聚焦选中节点"><span class="material-symbols-outlined">center_focus_strong</span></button>
        <button type="button" data-action="duplicate" title="复制选中节点"><span class="material-symbols-outlined">content_copy</span></button>
        <button type="button" data-action="freeze" title="冻结/解冻选中节点"><span class="material-symbols-outlined">ac_unit</span></button>
        <button type="button" data-action="delete" class="danger" title="删除选中节点"><span class="material-symbols-outlined">delete</span></button>
        <button type="button" data-action="clear" title="取消选择"><span class="material-symbols-outlined">close</span></button>
    `;
    flowSelectionToolbarEl.addEventListener('mousedown', (e) => e.stopPropagation());
    flowSelectionToolbarEl.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        if (action === 'focus') focusFlowNodes();
        if (action === 'duplicate') duplicateSelectedFlowNodes();
        if (action === 'freeze') toggleSelectedFlowNodesFreeze();
        if (action === 'delete') deleteSelectedFlowNodes(true);
        if (action === 'clear') clearNodeSelections();
    });
    document.body.appendChild(flowSelectionToolbarEl);
    return flowSelectionToolbarEl;
}

function updateFlowSelectionToolbar() {
    if (flowSelectionToolbarFrame) cancelAnimationFrame(flowSelectionToolbarFrame);
    flowSelectionToolbarFrame = requestAnimationFrame(() => {
        const toolbar = ensureFlowSelectionToolbar();
        flowSelectionToolbarFrame = 0;
        if (!flowState.selectedNodeIds || flowState.selectedNodeIds.size === 0) {
            toolbar.classList.remove('is-visible');
            return;
        }

        let left = Infinity, top = Infinity, right = -Infinity;
        flowState.selectedNodeIds.forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            const rect = el.getBoundingClientRect();
            left = Math.min(left, rect.left);
            top = Math.min(top, rect.top);
            right = Math.max(right, rect.right);
        });
        if (!Number.isFinite(left)) {
            toolbar.classList.remove('is-visible');
            return;
        }
        toolbar.style.left = ((left + right) / 2) + 'px';
        toolbar.style.top = Math.max(58, top - 12) + 'px';
        toolbar.classList.add('is-visible');
    });
}

function deleteSelectedFlowNodes(confirmFirst = true) {
    if (!flowState.selectedNodeIds || flowState.selectedNodeIds.size === 0) return;
    const total = flowState.selectedNodeIds.size;
    if (confirmFirst && !confirm(`确认删除选中的 ${total} 个节点及其所有连线吗？`)) return;
    const idsToDelete = new Set(flowState.selectedNodeIds);
    pushFlowHistory('bulk-delete');
    flowState.nodes = flowState.nodes.filter(n => !idsToDelete.has(n.id));
    flowState.links = flowState.links.filter(l => !idsToDelete.has(l.source) && !idsToDelete.has(l.target));
    flowState.selectedNodeIds.clear();
    rebuildLinkIndex();
    renderNodes();
    renderLinks();
    updateFlowSelectionToolbar();
    if (typeof saveFlowToDB === 'function') saveFlowToDB();
    if (typeof renderMinimap === 'function') renderMinimap();
}

function duplicateSelectedFlowNodes() {
    if (!flowState.selectedNodeIds || flowState.selectedNodeIds.size === 0) return;
    const selectedIds = Array.from(flowState.selectedNodeIds);
    const idMap = new Map();
    const now = Date.now();
    const newNodes = [];

    selectedIds.forEach((id, index) => {
        const source = flowState.nodes.find(n => n.id === id);
        const clone = deepCopyJsonSafe(source);
        if (!clone) return;
        const nextId = `node_${now}_${index}_${Math.random().toString(36).slice(2, 6)}`;
        idMap.set(id, nextId);
        clone.id = nextId;
        clone.x = (Number(clone.x) || 0) + 48;
        clone.y = (Number(clone.y) || 0) + 48;
        newNodes.push(clone);
    });

    if (!newNodes.length) return;
    const newLinks = (flowState.links || [])
        .filter(link => idMap.has(link.source) && idMap.has(link.target))
        .map((link, index) => {
            const linkClone = deepCopyJsonSafe(link);
            if (!linkClone) return null;
            linkClone.id = `link_${now}_${index}_${Math.random().toString(36).slice(2, 6)}`;
            linkClone.source = idMap.get(link.source);
            linkClone.target = idMap.get(link.target);
            return linkClone;
        })
        .filter(Boolean);

    pushFlowHistory('duplicate-selected');
    flowState.nodes.push(...newNodes);
    flowState.links.push(...newLinks);
    flowState.selectedNodeIds.clear();
    newNodes.forEach(node => flowState.selectedNodeIds.add(node.id));
    rebuildLinkIndex();
    renderNodes();
    renderLinks();
    updateSelectionStyles();
    updateFlowSelectionToolbar();
    if (typeof saveFlowToDB === 'function') saveFlowToDB();
    if (typeof renderMinimap === 'function') renderMinimap();
}

function toggleSelectedFlowNodesFreeze() {
    if (!flowState.selectedNodeIds || flowState.selectedNodeIds.size === 0) return;
    pushFlowHistory('toggle-freeze-selected');
    const selectedNodes = Array.from(flowState.selectedNodeIds)
        .map(id => flowState.nodes.find(n => n.id === id))
        .filter(Boolean);
    const shouldFreeze = selectedNodes.some(node => !node._frozen);
    selectedNodes.forEach(node => { node._frozen = shouldFreeze; });
    renderNodes();
    updateSelectionStyles();
    updateFlowSelectionToolbar();
    if (typeof saveFlowToDB === 'function') saveFlowToDB();
}

window.duplicateSelectedFlowNodes = duplicateSelectedFlowNodes;
window.deleteSelectedFlowNodes = deleteSelectedFlowNodes;
window.focusSelectedFlowNodes = () => focusFlowNodes();

// ==========================================
// 💾 工作流本地持久化引擎 (IndexedDB)
// ==========================================
async function saveFlowToDB() {
    if (typeof db === 'undefined') return;
    return new Promise((resolve) => {
        const tx = db.transaction('flow_workspaces', 'readwrite');
        tx.objectStore('flow_workspaces').put({
            id: 'default_workspace',
            nodes: flowState.nodes,
            links: flowState.links,
            transform: flowState.transform,
            timestamp: Date.now()
        });
        tx.oncomplete = () => resolve();
    });
}

async function loadFlowFromDB() {
    if (typeof db === 'undefined') return false;
    return new Promise((resolve) => {
        const tx = db.transaction('flow_workspaces', 'readonly');
        const req = tx.objectStore('flow_workspaces').get('default_workspace');
        req.onsuccess = () => {
            if (req.result) {
                flowState.nodes = req.result.nodes || [];
                flowState.links = req.result.links || [];
                rebuildLinkIndex();
                if (req.result.transform) flowState.transform = req.result.transform;
                resolve(true);
            } else resolve(false);
        };
        req.onerror = () => resolve(false);
    });
}

function deepCopyJsonSafe(obj) {
    try {
        return JSON.parse(JSON.stringify(obj));
    } catch (err) {
        return null;
    }
}

function snapshotFlowState() {
    return {
        nodes: deepCopyJsonSafe(flowState.nodes) || [],
        links: deepCopyJsonSafe(flowState.links) || [],
        transform: deepCopyJsonSafe(flowState.transform) || { x: 0, y: 0, scale: 1 }
    };
}

function pushFlowHistory(label) {
    if (flowState.history.isApplying) return;
    const snap = snapshotFlowState();
    if (!snap) return;
    const undoStack = flowState.history.undo;
    undoStack.push(snap);
    if (undoStack.length > flowState.history.maxSteps) undoStack.shift();
    flowState.history.redo = [];
}

function applyFlowSnapshot(snapshot) {
    if (!snapshot) return;
    flowState.history.isApplying = true;
    flowState.nodes = deepCopyJsonSafe(snapshot.nodes) || [];
    flowState.links = deepCopyJsonSafe(snapshot.links) || [];
    flowState.transform = deepCopyJsonSafe(snapshot.transform) || { x: 0, y: 0, scale: 1 };
    flowState.selectedNodeIds.clear();
    renderNodes();
    rebuildLinkIndex();
    renderLinks();
    updateCanvasTransform();
    flowState.history.isApplying = false;
}

window.undoFlow = function() {
    if (!flowState.history.undo.length) return;
    const current = snapshotFlowState();
    const prev = flowState.history.undo.pop();
    flowState.history.redo.push(current);
    applyFlowSnapshot(prev);
    if (typeof saveFlowToDB === 'function') saveFlowToDB();
};

window.redoFlow = function() {
    if (!flowState.history.redo.length) return;
    const current = snapshotFlowState();
    const next = flowState.history.redo.pop();
    flowState.history.undo.push(current);
    applyFlowSnapshot(next);
    if (typeof saveFlowToDB === 'function') saveFlowToDB();
};

function rebuildLinkIndex() {
    flowLinkIndexByNode.clear();
    (flowState.links || []).forEach((link) => {
        if (!link || !link.id) return;
        const sourceSet = flowLinkIndexByNode.get(link.source) || new Set();
        sourceSet.add(link.id);
        flowLinkIndexByNode.set(link.source, sourceSet);
        const targetSet = flowLinkIndexByNode.get(link.target) || new Set();
        targetSet.add(link.id);
        flowLinkIndexByNode.set(link.target, targetSet);
    });
}

function getRelatedLinkIds(nodeIds) {
    const ids = Array.isArray(nodeIds) ? nodeIds : [nodeIds];
    const result = new Set();
    ids.forEach((nodeId) => {
        const linkSet = flowLinkIndexByNode.get(nodeId);
        if (linkSet) linkSet.forEach((lid) => result.add(lid));
    });
    return result;
}

// ==========================================
// 🎨 支持内联预览的渲染引擎
// ==========================================
function renderPreview(node) {
    if (!node.result || !node.result.data) return '';
    const safeSrc = escapeFlowAttr(node.result.data);
    if (node.result.type === 'image') {
        return `<img src="${safeSrc}" style="width:100%; height:auto; display:block; border-radius: 4px;" />`;
    } else if (node.result.type === 'video') {
        return `<video src="${safeSrc}" style="width:100%; height:auto; display:block; border-radius: 4px;" autoplay loop muted controls></video>`;
    }
    return '';
}

function renderImageUploadInput(node, inp, val) {
    const hasImage = typeof val === 'string' && val.length > 100;
    const uploadId = `node-file-${node.id}-${inp.id}`;
    const uploadUiId = `img-upload-ui-${node.id}-${inp.id}`;
    const isPrimaryImageNode = node.type === 'base_image' && inp.id === 'image';

    if (isPrimaryImageNode) {
        return `
        <div id="${uploadUiId}" class="node-image-upload node-image-upload-large ${hasImage ? 'has-image' : ''}"
             ondragover="event.preventDefault(); this.classList.add('node-image-drag-over');" 
             ondragleave="event.preventDefault(); this.classList.remove('node-image-drag-over');" 
             ondrop="handleNodeImageDrop(event, '${node.id}', '${inp.id}'); this.classList.remove('node-image-drag-over');">
            <input id="${uploadId}" type="file" accept="image/*" style="display:none;" onchange="handleNodeImageUpload(event, '${node.id}', '${inp.id}')">
            ${hasImage
                ? `<img src="${escapeFlowAttr(val)}" class="img-preview-large" onmousedown="event.stopPropagation()" data-tip="已挂载图片，支持再次拖入覆盖">`
                : `<div class="node-image-upload-empty"><span class="material-symbols-outlined">image</span><span>拖入图片或点击上传</span></div>`}
            <label for="${uploadId}" class="node-image-upload-overlay" onmousedown="event.stopPropagation()">
                <span class="material-symbols-outlined">upload</span>
                <span class="img-upload-text">${hasImage ? '更换图片' : '上传 / 拖入图片'}</span>
            </label>
        </div>`;
    }

    return `
    <div id="${uploadUiId}" class="node-image-upload"
         ondragover="event.preventDefault(); this.style.borderColor='var(--accent)';" 
         ondragleave="event.preventDefault(); this.style.borderColor='transparent';" 
         ondrop="handleNodeImageDrop(event, '${node.id}', '${inp.id}'); this.style.borderColor='transparent';">
        <label class="node-input" style="flex:1; text-align:center; cursor:pointer; background: rgba(56,189,248,0.1); border-color: rgba(56,189,248,0.3); color: #38bdf8; padding: 6px; transition: 0.2s; margin:0;" onmouseover="this.style.background='rgba(56,189,248,0.2)'" onmouseout="this.style.background='rgba(56,189,248,0.1)'">
            <input type="file" accept="image/*" style="display:none;" onchange="handleNodeImageUpload(event, '${node.id}', '${inp.id}')">
            <span class="material-symbols-outlined" style="font-size:14px; vertical-align:middle;">upload</span> <span class="img-upload-text">${hasImage ? '更换图片' : '点击 / 拖入图片'}</span>
        </label>
        ${hasImage ? `<img src="${escapeFlowAttr(val)}" class="img-preview-thumb" style="width:28px; height:28px; border-radius:4px; object-fit:cover; border:1px solid rgba(255,255,255,0.2);" onmousedown="event.stopPropagation()" data-tip="已挂载本地内存">` : ''}
    </div>`;
}

function renderNodes() {
    if(!nodeBoard) return;

    // 1. 🗑️ 垃圾回收
    const activeNodeIds = new Set(flowState.nodes.map(n => n.id));
    Array.from(nodeBoard.children).forEach(child => {
        if (!activeNodeIds.has(child.id)) child.remove();
    });

    // 2. 🏭 靶向挂载与更新
    flowState.nodes.forEach(node => {
        let nodeEl = document.getElementById(node.id);

        if (!nodeEl) {
            nodeEl = document.createElement('div');
            nodeEl.className = 'veo-node';
            nodeEl.id = node.id;
            
            let inputsHtml = '';
            if (node.inputs && node.inputs.length > 0) {
                const isCollapsed = node._inputsCollapsed || false;
                inputsHtml = `
                    <div class="node-inputs-toggle-bar" onclick="toggleNodeInputs('${node.id}')" style="display:flex; justify-content:space-between; align-items:center; padding: 6px 8px; background: rgba(255,255,255,0.02); border-radius:4px; margin-bottom:8px; cursor:pointer; font-size:11px; color:#666; transition: 0.2s;" onmouseover="this.style.color='#aaa'; this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.color='#666'; this.style.background='rgba(255,255,255,0.02)'">
                        <span style="display:flex; align-items:center; gap:4px;"><span class="material-symbols-outlined" style="font-size:13px;">tune</span> 节点参数配置</span>
                        <span class="material-symbols-outlined arrow-icon" style="font-size:14px; transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1); transform: ${isCollapsed ? 'rotate(-90deg)' : 'none'}">expand_more</span>
                    </div>
                    <div class="node-inputs-container" id="inputs-container-${node.id}" style="display: ${isCollapsed ? 'none' : 'block'};">`;
                    
                node.inputs.forEach(inp => {
                    const val = node.data && node.data[inp.id] !== undefined ? node.data[inp.id] : inp.default;
                    inputsHtml += `<div class="node-input-group" id="group-${node.id}-${inp.id}"><div class="node-input-label">${escapeFlowHtml(inp.label)}</div>`;
                    
                    if (inp.type === 'textarea') {
                        inputsHtml += `<textarea class="node-input" rows="3" 
                            onmousedown="event.stopPropagation()" 
                            oninput="updateNodeData('${node.id}', '${inp.id}', this.value); window.AutocompleteController.listen(event, '${node.id}');"
                            onkeydown="window.AutocompleteController.handleKeyDown(event);">${escapeFlowHtml(val)}</textarea>`;
                    } else if (inp.type === 'select') {
                        inputsHtml += `<select class="node-input" onmousedown="event.stopPropagation()" onchange="updateNodeData('${node.id}', '${inp.id}', this.value); evaluateNodeConditions('${node.id}');">
                            ${inp.options.map(opt => `<option value="${escapeFlowAttr(opt)}" ${val === opt ? 'selected' : ''}>${escapeFlowHtml(opt)}</option>`).join('')}
                        </select>`;
                    } else if (inp.type === 'number') {
                        inputsHtml += `<input type="number" class="node-input" onmousedown="event.stopPropagation()" value="${escapeFlowAttr(val)}" oninput="updateNodeData('${node.id}', '${inp.id}', this.value)" style="font-family: monospace; color: var(--accent);" />`;
                    } else if (inp.type === 'image_upload') {
                        inputsHtml += renderImageUploadInput(node, inp, val);
                    }
                    inputsHtml += `</div>`;
                });
                inputsHtml += '</div>'; 
            } 

            nodeEl.innerHTML = `
                <div class="node-header" style="background: ${node.type === 'tool_image_gen' ? 'rgba(192,132,252,0.1)' : 'rgba(56,189,248,0.1)'};">
                    <div class="node-header-main">
                        <span>${escapeFlowHtml(node.title)}</span>
                        <span class="node-header-tools">
                            <button class="node-freeze-btn ${node._frozen ? 'is-frozen' : ''}" type="button" onclick="toggleNodeFreeze(event, '${node.id}')" onmousedown="event.stopPropagation()" data-tip="${node._frozen ? '解冻节点' : '冻结节点并复用缓存'}">
                                <span class="material-symbols-outlined">${node._frozen ? 'ac_unit' : 'lock_open'}</span>
                            </button>
                        </span>
                    </div>
                </div>
                <div class="node-body">
                    ${inputsHtml}
                    ${(node.ports.in || []).map(p => `
                        <div class="port-row">
                            <div class="port port-in port-${p.type}" id="${node.id}-${p.id}" 
                                 onmousedown="startDrawLink(event, '${node.id}', '${p.id}', '${p.type}', 'in')" 
                                 onmouseup="finishDrawLink(event, '${node.id}', '${p.id}', '${p.type}', 'in')"
                                 ondblclick="disconnectPort(event, '${node.id}', '${p.id}')"></div>
                            <span style="margin-left: 12px;">${escapeFlowHtml(p.label)}</span>
                        </div>
                    `).join('')}
                    ${(node.ports.out || []).map(p => `
                        <div class="port-row" style="justify-content: flex-end;">
                            <span style="margin-right: 12px;">${escapeFlowHtml(p.label)}</span>
                            <div class="port port-out port-${p.type}" id="${node.id}-${p.id}" 
                                 onmousedown="startDrawLink(event, '${node.id}', '${p.id}', '${p.type}', 'out')"
                                 onmouseup="finishDrawLink(event, '${node.id}', '${p.id}', '${p.type}', 'out')"
                                 ondblclick="disconnectPort(event, '${node.id}', '${p.id}')"></div>
                        </div>
                    `).join('')}
                    <div id="preview-${node.id}" style="margin-top:10px; border-radius:6px; overflow:hidden; background:rgba(0,0,0,0.3);">
                        ${node.result ? renderPreview(node) : ''}
                    </div>
                </div>
            `;
            
            nodeEl.onmousedown = (e) => startDragNode(e, node.id);
            nodeEl.oncontextmenu = (e) => showNodeMenu(e, node.id);
            nodeBoard.appendChild(nodeEl);
        }

        nodeEl.classList.toggle('is-frozen', !!node._frozen);
        nodeEl.style.transform = `translate(${node.x}px, ${node.y}px)`;
        evaluateNodeConditions(node.id);
    });
    updateSelectionStyles();
    scheduleFlowViewportCulling(80);
}

// ==========================================
// 🧠 节点动态表单求值器
// ==========================================
window.evaluateNodeConditions = function(nodeId) {
    const node = flowState.nodes.find(n => n.id === nodeId);
    if (!node || !node.inputs) return;
    
    node.inputs.forEach(inp => {
        if (inp.condition) {
            const groupEl = document.getElementById(`group-${node.id}-${inp.id}`);
            if (!groupEl) return;
            const depVal = node.data[inp.condition.field] !== undefined 
                ? node.data[inp.condition.field] 
                : node.inputs.find(i => i.id === inp.condition.field).default;
            if (depVal !== inp.condition.value) {
                groupEl.style.display = 'none';
            } else {
                groupEl.style.display = 'flex';
            }
        }
    });
};

// ==========================================
// ⚡ 节点内参数表单无损收纳引擎
// ==========================================
window.toggleNodeInputs = function(nodeId) {
    const node = flowState.nodes.find(n => n.id === nodeId);
    if (!node) return;
    node._inputsCollapsed = !node._inputsCollapsed;
    const container = document.getElementById(`inputs-container-${nodeId}`);
    if (container) {
        const isCollapsed = node._inputsCollapsed;
        container.style.display = isCollapsed ? 'none' : 'block';
        const arrow = container.previousElementSibling?.querySelector('.arrow-icon');
        if (arrow) arrow.style.transform = isCollapsed ? 'rotate(-90deg)' : 'none';
    }
    if (typeof saveFlowToDB === 'function') saveFlowToDB();
    if (typeof renderMinimap === 'function') renderMinimap();
};

window.toggleNodeFreeze = function(event, nodeId) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const node = flowState.nodes.find(n => n.id === nodeId);
    if (!node) return;
    node._frozen = !node._frozen;
    const el = document.getElementById(nodeId);
    if (el) {
        el.classList.toggle('is-frozen', !!node._frozen);
        const btn = el.querySelector('.node-freeze-btn');
        if (btn) {
            btn.classList.toggle('is-frozen', !!node._frozen);
            btn.setAttribute('data-tip', node._frozen ? '解冻节点' : '冻结节点并复用缓存');
            const icon = btn.querySelector('.material-symbols-outlined');
            if (icon) icon.textContent = node._frozen ? 'ac_unit' : 'lock_open';
        }
    }
    if (typeof saveFlowToDB === 'function') saveFlowToDB();
};

window.clearNodeCache = function(nodeId) {
    const node = flowState.nodes.find(n => n.id === nodeId);
    if (!node) return;
    node.result = null;
    node._lastInputHash = '';
    const preview = document.getElementById(`preview-${nodeId}`);
    if (preview) preview.innerHTML = '';
    setNodeStatus(nodeId, 'idle');
    if (typeof saveFlowToDB === 'function') saveFlowToDB();
};

// ==========================================
// 🎨 SVG 局部靶向渲染引擎
// ==========================================
function renderSingleLink(link, canvasRect) {
    if (!link || !link.id) return;
    const sourcePortEl = document.getElementById(`${link.source}-${link.sourcePort}`);
    const targetPortEl = document.getElementById(`${link.target}-${link.targetPort}`);
    const pathId = 'svgpath_' + link.id;
    let pathEl = document.getElementById(pathId);

    if (!sourcePortEl || !targetPortEl) {
        if (pathEl) pathEl.remove();
        flowLinkPathCache.delete(link.id);
        return;
    }

    const sRect = sourcePortEl.getBoundingClientRect();
    const tRect = targetPortEl.getBoundingClientRect();
    const x1 = (sRect.left + sRect.width / 2 - canvasRect.left) / flowState.transform.scale;
    const y1 = (sRect.top + sRect.height / 2 - canvasRect.top) / flowState.transform.scale;
    const x2 = (tRect.left + tRect.width / 2 - canvasRect.left) / flowState.transform.scale;
    const y2 = (tRect.top + tRect.height / 2 - canvasRect.top) / flowState.transform.scale;
    const offset = Math.max(Math.abs(x2 - x1) / 2, 60);
    const pathData = `M ${x1} ${y1} C ${x1 + offset} ${y1}, ${x2 - offset} ${y2}, ${x2} ${y2}`;

    if (!pathEl) {
        pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
        pathEl.id = pathId;
        pathEl.setAttribute('stroke', link.type === 'image' ? '#c084fc' : (link.type === 'text' ? '#fbbf24' : '#38bdf8'));
        pathEl.setAttribute('stroke-width', '3');
        pathEl.setAttribute('fill', 'none');
        pathEl.setAttribute('opacity', '0.8');
        pathEl.setAttribute('stroke-linecap', 'round');
        svgLayer.appendChild(pathEl);
    }
    const prevD = flowLinkPathCache.get(link.id);
    if (prevD !== pathData) {
        pathEl.setAttribute('d', pathData);
        flowLinkPathCache.set(link.id, pathData);
    }
}

function renderLinks(dirtyNodeIds = null) {
    if (!svgLayer) return;
    const canvasRect = canvas.getBoundingClientRect();

    const targetLinkIds = (dirtyNodeIds && dirtyNodeIds.size)
        ? getRelatedLinkIds(Array.from(dirtyNodeIds))
        : new Set((flowState.links || []).map(l => l.id));

    flowState.links.forEach((link) => {
        if (!link || !link.id) return;
        if (!targetLinkIds.has(link.id)) return;
        renderSingleLink(link, canvasRect);
    });

    if (!dirtyNodeIds || !dirtyNodeIds.size) {
        const existingPaths = Array.from(svgLayer.querySelectorAll('path[id^="svgpath_link_"]'));
        const validLinkIds = new Set(flowState.links.map(l => 'svgpath_' + l.id));
        existingPaths.forEach(p => {
            if (!validLinkIds.has(p.id)) p.remove();
        });
    }

    let drawingPath = document.getElementById('svgpath_drawing_temp');
    if (flowState.drawingLink.active) {
        const x1 = flowState.drawingLink.startX;
        const y1 = flowState.drawingLink.startY;
        const x2 = flowState.drawingLink.currentX;
        const y2 = flowState.drawingLink.currentY;
        const offset = Math.max(Math.abs(x2 - x1) / 2, 60);
        const pathData = `M ${x1} ${y1} C ${x1 + offset} ${y1}, ${x2 - offset} ${y2}, ${x2} ${y2}`;

        if (!drawingPath) {
            drawingPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
            drawingPath.id = 'svgpath_drawing_temp';
            drawingPath.setAttribute('stroke-width', '3');
            drawingPath.setAttribute('fill', 'none');
            drawingPath.setAttribute('stroke-dasharray', '6,6');
            drawingPath.setAttribute('opacity', '0.9');
            drawingPath.setAttribute('stroke-linecap', 'round');
            svgLayer.appendChild(drawingPath);
        }

        drawingPath.setAttribute('stroke', flowState.drawingLink.type === 'image' ? '#c084fc' : (flowState.drawingLink.type === 'text' ? '#fbbf24' : '#38bdf8'));
        drawingPath.setAttribute('d', pathData);
        drawingPath.style.display = 'block';
    } else if (drawingPath) {
        drawingPath.style.display = 'none';
    }
}

function getNodeById(nodeId) {
    return flowState.nodes.find(n => n.id === nodeId) || null;
}

function getPortById(node, ioType, portId) {
    if (!node || !node.ports) return null;
    const list = ioType === 'out' ? (node.ports.out || []) : (node.ports.in || []);
    return list.find(p => p.id === portId) || null;
}

function hasGraphCycle(nodes, links) {
    if (!Array.isArray(nodes) || nodes.length === 0) return false;

    const indegree = new Map();
    const adjacency = new Map();
    nodes.forEach(n => {
        indegree.set(n.id, 0);
        adjacency.set(n.id, new Set());
    });

    (links || []).forEach(link => {
        if (!link || !indegree.has(link.source) || !indegree.has(link.target)) return;
        if (adjacency.get(link.source).has(link.target)) return;
        adjacency.get(link.source).add(link.target);
        indegree.set(link.target, indegree.get(link.target) + 1);
    });

    const queue = [];
    indegree.forEach((deg, nodeId) => {
        if (deg === 0) queue.push(nodeId);
    });

    let visited = 0;
    while (queue.length > 0) {
        const current = queue.shift();
        visited++;
        adjacency.get(current).forEach(next => {
            const nextDeg = indegree.get(next) - 1;
            indegree.set(next, nextDeg);
            if (nextDeg === 0) queue.push(next);
        });
    }

    return visited !== nodes.length;
}

function sanitizeFlowLinks(links) {
    const sanitized = [];
    const exactSet = new Set();
    const targetInputSlotIndex = new Map();

    (links || []).forEach((link) => {
        if (!link) return;

        const sourceNode = getNodeById(link.source);
        const targetNode = getNodeById(link.target);
        if (!sourceNode || !targetNode) return;

        const sourcePort = getPortById(sourceNode, 'out', link.sourcePort);
        const targetPort = getPortById(targetNode, 'in', link.targetPort);
        if (!sourcePort || !targetPort) return;
        if (sourcePort.type !== targetPort.type) return;

        const exactKey = `${link.source}|${link.sourcePort}|${link.target}|${link.targetPort}|${sourcePort.type}`;
        if (exactSet.has(exactKey)) return;
        exactSet.add(exactKey);

        const normalizedLink = {
            id: link.id || ('link_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)),
            source: link.source,
            sourcePort: link.sourcePort,
            target: link.target,
            targetPort: link.targetPort,
            type: sourcePort.type
        };

        const inputSlotKey = `${normalizedLink.target}|${normalizedLink.targetPort}`;
        if (targetInputSlotIndex.has(inputSlotKey)) {
            sanitized[targetInputSlotIndex.get(inputSlotKey)] = normalizedLink;
        } else {
            targetInputSlotIndex.set(inputSlotKey, sanitized.length);
            sanitized.push(normalizedLink);
        }
    });

    return sanitized.filter(Boolean);
}

function linksFingerprint(links) {
    return JSON.stringify((links || []).map(l => `${l.source}|${l.sourcePort}|${l.target}|${l.targetPort}|${l.type}`).sort());
}

function normalizeFlowLinks(persistToDb = true) {
    const current = flowState.links || [];
    const next = sanitizeFlowLinks(current);
    const changed = linksFingerprint(current) !== linksFingerprint(next);
    if (!changed) rebuildLinkIndex();
    if (changed) {
        flowState.links = next;
        rebuildLinkIndex();
        renderLinks();
        if (persistToDb && typeof saveFlowToDB === 'function') saveFlowToDB();
    }
    return flowState.links;
}

// ==========================================
// 🖱️ 交互引擎 (拖拉拽核心)
// ==========================================
function startDragNode(e, nodeId) {
    const tag = e.target.tagName;
    if (flowState.isSpacePanning || e.shiftKey) return;
    if (e.button !== 0 || e.target.classList.contains('port') || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'OPTION') return; 
    
    e.stopPropagation();
    cancelFlowInertia();
    
    // 🌟 智能多选点触联动：如果没按 Shift 且点击了一个未选中的节点，清空之前的所有选择
    if (!e.shiftKey && !flowState.selectedNodeIds.has(nodeId)) {
        clearNodeSelections();
    }
    
    // 将当前拖拽的节点强行纳入选中阵列
    flowState.selectedNodeIds.add(nodeId);
    updateSelectionStyles();
    pushFlowHistory('move-node');

    flowState.activeNode = flowState.nodes.find(n => n.id === nodeId);
    flowState.startX = e.clientX; flowState.startY = e.clientY;
    
    // 批量抬升选中节点的层级
    flowState.selectedNodeIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.zIndex = 100;
    });
}

function computeEdgeScrollDelta(clientX, clientY) {
    const rect = viewport.getBoundingClientRect();
    const threshold = flowState.edgeScroll.threshold;
    const maxStep = flowState.edgeScroll.maxStep;
    let dx = 0;
    let dy = 0;

    if (clientX < rect.left + threshold) {
        const ratio = Math.max(0, (threshold - (clientX - rect.left)) / threshold);
        dx = maxStep * ratio;
    } else if (clientX > rect.right - threshold) {
        const ratio = Math.max(0, (threshold - (rect.right - clientX)) / threshold);
        dx = -maxStep * ratio;
    }

    if (clientY < rect.top + threshold) {
        const ratio = Math.max(0, (threshold - (clientY - rect.top)) / threshold);
        dy = maxStep * ratio;
    } else if (clientY > rect.bottom - threshold) {
        const ratio = Math.max(0, (threshold - (rect.bottom - clientY)) / threshold);
        dy = -maxStep * ratio;
    }

    return { dx, dy };
}

// 辅助函数：清除高亮
window.clearNodeSelections = function() {
    flowState.selectedNodeIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('is-selected');
    });
    flowState.selectedNodeIds.clear();
    updateFlowSelectionToolbar();
};

// 辅助函数：靶向渲染高亮样式
window.updateSelectionStyles = function() {
    flowState.nodes.forEach(n => {
        const el = document.getElementById(n.id);
        if (el) {
            if (flowState.selectedNodeIds.has(n.id)) {
                el.classList.add('is-selected');
            } else {
                el.classList.remove('is-selected');
            }
        }
    });
    updateFlowSelectionToolbar();
};

window.startDrawLink = function(e, nodeId, portId, portType, ioType) {
    if (ioType !== 'out') return;
    e.stopPropagation();
    cancelFlowInertia();
    viewport.classList.add('is-linking');
    const portEl = e.target;
    const pRect = portEl.getBoundingClientRect();
    const cRect = canvas.getBoundingClientRect();
    flowState.drawingLink = {
        active: true, sourceNode: nodeId, sourcePort: portId, type: portType,
        startX: (pRect.left + pRect.width/2 - cRect.left) / flowState.transform.scale,
        startY: (pRect.top + pRect.height/2 - cRect.top) / flowState.transform.scale,
        currentX: (e.clientX - cRect.left) / flowState.transform.scale,
        currentY: (e.clientY - cRect.top) / flowState.transform.scale
    };
};

window.finishDrawLink = function(e, targetNodeId, targetPortId, targetPortType, ioType) {
    e.stopPropagation();
    if (!flowState.drawingLink.active) return;

    const { sourceNode, sourcePort, type } = flowState.drawingLink;
    flowState.drawingLink.active = false;
    viewport.classList.remove('is-linking');

    if (ioType !== 'in' || sourceNode === targetNodeId || type !== targetPortType) {
        renderLinks();
        return;
    }

    const sourceNodeData = getNodeById(sourceNode);
    const targetNodeData = getNodeById(targetNodeId);
    const sourcePortData = getPortById(sourceNodeData, 'out', sourcePort);
    const targetPortData = getPortById(targetNodeData, 'in', targetPortId);

    if (!sourceNodeData || !targetNodeData || !sourcePortData || !targetPortData) {
        renderLinks();
        return;
    }
    if (sourcePortData.type !== targetPortData.type) {
        alert('端口类型不匹配，连线已取消。');
        renderLinks();
        return;
    }

    const sameLinkExists = flowState.links.some(l =>
        l.source === sourceNode &&
        l.sourcePort === sourcePort &&
        l.target === targetNodeId &&
        l.targetPort === targetPortId
    );
    if (sameLinkExists) {
        renderLinks();
        return;
    }

    const withoutTargetInput = flowState.links.filter(l => !(l.target === targetNodeId && l.targetPort === targetPortId));
    const candidateLink = {
        id: 'link_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        source: sourceNode,
        sourcePort: sourcePort,
        target: targetNodeId,
        targetPort: targetPortId,
        type: sourcePortData.type
    };
    const nextLinks = sanitizeFlowLinks(withoutTargetInput.concat(candidateLink));

    if (hasGraphCycle(flowState.nodes, nextLinks)) {
        alert('检测到死循环风险：该连线会形成环路，已阻止。');
        renderLinks();
        return;
    }

    pushFlowHistory('link-add');
    flowState.links = nextLinks;
    rebuildLinkIndex();
    if (typeof saveFlowToDB === 'function') saveFlowToDB();
    renderLinks();
    console.log(`🔗 连线成功: ${sourceNode} -> ${targetNodeId}`);
};

let isTicking = false;
let lastPointerEvent = null;

// 画布点按控制器 (打通平移与 Shift 区域框选双模态)
viewport.addEventListener('mousedown', (e) => {
    if (e.button !== 0 && e.button !== 1) return;
    if (isFlowFormTarget(e.target)) return;
    cancelFlowInertia();

    // 🌟 核心：如果按住了 Shift 键或者点的空白处，开启批量框选模式
    if (e.button === 0 && e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        flowState.selectionBox.active = true;
        flowState.selectionBox.startX = e.clientX;
        flowState.selectionBox.startY = e.clientY;
        flowState.selectionBoxMode = 'intersect';
        buildFlowSelectionCandidates();
        clearNodeSelections();
        
        dragSelectBox.style.left = e.clientX + 'px';
        dragSelectBox.style.top = e.clientY + 'px';
        dragSelectBox.style.width = '0px';
        dragSelectBox.style.height = '0px';
        dragSelectBox.style.display = 'block';
        dragSelectBox.classList.remove('is-window');
        dragSelectBox.classList.add('is-crossing');
        return;
    }

    // 正常画布空白点击清空选择
    if (e.button === 0 && e.target === viewport) {
        clearNodeSelections();
    }

    const isCanvasSurface = e.target === viewport || e.target === canvas || e.target === nodeBoard || e.target === svgLayer;
    const shouldPan = e.button === 1 || (e.button === 0 && (flowState.isSpacePanning || isCanvasSurface));
    if (shouldPan) {
        e.preventDefault();
        e.stopPropagation();
        pushFlowHistory('pan-canvas');
        flowState.isPanning = true; flowState.startX = e.clientX; flowState.startY = e.clientY;
        recordFlowPanSample(e.clientX, e.clientY);
        viewport.classList.add('is-panning-active');
        markFlowMinimapActive();
    }
});

window.addEventListener('mousemove', (e) => {
    lastPointerEvent = e;
    if (!isTicking) {
        requestAnimationFrame(() => {
            const evt = lastPointerEvent || e;
            // 模式 1：动态拉连线
            if (flowState.drawingLink.active) {
                const cRect = canvas.getBoundingClientRect();
                flowState.drawingLink.currentX = (evt.clientX - cRect.left) / flowState.transform.scale;
                flowState.drawingLink.currentY = (evt.clientY - cRect.top) / flowState.transform.scale;
                renderLinks();
            }
            // 模式 2：高级框选矩形绘制
            else if (flowState.selectionBox.active) {
                updateFlowSelectionFromPointer(evt);
            }
            // 模式 3：工业级多节点协同平移 (矩阵协同位移核心)
            else if (flowState.activeNode) {
                const dx = (evt.clientX - flowState.startX) / flowState.transform.scale;
                const dy = (evt.clientY - flowState.startY) / flowState.transform.scale;
                
                // 遍历选中矩阵中的所有节点，齐步走！
                flowState.selectedNodeIds.forEach(id => {
                    const targetNode = flowState.nodes.find(n => n.id === id);
                    if (targetNode) {
                        targetNode.x += dx;
                        targetNode.y += dy;
                        const el = document.getElementById(id);
                        if (el) el.style.transform = `translate(${targetNode.x}px, ${targetNode.y}px)`;
                    }
                });
                
                flowState.startX = evt.clientX; flowState.startY = evt.clientY;
                const dirtyIds = new Set(Array.from(flowState.selectedNodeIds));
                renderLinks(dirtyIds); 
                if (typeof renderMinimap === 'function') renderMinimap(); // 联动更新小地图
                updateFlowSelectionToolbar();
            }
            // 模式 4：画布全局平移
            else if (flowState.isPanning) {
                panFlowBy(evt.clientX - flowState.startX, evt.clientY - flowState.startY);
                flowState.startX = evt.clientX; flowState.startY = evt.clientY;
                recordFlowPanSample(evt.clientX, evt.clientY);
            }

            if (flowState.activeNode || flowState.drawingLink.active) {
                const edgeDelta = computeEdgeScrollDelta(evt.clientX, evt.clientY);
                if (Math.abs(edgeDelta.dx) > 0.2 || Math.abs(edgeDelta.dy) > 0.2) {
                    panFlowBy(edgeDelta.dx, edgeDelta.dy);
                    if (flowState.activeNode) {
                        const dirtyIds = new Set(Array.from(flowState.selectedNodeIds));
                        renderLinks(dirtyIds);
                    } else {
                        renderLinks();
                    }
                }
            }
            isTicking = false;
        });
        isTicking = true;
    }
});

window.addEventListener('mouseup', (e) => {
    let shouldSave = false;

    // 🌟 框选已经在 mousemove 中实时计算，mouseup 只负责收尾。
    if (flowState.selectionBox.active) {
        const sRect = dragSelectBox.getBoundingClientRect();
        flowState.selectionBox.active = false;
        dragSelectBox.style.display = 'none';
        dragSelectBox.classList.remove('is-window', 'is-crossing');
        flowSelectionCandidates = [];
        if (sRect.width <= 4 || sRect.height <= 4) {
            clearNodeSelections();
        } else {
            updateSelectionStyles();
        }
    }

    if (flowState.activeNode) {
        flowState.selectedNodeIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.zIndex = '';
        });
        shouldSave = true;
    }
    if (flowState.isPanning) {
        shouldSave = true;
        startFlowInertia();
    }

    flowState.activeNode = null;
    flowState.isPanning = false;
    if (!flowInertiaFrame) viewport.classList.remove('is-panning-active');
    
    if (flowState.drawingLink.active) {
        flowState.drawingLink.active = false;
        renderLinks();
        viewport.classList.remove('is-linking');
    }

    if (shouldSave && typeof saveFlowToDB === 'function') saveFlowToDB();
    if (typeof renderMinimap === 'function') renderMinimap(); // 联动更新小地图
    updateFlowSelectionToolbar();
});

viewport.addEventListener('wheel', (e) => {
    if (shouldAllowNativeWheel(e)) return;
    e.preventDefault();
    cancelFlowInertia();

    const absX = Math.abs(e.deltaX || 0);
    const absY = Math.abs(e.deltaY || 0);
    const isPinchZoom = e.ctrlKey;
    const looksLikeTrackpadPan = !isPinchZoom && (absX > 0 || (e.deltaMode === 0 && absY > 0 && absY < 42));

    if (looksLikeTrackpadPan) {
        panFlowBy(-(e.deltaX || 0), -(e.deltaY || 0));
    } else {
        const zoomFactor = Math.exp(-e.deltaY * (isPinchZoom ? 0.01 : 0.0016));
        zoomFlowAt(e.clientX, e.clientY, flowState.transform.scale * zoomFactor);
    }

    clearTimeout(flowWheelSaveTimer);
    flowWheelSaveTimer = setTimeout(() => {
        if (typeof saveFlowToDB === 'function') saveFlowToDB();
    }, 260);
}, { passive: false });

function updateCanvasTransform() {
    flowState.transform.scale = clampFlowScale(flowState.transform.scale);
    canvas.style.transform = `translate3d(${flowState.transform.x}px, ${flowState.transform.y}px, 0) scale(${flowState.transform.scale})`;

    const scale = flowState.transform.scale;
    const baseGrid = scale < 0.32 ? 100 : (scale < 0.62 ? 50 : (scale > 2.2 ? 10 : 20));
    const gridSize = Math.max(8, baseGrid * scale);
    viewport.style.backgroundPosition = `${flowState.transform.x}px ${flowState.transform.y}px`;
    viewport.style.backgroundSize = `${gridSize}px ${gridSize}px`;

    markFlowMinimapActive(520);
    if (typeof renderMinimap === 'function') renderMinimap();
    scheduleFlowViewportCulling();
    updateFlowSelectionToolbar();
}

// ==========================================
// 🔪 断线与节点操作
// ==========================================
window.disconnectPort = function(e, nodeId, portId) {
    e.stopPropagation();
    const initialLen = flowState.links.length;
    flowState.links = flowState.links.filter(l => !(
        (l.source === nodeId && l.sourcePort === portId) ||
        (l.target === nodeId && l.targetPort === portId)
    ));
    if (flowState.links.length !== initialLen) {
        pushFlowHistory('link-remove');
        rebuildLinkIndex();
        renderLinks();
        if (typeof saveFlowToDB === 'function') saveFlowToDB();
    }
};

// ==========================================
// 📦 工作流拓扑序列化引擎 (Import / Export)
// ==========================================

// 1. 导出：脱水打包 (Dehydration)
window.exportFlowToJSON = function() {
    if (flowState.nodes.length === 0) return alert("画布是空的，没有可导出的数据！");

    const exportData = {
        version: '1.0.0',
        timestamp: Date.now(),
        // 核心过滤：剔除 result, _cancelToken, dom相关状态，只留核心骨架
        nodes: flowState.nodes.map(n => ({
            id: n.id, type: n.type, x: n.x, y: n.y, data: n.data || {}
        })),
        links: flowState.links.map(l => ({
            id: l.id, source: l.source, sourcePort: l.sourcePort, target: l.target, targetPort: l.targetPort, type: l.type
        })),
        transform: flowState.transform
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `veo_workflow_${Date.now()}.json`);
    dlAnchorElem.click();
    dlAnchorElem.remove();
};

// 2. 导入：注水复活 (Hydration)
window.importFlowFromJSON = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (!importedData.nodes || !importedData.links) throw new Error("无效的工作流文件格式");

            // ⚠️ 危险警告确认
            if (flowState.nodes.length > 0) {
                if (!confirm("导入工作流将覆盖当前画布的所有内容，是否继续？")) return;
            }

            // 🌟 核心注水：根据 type 重新从 PluginManager 获取完整蓝图，组装新节点
            const reconstructedNodes = [];
            importedData.nodes.forEach(savedNode => {
                const blueprint = PluginManager.getSchema(savedNode.type);
                if (!blueprint) {
                    console.warn(`⚠️ 无法识别的节点类型 [${savedNode.type}]，已跳过兼容。`);
                    return; 
                }
                const newNode = JSON.parse(JSON.stringify(blueprint)); // 拿回引脚和 UI 结构
                newNode.id = savedNode.id;
                newNode.x = savedNode.x;
                newNode.y = savedNode.y;
                newNode.data = savedNode.data || {}; 
                reconstructedNodes.push(newNode);
            });

            // 暴力接管状态机
            pushFlowHistory('import-flow');
            flowState.nodes = reconstructedNodes;
            flowState.links = importedData.links;
            if (importedData.transform) flowState.transform = importedData.transform;
            normalizeFlowLinks(false);
            rebuildLinkIndex();
            if (hasGraphCycle(flowState.nodes, flowState.links)) {
                throw new Error("导入后检测到环路，请修正后再执行");
            }

            // 触发渲染轰炸与重写存档
            renderNodes();
            setTimeout(renderLinks, 50);
            updateCanvasTransform();
            if (typeof saveFlowToDB === 'function') saveFlowToDB();
            
            console.log("✅ 工作流导入成功！", importedData);

        } catch(err) {
            alert("❌ 导入失败: " + err.message);
        }
        event.target.value = ''; // 重置 file input，确保下次依然能触发 change
    };
    reader.readAsText(file);
};

// 3. 抹除画布
window.clearFlowCanvas = function() {
    if (flowState.nodes.length === 0) return;
    if (confirm("🚨 警告：这将彻底清空画布上的所有节点与连线，且无法撤销！是否继续？")) {
        pushFlowHistory('clear-flow');
        flowState.nodes = [];
        flowState.links = [];
        flowState.selectedNodeIds.clear();
        rebuildLinkIndex();
        renderNodes();
        renderLinks();
        updateFlowSelectionToolbar();
        if (typeof saveFlowToDB === 'function') saveFlowToDB();
    }
};

// ==========================================
// 🧩 统一插件化中枢
// ==========================================
class FlowPluginManager {
    constructor() { this.plugins = new Map(); }
    register(type, schema, executor) {
        if (this.plugins.has(type)) console.warn(`⚠️ 插件 [${type}] 已存在，正在被覆盖注册。`);
        schema.type = type; 
        this.plugins.set(type, { schema, executor });
        console.log(`🔌 [插件挂载] ${schema.title} (${type})`);
    }
    getSchema(type) { return this.plugins.get(type)?.schema; }
    getExecutor(type) { return this.plugins.get(type)?.executor; }
    getAllSchemas() { return Array.from(this.plugins.values()).map(p => p.schema); }
}

window.PluginManager = new FlowPluginManager();

window.updateNodeData = function(nodeId, key, value) {
    const node = flowState.nodes.find(n => n.id === nodeId);
    if (node) {
        if (!node.data) node.data = {};
        node.data[key] = value;
    }
};

function updateNodeImageUploadUI(nodeId, inputId, srcToUse) {
    const uploadUI = document.getElementById(`img-upload-ui-${nodeId}-${inputId}`);
    if (!uploadUI) return;

    const textSpan = uploadUI.querySelector('.img-upload-text');
    if (textSpan) textSpan.innerText = srcToUse ? '更换图片' : '上传 / 拖入图片';

    const isLargePreview = uploadUI.classList.contains('node-image-upload-large');
    if (isLargePreview) {
        uploadUI.classList.toggle('has-image', !!srcToUse);
        let largeImg = uploadUI.querySelector('.img-preview-large');
        let emptyEl = uploadUI.querySelector('.node-image-upload-empty');
        const overlayEl = uploadUI.querySelector('.node-image-upload-overlay');

        if (srcToUse) {
            if (!largeImg) {
                largeImg = document.createElement('img');
                largeImg.className = 'img-preview-large';
                largeImg.onmousedown = (e) => e.stopPropagation();
                uploadUI.insertBefore(largeImg, overlayEl || null);
            }
            largeImg.src = srcToUse;
            if (emptyEl) emptyEl.remove();
        } else {
            if (largeImg) largeImg.remove();
            if (!emptyEl) {
                emptyEl = document.createElement('div');
                emptyEl.className = 'node-image-upload-empty';
                emptyEl.innerHTML = '<span class="material-symbols-outlined">image</span><span>拖入图片或点击上传</span>';
                uploadUI.insertBefore(emptyEl, overlayEl || null);
            }
        }
        return;
    }

    if (srcToUse) {
        let thumbImg = uploadUI.querySelector('.img-preview-thumb');
        if (!thumbImg) {
            thumbImg = document.createElement('img');
            thumbImg.className = 'img-preview-thumb';
            thumbImg.style.cssText = 'width:28px; height:28px; border-radius:4px; object-fit:cover; border:1px solid rgba(255,255,255,0.2);';
            thumbImg.onmousedown = (e) => e.stopPropagation();
            uploadUI.appendChild(thumbImg);
        }
        thumbImg.src = srcToUse;
    } else {
        const thumbImg = uploadUI.querySelector('.img-preview-thumb');
        if (thumbImg) thumbImg.remove();
    }
}

window.handleNodeImageUpload = function(e, nodeId, inputId) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
        updateNodeData(nodeId, inputId, reader.result);
        updateNodeImageUploadUI(nodeId, inputId, reader.result);
        if (typeof saveFlowToDB === 'function') saveFlowToDB();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
};

window.handleNodeImageDrop = async function(e, nodeId, inputId) {
    e.preventDefault(); e.stopPropagation();
    let srcToUse = null;
    try {
        const jsonStr = e.dataTransfer.getData('application/json');
        if (jsonStr) {
            const meta = JSON.parse(jsonStr);
            const t = await getTaskDB(meta.taskId); 
            if (t && t.src) {
                console.log("🌟 [跨维传输] 成功捕获全局素材库图片！");
                srcToUse = await blobToBase64(t.src); 
            }
        }
    } catch(err) {}

    if (!srcToUse && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('image/'));
        if (file) {
            console.log("🌟 [物理传输] 成功捕获桌面拖拽图片！");
            srcToUse = await new Promise(resolve => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(file);
            });
        }
    }

    if (srcToUse) {
        updateNodeData(nodeId, inputId, srcToUse);
        updateNodeImageUploadUI(nodeId, inputId, srcToUse);
        if (typeof saveFlowToDB === 'function') saveFlowToDB();
    }
};

const ctxMenu = document.createElement('div');
ctxMenu.id = 'veo-context-menu';
ctxMenu.style.cssText = `position: absolute; display: none; z-index: 1000; background: rgba(25, 25, 30, 0.95); backdrop-filter: blur(15px); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; box-shadow: 0 10px 40px rgba(0,0,0,0.8); padding: 6px; min-width: 160px; color: #fff; font-size: 13px;`;
document.body.appendChild(ctxMenu);

window.addEventListener('click', () => ctxMenu.style.display = 'none');
viewport.addEventListener('mousedown', () => ctxMenu.style.display = 'none'); 

let menuTargetNodeId = null; 
let menuClickWorldPos = { x: 0, y: 0 };

window.showNodeMenu = function(e, nodeId) {
    e.preventDefault(); e.stopPropagation();
    menuTargetNodeId = nodeId;
    const node = flowState.nodes.find(n => n.id === nodeId);
    const freezeLabel = node && node._frozen ? '解冻节点' : '冻结并复用缓存';
    ctxMenu.innerHTML = `
        <div style="padding: 8px 12px; cursor: pointer; border-radius: 4px; color: #38bdf8;"
             onmouseover="this.style.background='rgba(56,189,248,0.12)'" onmouseout="this.style.background='transparent'"
             onclick="runFlow({mode:'from', startNodeId:'${nodeId}'})">
            <span class="material-symbols-outlined" style="font-size: 14px; vertical-align: middle;">play_arrow</span> 从此处开始执行
        </div>
        <div style="padding: 8px 12px; cursor: pointer; border-radius: 4px; color: #a78bfa;"
             onmouseover="this.style.background='rgba(167,139,250,0.12)'" onmouseout="this.style.background='transparent'"
             onclick="runFlow({mode:'single', startNodeId:'${nodeId}'})">
            <span class="material-symbols-outlined" style="font-size: 14px; vertical-align: middle;">bolt</span> 仅执行该节点
        </div>
        <div style="height:1px; background: rgba(255,255,255,0.08); margin: 6px 0;"></div>
        <div style="padding: 8px 12px; cursor: pointer; border-radius: 4px; color: #f59e0b;"
             onmouseover="this.style.background='rgba(245,158,11,0.12)'" onmouseout="this.style.background='transparent'"
             onclick="toggleNodeFreeze(event, '${nodeId}')">
            <span class="material-symbols-outlined" style="font-size: 14px; vertical-align: middle;">ac_unit</span> ${freezeLabel}
        </div>
        <div style="padding: 8px 12px; cursor: pointer; border-radius: 4px; color: #94a3b8;"
             onmouseover="this.style.background='rgba(148,163,184,0.12)'" onmouseout="this.style.background='transparent'"
             onclick="clearNodeCache('${nodeId}')">
            <span class="material-symbols-outlined" style="font-size: 14px; vertical-align: middle;">cached</span> 清除该节点缓存
        </div>
        <div style="height:1px; background: rgba(255,255,255,0.08); margin: 6px 0;"></div>
        <div style="padding: 8px 12px; cursor: pointer; border-radius: 4px; color: #ef4444;" 
             onmouseover="this.style.background='rgba(239,68,68,0.1)'" onmouseout="this.style.background='transparent'"
             onclick="deleteNode('${nodeId}')">
            <span class="material-symbols-outlined" style="font-size: 14px; vertical-align: middle;">delete</span> 删除节点
        </div>
    `;
    ctxMenu.style.left = e.clientX + 'px'; ctxMenu.style.top = e.clientY + 'px'; ctxMenu.style.display = 'block';
};

window.deleteNode = function(nodeId) {
    pushFlowHistory('delete-node');
    flowState.nodes = flowState.nodes.filter(n => n.id !== nodeId);
    flowState.links = flowState.links.filter(l => l.source !== nodeId && l.target !== nodeId); 
    flowState.selectedNodeIds.delete(nodeId);
    rebuildLinkIndex();
    renderNodes(); renderLinks();
    updateFlowSelectionToolbar();
    saveFlowToDB(); 
};

viewport.addEventListener('contextmenu', (e) => {
    if (e.target !== viewport && e.target !== svgLayer) return;
    e.preventDefault(); e.stopPropagation();
    const rect = canvas.getBoundingClientRect();
    menuClickWorldPos.x = (e.clientX - rect.left) / flowState.transform.scale;
    menuClickWorldPos.y = (e.clientY - rect.top) / flowState.transform.scale;

    let html = `<div style="padding: 4px 8px; font-size: 11px; color: #666; border-bottom: 1px solid #333; margin-bottom: 4px;">添加节点</div>`;
    PluginManager.getAllSchemas().forEach(schema => {
        const safeSchemaTypeJs = escapeFlowJsString(schema.type);
        html += `
            <div style="padding: 8px 12px; cursor: pointer; border-radius: 4px; display: flex; align-items: center; gap: 8px;" 
                 onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'"
                 onclick="spawnNode('${safeSchemaTypeJs}')">
                ${escapeFlowHtml(schema.title)}
            </div>
        `;
    });
    ctxMenu.innerHTML = html;
    ctxMenu.style.left = e.clientX + 'px'; ctxMenu.style.top = e.clientY + 'px'; ctxMenu.style.display = 'block';
});

window.spawnNode = function(blueprintType, spawnX, spawnY) {
    const blueprint = PluginManager.getSchema(blueprintType);
    if (!blueprint) return console.error(`❌ 找不到节点蓝图: ${blueprintType}`);
    pushFlowHistory('spawn-node');
    const newNode = JSON.parse(JSON.stringify(blueprint)); 
    newNode.id = 'node_' + Date.now();
    newNode.x = spawnX !== undefined ? spawnX : menuClickWorldPos.x;
    newNode.y = spawnY !== undefined ? spawnY : menuClickWorldPos.y;
    flowState.nodes.push(newNode);
    flowState.selectedNodeIds.clear();
    flowState.selectedNodeIds.add(newNode.id);
    renderNodes(); 
    updateSelectionStyles();
    if (typeof saveFlowToDB === 'function') saveFlowToDB();
    if (typeof renderMinimap === 'function') renderMinimap();
};

// ==========================================
// 🧰 左侧节点工具箱 (纯净去重版)
// ==========================================
window.initNodePalette = function() {
    let palette = document.getElementById('global-node-palette');
    if (!palette) {
        palette = document.createElement('div');
        palette.className = 'node-palette';
        palette.id = 'global-node-palette';
        document.body.appendChild(palette);
    }
    
    const schemas = PluginManager.getAllSchemas();
    const groups = {};
    schemas.forEach(s => {
        const cat = s.category || '未分类';
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(s);
    });
    
    let html = '';
    for (let cat in groups) {
        html += `<div class="palette-group-title">${escapeFlowHtml(cat)}</div>`;
        groups[cat].forEach(s => {
            const safeTypeJs = escapeFlowJsString(s.type);
            html += `
                <div class="palette-item" draggable="true" 
                     ondragstart="event.dataTransfer.setData('veo-node-type', '${safeTypeJs}')">
                    <span class="material-symbols-outlined" style="font-size:16px;">drag_indicator</span>
                    ${escapeFlowHtml(s.title)}
                </div>
            `;
        });
    }
    palette.innerHTML = html;

    if (!document.querySelector('.palette-toggle-btn')) {
        const toggleBtn = document.createElement('div');
        toggleBtn.className = 'palette-toggle-btn';
        toggleBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">chevron_left</span>';
        toggleBtn.onclick = () => document.body.classList.toggle('palette-collapsed');
        document.body.appendChild(toggleBtn);
    }
};

// 初始化顶部控制台
function initFlowToolbar() {
    if (document.getElementById('flow-top-toolbar')) return;

    // 隐藏上传器（只初始化一次）
    let fileInput = document.getElementById('flow-import-input');
    if (!fileInput) {
        fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.id = 'flow-import-input';
        fileInput.style.display = 'none';
        fileInput.onchange = window.importFlowFromJSON;
        document.body.appendChild(fileInput);
    }

    // 挂载到头部同级按钮区
    const toolbar = document.createElement('div');
    toolbar.id = 'flow-top-toolbar';
    toolbar.className = 'flow-top-toolbar';
    toolbar.innerHTML = `
        <button class="flow-tool-btn" onclick="document.getElementById('flow-import-input').click()">
            <span class="material-symbols-outlined" style="font-size: 16px;">file_open</span> 导入
        </button>
        <button class="flow-tool-btn" onclick="exportFlowToJSON()">
            <span class="material-symbols-outlined" style="font-size: 16px;">download</span> 导出
        </button>
        <div class="flow-tool-divider"></div>
        <button class="flow-tool-btn" onclick="undoFlow()">
            <span class="material-symbols-outlined" style="font-size: 16px;">undo</span> 撤销
        </button>
        <button class="flow-tool-btn" onclick="redoFlow()">
            <span class="material-symbols-outlined" style="font-size: 16px;">redo</span> 重做
        </button>
        <div class="flow-tool-divider"></div>
        <button class="flow-tool-btn danger" onclick="clearFlowCanvas()">
            <span class="material-symbols-outlined" style="font-size: 16px;">delete_sweep</span> 清空
        </button>
    `;
    const headerSlot = document.getElementById('flow-header-tools');
    if (headerSlot) headerSlot.appendChild(toolbar);
    else viewport.appendChild(toolbar);
}

async function bootstrapFlowEngine() {
    initFlowThemeMode();
    initNodePalette();
    initFlowToolbar();
    initMinimapUI();
    if (window.AutocompleteController && typeof window.AutocompleteController.init === 'function') {
        window.AutocompleteController.init();
    }
    await loadFlowFromDB();
    normalizeFlowLinks(false);
    renderNodes();
    setTimeout(() => { renderLinks(); renderMinimap(); }, 50);
    updateCanvasTransform();
    setTimeout(ensureFlowNodesVisibleAfterBoot, 180);
}

window.initFlowEngine = bootstrapFlowEngine;

// ==========================================
// ⌨️ 全局键盘快捷键中心 (支持批量一键销毁)
// ==========================================
window.addEventListener('keydown', (e) => {
    const activeTag = document.activeElement ? document.activeElement.tagName : '';
    const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag);

    if (!isTyping && e.code === 'Space') {
        e.preventDefault();
        flowState.isSpacePanning = true;
        viewport.classList.add('space-pan-ready');
        return;
    }

    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undoFlow();
        return;
    }
    if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')) {
        e.preventDefault();
        redoFlow();
        return;
    }
    if (!isTyping && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSelectedFlowNodes();
        return;
    }
    if (!isTyping && e.key.toLowerCase() === 'f' && flowState.selectedNodeIds.size > 0) {
        e.preventDefault();
        focusFlowNodes();
        return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
        // 拦截机制：如果用户当前正在输入框或文本域中改参数，绝不误杀节点！
        if (isTyping) return;

        if (flowState.selectedNodeIds.size > 0) {
            deleteSelectedFlowNodes(true);
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
        flowState.isSpacePanning = false;
        viewport.classList.remove('space-pan-ready');
    }
});

window.addEventListener('blur', () => {
    flowState.isSpacePanning = false;
    viewport.classList.remove('space-pan-ready', 'is-panning-active', 'is-linking');
});

// ==========================================
// 🗺️ 高性能 rAF 导航小地图 (Minimap 引擎)
// ==========================================
window.initMinimapUI = function() {
    if (document.getElementById('flow-minimap-container')) return;

    const container = document.createElement('div');
    container.id = 'flow-minimap-container';
    container.className = 'flow-minimap-container';
    
    const viewportBox = document.createElement('div');
    viewportBox.id = 'flow-minimap-viewport';
    viewportBox.className = 'flow-minimap-viewport';
    
    container.appendChild(viewportBox);
    document.body.appendChild(container);

    // 🌟 核心：注入小地图点击与拖拽全景传送引擎
    let isDraggingMap = false;

    const panToMapPos = (e) => {
        if (!flowState.minimap || flowState.minimap.scale === 0) return;
        const rect = container.getBoundingClientRect();
        const mapX = e.clientX - rect.left;
        const mapY = e.clientY - rect.top;

        // 核心数学：从小地图坐标 (2D 屏幕投影) 逆推回真实无限宇宙 (World Bounds)
        const worldX = (mapX / flowState.minimap.scale) + flowState.minimap.minX;
        const worldY = (mapY / flowState.minimap.scale) + flowState.minimap.minY;

        // 将当前主摄像机的中心点，对准这个真实宇宙坐标
        const vpRect = viewport.getBoundingClientRect();
        flowState.transform.x = (vpRect.width / 2) - worldX * flowState.transform.scale;
        flowState.transform.y = (vpRect.height / 2) - worldY * flowState.transform.scale;

        updateCanvasTransform(); // 触发主视图更新，其内部会自动联动 renderMinimap()
    };

    container.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.stopPropagation(); // 阻止事件冒泡导致主画布平移
        isDraggingMap = true;
        panToMapPos(e);
    });

    window.addEventListener('mousemove', (e) => {
        if (isDraggingMap) panToMapPos(e);
    });

    window.addEventListener('mouseup', () => {
        isDraggingMap = false;
    });

    renderMinimap();
};

window.renderMinimap = function() {
    const container = document.getElementById('flow-minimap-container');
    const vpBox = document.getElementById('flow-minimap-viewport');
    if (!container || !vpBox) return;

    // 清理老节点的微方块
    container.querySelectorAll('.flow-minimap-node').forEach(n => n.remove());

    if (flowState.nodes.length === 0) {
        vpBox.style.display = 'none';
        return;
    }
    vpBox.style.display = 'block';

    // 1. 动态嗅探画布上所有节点组成的超大边界矩形 (Bounding Box)
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    flowState.nodes.forEach(n => {
        if (n.x < minX) minX = n.x;
        if (n.x > maxX) maxX = n.x;
        if (n.y < minY) minY = n.y;
        if (n.y > maxY) maxY = n.y;
    });

    // 加上安全外边距
    minX -= 300; maxX += 500; minY -= 300; maxY += 400;
    const mapW = maxX - minX; const mapH = maxY - minY;

    // 2. 计算映射缩放比例
    const scaleX = 180 / mapW; const scaleY = 120 / mapH;
    const mapScale = Math.min(scaleX, scaleY);
    
    // 🚨 修复：将大地图世界的极值与比例存入内存，供鼠标传送引擎逆推使用
    flowState.minimap = { minX, minY, scale: mapScale };

    // 3. 绘制节点缩影方块
    flowState.nodes.forEach(n => {
        const nodeMin = document.createElement('div');
        nodeMin.className = 'flow-minimap-node';
        nodeMin.style.left = ((n.x - minX) * mapScale) + 'px';
        nodeMin.style.top = ((n.y - minY) * mapScale) + 'px';
        nodeMin.style.width = (240 * mapScale) + 'px'; 
        nodeMin.style.height = (120 * mapScale) + 'px'; 
        container.appendChild(nodeMin);
    });

    // 4. 靶向映射当前主浏览器窗口的视野红框 (Viewport Camera Box)
    const vRect = viewport.getBoundingClientRect();
    const curWorldX1 = -flowState.transform.x / flowState.transform.scale;
    const curWorldY1 = -flowState.transform.y / flowState.transform.scale;
    const curWorldW = vRect.width / flowState.transform.scale;
    const curWorldH = vRect.height / flowState.transform.scale;

    vpBox.style.left = Math.max(0, (curWorldX1 - minX) * mapScale) + 'px';
    vpBox.style.top = Math.max(0, (curWorldY1 - minY) * mapScale) + 'px';
    vpBox.style.width = Math.min(180, curWorldW * mapScale) + 'px';
    vpBox.style.height = Math.min(120, curWorldH * mapScale) + 'px';
};

// 🌟 对外暴露同一个相机函数，避免本地函数与 window 包装器状态不同步。
window.updateCanvasTransform = updateCanvasTransform;

viewport.addEventListener('dragover', (e) => {
    if (e.dataTransfer.types.includes('veo-node-type')) {
        e.preventDefault(); 
        e.dataTransfer.dropEffect = 'copy';
    }
});

viewport.addEventListener('drop', (e) => {
    const nodeType = e.dataTransfer.getData('veo-node-type');
    if (nodeType) {
        e.preventDefault(); e.stopPropagation();
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / flowState.transform.scale;
        const y = (e.clientY - rect.top) / flowState.transform.scale;
        spawnNode(nodeType, x, y);
    }
});

// ==========================================
// ⚙️ Phase 6: DAG 拓扑执行引擎
// ==========================================
function summarizeForHash(value) {
    if (value == null) return value;
    if (typeof value === 'string') {
        if (value.length <= 256) return value;
        return `${value.slice(0, 96)}...${value.slice(-64)}|len:${value.length}`;
    }
    if (Array.isArray(value)) return value.map((item) => summarizeForHash(item));
    if (typeof value === 'object') {
        const out = {};
        Object.keys(value).sort().forEach((k) => {
            out[k] = summarizeForHash(value[k]);
        });
        return out;
    }
    return value;
}

function simpleHash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return (h >>> 0).toString(16);
}

function computeNodeExecutionHash(node, compiledData, upstreamInputs) {
    const payload = {
        nodeType: node && node.type ? node.type : '',
        data: summarizeForHash(compiledData),
        upstream: summarizeForHash(upstreamInputs)
    };
    return simpleHash(JSON.stringify(payload));
}

function collectRunTargetIds(mode, startNodeId) {
    const allNodeIds = new Set((flowState.nodes || []).map((n) => n.id));
    if (mode === 'single' && startNodeId && allNodeIds.has(startNodeId)) {
        return new Set([startNodeId]);
    }
    if (mode === 'from' && startNodeId && allNodeIds.has(startNodeId)) {
        const targets = new Set([startNodeId]);
        const queue = [startNodeId];
        while (queue.length > 0) {
            const current = queue.shift();
            (flowState.links || []).forEach((link) => {
                if (link.source === current && !targets.has(link.target)) {
                    targets.add(link.target);
                    queue.push(link.target);
                }
            });
        }
        return targets;
    }
    return allNodeIds;
}

window.runFlow = async function(options = {}) {
    console.log("🚀 [执行引擎] 启动工业级 DAG 拓扑扫描...");
    if (!Array.isArray(flowState.nodes) || flowState.nodes.length === 0) {
        return alert("⚠️ 当前画布没有节点可执行。");
    }

    const runMode = options && options.mode ? options.mode : 'full';
    const startNodeId = options && options.startNodeId ? options.startNodeId : null;
    const targetIds = collectRunTargetIds(runMode, startNodeId);
    if (!targetIds.size) return alert("⚠️ 未找到可执行节点。");

    normalizeFlowLinks(true);

    if (hasGraphCycle(flowState.nodes, flowState.links)) {
        return alert("⚠️ 错误：工作流存在死循环连线，请先断开环路。");
    }

    const indegree = new Map();
    const downstream = new Map();
    flowState.nodes.forEach(n => {
        if (!targetIds.has(n.id)) return;
        indegree.set(n.id, 0);
        downstream.set(n.id, []);
    });
    flowState.links.forEach(link => {
        if (!indegree.has(link.source) || !indegree.has(link.target)) return;
        indegree.set(link.target, indegree.get(link.target) + 1);
        downstream.get(link.source).push(link.target);
    });

    let readyQueue = flowState.nodes.filter(n => indegree.has(n.id) && indegree.get(n.id) === 0).map(n => n.id);
    if (readyQueue.length === 0) return alert("⚠️ 错误：目标子图没有可执行起点，可能包含环路。");

    flowState.nodes.forEach(n => {
        if (!targetIds.has(n.id)) return;
        if (runMode === 'full') n.result = null;
        setNodeStatus(n.id, 'idle');
    });

    try {
        let processed = 0;
        while (readyQueue.length > 0) {
            const batch = readyQueue.slice();
            readyQueue = [];

            await Promise.all(batch.map(nodeId => executeNode(nodeId)));
            processed += batch.length;

            batch.forEach(nodeId => {
                const nextNodes = downstream.get(nodeId) || [];
                nextNodes.forEach(nextId => {
                    const left = indegree.get(nextId) - 1;
                    indegree.set(nextId, left);
                    if (left === 0) readyQueue.push(nextId);
                });
            });
        }

        if (processed !== targetIds.size) {
            throw new Error('执行队列异常：存在未完成节点（可能是隐式环路或损坏连线）');
        }
        console.log("✅ [执行引擎] 工作流执行完毕！模式:", runMode, '目标节点数:', targetIds.size);
    } catch (err) {
        console.error("❌ [执行引擎] 链路崩溃:", err);
        alert("执行流异常中断，请查看控制台日志。");
    }
};

const BASE_N8N_URL = 'https://api.wallyai.top/webhook'; 
function getApiHeaders() {
    return {
        'Content-Type': 'application/json',
        'wally123': sessionStorage.getItem('veo_admin_pwd') || ''
    };
}

async function prepareImagePayload(src) {
    if (!src) return undefined;
    if (src.startsWith('data:image')) return src;
    if (src.startsWith('http://') || src.startsWith('https://')) return src;
    if (src.startsWith('blob:')) {
        try {
            const res = await fetch(src);
            const blob = await res.blob();
            return await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            console.error("Blob 转换 Base64 失败:", e);
            return undefined;
        }
    }
    return src;
}

function resolvePayloadData(input) {
    if (!input) return undefined;
    if (typeof input === 'object' && input.data) return input.data;
    if (typeof input === 'string') return input;
    return undefined;
}

// ==========================================
// 📦 官方插件装载区
// ==========================================
PluginManager.register('base_text',
    {
        title: 'T 文本输入', category: '模块',
        ports: { in: [], out: [{ id: 'out_text', type: 'text', label: '文本输出' }] },
        inputs: [{ id: 'content', type: 'textarea', label: '请输入文本内容', default: '' }],
        data: {}
    },
    async (node, nodeData) => ({ type: 'text', data: nodeData.content || '', metadata: {} })
);

PluginManager.register('base_image',
    {
        title: '🖼️ 图片输入', category: '模块',
        ports: { in: [], out: [{ id: 'out_img', type: 'image', label: '图片输出' }] },
        inputs: [{ id: 'image', type: 'image_upload', label: '上传 / 拖入图片' }],
        data: {}
    },
    async (node, nodeData) => {
        if (!nodeData.image) throw new Error("输入模块缺少图片数据！");
        return { type: 'image', data: nodeData.image, metadata: {} };
    }
);

PluginManager.register('tool_image_gen',
    {
        title: '🎨 GPT 多模态生图', category: 'AI 生成',
        ports: {
            in: [{ id: 'in_ref', type: 'image', label: '风格垫图 (选填)' }, { id: 'in_prompt', type: 'text', label: '外挂提示词 (优先)' }],
            out: [{ id: 'out_img', type: 'image', label: '输出图像' }]
        },
        inputs: [
            { id: 'local_ref', type: 'image_upload', label: '本地直传垫图 (选填)' },
            { id: 'prompt', type: 'textarea', label: '保底提示词 (Prompt)', default: '一瓶放在岩石上的高级香水，雪山背景，8k' },
            { id: 'size', type: 'select', label: '画幅尺寸', options: ['1024x1024', '1024x576', '576x1024', '自定义 (AI嗅探)'], default: '1024x1024' },
            { id: 'customW', type: 'number', label: '自定义宽度比例 (W)', default: 9, condition: { field: 'size', value: '自定义 (AI嗅探)' } },
            { id: 'customH', type: 'number', label: '自定义高度比例 (H)', default: 21, condition: { field: 'size', value: '自定义 (AI嗅探)' } },
            { id: 'channel', type: 'select', label: '生成通道', options: ['通道 1 (主干)', '通道 2 (备用)'], default: '通道 1 (主干)' }
        ],
        data: {}
    },
    async (node, nodeData, upstreamInputs) => {
        let finalPrompt = nodeData.prompt || '';
        let wirePrompt = resolvePayloadData(upstreamInputs.in_prompt);
        
        // 智能融合：如果外部传了词，但插值引擎没能把它拼进最终词里（用户没写{{in_prompt}}），我们自动追加
        if (wirePrompt && typeof wirePrompt === 'string' && !finalPrompt.includes(wirePrompt)) {
            finalPrompt = wirePrompt + (finalPrompt === '一瓶放在岩石上的高级香水，雪山背景，8k' ? '' : '，' + finalPrompt);
        }
        
        // 抹除残留的未匹配模板占位符
        finalPrompt = finalPrompt.replace(/\{\{\s*[a-zA-Z0-9_.]+\s*\}\}/g, '').trim();
        if (finalPrompt === '') throw new Error("缺少正向提示词！");
        
        let finalSize = nodeData.size || '1024x1024';
        if (finalSize === '自定义 (AI嗅探)') { finalSize = ""; finalPrompt += ` 画面比例${nodeData.customW || 9}:${nodeData.customH || 21}`; }
        const refImgSource = resolvePayloadData(upstreamInputs.in_ref) || resolvePayloadData(nodeData.local_ref);
        const payload = { prompt: finalPrompt.trim(), size: finalSize, channel: (nodeData.channel && nodeData.channel.includes('2')) ? 'channel_2' : 'channel_1', images: refImgSource ? [refImgSource] : [] };
        
        const res = await fetch(`${BASE_N8N_URL}/proxy-image-gen`, { method: 'POST', headers: getApiHeaders(), body: JSON.stringify(payload) });
        const rawText = await res.text();
        if (!res.ok) throw new Error(`HTTP ${res.status} 异常: ${rawText}`);
        
        let data; try { data = JSON.parse(rawText); } catch (e) { throw new Error(`非合法 JSON`); }
        const imgObj = data.data && data.data[0] ? data.data[0] : (data[0] || data);
        let resultDataStr = imgObj.url || (imgObj.b64_json ? "data:image/png;base64," + imgObj.b64_json : null);
        if (!resultDataStr) throw new Error("未找到 url 或 b64_json 字段");
        return { type: 'image', data: resultDataStr, metadata: { source: 'gpt-image-2', size: finalSize } };
    }
);

PluginManager.register('tool_video_gen',
    {
        title: '🎞️ Veo 视频生成', category: 'AI 生成',
        ports: {
            in: [
                { id: 'in_first_frame', type: 'image', label: '首帧参考图 (优先)' },
                { id: 'in_last_frame', type: 'image', label: '尾帧参考图 (选填)' },
                { id: 'in_ref1', type: 'image', label: '通用垫图 1' },
                { id: 'in_ref2', type: 'image', label: '通用垫图 2' },
                { id: 'in_ref3', type: 'image', label: '通用垫图 3' },
                { id: 'in_prompt', type: 'text', label: '外挂提示词 (优先)' }
            ],
            out: [{ id: 'out_video', type: 'video', label: '输出视频' }]
        },
        inputs: [
            { id: 'local_first_frame', type: 'image_upload', label: '直传首帧 (优先于连线)' },
            { id: 'local_last_frame', type: 'image_upload', label: '直传尾帧 (选填)' },
            { id: 'local_ref1', type: 'image_upload', label: '直传垫图 1' },
            { id: 'local_ref2', type: 'image_upload', label: '直传垫图 2' },
            { id: 'local_ref3', type: 'image_upload', label: '直传垫图 3' },
            { id: 'prompt', type: 'textarea', label: '保底运镜动作描述', default: '' },
            { id: 'model', type: 'select', label: '生成模型', options: ['veo3.1', 'veo3.1-4k', 'veo3.1-components', 'veo3.1-components-4k'], default: 'veo3.1' },
            { id: 'aspectRatio', type: 'select', label: '画幅比例', options: ['16:9', '9:16', '1:1'], default: '16:9' },
            { id: 'enhancePrompt', type: 'select', label: 'AI 扩写提示词', options: ['开启 (推荐)', '关闭 (原词)'], default: '开启 (推荐)' },
            { id: 'enableUpsample', type: 'select', label: '画质超分增强', options: ['关闭 (标准)', '开启 (更慢)'], default: '关闭 (标准)' },
            { id: 'autoRetry', type: 'select', label: '失败挂机重试', options: ['关闭', '开启 (无限重试)'], default: '关闭' }
        ],
        data: {}
    },
    async (node, nodeData, upstreamInputs) => {
        const firstFrame = await prepareImagePayload(resolvePayloadData(upstreamInputs.in_first_frame) || resolvePayloadData(nodeData.local_first_frame));
        const lastFrame = await prepareImagePayload(resolvePayloadData(upstreamInputs.in_last_frame) || resolvePayloadData(nodeData.local_last_frame));
        
        const refImages = [];
        for (let i = 1; i <= 3; i++) {
            const refRaw = resolvePayloadData(upstreamInputs[`in_ref${i}`]) || resolvePayloadData(nodeData[`local_ref${i}`]);
            if (refRaw) refImages.push(await prepareImagePayload(refRaw));
        }
        
        if (!firstFrame && refImages.length === 0) throw new Error("缺少首帧或通用垫图，Veo 拒绝执行！");
        
        let targetModel = nodeData.model || "veo3.1";
        if (!firstFrame && refImages.length > 0 && !targetModel.includes('components')) { targetModel = targetModel === 'veo3.1' ? 'veo3.1-components' : 'veo3.1-components-4k'; }
        
        // 🌟 智能融合视频提示词
        let finalPrompt = nodeData.prompt || '';
        let wirePrompt = resolvePayloadData(upstreamInputs.in_prompt);
        if (wirePrompt && typeof wirePrompt === 'string' && !finalPrompt.includes(wirePrompt)) {
            finalPrompt = wirePrompt + (finalPrompt ? '，' + finalPrompt : '');
        }
        finalPrompt = finalPrompt.replace(/\{\{\s*[a-zA-Z0-9_.]+\s*\}\}/g, '').trim();

        const payload = {
            model: targetModel, prompt: finalPrompt, aspectRatio: nodeData.aspectRatio || "16:9",
            enhancePrompt: nodeData.enhancePrompt !== '关闭 (原词)', enableUpsample: nodeData.enableUpsample === '开启 (更慢)',
            firstFrame: firstFrame || undefined, lastFrame: lastFrame || undefined, references: refImages.length > 0 ? refImages : undefined
        };
        
        const submitRes = await fetch(`${BASE_N8N_URL}/proxy-submit`, { method: 'POST', headers: getApiHeaders(), body: JSON.stringify(payload) });
        const submitRawText = await submitRes.text();
        if (!submitRes.ok) throw new Error(`HTTP ${submitRes.status} 异常: ${submitRawText}`);
        
        let submitData; try { submitData = JSON.parse(submitRawText); } catch (e) { throw new Error("接口返回非 JSON"); }
        if (!submitData.taskId) throw new Error("未获得 TaskID: " + submitRawText);

        let isComplete = false, finalVideoUrl = "";
        while (!isComplete) {
            if (node._cancelToken) throw new Error("⛔ 手动中止");
            for (let i = 0; i < 15; i++) { if (node._cancelToken) throw new Error("⛔ 手动中止"); await new Promise(r => setTimeout(r, 1000)); }
            
            const pollRes = await fetch(`${BASE_N8N_URL}/proxy-poll`, { method: 'POST', headers: getApiHeaders(), body: JSON.stringify({ taskId: submitData.taskId }) });
            const pollRawText = await pollRes.text();
            if (!pollRes.ok) throw new Error(`轮询异常: ${pollRawText}`);
            let pollData; try { pollData = JSON.parse(pollRawText); } catch (e) { throw new Error("轮询返回非 JSON"); }
            if (pollData.status === 'success') { finalVideoUrl = pollData.videoUrl; isComplete = true; } 
            else if (pollData.status === 'failed') { throw new Error(`生成失败: ${pollData.raw_status}`); }
        }
        return { type: 'video', data: finalVideoUrl, metadata: { source: targetModel, aspectRatio: nodeData.aspectRatio || "16:9" } };
    }
);

// ==========================================
// 🧬 表达式插值编译引擎 (Expression Interpolator)
// ==========================================
// ==========================================
// 🔮 智能感知补全中枢 (Autocomplete Engine)
// ==========================================
window.AutocompleteController = {
    activeInput: null,
    currentNodeId: null,
    dropdownEl: null,
    candidates: [],
    activeIndex: 0,

    init() {
        if (document.getElementById('flow-autocomplete-dropdown')) return;
        this.dropdownEl = document.createElement('div');
        this.dropdownEl.id = 'flow-autocomplete-dropdown';
        this.dropdownEl.className = 'flow-autocomplete-dropdown';
        document.body.appendChild(this.dropdownEl);

        window.addEventListener('click', () => this.hide());
        viewport.addEventListener('wheel', () => this.hide());
    },

    listen(e, nodeId) {
        const input = e.target;
        const val = input.value;
        const cursorPos = input.selectionStart;
        
        const textBeforeCursor = val.slice(0, cursorPos);
        const triggerIndex = textBeforeCursor.lastIndexOf('{{');
        const closeIndex = textBeforeCursor.lastIndexOf('}}');

        // 🚀 核心修复 1：只要光标在 {{ 之后，且处于未闭合的作用域内，就维持 UI 并捕获关键字
        if (triggerIndex !== -1 && triggerIndex > closeIndex) {
            this.activeInput = input;
            this.currentNodeId = nodeId;
            
            // 提取用户已输入的搜索词 (例如输入 {{in_p，则提取 "in_p")
            const keyword = textBeforeCursor.slice(triggerIndex + 2).trim().toLowerCase();
            
            this.buildCandidates(keyword);
            if (this.candidates.length > 0) {
                this.show();
            } else {
                this.hide();
            }
        } else {
            this.hide();
        }
    },

    buildCandidates(keyword = '') {
        this.candidates = [];
        const currNode = flowState.nodes.find(n => n.id === this.currentNodeId);
        if (!currNode) return;

        let pool = [];

        if (currNode.ports && currNode.ports.in) {
            currNode.ports.in.forEach(p => {
                pool.push({ label: `当前连线: ${p.label}`, code: p.id, type: 'local' });
            });
        }

        flowState.nodes.forEach(node => {
            if (node.id === this.currentNodeId) return;
            if (node.inputs) {
                node.inputs.forEach(inp => {
                    if (['textarea', 'select', 'number'].includes(inp.type)) {
                        pool.push({ label: `${node.title} ➔ ${inp.label}`, code: `${node.id}.${inp.id}`, type: 'cross' });
                    }
                });
            }
        });

        // 🚀 核心修复 2：加入高性能的内存过滤机制
        if (keyword) {
            this.candidates = pool.filter(c => 
                c.label.toLowerCase().includes(keyword) || 
                c.code.toLowerCase().includes(keyword)
            );
        } else {
            this.candidates = pool;
        }

        this.activeIndex = 0;
        this.render();
    },

    render() {
        if (this.candidates.length === 0) {
            this.dropdownEl.innerHTML = `<div style="padding:8px; text-align:center; color:#555; font-size:11px;">无可用工作流变量</div>`;
            return;
        }
        this.dropdownEl.innerHTML = this.candidates.map((c, i) => `
            <div class="autocomplete-item ${i === this.activeIndex ? 'is-active' : ''}" 
                 onmousedown="window.AutocompleteController.inject('${escapeFlowJsString(c.code)}'); event.stopPropagation();">
                <span>${escapeFlowHtml(c.label)}</span>
                <span class="autocomplete-tag ${c.type === 'local' ? 'tag-local' : 'tag-cross'}">${c.type === 'local' ? '引脚' : '跨节点'}</span>
            </div>
        `).join('');
    },

    show() {
        if (!this.activeInput) return;
        const rect = this.activeInput.getBoundingClientRect();
        this.dropdownEl.style.left = rect.left + 'px';
        this.dropdownEl.style.top = (rect.bottom + window.scrollY + 4) + 'px';
        this.dropdownEl.style.display = 'block';
    },

    hide() {
        if (this.dropdownEl) this.dropdownEl.style.display = 'none';
    },

    handleKeyDown(e) {
        if (this.dropdownEl.style.display !== 'block') return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.activeIndex = (this.activeIndex + 1) % this.candidates.length;
            this.render();
            this.scrollToActive();
        } 
        else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.activeIndex = (this.activeIndex - 1 + this.candidates.length) % this.candidates.length;
            this.render();
            this.scrollToActive();
        } 
        else if (e.key === 'Enter') {
            e.preventDefault();
            if (this.candidates[this.activeIndex]) {
                this.inject(this.candidates[this.activeIndex].code);
            }
        } 
        else if (e.key === 'Escape') {
            e.preventDefault();
            this.hide();
        }
    },

    scrollToActive() {
        const activeEl = this.dropdownEl.querySelector('.autocomplete-item.is-active');
        if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
    },

    inject(code) {
        const input = this.activeInput;
        if (!input) return;

        const val = input.value;
        const cursorPos = input.selectionStart;
        const textBeforeCursor = val.slice(0, cursorPos);
        const triggerIndex = textBeforeCursor.lastIndexOf('{{');

        if (triggerIndex !== -1) {
            const before = val.slice(0, triggerIndex);
            
            // 🚀 核心修复 3：智能嗅探并吞噬光标后可能存在的旧变量名和右闭合括号
            let textAfterCursor = val.slice(cursorPos);
            const endMatch = textAfterCursor.match(/^[^}]*\}\}/);
            if (endMatch) {
                textAfterCursor = textAfterCursor.slice(endMatch[0].length);
            }

            input.value = before + `{{${code}}}` + textAfterCursor;
            
            const newCursorPos = before.length + code.length + 4;
            input.setSelectionRange(newCursorPos, newCursorPos);
            
            // 强制触发原生 input 事件，确保底层的 updateNodeData 状态机同步
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        this.hide();
        input.focus();
    }
};
window.compileExpressionTemplate = function(nodeData, upstreamInputs, flowNodes) {
    const compiled = JSON.parse(JSON.stringify(nodeData || {}));

    const resolveTokenValue = (token) => {
        const v = String(token || '').trim();
        if (!v) return undefined;
        if (upstreamInputs && upstreamInputs[v]) {
            const inputVal = upstreamInputs[v];
            if (inputVal && typeof inputVal === 'object' && inputVal.data !== undefined) return inputVal.data;
            return inputVal;
        }
        if (v.includes('.')) {
            const [nid, nfield] = v.split('.');
            const targetNode = (flowNodes || []).find(n => n.id === nid);
            if (targetNode && targetNode.data && targetNode.data[nfield] !== undefined) {
                return targetNode.data[nfield];
            }
        }
        return undefined;
    };

    const parseExpressionBody = (rawBody) => {
        const body = String(rawBody || '').trim();
        if (!body) return { token: '', fallback: '' };
        const pipePos = body.indexOf('|');
        if (pipePos === -1) return { token: body, fallback: '' };
        const token = body.slice(0, pipePos).trim();
        let fallback = body.slice(pipePos + 1).trim();
        if ((fallback.startsWith("'") && fallback.endsWith("'")) || (fallback.startsWith('"') && fallback.endsWith('"'))) {
            fallback = fallback.slice(1, -1);
        }
        return { token, fallback };
    };

    const compileStringTemplate = (inputText) => {
        const text = String(inputText || '');
        let out = '';
        let i = 0;
        while (i < text.length) {
            const open = text.indexOf('{{', i);
            if (open === -1) {
                out += text.slice(i);
                break;
            }
            out += text.slice(i, open);
            const close = text.indexOf('}}', open + 2);
            if (close === -1) {
                out += text.slice(open);
                break;
            }
            const body = text.slice(open + 2, close);
            const parsed = parseExpressionBody(body);
            const resolved = resolveTokenValue(parsed.token);
            if (resolved === undefined || resolved === null || resolved === '') {
                out += parsed.fallback ? parsed.fallback : `{{${body}}}`;
            } else {
                out += String(resolved);
            }
            i = close + 2;
        }
        return out;
    };

    const walk = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        Object.keys(obj).forEach((key) => {
            if (typeof obj[key] === 'string') obj[key] = compileStringTemplate(obj[key]);
            else if (obj[key] && typeof obj[key] === 'object') walk(obj[key]);
        });
    };

    walk(compiled);
    return compiled;
};

// ==========================================
// 🚀 执行调度与状态 UI
// ==========================================
async function executeNode(nodeId) {
    const node = flowState.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const nodeStartTime = Date.now();
    
    try {
        let upstreamInputs = {};
        const incomingLinks = flowState.links.filter(l => l.target === nodeId);
        for (let link of incomingLinks) {
            const sourceNode = flowState.nodes.find(n => n.id === link.source);
            if (sourceNode && sourceNode.result) upstreamInputs[link.targetPort] = sourceNode.result;
        }

        if (node._frozen) {
            if (node.result) {
                setNodeStatus(nodeId, 'cached', { label: 'Frozen Cache' });
                return;
            }
            setNodeStatus(nodeId, 'error');
            throw new Error(`节点 [${node.title || node.id}] 已冻结，但没有可复用缓存`);
        }

        setNodeStatus(nodeId, 'running');
        const executor = PluginManager.getExecutor(node.type);
        if (!executor) throw new Error(`引擎未找到节点类型 [${node.type}] 的执行器`);

        // 🌟 核心：在此处插入编译管线！把含有 {{}} 的表单数据替换为真实变量！
        const compiledData = compileExpressionTemplate(node.data || {}, upstreamInputs, flowState.nodes);
        const inputHash = computeNodeExecutionHash(node, compiledData, upstreamInputs);
        if (node.result && node._lastInputHash && node._lastInputHash === inputHash) {
            setNodeStatus(nodeId, 'cached', { label: 'Cache Hit' });
            return;
        }

        const isInfiniteRetry = (compiledData.autoRetry === '开启 (无限重试)' || compiledData.autoRetry === true);
        let attempt = 0;
        let finalResult = null;
        node._cancelToken = false; 

        while (true) {
            if (node._cancelToken) throw new Error("⛔ 已手动中止");
            try {
                if (attempt > 0) setNodeStatus(nodeId, 'running', { retryCount: attempt });
                // ⚠️ 传入 compiledData，执行器拿到的已经是替换好的纯文本了！
                finalResult = await executor(node, compiledData, upstreamInputs);
                break; 
            } catch (err) {
                if (node._cancelToken) throw new Error("⛔ 已手动中止"); 
                attempt++;
                if (!isInfiniteRetry) throw err; 
                for(let i = 0; i < 5; i++) {
                    if (node._cancelToken) throw new Error("⛔ 已手动中止");
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
        }

        node.result = finalResult; 
        node._lastInputHash = inputHash;
        saveFlowToDB(); 
        
        const costTime = ((Date.now() - nodeStartTime) / 1000).toFixed(1);
        setNodeStatus(nodeId, 'success', { costTime: costTime });
        document.getElementById(`preview-${nodeId}`).innerHTML = renderPreview(node);
        await recordNodeBilling(node);

    } catch (error) {
        setNodeStatus(nodeId, 'error');
        throw error; 
    }
}

window.cancelNodeExecution = function(nodeId) {
    const node = flowState.nodes.find(n => n.id === nodeId);
    if (node) node._cancelToken = true; 
};

function setNodeStatus(nodeId, status, meta = {}) {
    const el = document.getElementById(nodeId);
    if (!el) return;
    el.style.transition = 'all 0.3s ease';
    el.classList.remove('is-running', 'is-success', 'is-error', 'is-auto-retrying');
    if (status === 'running') el.classList.add('is-running');
    if (status === 'success' || status === 'cached') el.classList.add('is-success');
    if (status === 'error') el.classList.add('is-error');
    if (status === 'running' && meta.retryCount) el.classList.add('is-auto-retrying');

    let statusBar = el.querySelector('.node-status-bar');
    if (!statusBar) {
        statusBar = document.createElement('div');
        statusBar.className = 'node-status-bar';
        statusBar.style.cssText = 'position: absolute; bottom: -24px; left: 0; width: 100%; font-size: 11px; font-family: monospace; text-align: center; padding: 4px 0; border-radius: 6px; transition: 0.3s; z-index: 10; opacity: 0; pointer-events: none; backdrop-filter: blur(4px); box-shadow: 0 2px 10px rgba(0,0,0,0.5);';
        el.appendChild(statusBar);
    }

    if (el.dataset.timerId) {
        clearInterval(parseInt(el.dataset.timerId));
        delete el.dataset.timerId;
    }

    const incomingLinks = flowState.links.filter(l => l.target === nodeId);
    incomingLinks.forEach(link => {
        const pathEl = document.getElementById('svgpath_' + link.id);
        if (pathEl) {
            if (status === 'running') pathEl.classList.add('link-flowing');
            else pathEl.classList.remove('link-flowing');
        }
    });

    if (status === 'running') {
        el.style.boxShadow = '0 0 30px 5px rgba(56, 189, 248, 0.4)';
        el.style.borderColor = '#38bdf8';
        statusBar.style.background = 'rgba(56, 189, 248, 0.15)';
        statusBar.style.color = '#38bdf8';
        statusBar.style.border = '1px solid rgba(56, 189, 248, 0.3)';
        statusBar.style.opacity = '1';
        statusBar.style.bottom = '-30px'; 
        statusBar.style.pointerEvents = 'auto'; 
        
        const startTime = Date.now();
        const renderStatusUI = () => {
            const sec = Math.floor((Date.now() - startTime) / 1000);
            const mm = String(Math.floor(sec / 60)).padStart(2, '0');
            const ss = String(sec % 60).padStart(2, '0');
            const retryStr = meta.retryCount ? ` <span style="color:#f59e0b">(重试 ${meta.retryCount})</span>` : '';
            statusBar.innerHTML = `⚙️ 引擎轰鸣中...${retryStr} <span style="font-weight:bold; font-size:12px; margin-left:4px;">${mm}:${ss}</span>
            <button onclick="cancelNodeExecution('${nodeId}'); event.stopPropagation();" onmousedown="event.stopPropagation();" style="margin-left:8px; padding:2px 8px; font-size:11px; background:rgba(239,68,68,0.2); color:#ef4444; border:1px solid rgba(239,68,68,0.5); border-radius:4px; cursor:pointer; pointer-events:auto; transition:0.2s;">中止</button>`;
        };
        renderStatusUI(); 
        const timerId = setInterval(renderStatusUI, 1000); 
        el.dataset.timerId = timerId;

    } else if (status === 'success' || status === 'cached') {
        el.style.boxShadow = '0 0 30px 5px rgba(34, 197, 94, 0.3)';
        el.style.borderColor = '#22c55e';
        statusBar.style.background = 'rgba(34, 197, 94, 0.15)';
        statusBar.style.color = '#22c55e';
        statusBar.style.border = '1px solid rgba(34, 197, 94, 0.3)';
        statusBar.style.opacity = '1';
        statusBar.style.pointerEvents = 'none'; 
        const costTime = meta.costTime || 0;
        statusBar.innerHTML = status === 'cached'
            ? `🧊 ${escapeFlowHtml(meta.label || 'Cache Hit')}`
            : `✅ 跑通完毕 ⏱️ <span style="font-weight:bold;">${escapeFlowHtml(costTime)}s</span>`;
        setTimeout(() => { statusBar.style.opacity = '0'; statusBar.style.bottom = '-24px'; }, 4000);

    } else if (status === 'error') {
        el.style.boxShadow = '0 0 30px 5px rgba(239, 68, 68, 0.3)';
        el.style.borderColor = '#ef4444';
        statusBar.style.background = 'rgba(239, 68, 68, 0.15)';
        statusBar.style.color = '#ef4444';
        statusBar.style.border = '1px solid rgba(239, 68, 68, 0.3)';
        statusBar.style.opacity = '1';
        statusBar.innerHTML = `❌ 链路崩溃`;
    } else {
        el.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
        el.style.borderColor = 'rgba(255,255,255,0.1)';
        statusBar.style.opacity = '0';
    }
}

// ==========================================
// 💰 独立记账与虫洞引擎
// ==========================================
async function recordNodeBilling(node) {
    if (!node || !node.data) return;
    let cost = 0; let detailStr = '';
    if (node.type === 'tool_image_gen') {
        const isChannel2 = node.data.channel && node.data.channel.includes('2');
        cost = isChannel2 ? 0.06 : 0.084;
        detailStr = `Pro工作流：多模态生图 (${isChannel2 ? '备用通道' : '主干通道'})`;
    } 
    else if (node.type === 'tool_video_gen') {
        const is4K = node.data.model && node.data.model.includes('4k');
        cost = is4K ? 0.50 : 0.35;
        detailStr = `Pro工作流：Veo 视频生成 (${is4K ? '4K高画质' : '标准画质'})`;
    }

    if (cost > 0) {
        const record = {
            id: 'bill_flow_' + Date.now() + '_' + Math.random().toString(36).substr(2,5),
            taskId: node.id,
            nodeId: node.id,
            type: node.type === 'tool_video_gen' ? 'video' : 'image',
            cost: cost,
            detail: detailStr,
            timestamp: Date.now()
        };
        return new Promise((resolve) => {
            try {
                const tx = db.transaction('billing', 'readwrite');
                tx.objectStore('billing').put(record);
                tx.oncomplete = () => {
                    if (typeof window.updateTotalBalance === 'function') window.updateTotalBalance(); 
                    else if (typeof sysBus !== 'undefined') sysBus.emit('SYSTEM:BILLING_UPDATED', record);
                    resolve();
                };
                tx.onerror = () => resolve();
            } catch (error) { resolve(); }
        });
    }
}

window.toggleMaterialDrawer = function() {
    const drawer = document.getElementById('material-drawer');
    if (drawer) {
        drawer.classList.toggle('open');
        if (drawer.classList.contains('open')) renderMaterialLibrary();
    }
};

window.renderMaterialLibrary = async function() {
    const grid = document.getElementById('material-grid');
    if (!grid) return;
    try {
        const tasks = await getAllTasksDB(); 
        const materials = tasks.filter(t => t.type === 'local_image');
        if (materials.length === 0) { 
            grid.innerHTML = `<div style="grid-column: span 2; text-align: center; padding: 40px 0; color: #555; font-size: 12px;">主画布仓库空空如也，请先去主页传图</div>`; 
            return; 
        }
        let html = '';
        materials.forEach(m => {
            const url = getBlobUrl(m.id, m.src);
            html += `
                <div class="material-item" draggable="true" 
                     ondragstart="event.dataTransfer.setData('application/json', JSON.stringify({taskId: '${m.id}', type: 'local'}))">
                    <img src="${url}" loading="lazy">
                </div>
            `;
        });
        grid.innerHTML = html;
    } catch (err) {
        grid.innerHTML = `<div style="color: #ef4444; font-size: 12px; grid-column: span 2;">数据库穿透异常</div>`;
    }
};

document.addEventListener('mousedown', (e) => {
    const drawer = document.getElementById('material-drawer');
    if (drawer && drawer.classList.contains('open')) {
        const isClickInside = drawer.contains(e.target);
        const isClickToggleButton = e.target.closest('button[onclick="toggleMaterialDrawer()"]');
        if (!isClickInside && !isClickToggleButton) drawer.classList.remove('open');
    }
});
// initFlowEngine 已在上方统一挂载为 bootstrapFlowEngine。

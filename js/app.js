// ==========================================
// 🟢 核心应用逻辑与安全拦截 (Veo Studio Infinity Flow)
// ==========================================
let loginAnimationId = null;

// 🌟 自动注入核心缺失样式 (包含弹窗、小地图、扫描线、拉伸把手)
const styleInj = document.createElement('style');
styleInj.innerHTML = `
    .minimap-container { bottom: 160px !important; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); overflow: hidden !important; }
    .minimap-container.is-minimized { width: 44px !important; height: 44px !important; border-radius: 22px !important; display: flex; align-items: center; justify-content: center; cursor: pointer; border-color: rgba(255,255,255,0.2); }
    .minimap-container.is-minimized #minimap-canvas, .minimap-container.is-minimized #minimap-viewport-box { opacity: 0; pointer-events: none; }
    .minimap-toggle { position: absolute; top: 6px; right: 6px; width: 22px; height: 22px; background: rgba(0,0,0,0.6); color: white; border-radius: 50%; display: flex; justify-content: center; align-items: center; cursor: pointer; z-index: 10; opacity: 0; transition: 0.2s; border: 1px solid rgba(255,255,255,0.1); }
    .minimap-container:hover .minimap-toggle { opacity: 1; }
    .minimap-container.is-minimized .minimap-toggle { display: none; }
    .minimap-icon { display: none; font-size: 24px; color: var(--accent); }
    .minimap-container.is-minimized .minimap-icon { display: block; }
    
    .sys-modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); backdrop-filter: blur(5px); z-index: 9999; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.3s ease; }
    .sys-modal-overlay.show { opacity: 1; }
    .sys-modal-content { background: var(--surface); border: 1px solid var(--accent); border-radius: 12px; width: 420px; max-width: 90%; transform: scale(0.95); transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: 0 20px 40px rgba(0,0,0,0.5); overflow: hidden; }
    .sys-modal-overlay.show .sys-modal-content { transform: scale(1); }
    
    .cyber-scanner-box { width: 80%; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; margin-top: 16px; overflow: hidden; position: relative; }
    .cyber-scanner-line { height: 100%; width: 30%; background: var(--accent); box-shadow: 0 0 10px var(--accent); border-radius: 2px; animation: scanAnim 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite alternate; }
    @keyframes scanAnim { 0% { transform: translateX(0); } 100% { transform: translateX(233%); } }
    
    .frame-resize-handle {
        position: absolute; bottom: 0; right: 0; width: 28px; height: 28px;
        cursor: nwse-resize; z-index: 20; pointer-events: auto;
        background: linear-gradient(135deg, transparent 50%, rgba(167, 139, 250, 0.4) 50%);
        border-bottom-right-radius: 14px; transition: 0.2s;
    }
    .frame-resize-handle:hover { background: linear-gradient(135deg, transparent 50%, rgba(167, 139, 250, 0.8) 50%); }
`;
document.head.appendChild(styleInj);

function showErrorModal() {
    const modal = document.getElementById('error-modal'); if (!modal) return;
    modal.style.display = 'flex'; modal.offsetHeight; modal.classList.add('show');
    const content = document.getElementById('error-modal-content');
    if (content) { content.classList.remove('error-shake'); void content.offsetWidth; content.classList.add('error-shake'); }
}
function closeErrorModal() {
    const modal = document.getElementById('error-modal'); if (!modal) return;
    modal.classList.remove('show'); setTimeout(() => modal.style.display = 'none', 300);
    const input = document.getElementById('studio-pwd-input'); if (input) input.focus();
}

function showAnnouncement() {
    const modal = document.getElementById('announcement-modal'); if (!modal) return;
    modal.style.display = 'flex'; modal.offsetHeight; modal.classList.add('show');
}
function closeAnnouncement() {
    const modal = document.getElementById('announcement-modal'); if (!modal) return;
    modal.classList.remove('show'); setTimeout(() => modal.style.display = 'none', 300);
}

async function hashPassword(password) {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const THEME_MODE_KEY = 'veo_theme_mode';
const THEME_DARK = 'dark';
const THEME_LIGHT = 'light';
const ROUTE_TRANSITION_MS = 460;

function isReducedMotion() {
    try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (err) {
        console.error(err);
        return false;
    }
}

function ensureRouteTransitionLayer() {
    let layer = document.getElementById('route-transition');
    if (layer) return layer;
    layer = document.createElement('div');
    layer.id = 'route-transition';
    layer.className = 'route-transition';
    layer.setAttribute('aria-hidden', 'true');
    layer.innerHTML = '<div class="route-transition-ring"></div><div class="route-transition-label">ROUTE HANDSHAKE</div>';
    document.body.appendChild(layer);
    return layer;
}

function startRouteTransition(labelText) {
    const layer = ensureRouteTransitionLayer();
    if (!layer) return;
    const label = layer.querySelector('.route-transition-label');
    if (label && labelText) label.textContent = labelText;
    layer.classList.add('is-active');
}

function markAppShellReady() {
    document.body.classList.remove('app-shell-init');
    document.body.classList.add('app-shell-ready');
}

window.navigateWithTransition = function(url, options = {}) {
    if (!url || typeof url !== 'string') return;
    const replace = !!options.replace;
    const label = options.label || 'ROUTE HANDSHAKE';
    if (isReducedMotion()) {
        if (replace) window.location.replace(url);
        else window.location.href = url;
        return;
    }
    startRouteTransition(label);
    window.setTimeout(() => {
        if (replace) window.location.replace(url);
        else window.location.href = url;
    }, ROUTE_TRANSITION_MS);
};

window.openFlowWorkspace = function(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    window.navigateWithTransition('flow.html', { label: 'OPEN NODE FLOW' });
};

function normalizeThemeMode(rawMode) {
    if (rawMode === THEME_LIGHT || rawMode === 'mono') return THEME_LIGHT;
    return THEME_DARK;
}

function applyThemeMode(mode) {
    const nextMode = normalizeThemeMode(mode);
    const isLight = nextMode === THEME_LIGHT;
    document.documentElement.setAttribute('data-theme', nextMode);

    const iconEl = document.getElementById('theme-toggle-icon');
    const btnEl = document.getElementById('theme-toggle-btn');
    if (iconEl) iconEl.innerText = isLight ? 'light_mode' : 'dark_mode';
    if (btnEl) btnEl.setAttribute('data-tip', isLight ? '切换到夜间模式' : '切换到日间模式');
}

function initThemeMode() {
    const saved = localStorage.getItem(THEME_MODE_KEY);
    const nextMode = normalizeThemeMode(saved);
    localStorage.setItem(THEME_MODE_KEY, nextMode);
    applyThemeMode(nextMode);
}

function activateLoginPanel(focusDelay = 360) {
    const panel = document.getElementById('gate-step-2');
    if (!panel) return;
    panel.classList.remove('step-passed');
    panel.classList.remove('step-active');
    requestAnimationFrame(() => {
        panel.classList.add('step-active');
    });
    setTimeout(() => {
        const input = document.getElementById('studio-pwd-input');
        if (input) input.focus();
    }, focusDelay);
}

window.toggleThemeMode = function() {
    const current = normalizeThemeMode(localStorage.getItem(THEME_MODE_KEY));
    const next = current === THEME_LIGHT ? THEME_DARK : THEME_LIGHT;
    localStorage.setItem(THEME_MODE_KEY, next);
    applyThemeMode(next);
    if (typeof showToast === 'function') {
        showToast(next === THEME_LIGHT ? '已切换至日间模式' : '已切换至夜间模式', 'info');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    ensureRouteTransitionLayer();
    initThemeMode();
    const gate = document.getElementById('login-gate');
    const savedSessionPwd = sessionStorage.getItem('veo_admin_pwd');
    if (savedSessionPwd) {
        if (gate) gate.style.display = 'none';
        window.requestAnimationFrame(() => markAppShellReady());
    } else if (gate) {
        activateLoginPanel(420);
    }

    const rememberedPwd = localStorage.getItem('veo_admin_pwd_saved');
    if (rememberedPwd) {
        const pwdInput = document.getElementById('studio-pwd-input'), rememberCheckbox = document.getElementById('remember-pwd');
        if (pwdInput) pwdInput.value = rememberedPwd; if (rememberCheckbox) rememberCheckbox.checked = true; 
    }

    const loginScene = document.getElementById('login-scene');
    const loginFormCard = loginScene ? loginScene.querySelector('.login-form-box') : null;
    const loginIntroCard = loginScene ? loginScene.querySelector('.login-intro') : null;
    const resetLoginTilt = () => {
        if (!loginScene) return;
        loginScene.style.setProperty('--login-tilt-x', '0deg');
        loginScene.style.setProperty('--login-tilt-y', '0deg');
        if (loginFormCard) loginFormCard.style.transform = 'translateZ(0) rotateX(0deg) rotateY(0deg)';
        if (loginIntroCard) loginIntroCard.style.transform = 'translateZ(0) rotateX(0deg) rotateY(0deg)';
    };

    const canvas = document.getElementById('login-canvas');
    if (canvas && gate && gate.style.display !== 'none') {
        const ctx = canvas.getContext('2d');
        let width, height, particles = [], mouse = { x: null, y: null };
        function resize() { width = canvas.width = window.innerWidth; height = canvas.height = window.innerHeight; }
        window.addEventListener('resize', resize); resize();
        gate.addEventListener('mousemove', (e) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
            if (!loginScene || isReducedMotion()) return;
            try {
                const rect = loginScene.getBoundingClientRect();
                if (!rect || rect.width <= 0 || rect.height <= 0) return;
                const px = (e.clientX - rect.left) / rect.width;
                const py = (e.clientY - rect.top) / rect.height;
                const tiltY = ((px - 0.5) * 3.2).toFixed(2);
                const tiltX = ((0.5 - py) * 2.8).toFixed(2);
                loginScene.style.setProperty('--login-tilt-x', `${tiltX}deg`);
                loginScene.style.setProperty('--login-tilt-y', `${tiltY}deg`);
                if (loginFormCard) loginFormCard.style.transform = `translateZ(0) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
                if (loginIntroCard) loginIntroCard.style.transform = `translateZ(0) rotateX(${(tiltX * 0.35).toFixed(2)}deg) rotateY(${(tiltY * 0.35).toFixed(2)}deg)`;
            } catch (err) {
                console.warn('[login-tilt] update failed:', err);
            }
        });
        gate.addEventListener('mouseleave', () => {
            mouse.x = null;
            mouse.y = null;
            resetLoginTilt();
        });
        resetLoginTilt();

        class Particle {
            constructor() {
                this.x = Math.random() * width; this.y = Math.random() * height;
                this.size = Math.random() * 1.5 + 0.5; this.speedX = Math.random() * 0.5 - 0.25; this.speedY = Math.random() * 0.5 - 0.25;
                this.baseOpacity = Math.random() * 0.3 + 0.1; this.opacity = this.baseOpacity;
            }
            update() {
                this.x += this.speedX; this.y += this.speedY;
                if (this.x < 0 || this.x > width) this.speedX *= -1; if (this.y < 0 || this.y > height) this.speedY *= -1;
                if (mouse.x && mouse.y) {
                    let dx = mouse.x - this.x, dy = mouse.y - this.y;
                    if (Math.sqrt(dx*dx + dy*dy) < 80) { this.x -= dx * 0.015; this.y -= dy * 0.015; this.opacity = 0.9; } 
                    else { this.opacity = Math.max(this.baseOpacity, this.opacity - 0.02); }
                }
            }
            draw() { ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`; ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill(); }
        }
        for (let i = 0; i < 120; i++) particles.push(new Particle());
        function animate() {
            ctx.clearRect(0, 0, width, height);
            if (mouse.x && mouse.y) {
                let gradient = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 120);
                gradient.addColorStop(0, 'rgba(255, 255, 255, 0.08)'); gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.02)'); gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
            }
            particles.forEach(p => { p.update(); p.draw(); }); loginAnimationId = requestAnimationFrame(animate);
        }
        animate();
    }

    const minimapEl = document.getElementById('minimap-container');
    if (minimapEl) {
        minimapEl.innerHTML += `
            <div class="minimap-toggle" onclick="toggleMinimap(event)" data-tip="收起小地图"><span class="material-symbols-outlined" style="font-size:14px;">close</span></div>
            <span class="material-symbols-outlined minimap-icon" onclick="toggleMinimap(event)" data-tip="展开小地图">map</span>
        `;
    }
});

window.toggleMinimap = function(e) {
    if(e) e.stopPropagation();
    const container = document.getElementById('minimap-container');
    if (container) {
        container.classList.toggle('is-minimized');
        if (!container.classList.contains('is-minimized')) { renderMinimap(); }
    }
};

function startLoginTransition() {
    activateLoginPanel(180);
}

async function handleLoginSubmit(e) {
    e.preventDefault(); 
    const pwdInput = document.getElementById('studio-pwd-input').value.trim(), btn = document.getElementById('login-submit-btn');
    if (!pwdInput) return showToast("请输入密钥", "error");
    btn.innerHTML = `<svg class="spinner" viewBox="0 0 50 50" style="width:20px;height:20px;stroke:currentColor;margin:0 auto;"><circle cx="25" cy="25" r="20"></circle></svg>`; btn.style.pointerEvents = 'none';

    const inputHash = await hashPassword(pwdInput);
    const TARGET_HASH = "acc8ca2c94bcfaf05736fe29176ad5ec6f766a47ae3597a4186507ece27e5f0f";

    setTimeout(() => {
        if (inputHash !== TARGET_HASH) {
            showErrorModal(); btn.innerHTML = `验证身份 / LOGIN`; btn.style.pointerEvents = 'auto';
            document.getElementById('studio-pwd-input').value = ''; localStorage.removeItem('veo_admin_pwd_saved'); return; 
        }
        sessionStorage.setItem('veo_admin_pwd', pwdInput);
        const rememberCheckbox = document.getElementById('remember-pwd');
        if (rememberCheckbox && rememberCheckbox.checked) localStorage.setItem('veo_admin_pwd_saved', pwdInput); else localStorage.removeItem('veo_admin_pwd_saved'); 
        btn.innerHTML = `<span class="material-symbols-outlined">check_circle</span> 验证通过`; btn.style.background = 'var(--success)';
        
        setTimeout(() => {
            document.getElementById('gate-step-2').classList.remove('step-active'); document.getElementById('gate-step-2').classList.add('step-passed');
            const gate = document.getElementById('login-gate'); gate.classList.add('unlocked');
            setTimeout(() => {
                if (typeof loginAnimationId !== 'undefined' && loginAnimationId) cancelAnimationFrame(loginAnimationId);
                gate.remove(); showToast("欢迎回来", "success");
                markAppShellReady();
                setTimeout(showAnnouncement, 500); 
            }, 800);
        }, 400);
    }, 600);
}

const API_SUBMIT = 'https://api.wallyai.top/webhook/proxy-submit'; 
const API_POLL = 'https://api.wallyai.top/webhook/proxy-poll'; 
const API_IMAGE_GEN = (window.VEO_IMAGE_UNIFIED_WEBHOOK && String(window.VEO_IMAGE_UNIFIED_WEBHOOK).trim()) || 'https://api.wallyai.top/webhook/proxy-image-unified';
const API_IMAGE_GEN_LEGACY = (window.VEO_IMAGE_LEGACY_WEBHOOK && String(window.VEO_IMAGE_LEGACY_WEBHOOK).trim()) || 'https://api.wallyai.top/webhook/proxy-image-gen';
const API_IMAGE_AUTH = (window.VEO_WEBHOOK_AUTH && String(window.VEO_WEBHOOK_AUTH).trim()) || '';
let activeTasks = [], activeRetries = new Set(); 
const taskPollControllers = new Map();
const taskPollTimers = new Map();

function cssEscapeSafe(id) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(id);
    return String(id).replace(/([!"#$%&'()*+,./:;<=>?@[\]^`{|}~\\])/g, '\\$1');
}

function snapshotCardState(cardEl) {
    const state = { focusSelector: '', selectionStart: null, selectionEnd: null, videos: [] };
    if (!cardEl) return state;
    const activeEl = document.activeElement;
    if (activeEl && cardEl.contains(activeEl)) {
        if (activeEl.id) state.focusSelector = `#${cssEscapeSafe(activeEl.id)}`;
        else if (activeEl.name) state.focusSelector = `[name="${String(activeEl.name).replace(/"/g, '\\"')}"]`;
        else if (activeEl.className && typeof activeEl.className === 'string') {
            const oneClass = activeEl.className.split(/\s+/).find(Boolean);
            if (oneClass) state.focusSelector = `.${cssEscapeSafe(oneClass)}`;
        }
        if (typeof activeEl.selectionStart === 'number') state.selectionStart = activeEl.selectionStart;
        if (typeof activeEl.selectionEnd === 'number') state.selectionEnd = activeEl.selectionEnd;
    }
    const videos = cardEl.querySelectorAll('video');
    videos.forEach((video, idx) => {
        state.videos.push({
            key: video.currentSrc || video.getAttribute('src') || `video_${idx}`,
            currentTime: Number.isFinite(video.currentTime) ? video.currentTime : 0,
            paused: video.paused
        });
    });
    return state;
}

function restoreCardState(cardEl, state) {
    if (!cardEl || !state) return;
    if (Array.isArray(state.videos) && state.videos.length > 0) {
        const videos = cardEl.querySelectorAll('video');
        videos.forEach((video, idx) => {
            const key = video.currentSrc || video.getAttribute('src') || `video_${idx}`;
            const hit = state.videos.find((v) => v.key === key) || state.videos[idx];
            if (!hit) return;
            try {
                if (Number.isFinite(hit.currentTime) && hit.currentTime > 0) video.currentTime = hit.currentTime;
                if (!hit.paused) video.play().catch(() => {});
            } catch (err) {}
        });
    }
    if (state.focusSelector) {
        const target = cardEl.querySelector(state.focusSelector);
        if (target && typeof target.focus === 'function') {
            target.focus({ preventScroll: true });
            if (typeof state.selectionStart === 'number' && typeof state.selectionEnd === 'number' && typeof target.setSelectionRange === 'function') {
                try { target.setSelectionRange(state.selectionStart, state.selectionEnd); } catch (err) {}
            }
        }
    }
}

function patchElementAttributes(fromEl, toEl) {
    const fromAttrs = fromEl.getAttributeNames ? fromEl.getAttributeNames() : [];
    const toAttrs = toEl.getAttributeNames ? toEl.getAttributeNames() : [];
    fromAttrs.forEach((name) => {
        if (!toEl.hasAttribute(name)) fromEl.removeAttribute(name);
    });
    toAttrs.forEach((name) => {
        const nextVal = toEl.getAttribute(name);
        if (fromEl.getAttribute(name) !== nextVal) fromEl.setAttribute(name, nextVal);
    });
}

function canReuseNode(fromNode, toNode) {
    if (!fromNode || !toNode) return false;
    if (fromNode.nodeType !== toNode.nodeType) return false;
    if (fromNode.nodeType === Node.TEXT_NODE) return true;
    if (fromNode.nodeType === Node.ELEMENT_NODE) return fromNode.tagName === toNode.tagName;
    return false;
}

function morphNodeLite(fromNode, toNode) {
    if (!canReuseNode(fromNode, toNode)) {
        fromNode.replaceWith(toNode.cloneNode(true));
        return;
    }
    if (fromNode.nodeType === Node.TEXT_NODE) {
        if (fromNode.nodeValue !== toNode.nodeValue) fromNode.nodeValue = toNode.nodeValue;
        return;
    }
    patchElementAttributes(fromNode, toNode);
    morphChildrenLite(fromNode, toNode);
}

function morphChildrenLite(fromParent, toParent) {
    const fromChildren = Array.from(fromParent.childNodes);
    const toChildren = Array.from(toParent.childNodes);
    const byId = new Map();
    fromChildren.forEach((child) => {
        if (child.nodeType === Node.ELEMENT_NODE && child.id) byId.set(child.id, child);
    });
    const used = new Set();
    const nextOrdered = [];
    let cursor = 0;

    toChildren.forEach((nextChild) => {
        let matched = null;
        if (nextChild.nodeType === Node.ELEMENT_NODE && nextChild.id && byId.has(nextChild.id)) {
            matched = byId.get(nextChild.id);
        } else {
            while (cursor < fromChildren.length && used.has(fromChildren[cursor])) cursor++;
            const candidate = fromChildren[cursor];
            if (canReuseNode(candidate, nextChild)) matched = candidate;
            cursor++;
        }
        if (matched) {
            used.add(matched);
            morphNodeLite(matched, nextChild);
            nextOrdered.push(matched);
        } else {
            nextOrdered.push(nextChild.cloneNode(true));
        }
    });

    fromChildren.forEach((child) => {
        if (!used.has(child) && child.parentNode === fromParent) child.remove();
    });
    fromParent.replaceChildren(...nextOrdered);
}

function morphCardDOM(cardEl, nextHtml) {
    if (!cardEl) return;
    const state = snapshotCardState(cardEl);
    const shell = document.createElement('div');
    shell.innerHTML = nextHtml;
    morphChildrenLite(cardEl, shell);
    restoreCardState(cardEl, state);
}

async function blobsToBase64Sequential(blobs, options = {}) {
    const list = Array.isArray(blobs) ? blobs : [];
    const out = [];
    for (const blob of list) {
        out.push(await blobToBase64(blob, options));
    }
    return out;
}

async function buildBlobSignature(blob) {
    if (!blob) return '';
    if (typeof blob === 'string') return `str_${blob.length}_${blob.slice(-120)}`;
    const size = toFiniteNumber(blob.size, 0);
    const type = blob.type || 'application/octet-stream';
    const head = await blob.slice(0, 64).arrayBuffer().catch(() => null);
    const tailStart = Math.max(0, size - 64);
    const tail = await blob.slice(tailStart, size).arrayBuffer().catch(() => null);
    const headArr = head ? Array.from(new Uint8Array(head)).join(',') : '';
    const tailArr = tail ? Array.from(new Uint8Array(tail)).join(',') : '';
    return `${type}|${size}|${headArr}|${tailArr}`;
}

function clearTaskPolling(taskId, removeActive = true) {
    const controller = taskPollControllers.get(taskId);
    if (controller) {
        try { controller.abort(); } catch (err) {}
        taskPollControllers.delete(taskId);
    }
    const timerId = taskPollTimers.get(taskId);
    if (timerId) {
        clearTimeout(timerId);
        taskPollTimers.delete(taskId);
    }
    if (removeActive) removeActiveTask(taskId);
}

function removeActiveTask(id) { const index = activeTasks.indexOf(id); if (index > -1) activeTasks.splice(index, 1); }
function toggleDrawer() { document.getElementById('tool-drawer').classList.toggle('open'); }
function toggleMaterialDrawer() { document.getElementById('material-drawer').classList.toggle('open'); }

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
    const tasks = await getAllTasksDB(); 
    const materials = tasks.filter(t => t.type === 'local_image');
    const grid = document.getElementById('material-grid'); 
    if (!grid) return;
    
    if (materials.length === 0) { 
        grid.innerHTML = `<div style="grid-column: span 2; text-align: center; padding: 40px 0; color: var(--text-sub); font-size: 12px;">仓库空空如也</div>`; 
        return; 
    }

    const now = Date.now(), ONE_DAY = 86400000;
    const groups = { "今天": [], "昨天": [], "本周": [], "更早": [] };

    materials.forEach(m => {
        const diff = now - m.timestamp;
        if (diff < ONE_DAY) groups["今天"].push(m);
        else if (diff < ONE_DAY * 2) groups["昨天"].push(m);
        else if (diff < ONE_DAY * 7) groups["本周"].push(m);
        else groups["更早"].push(m);
    });

    let html = '';
    for (const [groupName, items] of Object.entries(groups)) {
        if (items.length > 0) {
            html += `<div style="grid-column: span 2; font-size: 12px; font-weight: 600; color: var(--text-sub); margin-top: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 4px;">${groupName} (${items.length})</div>`;
            html += items.map(m => `
                <div class="material-item" draggable="true" ondragstart="event.dataTransfer.setData('application/json', JSON.stringify({taskId: '${m.id}', type: 'local'}))" ondblclick="openLightbox(this.querySelector('img').src)" data-tip="按住拖拽复用 | 双击放大">
                    <img src="${getBlobUrl(m.id, m.src)}" loading="lazy">
                    <button class="delete-btn material-symbols-outlined" onclick="deleteMaterial(event, '${m.id}')" data-tip="彻底删除素材">close</button>
                </div>
            `).join('');
        }
    }
    grid.innerHTML = html;
}

async function deduplicateMaterials(event) {
    const btn = event.currentTarget;
    const originalHTML = btn.innerHTML;
    btn.innerHTML = `<svg class="spinner" viewBox="0 0 50 50" style="width:16px;height:16px;stroke:currentColor;margin-right:6px;"><circle cx="25" cy="25" r="20"></circle></svg> 扫描中...`;
    btn.style.pointerEvents = 'none';

    try {
        const tasks = await getAllTasksDB();
        const materials = tasks.filter(t => t.type === 'local_image');
        const seenSignatures = new Set();
        let removedCount = 0;

        for (let m of materials) {
            if (!m.src) continue; 
            const signature = await buildBlobSignature(m.src);
            if (!signature) continue; 

            if (seenSignatures.has(signature)) {
                await deleteTaskDB(m.id); 
                removedCount++;
            } else {
                seenSignatures.add(signature);
            }
        }

        if (removedCount > 0) {
            await renderMaterialLibrary();
            showToast(`✨ 清理完毕：已成功剔除 ${removedCount} 张完全重复的素材！`, "success");
        } else {
            showToast("🌟 您的素材库很干净，没有发现重复图片。", "info");
        }
    } catch (err) {
        console.error('去重引擎故障:', err);
        showToast("去重扫描失败", "error");
    } finally {
        btn.innerHTML = originalHTML;
        btn.style.pointerEvents = 'auto';
    }
}

async function clearAllMaterials() {
    if(confirm('🚨 危险操作！\n确定要清空整个素材库吗？\n(这绝对安全：它只清空侧边栏图库，不会影响您画布上已经垫进去、正在使用的卡片图片！)')) {
        const tasks = await getAllTasksDB();
        const materials = tasks.filter(t => t.type === 'local_image');
        await Promise.all(materials.map(m => deleteTaskDB(m.id)));
        await renderMaterialLibrary();
        showToast("🗑️ 素材库已全部清空，空间已释放。", "success");
    }
}

async function deleteMaterial(e, id) {
    e.stopPropagation();
    if(confirm('🗑️ 确定要从素材库彻底销毁这张图片吗？')) { await deleteTaskDB(id); renderMaterialLibrary(); showToast("已销毁素材", "success"); }
}

async function updateBillingUI() { const stats = await getBillingStats(); const txtEl = document.getElementById('top-bill-text'); if(txtEl) txtEl.innerText = `￥${stats.totalCost}`; }
async function openBillingModal() {
    const stats = await getBillingStats(); document.getElementById('bill-total').innerText = '￥' + stats.totalCost; document.getElementById('bill-video-count').innerText = stats.videoCount; document.getElementById('bill-image-count').innerText = stats.imageCount;
    const modal = document.getElementById('billing-modal'); modal.style.display = 'flex'; modal.offsetHeight; modal.classList.add('show');
}
function closeBillingModal() { const modal = document.getElementById('billing-modal'); modal.classList.remove('show'); setTimeout(() => modal.style.display = 'none', 300); }

function updateEstimatedCost() {
    const state = globalStore.getState(); 
    let cost = 0.35; 
    if (state.model.includes('4k')) {
        cost = 0.50; 
    } else if (state.model.includes('lite')) { // 🌟 兼容特惠模型 fast-lite-1.0
        cost = 0.20; 
    }
    
    const batchSelect = document.getElementById('batch-select');
    const batch = batchSelect ? parseInt(batchSelect.value) : 1;
    const total = (cost * batch).toFixed(2);
    
    const btn = document.getElementById('generate-btn'); 
    if (btn) btn.setAttribute('data-tip', `发送至服务器生成 | 预估消耗: ￥${total}`);
}
function updateBatchCount(select) { document.getElementById('batch-text').innerText = select.options[select.selectedIndex].text; updateEstimatedCost(); }

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
    const toast = document.createElement('div'); toast.className = `veo-toast toast-${type}`;
    let icon = type === 'error' ? 'error' : (type === 'success' ? 'check_circle' : 'info');
    toast.innerHTML = `<span class="material-symbols-outlined icon" style="font-size: 16px;">${icon}</span> ${message}`;
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

async function createFrame() {
    if (selectedTasks.size === 0) return showToast("请先按住 Shift 框选需要打组的卡片", "error");
    const tasks = await getAllTasksDB();
    const selected = tasks.filter(t => selectedTasks.has(t.id) && t.type !== 'frame' && t.type !== 'local_image' && !t.parentId);
    if (selected.length === 0) return showToast("选中的卡片已被打组或无效", "error");
    await renderBoard();
    const selectedBounds = selected.map((t) => {
        normalizeTaskPosition(t);
        const size = measureTaskAABB(t);
        return { x: t.x, y: t.y, width: size.width, height: size.height };
    });
    let minX = Math.min(...selectedBounds.map(t => t.x));
    let minY = Math.min(...selectedBounds.map(t => t.y));
    let maxX = Math.max(...selectedBounds.map(t => t.x + t.width));
    let maxY = Math.max(...selectedBounds.map(t => t.y + t.height));
    const frameId = 'frame_' + Date.now(), padding = 60;
    const newFrame = { id: frameId, type: 'frame', x: minX - padding, y: minY - padding, width: maxX - minX + padding * 2, height: maxY - minY + padding * 2, title: '未命名项目组', isCollapsed: false, timestamp: Date.now() };

    selected.forEach((t) => { t.parentId = frameId; });
    if (typeof saveTaskBatchDB === 'function') await saveTaskBatchDB([newFrame].concat(selected));
    else {
        await saveTaskDB(newFrame);
        for (let t of selected) await saveTaskDB(t);
    }
    clearSelection(); await renderBoard(); showToast(`✅ 已将 ${selected.length} 个卡片收纳为项目组`, "success");
}

async function updateTaskField(id, key, val) { const task = await getTaskDB(id); if (task) { task[key] = val; await saveTaskDB(task); } }
async function toggleFrameCollapse(id) { const frame = await getTaskDB(id); if (frame) { frame.isCollapsed = !frame.isCollapsed; await saveTaskDB(frame); await renderBoard(); } }
async function removeFrame(id) {
    if(confirm('📦 确定要解散这个项目组吗？\n(内部卡片将安全保留在画布上)')) {
        await deleteTaskDB(id); const tasks = await getAllTasksDB();
        for (let t of tasks) { if (t.parentId === id) { delete t.parentId; await saveTaskDB(t); } }
        await renderBoard(); showToast("项目组已解散", "success");
    }
}

async function checkGroupDrop(draggedInfo) {
    const task = draggedInfo.task;
    if (task.type === 'frame') return; 
    const cardCenter = { x: task.x + (task.width || 340)/2, y: task.y + (task.height || 400)/2 };
    
    const frames = Array.from(document.querySelectorAll('.frame-box')).map(el => el.__veoTask).filter(t => t && t.type === 'frame' && !t.isCollapsed);
    let validFrames = [];
    
    for (let f of frames) {
        if (cardCenter.x > f.x && cardCenter.x < f.x + f.width && cardCenter.y > f.y && cardCenter.y < f.y + f.height) {
            validFrames.push(f);
        }
    }

    let droppedIntoFrame = null;
    if (validFrames.length > 0) {
        validFrames.sort((a, b) => {
            const elA = document.getElementById('card-' + a.id);
            const elB = document.getElementById('card-' + b.id);
            const zA = parseInt(elA ? elA.style.zIndex || 0 : 0);
            const zB = parseInt(elB ? elB.style.zIndex || 0 : 0);
            return zB - zA;
        });
        droppedIntoFrame = validFrames[0].id;
    }

    if (droppedIntoFrame) {
        if (task.parentId !== droppedIntoFrame) {
            task.parentId = droppedIntoFrame; await saveTaskDB(task);
            showToast("📦 卡片已移入项目组", "success");
        }
    } else {
        if (task.parentId) {
            task.parentId = null; await saveTaskDB(task);
            showToast("📤 卡片已自由脱离项目组", "info");
        }
    }
}


const viewport = document.getElementById('canvas-viewport'), board = document.getElementById('canvas-board'), marquee = document.getElementById('selection-marquee'); 
let transform = { x: window.innerWidth / 2, y: 100, scale: 1 }, isPanning = false, startPanX = 0, startPanY = 0, ticking = false; 
let draggingCardInfo = null, highestZIndex = 10, scrollTimeout; 
let selectedTasks = new Set(), isSelecting = false, startSelX = 0, startSelY = 0;
let activeCrop = null, activeFrameResize = null; 
let isPrimaryPointerDown = false;
let lastPointerClientX = 0;
let lastPointerClientY = 0;
let toolDragSession = null;
let lastViewportDragClientX = NaN;
let lastViewportDragClientY = NaN;

function clientToBoard(clientX, clientY) {
    const scaleSafe = (Number.isFinite(transform.scale) && transform.scale !== 0) ? transform.scale : 1;
    const rect = (viewport && typeof viewport.getBoundingClientRect === 'function')
        ? viewport.getBoundingClientRect()
        : { left: 0, top: 0 };
    const localX = (Number.isFinite(clientX) ? clientX : 0) - rect.left;
    const localY = (Number.isFinite(clientY) ? clientY : 0) - rect.top;
    return {
        x: (localX - transform.x) / scaleSafe,
        y: (localY - transform.y) / scaleSafe
    };
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

function toFiniteNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function normalizeTaskPosition(task) {
    if (!task || typeof task !== 'object') return;
    task.x = toFiniteNumber(task.x, 0);
    task.y = toFiniteNumber(task.y, 0);
}

function getTaskFallbackSize(task) {
    if (!task || typeof task !== 'object') return { width: 340, height: 400 };
    if (task.type === 'note') {
        return {
            width: Math.max(200, toFiniteNumber(task.width, 260)),
            height: Math.max(140, toFiniteNumber(task.height, 180))
        };
    }
    if (task.type === 'tool_generator') return { width: 380, height: 420 };
    if (task.type === 'tool_image_gen') {
        const isCollapsed = !!(task.state && task.state.previewCollapsed === true);
        return { width: isCollapsed ? 360 : 680, height: 520 };
    }
    if (task.type === 'tool_cropper') return { width: 340, height: 420 };
    if (task.type === 'frame') {
        return {
            width: Math.max(340, toFiniteNumber(task.width, 340)),
            height: Math.max(140, toFiniteNumber(task.height, 140))
        };
    }
    return {
        width: Math.max(280, toFiniteNumber(task.width, 340)),
        height: Math.max(220, toFiniteNumber(task.height, 400))
    };
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

function detectToolPluginType(el) {
    if (!el) return '';
    const attr = el.getAttribute('ondragstart') || '';
    if (attr.includes("'generator'")) return 'generator';
    if (attr.includes("'image_gen'")) return 'image_gen';
    if (attr.includes("'cropper'")) return 'cropper';
    return '';
}

window.addEventListener('mousedown', (e) => {
    if (e.button === 0) isPrimaryPointerDown = true;
    if (Number.isFinite(e.clientX)) lastPointerClientX = e.clientX;
    if (Number.isFinite(e.clientY)) lastPointerClientY = e.clientY;
}, true);

function clearSelection() { selectedTasks.clear(); document.querySelectorAll('.video-card.selected, .frame-box.selected').forEach(c => c.classList.remove('selected')); }

window.addEventListener('mousemove', (e) => {
    if (Number.isFinite(e.clientX)) lastPointerClientX = e.clientX;
    if (Number.isFinite(e.clientY)) lastPointerClientY = e.clientY;
    if (!ticking) {
        requestAnimationFrame(() => {
            if (isPanning) {
                transform.x = e.clientX - startPanX; transform.y = e.clientY - startPanY; 
                board.style.transform = `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`;
                document.body.style.backgroundPosition = `${transform.x}px ${transform.y}px`; document.body.style.backgroundSize = `${30 * transform.scale}px ${30 * transform.scale}px`;
                syncMinimapViewport(); 
            } 
            else if (isSelecting) {
                const currentX = e.clientX, currentY = e.clientY, left = Math.min(startSelX, currentX), top = Math.min(startSelY, currentY), width = Math.abs(currentX - startSelX), height = Math.abs(currentY - startSelY);
                if(marquee) { marquee.style.left = left + 'px'; marquee.style.top = top + 'px'; marquee.style.width = width + 'px'; marquee.style.height = height + 'px'; }
                const selRect = { left, top, right: left + width, bottom: top + height };
                document.querySelectorAll('.video-card, .frame-box').forEach(card => {
                    const rect = card.getBoundingClientRect();
                    if(card.classList.contains('hidden-in-frame')) return;
                    if (rect.left < selRect.right && rect.right > selRect.left && rect.top < selRect.bottom && rect.bottom > selRect.top) { card.classList.add('selected'); selectedTasks.add(card.id.replace('card-', '')); } 
                    else { card.classList.remove('selected'); selectedTasks.delete(card.id.replace('card-', '')); }
                });
            } 
            else if (draggingCardInfo) {
                const dx = (e.clientX - draggingCardInfo.startMouseX) / transform.scale, dy = (e.clientY - draggingCardInfo.startMouseY) / transform.scale;
                const dragBaseX = toFiniteNumber(draggingCardInfo.initialX, 0);
                const dragBaseY = toFiniteNumber(draggingCardInfo.initialY, 0);
                draggingCardInfo.task.x = dragBaseX + dx; draggingCardInfo.task.y = dragBaseY + dy;
                draggingCardInfo.el.style.transform = `translate(${draggingCardInfo.task.x}px, ${draggingCardInfo.task.y}px)`;
                if (draggingCardInfo.children) {
                    draggingCardInfo.children.forEach(child => {
                        const childBaseX = toFiniteNumber(child.initialX, 0);
                        const childBaseY = toFiniteNumber(child.initialY, 0);
                        child.task.x = childBaseX + dx; child.task.y = childBaseY + dy;
                        child.el.style.transform = `translate(${child.task.x}px, ${child.task.y}px)`;
                    });
                }
            }
            else if (activeFrameResize) {
                const dx = (e.clientX - activeFrameResize.startX) / transform.scale, dy = (e.clientY - activeFrameResize.startY) / transform.scale;
                const newW = Math.max(activeFrameResize.minW, activeFrameResize.startW + dx);
                const newH = Math.max(activeFrameResize.minH, activeFrameResize.startH + dy);
                activeFrameResize.el.style.width = newW + 'px'; activeFrameResize.el.style.height = newH + 'px';
                activeFrameResize.task.width = newW; activeFrameResize.task.height = newH; 
            }
            ticking = false;
        });
        ticking = true;
    }
});

viewport.addEventListener('mousedown', (e) => { 
    if (e.target === viewport || e.target === board) { 
        if (e.shiftKey) { isSelecting = true; startSelX = e.clientX; startSelY = e.clientY; if(marquee) { marquee.style.left = startSelX + 'px'; marquee.style.top = startSelY + 'px'; marquee.style.width = '0'; marquee.style.height = '0'; marquee.style.display = 'block'; } } 
        else { clearSelection(); isPanning = true; board.classList.add('is-moving'); startPanX = e.clientX - transform.x; startPanY = e.clientY - transform.y; }
    } 
});

window.addEventListener('mouseup', async () => { 
    isPrimaryPointerDown = false;
    isPanning = false; board.classList.remove('is-moving'); 
    if (isSelecting) { isSelecting = false; if(marquee) marquee.style.display = 'none'; }
    
    if (draggingCardInfo) { 
        draggingCardInfo.el.style.willChange = 'auto'; 
        await saveTaskDB(draggingCardInfo.task); 
        
        if (draggingCardInfo.children) { 
            for(let child of draggingCardInfo.children) { child.el.style.willChange = 'auto'; await saveTaskDB(child.task); }
        } else {
            await checkGroupDrop(draggingCardInfo);
        }
        draggingCardInfo = null; 
        renderMinimap(); 
    } 
    if (activeFrameResize) {
        await saveTaskDB(activeFrameResize.task); 
        activeFrameResize = null;
        renderMinimap();
    }
});

viewport.addEventListener('wheel', (e) => {
    if (e.target.tagName === 'TEXTAREA' || e.target.closest('textarea')) return;
    if (draggingCardInfo) return; 
    e.preventDefault(); if (ticking) return; 
    board.classList.add('is-moving'); clearTimeout(scrollTimeout); scrollTimeout = setTimeout(() => board.classList.remove('is-moving'), 150); 
    const delta = e.deltaY * 0.001; let newScale = Math.min(Math.max(0.2, transform.scale - delta), 3); 
    const mouseX = e.clientX - viewport.getBoundingClientRect().left, mouseY = e.clientY - viewport.getBoundingClientRect().top;
    transform.x = mouseX - (mouseX - transform.x) * (newScale / transform.scale); transform.y = mouseY - (mouseY - transform.y) * (newScale / transform.scale); transform.scale = newScale;
    
    if (!ticking) {
        requestAnimationFrame(() => {
            board.style.transform = `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`;
            document.body.style.backgroundPosition = `${transform.x}px ${transform.y}px`; document.body.style.backgroundSize = `${30 * transform.scale}px ${30 * transform.scale}px`;
            syncMinimapViewport(); ticking = false;
        });
        ticking = true;
    }
}, { passive: false });

function startFrameResize(e, id) {
    e.stopPropagation(); 
    isPanning = false; board.classList.remove('is-moving');
    const el = document.getElementById('card-' + id);
    const task = el.__veoTask;
    
    let minW = 340; 
    let minH = 140; 
    
    if (task) {
        document.querySelectorAll('.video-card, .frame-box').forEach(childEl => {
            if (childEl.__veoTask && childEl.__veoTask.parentId === id) {
                const childTask = childEl.__veoTask;
                const childRight = (childTask.x - task.x) + (childTask.width || 340) + 40; 
                const childBottom = (childTask.y - task.y) + (childTask.height || 400) + 40; 
                if (childRight > minW) minW = childRight;
                if (childBottom > minH) minH = childBottom;
            }
        });
    }

    activeFrameResize = {
        id: id, startX: e.clientX, startY: e.clientY,
        startW: el.offsetWidth, startH: el.offsetHeight, el: el, task: task,
        minW: minW, minH: minH  
    };
}

// ✅ 替换为支持 Alt 克隆的拖拽绑定引擎
function bindCardDrag(cardEl, task) {
    cardEl.__veoTask = task; 
    cardEl.onmousedown = (e) => { 
        if(e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON' && !e.target.classList.contains('frame-resize-handle')) { 
            highestZIndex++; cardEl.style.zIndex = highestZIndex; 
        } 
    };
    
    const header = cardEl.querySelector('.card-header') || cardEl.querySelector('.frame-header');
    if(header) {
        // 🌟 改为 async 函数，因为克隆需要查库
        header.onmousedown = async (e) => {
            if(e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.closest('button')) return;

            // 🌟🌟🌟 新增：侦测到按住 Alt 键，直接执行克隆并阻断原卡片的拖拽
            if (e.altKey) {
                e.preventDefault();
                e.stopPropagation();
                if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
                await duplicateTask(task, e);
                return;
            }

            highestZIndex++; cardEl.style.zIndex = highestZIndex; cardEl.style.willChange = 'transform'; 
            if (e.shiftKey || e.ctrlKey || e.metaKey) {
                if (selectedTasks.has(task.id)) { selectedTasks.delete(task.id); cardEl.classList.remove('selected'); } else { selectedTasks.add(task.id); cardEl.classList.add('selected'); }
            } else {
                if (!selectedTasks.has(task.id)) { clearSelection(); selectedTasks.add(task.id); cardEl.classList.add('selected'); }
            }
            draggingCardInfo = {
                el: cardEl,
                task: cardEl.__veoTask,
                startMouseX: e.clientX,
                startMouseY: e.clientY,
                initialX: toFiniteNumber(cardEl.__veoTask && cardEl.__veoTask.x, 0),
                initialY: toFiniteNumber(cardEl.__veoTask && cardEl.__veoTask.y, 0)
            }; 
            
            if (task.type === 'frame') {
                draggingCardInfo.children = [];
                document.querySelectorAll('.video-card, .frame-box').forEach(childEl => {
                    if (childEl.__veoTask && childEl.__veoTask.parentId === task.id) {
                        childEl.style.willChange = 'transform';
                        draggingCardInfo.children.push({
                            el: childEl,
                            task: childEl.__veoTask,
                            initialX: toFiniteNumber(childEl.__veoTask && childEl.__veoTask.x, 0),
                            initialY: toFiniteNumber(childEl.__veoTask && childEl.__veoTask.y, 0)
                        });
                    }
                });
            }
            e.stopPropagation(); 
        };
    }
    
    const resizeHandle = cardEl.querySelector('.frame-resize-handle');
    if (resizeHandle) {
        resizeHandle.onmousedown = (e) => {
            e.stopPropagation(); isPanning = false; if(board) board.classList.remove('is-moving');
            startFrameResize(e, task.id);
        };
    }
}

window.addEventListener('keydown', async (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault(); document.querySelectorAll('.video-card, .frame-box').forEach(card => { if(card.classList.contains('hidden-in-frame')) return; selectedTasks.add(card.id.replace('card-', '')); card.classList.add('selected'); }); showToast(`已全选可视节点`, "info");
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
        if (selectedTasks.size > 0) {
            if (confirm(`🗑️ 确定要彻底删除选中的 ${selectedTasks.size} 个对象吗？(若包含项目组，内部卡片也会连锅端！)`)) {
                const deletePromises = Array.from(selectedTasks).map(async (id) => { 
                    await deleteTaskDB(id); const card = document.getElementById('card-' + id); if (card) card.remove(); 
                    const allTasks = await getAllTasksDB(); for(let t of allTasks) { if(t.parentId === id) { await deleteTaskDB(t.id); const childEl = document.getElementById('card-' + t.id); if(childEl) childEl.remove(); } }
                });
                await Promise.all(deletePromises); showToast(`清理完成`, "success"); selectedTasks.clear(); renderMinimap();
            }
        }
    }
});

let mapMeta = { minX: 0, minY: 0, mapScale: 1, offsetX: 0, offsetY: 0 };

async function renderMinimap() {
    const container = document.getElementById('minimap-container');
    if (!container || container.classList.contains('is-minimized')) return; 
    
    const canvas = document.getElementById('minimap-canvas'), viewBox = document.getElementById('minimap-viewport-box');
    if (!canvas || !viewBox) return;
    const ctx = canvas.getContext('2d'), cw = container.clientWidth, ch = container.clientHeight;
    canvas.width = cw; canvas.height = ch;

    const tasks = await getAllTasksDB(); const boardTasks = tasks.filter(t => t.type !== 'local_image');
    if (boardTasks.length === 0) { ctx.clearRect(0, 0, cw, ch); viewBox.style.display = 'none'; return; }

    const frameMap = {}; boardTasks.filter(t => t.type === 'frame').forEach(f => frameMap[f.id] = f);

    let minX = Math.min(...boardTasks.map(t => t.x)), maxX = Math.max(...boardTasks.map(t => t.x + (t.width || 340))); 
    let minY = Math.min(...boardTasks.map(t => t.y)), maxY = Math.max(...boardTasks.map(t => t.y + (t.height || 400))); 

    const viewMinX = -transform.x / transform.scale, viewMaxX = viewMinX + window.innerWidth / transform.scale;
    const viewMinY = -transform.y / transform.scale, viewMaxY = viewMinY + window.innerHeight / transform.scale;

    minX = Math.min(minX, viewMinX); maxX = Math.max(maxX, viewMaxX); minY = Math.min(minY, viewMinY); maxY = Math.max(maxY, viewMaxY);
    const padding = 800; minX -= padding; maxX += padding; minY -= padding; maxY += padding;

    const mapWidth = maxX - minX, mapHeight = maxY - minY;
    const scaleX = cw / mapWidth, scaleY = ch / mapHeight, mapScale = Math.min(scaleX, scaleY);
    const offsetX = (cw - mapWidth * mapScale) / 2, offsetY = (ch - mapHeight * mapScale) / 2;
    mapMeta = { minX, minY, mapScale, offsetX, offsetY };

    ctx.clearRect(0, 0, cw, ch);
    boardTasks.forEach(t => {
        if (t.parentId && frameMap[t.parentId] && frameMap[t.parentId].isCollapsed) return;
        const px = offsetX + (t.x - minX) * mapScale, py = offsetY + (t.y - minY) * mapScale, pw = (t.width || 340) * mapScale, ph = (t.height || 400) * mapScale;
        ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(px, py, pw, Math.max(ph, 5), 3); else ctx.rect(px, py, pw, Math.max(ph, 5));
        
        if (t.type === 'frame') ctx.fillStyle = 'rgba(167, 139, 250, 0.15)'; 
        else if (t.type === 'note') ctx.fillStyle = 'rgba(255, 202, 40, 0.8)'; else if (t.type === 'tool_generator') ctx.fillStyle = 'rgba(129, 140, 248, 0.8)'; else if (t.type === 'tool_image_gen') ctx.fillStyle = 'rgba(10, 132, 255, 0.8)'; else if (t.type === 'tool_cropper') ctx.fillStyle = 'rgba(50, 215, 75, 0.8)'; else ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fill();
    });
    syncMinimapViewport();
}

function syncMinimapViewport() {
    const viewBox = document.getElementById('minimap-viewport-box'); if (!viewBox) return;
    const viewMinX = -transform.x / transform.scale, viewMinY = -transform.y / transform.scale;
    const vPx = mapMeta.offsetX + (viewMinX - mapMeta.minX) * mapMeta.mapScale, vPy = mapMeta.offsetY + (viewMinY - mapMeta.minY) * mapMeta.mapScale;
    const vPw = (window.innerWidth / transform.scale) * mapMeta.mapScale, vPh = (window.innerHeight / transform.scale) * mapMeta.mapScale;
    viewBox.style.display = 'block'; viewBox.style.left = vPx + 'px'; viewBox.style.top = vPy + 'px'; viewBox.style.width = vPw + 'px'; viewBox.style.height = vPh + 'px';
}

function handleMinimapClick(e) {
    const container = document.getElementById('minimap-container'); 
    if (container.classList.contains('is-minimized')) return; 
    
    const rect = container.getBoundingClientRect();
    const clickX = e.clientX - rect.left, clickY = e.clientY - rect.top;
    const targetWorldX = (clickX - mapMeta.offsetX) / mapMeta.mapScale + mapMeta.minX, targetWorldY = (clickY - mapMeta.offsetY) / mapMeta.mapScale + mapMeta.minY;
    transform.x = -targetWorldX * transform.scale + window.innerWidth / 2; transform.y = -targetWorldY * transform.scale + window.innerHeight / 2;
    board.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
    board.style.transform = `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`; document.body.style.backgroundPosition = `${transform.x}px ${transform.y}px`;
    syncMinimapViewport(); setTimeout(() => { board.style.transition = 'none'; renderMinimap(); }, 400);
}

let lightboxEl = null;
function openLightbox(src) {
    if (!lightboxEl) { lightboxEl = document.createElement('div'); lightboxEl.className = 'image-lightbox'; lightboxEl.innerHTML = `<img>`; lightboxEl.onclick = () => { lightboxEl.classList.remove('show'); setTimeout(() => lightboxEl.style.display = 'none', 200); }; document.body.appendChild(lightboxEl); }
    lightboxEl.querySelector('img').src = src; lightboxEl.style.display = 'flex'; lightboxEl.offsetHeight; lightboxEl.classList.add('show');
}

window.addEventListener('paste', async (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const items = e.clipboardData?.items; if (!items) return; let added = false;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            const file = items[i].getAsFile(); if(!file) continue; const blob = await compressImageToBlob(file, 1024);
            await saveTaskDB({ id: 'local_img_' + Date.now() + Math.random().toString(36).substr(2, 5), type: 'local_image', src: blob, timestamp: Date.now() }); added = true;
        }
    }
    if (added) { await renderMaterialLibrary(); showToast(`✅ 已将剪贴板图片收入全局素材库`, 'success'); document.getElementById('material-drawer').classList.add('open'); }
});

const consoleEl = document.getElementById('floating-console');
document.addEventListener('click', (e) => {
    const popover = document.getElementById('ref-popover'), slotBox = document.getElementById('slot-ref-box');
    if (popover && popover.style.display === 'flex' && !popover.contains(e.target) && !slotBox.contains(e.target)) popover.style.display = 'none';
    if (e.target === viewport || e.target === board) { consoleEl.classList.add('minimized'); document.getElementById('tool-drawer').classList.remove('open'); document.getElementById('material-drawer').classList.remove('open'); } else if (consoleEl.contains(e.target)) consoleEl.classList.remove('minimized');
});

async function createStickyNote(spawnX, spawnY) {
    if (spawnX === undefined) spawnX = (-transform.x + window.innerWidth/2 - 120) / transform.scale; if (spawnY === undefined) spawnY = (-transform.y + window.innerHeight/2 - 80) / transform.scale;
    await saveTaskDB({ id: 'note_' + Date.now() + Math.random().toString(36).substr(2, 5), type: 'note', text: '', x: spawnX, y: spawnY, width: 260, height: 200, timestamp: Date.now() }); renderBoard();
}
viewport.addEventListener('dblclick', (e) => {
    if (e.target === viewport || e.target === board) {
        const p = clientToBoard(e.clientX, e.clientY);
        createStickyNote(p.x, p.y);
    }
});

let noteTimeout;
async function updateNoteText(id, text) { clearTimeout(noteTimeout); noteTimeout = setTimeout(async () => { const note = await getTaskDB(id); if (note) { note.text = text; await saveTaskDB(note); } }, 500); }
function saveNoteSize(id, w, h) { setTimeout(async () => { const note = await getTaskDB(id); if (note && (note.width !== w || note.height !== h)) { note.width = w; note.height = h; await saveTaskDB(note); renderMinimap(); } }, 100); }

async function exportWorkspace() {
    const btn = document.getElementById('export-btn'); const originalHTML = btn.innerHTML; btn.innerHTML = `<svg class="spinner" viewBox="0 0 50 50" style="width:16px;height:16px;stroke:currentColor;margin-right:6px;"><circle cx="25" cy="25" r="20"></circle></svg> 打包中...`;
    try {
        const tasks = await getAllTasksDB(); const exportData = [];
        for (let t of tasks) {
            let clone = { ...t }; if (clone.type === 'local_image' && clone.src) clone.src = await blobToBase64(clone.src, { mode: 'network', maxBytes: 10 * 1024 * 1024, maxEdge: 2048 });
            if (clone.state) {
                if (clone.state.images) clone.state.images = await blobsToBase64Sequential(clone.state.images, { mode: 'network', maxBytes: 10 * 1024 * 1024, maxEdge: 2048 });
                if (Array.isArray(clone.state.resultBlobs)) clone.state.resultBlobs = await blobsToBase64Sequential(clone.state.resultBlobs, { mode: 'network', maxBytes: 10 * 1024 * 1024, maxEdge: 2048 });
                if (clone.state.resultBlob) clone.state.resultBlob = await blobToBase64(clone.state.resultBlob, { mode: 'network', maxBytes: 10 * 1024 * 1024, maxEdge: 2048 });
                if (clone.state.sourceBlob) clone.state.sourceBlob = await blobToBase64(clone.state.sourceBlob, { mode: 'network', maxBytes: 10 * 1024 * 1024, maxEdge: 2048 });
            }
            if (clone.rawImages) {
                if (clone.rawImages.firstFrame) clone.rawImages.firstFrame = await blobToBase64(clone.rawImages.firstFrame, { mode: 'network', maxBytes: 10 * 1024 * 1024, maxEdge: 2048 });
                if (clone.rawImages.lastFrame) clone.rawImages.lastFrame = await blobToBase64(clone.rawImages.lastFrame, { mode: 'network', maxBytes: 10 * 1024 * 1024, maxEdge: 2048 });
                if (clone.rawImages.references) clone.rawImages.references = await blobsToBase64Sequential(clone.rawImages.references, { mode: 'network', maxBytes: 10 * 1024 * 1024, maxEdge: 2048 });
            }
            exportData.push(clone);
        }
        const blob = new Blob([JSON.stringify(exportData)], {type: 'application/json'}); const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `VeoStudio_Flow_${Date.now()}.veo`; a.click(); URL.revokeObjectURL(url);
    } catch (e) { alert('导出失败: ' + e.message); } finally { btn.innerHTML = originalHTML; }
}

async function importWorkspace(input) {
    if (!input.files[0]) return; const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (confirm(`📦 解析成功！包含 ${data.length} 个节点。\n这会与您当前的画布合并，是否继续？`)) {
                const importedTasks = [];
                for (let t of data) {
                    if (t.type === 'local_image' && typeof t.src === 'string') t.src = await fetch(t.src).then(r => r.blob());
                    if (t.state) {
                        if (t.state.images) t.state.images = await Promise.all(t.state.images.map(async b => typeof b === 'string' ? await fetch(b).then(r => r.blob()) : b));
                        if (Array.isArray(t.state.resultBlobs)) {
                            t.state.resultBlobs = await Promise.all(t.state.resultBlobs.map(async b => typeof b === 'string' ? await fetch(b).then(r => r.blob()) : b));
                        }
                        if (t.state.resultBlob && typeof t.state.resultBlob === 'string') t.state.resultBlob = await fetch(t.state.resultBlob).then(r => r.blob());
                        if (t.state.sourceBlob && typeof t.state.sourceBlob === 'string') t.state.sourceBlob = await fetch(t.state.sourceBlob).then(r => r.blob());
                    }
                    if (t.rawImages) { if (typeof t.rawImages.firstFrame === 'string') t.rawImages.firstFrame = await fetch(t.rawImages.firstFrame).then(r => r.blob()); if (typeof t.rawImages.lastFrame === 'string') t.rawImages.lastFrame = await fetch(t.rawImages.lastFrame).then(r => r.blob()); if (t.rawImages.references) t.rawImages.references = await Promise.all(t.rawImages.references.map(async b => typeof b === 'string' ? await fetch(b).then(r => r.blob()) : b)); }
                    importedTasks.push(t);
                }
                if (typeof saveTaskBatchDB === 'function') await saveTaskBatchDB(importedTasks);
                else for (const t of importedTasks) await saveTaskDB(t);
                renderBoard(); await renderMaterialLibrary(); await updateBillingUI(); renderMinimap();
            }
        } catch(err) { alert('❌ 文件解析失败，请确保导入的是有效的 .veo 格式文件'); } input.value = '';
    };
    reader.readAsText(input.files[0]);
}

window.addEventListener("dragover", function(e){ e.preventDefault(); }, false); window.addEventListener("drop", function(e){ e.preventDefault(); }, false);

document.addEventListener('dragstart', (e) => {
    const toolEl = e.target && e.target.closest ? e.target.closest('.draggable-tool') : null;
    if (!toolEl) return;
    const point = getEventClientPoint(e);
    if (!point) return;
    const plugin = detectToolPluginType(toolEl);
    const startBoard = clientToBoard(point.x, point.y);

    toolDragSession = {
        plugin,
        startClientX: point.x,
        startClientY: point.y,
        startBoardX: startBoard.x,
        startBoardY: startBoard.y,
        hotX: NaN,
        hotY: NaN
    };

    if (plugin && e.dataTransfer) e.dataTransfer.setData('plugin', plugin);
    if (e.dataTransfer && typeof e.dataTransfer.setDragImage === 'function') {
        const rect = toolEl.getBoundingClientRect();
        const hotX = Math.max(0, Math.min(rect.width, point.x - rect.left));
        const hotY = Math.max(0, Math.min(rect.height, point.y - rect.top));
        toolDragSession.hotX = hotX;
        toolDragSession.hotY = hotY;
        e.dataTransfer.setDragImage(toolEl, hotX, hotY);
    }
}, true);

document.addEventListener('dragend', () => {
    toolDragSession = null;
    lastViewportDragClientX = NaN;
    lastViewportDragClientY = NaN;
}, true);

viewport.addEventListener('dragover', (e) => {
    e.preventDefault();
    const point = getEventClientPoint(e);
    if (!point) return;
    lastViewportDragClientX = point.x;
    lastViewportDragClientY = point.y;
}, false);

viewport.addEventListener('drop', async (e) => {
    e.preventDefault();
    const pluginType = e.dataTransfer.getData('plugin') || (toolDragSession && toolDragSession.plugin) || '';
    if (pluginType) {
        const dropPoint = getEventClientPoint(e) || (
            Number.isFinite(lastViewportDragClientX) && Number.isFinite(lastViewportDragClientY)
                ? { x: lastViewportDragClientX, y: lastViewportDragClientY }
                : null
        );
        if (!dropPoint) return;
        const dropBoard = clientToBoard(dropPoint.x, dropPoint.y);
        const spawnX = toFiniteNumber(dropBoard.x, 0);
        const spawnY = toFiniteNumber(dropBoard.y, 0);

        let newTool = null;
        if (pluginType === 'generator') newTool = { id: 'tool_' + Date.now(), type: 'tool_generator', x: spawnX, y: spawnY, timestamp: Date.now(), state: { format: '', opening: '', attribute: '', general: '' } };
        else if (pluginType === 'image_gen') newTool = {
            id: 'tool_img_' + Date.now(),
            type: 'tool_image_gen',
            x: spawnX,
            y: spawnY,
            timestamp: Date.now(),
            status: 'idle',
            state: {
                version: 'trial',
                providerSort: 'quality',
                quality: 'auto',
                format: 'png',
                n: 1,
                size: '1024x1024',
                trialRatio: '1:1',
                proRatio: '1:1',
                proResolution: '1k',
                customW: 9,
                customH: 16,
                background: 'auto',
                moderation: 'auto',
                prompt: '',
                images: [],
                maskImage: null,
                resultUrl: null,
                resultBlob: null,
                resultBlobs: [],
                previewCollapsed: false,
                channel: 'channel_1',
                autoRetry: false
            },
            retryCount: 0
        };
        else if (pluginType === 'cropper') newTool = { id: 'tool_crop_' + Date.now(), type: 'tool_cropper', x: spawnX, y: spawnY, timestamp: Date.now(), state: { sourceBlob: null, resultBlob: null, cropParams: { left: 10, top: 10, width: 80, height: 80 } } };
        if (newTool) {
            await saveTaskDB(newTool);
            renderBoard();
            document.getElementById('tool-drawer').classList.remove('open');
            toolDragSession = null;
            lastViewportDragClientX = NaN;
            lastViewportDragClientY = NaN;
            return;
        }
    }
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
        let added = false;
        for (let file of files) { if (file.type.startsWith('image/')) { const blob = await compressImageToBlob(file, 1024); await saveTaskDB({ id: 'local_img_' + Date.now() + Math.random().toString(36).substr(2, 5), type: 'local_image', src: blob, timestamp: Date.now() }); added = true; } }
        if(added) { await renderMaterialLibrary(); showToast(`✅ 已将拖入的图片收入全局素材库`, 'success'); document.getElementById('material-drawer').classList.add('open'); }
    }
});

// 🌟 强力拖放解析引擎 (通杀所有数据格式)
async function parseDroppedImage(e) {
    let srcToUse = null;
    try {
        const jsonStr = e.dataTransfer.getData('application/json');
        if (jsonStr) {
            const meta = JSON.parse(jsonStr); const t = await getTaskDB(meta.taskId);
            if (t) {
                if (meta.type === 'local') srcToUse = t.src;
                else if (meta.type === 'thumb') srcToUse = t.rawImages?.firstFrame || (t.rawImages?.references && t.rawImages.references[0]);
                else if (meta.type === 'gen_result') {
                    const idx = Number.isFinite(Number(meta.index)) ? Number(meta.index) : 0;
                    if (Array.isArray(t.state?.resultBlobs) && t.state.resultBlobs[idx]) srcToUse = t.state.resultBlobs[idx];
                    else srcToUse = t.state?.resultBlob;
                }
                else if (meta.type === 'crop_result') srcToUse = t.state?.resultBlob;
            }
        }
    } catch(err) {}

    // 兜底 1：解析 Base64 文本数据 (从其他网页拖拽)
    if (!srcToUse) {
        let textData = e.dataTransfer.getData('text/plain');
        if (textData && textData.startsWith('data:image')) {
            try { srcToUse = await (await fetch(textData)).blob(); } catch(err) {}
        }
    }

    // 兜底 2：解析纯本地文件 (从电脑桌面或文件夹拖拽)
    if (!srcToUse && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('image/'));
        if (file) srcToUse = await compressImageToBlob(file, 1024);
    }
    
    return srcToUse;
}

// ==========================================
// 🚀 核心：单节点局部渲染引擎 (彻底告别全局闪烁)
// ==========================================
function applyImgGenCardFrame(cardEl, task) {
    if (!cardEl || !task || task.type !== 'tool_image_gen') return;
    ensureImgGenState(task);
    const isOpen = task.state.previewCollapsed !== true;
    const collapsedWidth = 360;
    const expandedWidth = 680;
    cardEl.classList.toggle('is-preview-open', isOpen);
    cardEl.style.width = `${isOpen ? expandedWidth : collapsedWidth}px`;
}

async function renderCard(taskId) {
    const task = await getTaskDB(taskId); if (!task) return;
    const cardEl = document.getElementById('card-' + taskId); if (!cardEl) return;

    // 仅重绘当前的这一张卡片
    morphCardDOM(cardEl, generateCardHTML(task));
    applyImgGenCardFrame(cardEl, task);
    bindCardDrag(cardEl, task);

    // 同步追踪属性，防止后续被误刷
    const currentImgLen = (task.state && task.state.images) ? task.state.images.length : 0;
    const currentProgress = task.progress || '';
    const cropSrc = task.state && task.state.sourceBlob ? 'hasSrc' : 'noSrc';
    const cropRes = task.state && task.state.resultBlob ? 'hasRes' : 'noRes';
    const currentChannel = (task.state && task.state.channel) ? task.state.channel : 'channel_1';
    const currentVersion = (task.state && task.state.version) ? task.state.version : 'trial';
    const currentPreviewCollapsed = (task.type === 'tool_image_gen' && task.state) ? String(task.state.previewCollapsed === true) : 'na';

    cardEl.setAttribute('data-sync-status', task.status || 'static');
    cardEl.setAttribute('data-sync-retry', task.retryCount || 0);
    cardEl.setAttribute('data-sync-img-len', currentImgLen);
    cardEl.setAttribute('data-sync-progress', currentProgress);
    cardEl.setAttribute('data-sync-crop-src', cropSrc);
    cardEl.setAttribute('data-sync-crop-res', cropRes);
    cardEl.setAttribute('data-sync-channel', currentChannel);
    cardEl.setAttribute('data-sync-version', currentVersion);
    cardEl.setAttribute('data-sync-preview-collapsed', currentPreviewCollapsed);
    cardEl.setAttribute('data-sync-title', task.title || '');
    cardEl.setAttribute('data-sync-collapsed', String(task.isCollapsed));
}

// ==========================================
// ✂️ 局部裁切器 (Cropper) 核心交互逻辑 (局部渲染版)
// ==========================================
async function handleCropperDrop(e, taskId) {
    e.preventDefault(); e.stopPropagation();
    const srcToUse = await parseDroppedImage(e); 
    if (srcToUse) {
        const task = await getTaskDB(taskId);
        if (task) { 
            task.state.sourceBlob = srcToUse;
            task.timestamp = Date.now();
            await saveTaskDB(task); 
            renderCard(taskId); 
            showToast("✅ 成功导入待裁切素材", "success"); 
        }
    }
}

async function handleCropperUpload(input, taskId) {
    if (!input.files || input.files.length === 0) return;
    const blob = await compressImageToBlob(input.files[0], 1024);
    const task = await getTaskDB(taskId);
    if (task) { 
        task.state.sourceBlob = blob; 
        task.timestamp = Date.now();
        await saveTaskDB(task); 
        renderCard(taskId); 
    }
    input.value = '';
}

async function resetCropper(taskId) {
    const task = await getTaskDB(taskId);
    if (task) { 
        task.state.sourceBlob = null; 
        task.state.resultBlob = null; 
        await saveTaskDB(task); 
        renderCard(taskId); 
    }
}

// ✅ 替换为：带状态重置的返回重选器
async function reEditCropper(taskId) {
    const task = await getTaskDB(taskId);
    if (task) { 
        task.state.resultBlob = null; 
        
        // 🌟 补上这一行，清理掉上次裁切的残留指纹
        task.timestamp = Date.now(); 
        
        await saveTaskDB(task); 
        renderCard(taskId); 
    }
}

// ✅ 替换为：带“时间戳击穿缓存”功能的裁切生成器
async function generateCrop(taskId) {
    const task = await getTaskDB(taskId); 
    if (!task || !task.state.sourceBlob) return;
    
    const imgEl = document.getElementById(`crop-img-${taskId}`);
    const boxEl = document.getElementById(`crop-box-${taskId}`);
    if (!imgEl || !boxEl) return;

    const containerRect = imgEl.parentElement.getBoundingClientRect();
    const boxRect = boxEl.getBoundingClientRect();
    const scaleX = imgEl.naturalWidth / containerRect.width;
    const scaleY = imgEl.naturalHeight / containerRect.height;
    const cropX = (boxRect.left - containerRect.left) * scaleX;
    const cropY = (boxRect.top - containerRect.top) * scaleY;
    const cropW = boxRect.width * scaleX;
    const cropH = boxRect.height * scaleY;

    const canvas = document.createElement('canvas');
    canvas.width = cropW; canvas.height = cropH;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.src = imgEl.src;
    img.onload = async () => {
        ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        canvas.toBlob(async (blob) => {
            task.state.resultBlob = blob;
            
            // 🌟 核心修复：强制更新时间戳，让浏览器明白这是一张全新的图
            task.timestamp = Date.now(); 
            
            await saveTaskDB(task);
            renderCard(taskId); // 局部重绘
            showToast("✂️ 裁切提取完成！可按住新图片拖拽复用", "success");
        }, 'image/jpeg', 0.9);
    };
}

function bindMainConsoleDrop(slotId, stateKey) {
    const slot = document.getElementById(slotId); slot.addEventListener('dragover', (e) => { e.preventDefault(); slot.classList.add('drag-over'); }); slot.addEventListener('dragleave', (e) => { e.preventDefault(); slot.classList.remove('drag-over'); });
    slot.addEventListener('drop', async (e) => {
        e.preventDefault(); slot.classList.remove('drag-over'); const srcToUse = await parseDroppedImage(e);
        if (srcToUse) {
            if (stateKey === 'references') { 
                if (globalStore.getState().references.length < 3) globalStore.getState().references.push(srcToUse); 
                renderReferences(); 
                document.getElementById('ref-popover').style.display = 'flex'; 
            } 
            else { 
                globalStore.getState()[stateKey] = srcToUse; 
                const t = stateKey === 'firstFrame' ? 'first' : 'last'; 
                // 🌟 核心：加上 Date.now() 打破缓存
                document.getElementById(`${t}-img`).src = getBlobUrl(`temp_${t}_${Date.now()}`, srcToUse); 
                document.getElementById(`slot-${t}-box`).classList.add('has-img'); 
            }
        }
    });
}

function toggleRefPopover(e) { e.stopPropagation(); if (globalStore.getState().references.length === 0) document.getElementById('ref-file').click(); else { const p = document.getElementById('ref-popover'); p.style.display = p.style.display === 'flex' ? 'none' : 'flex'; } }

const genData = { formats: ["主播带货", "街头采访", "教程演示", "前后反差", "开箱测评", "对比实验", "剧情短剧", "冲突夸张", "用户证言", "评论区回复", "生活方式植入"], openings: ["产品痛点开场", "夸张吸睛开场", "结果先给开场", "问题提问开场", "场景代入开场", "测评对比开场", "评论群回复开场", "数字清单开场"], attributes: ["强化主播人设", "情绪张力更强", "提前带出福利", "加入真实经历", "种草干货收尾", "单一卖点更聚焦"], generals: ["节奏更快", "情绪更强", "更像真实博主", "更强结果感", "更弱广告感", "强化收尾下单", "更强调产品细节", "UGC感", "更像评论区安利"] };
function getRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
async function shuffleGenerator(id) { const task = await getTaskDB(id); if(!task) return; task.state.format = getRandom(genData.formats); task.state.opening = getRandom(genData.openings); task.state.attribute = getRandom(genData.attributes); task.state.general = getRandom(genData.generals); await saveTaskDB(task); renderCard(id); }
async function updateGeneratorState(id, key, value) { const task = await getTaskDB(id); if(task) { task.state[key] = value; await saveTaskDB(task); } }
async function applyGeneratorToPrompt(id, btnElement) {
    const task = await getTaskDB(id); if(!task) return;
    const { format, opening, attribute, general } = task.state;
    if (!format || !opening || !attribute || !general) return alert("请先点击【随机抽取】生成完整的组合");
    document.getElementById('prompt-input').value = `【带货形式】${format} | 【开头】${opening} | 【属性】${attribute} | 【通用】${general} \n\n围绕以上要求，帮我生成...`;
    document.getElementById('floating-console').classList.remove('minimized');
    const originalText = btnElement.innerHTML; btnElement.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px;">check_circle</span> 已应用`; btnElement.style.color = 'var(--success)'; setTimeout(() => { btnElement.innerHTML = originalText; btnElement.style.color = ''; }, 1500);
}
function buildGeneratorOptions(arr, selected) { let html = `<option value="" disabled ${!selected ? 'selected' : ''}>请选择...</option>`; arr.forEach(item => { html += `<option value="${item}" ${selected === item ? 'selected' : ''}>${item}</option>`; }); return html; }

function switchMode(mode) { globalStore.dispatch('SET_MODE', mode); }
function updateModel(select) { globalStore.dispatch('SET_MODEL', { value: select.value, text: select.options[select.selectedIndex].text }); }
function updateRatio(select) { globalStore.dispatch('SET_RATIO', { value: select.value, text: select.options[select.selectedIndex].text }); }
function updateEnhance(select) { globalStore.dispatch('SET_ENHANCE', { value: select.value, text: select.options[select.selectedIndex].text }); }
function updateUpsample(select) { globalStore.getState().enableUpsample = select.value === 'true'; document.getElementById('upsample-text').innerText = select.options[select.selectedIndex].text; }
function updateAutoRetry(select) { globalStore.getState().autoRetry = select.value === 'true'; document.getElementById('retry-text').innerText = select.options[select.selectedIndex].text; }

sysBus.on('UI:SWITCH_MODE', (mode) => { document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active')); document.querySelectorAll('.slot-group').forEach(s => s.classList.remove('active')); document.getElementById(`tab-${mode}`).classList.add('active'); document.getElementById(`slots-${mode}`).classList.add('active'); updateEstimatedCost(); });
sysBus.on('UI:UPDATE_MODEL_TEXT', (text) => document.getElementById('model-text').innerText = text);
sysBus.on('UI:UPDATE_RATIO', (data) => { document.getElementById('ratio-text').innerText = data.text; document.getElementById('ratio-icon').innerText = data.value === '16:9' ? 'crop_16_9' : 'crop_portrait'; });
sysBus.on('UI:UPDATE_ENHANCE_TEXT', (text) => document.getElementById('enhance-text').innerText = text);
sysBus.on('SYSTEM:MODEL_CHANGED', (modelValue) => {
    const frameTab = document.getElementById('tab-frame'), refTab = document.getElementById('tab-ref');
    if (modelValue.includes('components')) {
        if (globalStore.getState().currentMode !== 'ref') switchMode('ref');
        frameTab.style.opacity = '0.3'; frameTab.style.pointerEvents = 'none';
        refTab.style.opacity = '1'; refTab.style.pointerEvents = 'auto';
        showToast("已自动切换至【参考图 Cmp】专属多模态通道", "info");
    } else {
        if (globalStore.getState().currentMode !== 'frame') switchMode('frame');
        refTab.style.opacity = '0.3'; refTab.style.pointerEvents = 'none';
        frameTab.style.opacity = '1'; frameTab.style.pointerEvents = 'auto';
        showToast("已自动切换至【首尾帧】视频通道", "info");
    }
    updateEstimatedCost();
});

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

async function handleSingleFrame(input, type) { if (!input.files[0]) return; globalStore.getState()[type] = await compressImageToBlob(input.files[0]); const t = type === 'firstFrame' ? 'first' : 'last'; document.getElementById(`${t}-img`).src = getBlobUrl(`temp_${t}`, globalStore.getState()[type]); document.getElementById(`slot-${t}-box`).classList.add('has-img'); input.value = ''; }
function clearFrame(event, type) { if(event) { event.preventDefault(); event.stopPropagation(); } globalStore.getState()[type] = null; const t = type === 'firstFrame' ? 'first' : 'last'; document.getElementById(`slot-${t}-box`).classList.remove('has-img'); document.getElementById(`${t}-img`).src = ''; }

async function submitBatchTask() {
    const prompt = document.getElementById('prompt-input').value.trim(); if (!prompt) return alert('请填写提示词');
    const batchCount = parseInt(document.getElementById('batch-select').value), btn = document.getElementById('generate-btn');
    btn.disabled = true; btn.innerHTML = `<svg class="spinner" viewBox="0 0 50 50"><circle cx="25" cy="25" r="20"></circle></svg>`;
    
    let submitRef = [...globalStore.getState().references], submitFirst = globalStore.getState().firstFrame, submitLast = globalStore.getState().lastFrame;
    if (globalStore.getState().currentMode === 'ref') { submitFirst = null; submitLast = null; } else submitRef = [];
    const taskParams = { model: globalStore.getState().model, aspectRatio: globalStore.getState().aspectRatio, enhancePrompt: globalStore.getState().enhancePrompt, enableUpsample: globalStore.getState().enableUpsample, autoRetry: globalStore.getState().autoRetry, firstFrame: submitFirst, lastFrame: submitLast, references: submitRef };
    let promises = []; for(let i=0; i<batchCount; i++) promises.push(executeSubmission(taskParams, prompt, i));
    
    await Promise.allSettled(promises);
    btn.disabled = false; btn.innerHTML = `<span class="material-symbols-outlined">arrow_upward</span>`; updateEstimatedCost(); 
    document.getElementById('prompt-input').value = ''; 

    // 🌟 新增核心：发射后彻底清空控制台内存与缩略图
    globalStore.getState().firstFrame = null;
    globalStore.getState().lastFrame = null;
    globalStore.getState().references = [];
    document.getElementById('first-img').src = '';
    document.getElementById('last-img').src = '';
    document.getElementById('slot-first-box').classList.remove('has-img');
    document.getElementById('slot-last-box').classList.remove('has-img');
    document.getElementById('first-file').value = '';
    document.getElementById('last-file').value = '';
    renderReferences(); 
}

// 🌟 提交引擎 (高容错 ID 解析版)
async function executeSubmission(params, promptText, offsetIndex = 0) {
    try {
        const apiPayload = {
            model: params.model,
            prompt: promptText,
            aspectRatio: params.aspectRatio,
            enhancePrompt: params.enhancePrompt,
            enableUpsample: params.enableUpsample,
            firstFrame: await blobToBase64(params.firstFrame, { mode: 'network' }),
            lastFrame: await blobToBase64(params.lastFrame, { mode: 'network' }),
            references: await blobsToBase64Sequential(params.references, { mode: 'network' })
        };
        const response = await fetch(API_SUBMIT, { method: 'POST', headers: { 'Content-Type': 'application/json', 'wally123': sessionStorage.getItem('veo_admin_pwd') }, body: JSON.stringify(apiPayload) });
        
        if (response.status === 401 || response.status === 403) { handleAuthError(); throw new Error("密码错误"); }
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`API 返回异常: ${response.status} - ${errText}`);
        }
        
        const data = await response.json();
        const returnedId = data.taskId || data.id || data.task_id; // 🌟 兼容各种 n8n 返回结构
        
        if (returnedId) {
            const spawnX = (-transform.x + window.innerWidth/2 - 170) / transform.scale + (offsetIndex * 360), spawnY = (-transform.y + window.innerHeight/2 - 150) / transform.scale + (offsetIndex * 40);
            let displayModelName = params.model.replace('veo3.1', 'Veo 3.1').replace('-components', ' Cmp').replace('-4k', ' 4K').toUpperCase();
            if (params.model.includes('lite')) displayModelName = '极速特惠版'; 
            
            const newTask = { id: returnedId, prompt: promptText, modelStr: displayModelName, modelVal: params.model, ratio: params.aspectRatio, autoRetry: params.autoRetry, retryCount: 0, rawImages: { firstFrame: params.firstFrame, lastFrame: params.lastFrame, references: params.references || [] }, mode: params.references && params.references.length > 0 ? 'ref' : 'frame', status: 'processing', progress: null, timestamp: Date.now(), time: new Date().toLocaleTimeString('zh-CN', {hour: '2-digit', minute:'2-digit'}), videoUrl: null, x: spawnX, y: spawnY, isBilled: false };
            await saveTaskDB(newTask); await renderBoard(); 
        }
    } catch (error) { 
        console.error('任务提交失败:', error); 
        showToast('视频生成提交失败，请检查网络或余额。', 'error');
    }
}

async function retryTask(taskId, btnElement) {
    if (activeRetries.has(taskId)) return; activeRetries.add(taskId);
    if (btnElement) { btnElement.disabled = true; btnElement.innerHTML = `<svg class="spinner" viewBox="0 0 50 50" style="width:18px;height:18px;stroke:var(--text-sub);"><circle cx="25" cy="25" r="20"></circle></svg>`; }
    const task = await getTaskDB(taskId); if(!task) { activeRetries.delete(taskId); return; }
    try {
        const apiPayload = {
            model: task.modelVal,
            prompt: task.prompt,
            aspectRatio: task.ratio,
            enhancePrompt: true,
            enableUpsample: false,
            firstFrame: await blobToBase64(task.rawImages.firstFrame, { mode: 'network' }),
            lastFrame: await blobToBase64(task.rawImages.lastFrame, { mode: 'network' }),
            references: await blobsToBase64Sequential((task.rawImages.references || []), { mode: 'network' })
        };
        const response = await fetch(API_SUBMIT, { method: 'POST', headers: { 'Content-Type': 'application/json', 'wally123': sessionStorage.getItem('veo_admin_pwd') }, body: JSON.stringify(apiPayload) });
        if (response.status === 401 || response.status === 403) { handleAuthError(); throw new Error("密码错误"); }
        if (!response.ok) throw new Error("API 异常");
        const data = await response.json();
        
        const returnedId = data.taskId || data.id || data.task_id;
        if (returnedId) { 
            clearTaskPolling(taskId);
            await deleteTaskDB(taskId); 
            task.id = returnedId; task.status = 'processing'; task.progress = null; task.retryCount = (task.retryCount || 0) + 1; task.timestamp = Date.now(); task.time = new Date().toLocaleTimeString('zh-CN', {hour: '2-digit', minute:'2-digit'}); task.isBilled = false; 
            await saveTaskDB(task); activeRetries.delete(taskId); await renderBoard(); 
        } else throw new Error("无返回 ID");
    } catch (error) { task.status = 'failed'; task.autoRetry = false; await saveTaskDB(task); activeRetries.delete(taskId); renderCard(taskId); }
}

// 🌟 轮询引擎 (高容错状态解析版)
function startTaskPolling(taskId) {
    clearTaskPolling(taskId, false);
    let attempts = 0;
    let errorCount = 0;
    const maxAttempts = 240;
    const maxConsecutiveErrors = 20;
    const scheduleNextPoll = (delayMs = 15000) => {
        const safeDelay = Math.max(500, toFiniteNumber(delayMs, 15000));
        const timerId = setTimeout(() => {
            poll().catch(() => {});
        }, safeDelay);
        taskPollTimers.set(taskId, timerId);
    };
    const poll = async () => {
        taskPollTimers.delete(taskId);
        attempts++;
        try {
            const task = await getTaskDB(taskId); if (!task) { clearTaskPolling(taskId); return; }
            // 仅视频任务使用该轮询器，防止生图/工具卡在刷新后被误判失败。
            if (task.type) { clearTaskPolling(taskId); return; }
            if (!task.modelVal) { clearTaskPolling(taskId); return; }
            const currentPwd = sessionStorage.getItem('veo_admin_pwd');
            if (!currentPwd) { scheduleNextPoll(2000); return; } 

            const controller = new AbortController();
            taskPollControllers.set(taskId, controller);
            const response = await fetch(API_POLL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'wally123': currentPwd },
                body: JSON.stringify({ taskId: taskId, model: task.modelVal }),
                signal: controller.signal
            });
            taskPollControllers.delete(taskId);
            if (response.status === 401 || response.status === 403) { clearTaskPolling(taskId); handleAuthError(); return; }
            if (!response.ok) throw new Error("API 异常");
            const data = await response.json();
            errorCount = 0;
            
            // 🌟 强力兼容各种 n8n 的字段名与状态名
            const currentStatus = (data.status || data.state || 'processing').toLowerCase();
            const currentVideoUrl = data.videoUrl || data.video_url || data.url;

            if (data && (currentStatus === 'success' || currentStatus === 'completed' || currentStatus === 'succeeded') && currentVideoUrl) { 
                clearTaskPolling(taskId); task.status = 'success'; task.videoUrl = currentVideoUrl; 
                if (!task.isBilled) {
                    let cost = 0.35, detailDesc = "Veo 3.1 (首尾帧)";
                    if (task.modelVal === 'veo3.1-components') { cost = 0.35; detailDesc = "Veo 3.1 Cmp (参考图)"; } 
                    else if (task.modelVal === 'veo3.1-4k') { cost = 0.50; detailDesc = "Veo 3.1 4K (首尾帧)"; } 
                    else if (task.modelVal === 'veo3.1-components-4k') { cost = 0.50; detailDesc = "Veo 3.1 Cmp 4K (参考图)"; } 
                    else if (task.modelVal.includes('lite')) { cost = 0.20; detailDesc = "极速特惠版模型"; }
                    
                    await addBillingRecord({ id: 'bill_' + task.id, taskId: task.id, type: 'video', cost: cost, detail: detailDesc }); 
                    task.isBilled = true; 
                    updateBillingUI();
                }
                await saveTaskDB(task); renderCard(taskId); return; 
            }
            if (data && (currentStatus === 'failed' || currentStatus === 'error' || currentStatus === 'canceled' || currentStatus === 'rejected')) { 
                clearTaskPolling(taskId); 
                if (task.autoRetry) retryTask(task.id, null); 
                else { task.status = 'failed'; await saveTaskDB(task); renderCard(taskId); } 
                return; 
            }
            if (data && (currentStatus === 'processing' || currentStatus === 'pending' || currentStatus === 'queued' || currentStatus === 'in_progress') && data.progress && task.progress !== data.progress) { 
                task.progress = data.progress; await saveTaskDB(task); renderCard(taskId); 
            }
            
            if (attempts < maxAttempts) scheduleNextPoll(15000);
            else {
                clearTaskPolling(taskId);
                if (task.autoRetry) retryTask(task.id, null);
                else { task.status = 'failed'; await saveTaskDB(task); renderCard(taskId); }
            }
        } catch (error) {
            if (error && error.name === 'AbortError') return;
            errorCount++;
            taskPollControllers.delete(taskId);
            const task = await getTaskDB(taskId);
            if (!task) { clearTaskPolling(taskId); return; }
            if (errorCount >= maxConsecutiveErrors || attempts >= maxAttempts) {
                clearTaskPolling(taskId);
                if (task.autoRetry) retryTask(task.id, null);
                else { task.status = 'failed'; await saveTaskDB(task); renderCard(taskId); }
                return;
            }
            scheduleNextPoll(15000);
        }
    };
    poll();
}

async function reuseTask(taskId) {
    const task = await getTaskDB(taskId); if(!task) return;
    document.getElementById('prompt-input').value = task.prompt || '';
    if (task.modelVal) { const modelSelect = document.getElementById('model-select'); if(modelSelect.querySelector(`option[value="${task.modelVal}"]`)) { modelSelect.value = task.modelVal; updateModel(modelSelect); } }
    if (task.ratio) { document.getElementById('ratio-select').value = task.ratio; updateRatio(document.getElementById('ratio-select')); }
    if (task.rawImages) {
        globalStore.getState().firstFrame = task.rawImages.firstFrame || null; globalStore.getState().lastFrame = task.rawImages.lastFrame || null; globalStore.getState().references = [...(task.rawImages.references || [])]; switchMode(task.mode || 'ref');
        if (globalStore.getState().firstFrame) { document.getElementById('first-img').src = getBlobUrl('temp_first', globalStore.getState().firstFrame); document.getElementById('slot-first-box').classList.add('has-img'); } else clearFrame(null, 'firstFrame');
        if (globalStore.getState().lastFrame) { document.getElementById('last-img').src = getBlobUrl('temp_last', globalStore.getState().lastFrame); document.getElementById('slot-last-box').classList.add('has-img'); } else clearFrame(null, 'lastFrame');
        renderReferences();
    }
    document.getElementById('floating-console').classList.remove('minimized'); document.getElementById('prompt-input').focus();
}

function generateCardHTML(task) {
    if (task.type === 'frame') {
        return `
        <div class="frame-header" onmousedown="event.stopPropagation()">
            <span class="material-symbols-outlined" style="font-size:18px;">view_cofy</span>
            <input type="text" class="frame-title-input" value="${task.title || ''}" placeholder="未命名项目组" onchange="updateTaskField('${task.id}', 'title', this.value)">
            <div style="display:flex; gap: 4px; margin-left: auto;">
                <button class="frame-btn" onclick="toggleFrameCollapse('${task.id}')" data-tip="折叠/展开此项目收纳"><span class="material-symbols-outlined" style="font-size:22px;">${task.isCollapsed ? 'expand_more' : 'expand_less'}</span></button>
                <button class="frame-btn" onclick="removeFrame('${task.id}')" data-tip="解散该项目组"><span class="material-symbols-outlined" style="font-size:18px;">close</span></button>
            </div>
        </div>
        ${!task.isCollapsed ? `<div class="frame-resize-handle" data-tip="按住拖拽调节框架大小"></div>` : ''}
        `;
    }
    if (task.type === 'note') return `<div class="card-header"><span style="color:#ffca28; display:flex; align-items:center; gap:4px;"><span class="material-symbols-outlined" style="font-size:14px;">sticky_note_2</span> 即时便签</span><button onclick="removeTask('${task.id}')" data-tip="删除此便签" style="background:transparent; border:none; color:#ffca28; cursor:pointer; opacity:0.6;"><span class="material-symbols-outlined" style="font-size:16px;">close</span></button></div><textarea oninput="updateNoteText('${task.id}', this.value)" placeholder="在此输入灵感、提示词或分组备注...">${task.text || ''}</textarea>`;
    if (task.type === 'tool_generator') return `<div class="card-header"><span style="color:#818cf8; display:flex; align-items:center; gap:4px;"><span class="material-symbols-outlined" style="font-size:14px;">auto_awesome</span> 社媒灵感生成器</span><button onclick="removeTask('${task.id}')" data-tip="删除该组件" style="background:transparent; border:none; color:var(--text-sub); cursor:pointer;"><span class="material-symbols-outlined" style="font-size:16px;">close</span></button></div><div class="gen-grid"><div class="gen-item"><label><span class="material-symbols-outlined" style="font-size:12px;">video_camera_front</span> 带货形式</label><select onchange="updateGeneratorState('${task.id}', 'format', this.value)">${buildGeneratorOptions(genData.formats, task.state.format)}</select></div><div class="gen-item"><label><span class="material-symbols-outlined" style="font-size:12px;">play_circle</span> 开头节奏</label><select onchange="updateGeneratorState('${task.id}', 'opening', this.value)">${buildGeneratorOptions(genData.openings, task.state.opening)}</select></div><div class="gen-item"><label><span class="material-symbols-outlined" style="font-size:12px;">sell</span> 内容属性</label><select onchange="updateGeneratorState('${task.id}', 'attribute', this.value)">${buildGeneratorOptions(genData.attributes, task.state.attribute)}</select></div><div class="gen-item"><label><span class="material-symbols-outlined" style="font-size:12px;">magic_button</span> 通用调性</label><select onchange="updateGeneratorState('${task.id}', 'general', this.value)">${buildGeneratorOptions(genData.generals, task.state.general)}</select></div></div><div class="gen-actions"><button class="gen-btn shuffle" onclick="shuffleGenerator('${task.id}')" data-tip="摇骰子：随机抽取一套爆款剧本组合"><span class="material-symbols-outlined" style="font-size:16px;">shuffle</span> 随机抽取</button><button class="gen-btn copy" onclick="applyGeneratorToPrompt('${task.id}', this)" data-tip="一键将结构化剧本反填至底部 Prompt 框"><span class="material-symbols-outlined" style="font-size:16px;">move_down</span> 应用至控制台</button></div>`;

    if (task.type === 'tool_image_gen') {
        ensureImgGenState(task);
        const isProcessing = task.status === 'processing';
        const isFailed = task.status === 'failed';
        const isPro = task.state.version === 'pro';
        const isChannel2 = task.state.channel === 'channel_2';
        const previewCollapsed = task.state.previewCollapsed === true;
        const resolvedSize = resolveImgGenSize(task.state);
        const currentCost = isPro ? 'PRO' : (isChannel2 ? '0.06' : '0.084');
        const resultBlobs = Array.isArray(task.state.resultBlobs) && task.state.resultBlobs.length > 0
            ? task.state.resultBlobs
            : (task.state.resultBlob ? [task.state.resultBlob] : []);
        const hasResult = task.status === 'success' && resultBlobs.length > 0;

        let slotsHtml = task.state.images.map((img, i) => `<div class="img-gen-slot"><img src="${getBlobUrl(task.id+'_img_'+i+'_'+(task.timestamp||''), img)}"><div class="popover-rm-btn remove-badge" onclick="removeGenImage(event, '${task.id}', ${i})">×</div></div>`).join('');
        if (task.state.images.length < 5) {
            slotsHtml += `<div class="img-gen-slot img-gen-slot-add" id="img-gen-zone-${task.id}" data-tip="点击上传或从画布拖入垫图 (最多5张)" onclick="document.getElementById('file-input-${task.id}').click()"><span class="material-symbols-outlined">add_photo_alternate</span><input type="file" id="file-input-${task.id}" style="display:none;" multiple accept="image/*" onchange="handleGenImageUpload(this, '${task.id}')" onclick="event.stopPropagation()"></div>`;
        }

        let btnContent = `<span class="material-symbols-outlined" style="font-size:18px;">draw</span> ${isPro ? '专业生成' : '试用生成'} <span class="img-gen-btn-price">${isPro ? currentCost : `￥${currentCost}`}</span> ${task.state.costTime ? `<span class="img-gen-runtime">⏱ ${task.state.costTime}s</span>` : ''}`;
        const retryTxt = task.retryCount ? ` (重试 ${task.retryCount})` : '';
        if (isProcessing) {
            btnContent = `
                <div class="img-gen-processing-wrap">
                    <div class="img-gen-processing-head">
                        <div class="img-gen-processing-left">
                            <svg class="spinner" viewBox="0 0 50 50" style="width:14px;height:14px;stroke:currentColor;"><circle cx="25" cy="25" r="20"></circle></svg>
                            生成中...${retryTxt}
                        </div>
                        <div class="veo-dynamic-timer img-gen-timer" data-start-time="${task.state.startTime || Date.now()}">00:00</div>
                    </div>
                    <div class="img-gen-progress"><div class="img-gen-progress-bar"></div></div>
                </div>
            `;
        }
        if (isFailed) btnContent = `<span class="material-symbols-outlined" style="font-size:18px;">refresh</span> 失败，点击重试 ${task.state.costTime ? `(在 ${task.state.costTime}s 处断开)` : ''}`;

        let customRatioHtml = '';
        const showCustomRatio = (!isPro && task.state.trialRatio === 'custom') || (isPro && task.state.proRatio === 'custom');
        if (showCustomRatio) {
            const w = task.state.customW || 9;
            const h = task.state.customH || 16;
            customRatioHtml = `
            <div class="img-gen-custom-ratio">
                <span class="material-symbols-outlined" style="font-size:14px; color:var(--accent);">aspect_ratio</span>
                <span class="img-gen-custom-label">比例</span>
                <input type="number" class="img-gen-select img-gen-ratio-input" value="${w}" onchange="updateImgGenState('${task.id}', 'customW', this.value)">
                <span style="color:var(--text-sub);">:</span>
                <input type="number" class="img-gen-select img-gen-ratio-input" value="${h}" onchange="updateImgGenState('${task.id}', 'customH', this.value)">
                <span class="img-gen-size-hint">输出尺寸: ${resolvedSize}</span>
            </div>`;
        }

        const proControlsHtml = isPro
            ? `<div class="img-gen-controls img-gen-controls-pro">
            <select class="img-gen-select" onchange="updateImgGenState('${task.id}', 'proRatio', this.value)" data-tip="专业版：先选构图比例">
                <option value="1:1" ${task.state.proRatio==='1:1'?'selected':''}>比例 1:1</option>
                <option value="3:2" ${task.state.proRatio==='3:2'?'selected':''}>比例 3:2</option>
                <option value="2:3" ${task.state.proRatio==='2:3'?'selected':''}>比例 2:3</option>
                <option value="16:9" ${task.state.proRatio==='16:9'?'selected':''}>比例 16:9</option>
                <option value="9:16" ${task.state.proRatio==='9:16'?'selected':''}>比例 9:16</option>
                <option value="custom" ${task.state.proRatio==='custom'?'selected':''}>自定义比例</option>
                <option value="auto" ${task.state.proRatio==='auto'?'selected':''}>Auto 比例</option>
            </select>
            <select class="img-gen-select" onchange="updateImgGenState('${task.id}', 'proResolution', this.value)" data-tip="专业版：再选分辨率档位">
                <option value="1k" ${task.state.proResolution==='1k'?'selected':''}>1K</option>
                <option value="2k" ${task.state.proResolution==='2k'?'selected':''}>2K</option>
                <option value="4k" ${task.state.proResolution==='4k'?'selected':''}>4K</option>
            </select>
            <select class="img-gen-select" onchange="updateImgGenState('${task.id}', 'providerSort', this.value)" data-tip="专业版：质量优先或速度优先">
                <option value="quality" ${task.state.providerSort==='quality'?'selected':''}>质量优先</option>
                <option value="speed" ${task.state.providerSort==='speed'?'selected':''}>速度优先</option>
            </select>
            <select class="img-gen-select" onchange="updateImgGenState('${task.id}', 'quality', this.value)" data-tip="专业版：输出质量">
                <option value="auto" ${task.state.quality==='auto'?'selected':''}>自动质量</option>
                <option value="high" ${task.state.quality==='high'?'selected':''}>高质量</option>
                <option value="medium" ${task.state.quality==='medium'?'selected':''}>中质量</option>
                <option value="low" ${task.state.quality==='low'?'selected':''}>低质量</option>
            </select>
            <select class="img-gen-select" onchange="updateImgGenState('${task.id}', 'format', this.value)" data-tip="专业版：输出格式">
                <option value="png" ${task.state.format==='png'?'selected':''}>PNG</option>
                <option value="jpeg" ${task.state.format==='jpeg'?'selected':''}>JPEG</option>
                <option value="webp" ${task.state.format==='webp'?'selected':''}>WEBP</option>
            </select>
            <select class="img-gen-select" onchange="updateImgGenState('${task.id}', 'n', this.value)" data-tip="专业版：目标张数">
                <option value="1" ${String(task.state.n)==='1'?'selected':''}>1张</option>
                <option value="2" ${String(task.state.n)==='2'?'selected':''}>2张</option>
                <option value="3" ${String(task.state.n)==='3'?'selected':''}>3张</option>
                <option value="4" ${String(task.state.n)==='4'?'selected':''}>4张</option>
                <option value="5" ${String(task.state.n)==='5'?'selected':''}>5张</option>
                <option value="6" ${String(task.state.n)==='6'?'selected':''}>6张</option>
                <option value="7" ${String(task.state.n)==='7'?'selected':''}>7张</option>
                <option value="8" ${String(task.state.n)==='8'?'selected':''}>8张</option>
                <option value="9" ${String(task.state.n)==='9'?'selected':''}>9张</option>
                <option value="10" ${String(task.state.n)==='10'?'selected':''}>10张</option>
            </select>
        </div>
        <div class="img-gen-controls img-gen-controls-pro">
            <select class="img-gen-select" onchange="updateImgGenState('${task.id}', 'background', this.value)" data-tip="专业版：背景模式">
                <option value="auto" ${task.state.background==='auto'?'selected':''}>背景 auto</option>
                <option value="transparent" ${task.state.background==='transparent'?'selected':''}>背景 transparent</option>
                <option value="opaque" ${task.state.background==='opaque'?'selected':''}>背景 opaque</option>
            </select>
            <select class="img-gen-select" onchange="updateImgGenState('${task.id}', 'moderation', this.value)" data-tip="专业版：审核级别">
                <option value="auto" ${task.state.moderation==='auto'?'selected':''}>审核 auto</option>
                <option value="low" ${task.state.moderation==='low'?'selected':''}>审核 low</option>
            </select>
            <div class="img-gen-size-chip">输出尺寸: ${resolvedSize}</div>
        </div>`
            : `<div class="img-gen-controls">
            <select class="img-gen-select" onchange="updateImgGenState('${task.id}', 'trialRatio', this.value)" data-tip="试用版：分辨率固定 1K，仅按比例调整构图">
                <option value="1:1" ${task.state.trialRatio==='1:1'?'selected':''}>比例 1:1</option>
                <option value="3:2" ${task.state.trialRatio==='3:2'?'selected':''}>比例 3:2</option>
                <option value="2:3" ${task.state.trialRatio==='2:3'?'selected':''}>比例 2:3</option>
                <option value="16:9" ${task.state.trialRatio==='16:9'?'selected':''}>比例 16:9</option>
                <option value="9:16" ${task.state.trialRatio==='9:16'?'selected':''}>比例 9:16</option>
                <option value="custom" ${task.state.trialRatio==='custom'?'selected':''}>自定义比例</option>
            </select>
            <select class="img-gen-select" disabled data-tip="试用版分辨率固定为 1K">
                <option selected>分辨率 1K (锁定)</option>
            </select>
        </div>`;

        const previewGridHtml = hasResult
            ? `<div class="img-gen-preview-grid">${
                resultBlobs.map((blob, idx) => `<div class="img-gen-preview-item"><img src="${getBlobUrl(task.id+'_res_'+idx+'_'+(task.timestamp||''), blob)}" draggable="true" ondragstart="event.dataTransfer.setData('application/json', JSON.stringify({taskId: '${task.id}', type: 'gen_result', index: ${idx}}))" ondblclick="openLightbox(this.src)" data-tip="双击全屏高清预览，按住可拖动复用"></div>`).join('')
            }</div>`
            : '';

        let previewPlaceholderHtml = '';
        if (!hasResult) {
            if (isProcessing) {
                previewPlaceholderHtml = `<div class="img-gen-preview-placeholder is-processing"><svg class="spinner" viewBox="0 0 50 50" style="width:30px;height:30px;stroke:currentColor;"><circle cx="25" cy="25" r="20"></circle></svg><div class="img-gen-preview-placeholder-title">正在生成图像...</div><div class="img-gen-preview-placeholder-sub">生成动效已绑定预览框</div></div>`;
            } else if (isFailed) {
                previewPlaceholderHtml = `<div class="img-gen-preview-placeholder is-failed"><span class="material-symbols-outlined" style="font-size:28px;">warning</span><div class="img-gen-preview-placeholder-title">本次生成失败</div><div class="img-gen-preview-placeholder-sub">请调整提示词或参数后重试</div></div>`;
            } else {
                previewPlaceholderHtml = `<div class="img-gen-preview-placeholder"><span class="material-symbols-outlined" style="font-size:30px;">play_circle</span><div class="img-gen-preview-placeholder-title">点击生成开始预览</div><div class="img-gen-preview-placeholder-sub">输出结果将在此实时展示</div></div>`;
            }
        }

        const dockToggleIcon = previewCollapsed ? 'keyboard_arrow_right' : 'keyboard_arrow_left';
        const dockToggleTip = previewCollapsed ? '展开右侧预览面板' : '收纳右侧预览面板';
        const panelToggleIcon = 'keyboard_arrow_right';
        const panelToggleTip = '收纳预览面板';

        return `<div class="card-header"><span style="color:var(--accent); display:flex; align-items:center; gap:4px;"><span class="material-symbols-outlined" style="font-size:14px;">brush</span> AI 多模生图</span><button onclick="removeTask('${task.id}')" data-tip="删除该组件" style="background:transparent; border:none; color:var(--text-sub); cursor:pointer;"><span class="material-symbols-outlined" style="font-size:16px;">close</span></button></div>
        <div class="img-gen-shell">
            <div class="img-gen-split ${previewCollapsed ? 'preview-collapsed' : ''}">
                <div class="img-gen-left">
                    <div class="img-gen-panel-head">
                        <span class="img-gen-panel-title">INPUT</span>
                        <button class="img-gen-dock-toggle" onclick="toggleImgGenPreviewPanel(event, '${task.id}')" data-tip="${dockToggleTip}">
                            <span class="material-symbols-outlined" style="font-size:16px;">${dockToggleIcon}</span>
                        </button>
                    </div>
                    <div class="img-gen-input-body">
                        <div class="img-gen-statusbar">
                            <span class="img-gen-status-badge ${isPro ? 'is-pro' : 'is-trial'}">${isPro ? 'PRO · GPT IMAGE 2' : 'TRIAL · LEGACY'}</span>
                            <span class="img-gen-size-chip">${isPro ? `${(task.state.proRatio === 'custom') ? `${task.state.customW}:${task.state.customH}` : task.state.proRatio} / ${(task.state.proResolution || '1k').toUpperCase()}` : `${(task.state.trialRatio === 'custom') ? `${task.state.customW}:${task.state.customH}` : (task.state.trialRatio || '1:1')} / 1K`}</span>
                        </div>
                        <div class="img-gen-slots" ondragover="event.preventDefault(); document.getElementById('img-gen-zone-${task.id}')?.classList.add('drag-over');" ondragleave="document.getElementById('img-gen-zone-${task.id}')?.classList.remove('drag-over');" ondrop="handleGenImageDrop(event, '${task.id}')">${slotsHtml}</div>
                        <div class="img-gen-upload-note">拖拽或点击添加垫图，最多 5 张</div>
                        <div class="img-gen-controls">
                            <select class="img-gen-select" onchange="updateImgGenState('${task.id}', 'version', this.value)" data-tip="试用版走旧模型双通道，专业版走 GPT Image 2">
                                <option value="trial" ${task.state.version==='trial'?'selected':''}>试用版</option>
                                <option value="pro" ${task.state.version==='pro'?'selected':''}>专业版 GPT Image 2</option>
                            </select>
                            <select class="img-gen-select" onchange="updateImgGenState('${task.id}', 'channel', this.value)" style="flex: 1.5; ${isPro ? 'opacity:0.45;' : ''}" ${isPro ? 'disabled' : ''} data-tip="试用版可切换双通道，专业版固定走 GPT 路由">
                                <option value="channel_1" ${task.state.channel==='channel_1' || !task.state.channel ? 'selected' : ''}>试用通道 1 (主)</option>
                                <option value="channel_2" ${task.state.channel==='channel_2'?'selected':''}>试用通道 2 (备)</option>
                            </select>
                            <select class="img-gen-select" onchange="updateImgGenState('${task.id}', 'autoRetry', this.value === 'true')" data-tip="遇网络异常是否自动重试 (最多3次)">
                                <option value="false" ${!task.state.autoRetry?'selected':''}>单次</option>
                                <option value="true" ${task.state.autoRetry?'selected':''}>自动重试</option>
                            </select>
                        </div>
                        ${proControlsHtml}
                        ${customRatioHtml}
                        <textarea class="img-gen-prompt" onchange="updateImgGenState('${task.id}', 'prompt', this.value)" placeholder="输入画面提示词，可垫入 1-5 张图配合描述...">${task.state.prompt||''}</textarea>
                        <button class="img-gen-btn ${isProcessing ? 'is-running' : ''}" onclick="submitImgGen('${task.id}')" ${isProcessing?'disabled':''} style="${isFailed ? 'background: var(--danger);' : ''}">${btnContent}</button>
                    </div>
                </div>
                <aside class="img-gen-preview-panel ${previewCollapsed ? 'is-collapsed' : ''} ${isProcessing ? 'is-running' : ''}">
                    <div class="img-gen-preview-head">
                        <div class="img-gen-preview-head-main">
                            <span class="img-gen-preview-title">OUTPUT</span>
                            <div class="img-gen-preview-tabs">
                                <button class="img-gen-preview-tab is-active" type="button">Preview</button>
                                <button class="img-gen-preview-tab" type="button" disabled>JSON</button>
                            </div>
                        </div>
                        <button class="img-gen-preview-toggle" onclick="toggleImgGenPreviewPanel(event, '${task.id}')" data-tip="${panelToggleTip}">
                            <span class="material-symbols-outlined" style="font-size:16px;">${panelToggleIcon}</span>
                        </button>
                    </div>
                    <div class="img-gen-preview-body">
                        ${previewGridHtml || previewPlaceholderHtml}
                    </div>
                </aside>
            </div>
        </div>`;
    }

    if (task.type === 'tool_cropper') {
        const hasSource = !!task.state.sourceBlob, hasResult = !!task.state.resultBlob; let contentHtml = '';
        if (!hasSource) contentHtml = `<div class="img-slot" id="crop-zone-${task.id}" style="width:100%; height:200px; border-radius:8px;" data-tip="点击上传或从画布拖入素材图片" onclick="document.getElementById('crop-file-${task.id}').click()"><span class="material-symbols-outlined" style="font-size:32px; color:var(--text-sub);">add_photo_alternate</span><span style="margin-top:8px;">导入素材图片</span><input type="file" id="crop-file-${task.id}" style="display:none;" accept="image/*" onchange="handleCropperUpload(this, '${task.id}')"></div>`;
        else if (!hasResult) {
            const p = task.state.cropParams;
            contentHtml = `<div class="cropper-workspace" id="crop-workspace-${task.id}"><img id="crop-img-${task.id}" src="${getBlobUrl(task.id+'_src_'+(task.timestamp || ''), task.state.sourceBlob)}"><div class="crop-box" id="crop-box-${task.id}" data-task-id="${task.id}" style="left:${p.left}%; top:${p.top}%; width:${p.width}%; height:${p.height}%;"><div class="crop-grid"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div><div class="crop-handle ch-nw" data-dir="nw"></div><div class="crop-handle ch-ne" data-dir="ne"></div><div class="crop-handle ch-sw" data-dir="sw"></div><div class="crop-handle ch-se" data-dir="se"></div></div></div><div style="display:flex; gap:8px;"><button class="img-gen-btn" style="flex:1; background:var(--surface-hover); color:var(--text-main); margin:0;" onclick="resetCropper('${task.id}')">重置图片</button><button class="img-gen-btn" style="flex:2; background:var(--success); margin:0;" onclick="generateCrop('${task.id}')"><span class="material-symbols-outlined" style="font-size:16px;">crop</span> 确认裁切提取</button></div>`;
        } else { contentHtml = `<div class="img-gen-result" style="border:none; border-radius:8px; background:transparent; min-height: unset;"><img src="${getBlobUrl(task.id+'_res_'+(task.timestamp||''), task.state.resultBlob)}" draggable="true" ondragstart="event.dataTransfer.setData('application/json', JSON.stringify({taskId: '${task.id}', type: 'crop_result'}))" data-tip="按住拖拽，送至其他卡片组件复用" style="border-radius: 8px; border: 1px solid rgba(255,255,255,0.2);"></div><button class="img-gen-btn" style="width:100%; margin: 0; background:var(--surface-hover); color:var(--text-main);" onclick="reEditCropper('${task.id}')"><span class="material-symbols-outlined" style="font-size:16px;">history</span> 返回重新调整框选区</button>`; }
        return `<div class="card-header"><span style="color:var(--success); display:flex; align-items:center; gap:4px;"><span class="material-symbols-outlined" style="font-size:14px;">crop</span> 局部裁切器</span><button onclick="removeTask('${task.id}')" style="background:transparent; border:none; color:var(--text-sub); cursor:pointer;"><span class="material-symbols-outlined" style="font-size:16px;">close</span></button></div><div style="padding: 0 12px 12px 12px; display:flex; flex-direction:column; gap:12px;" ondragover="event.preventDefault();" ondrop="handleCropperDrop(event, '${task.id}')">${contentHtml}</div>`;
    }

    let statusBadge = '', mediaHtml = ''; const thumbImg = task.rawImages && (task.rawImages.firstFrame || (task.rawImages.references && task.rawImages.references[0])); const thumbUrl = getBlobUrl(task.id + '_thumb', thumbImg);
    if (task.status === 'processing') { 
        const retryTxt = task.retryCount ? ` (重试 ${task.retryCount})` : ''; statusBadge = `<span class="status-badge processing">生成中...${retryTxt}</span>`; 
        let progressHtml = `
            <div class="cyber-scanner-box"><div class="cyber-scanner-line"></div></div>
            <div style="font-size: 11px; color: var(--accent); margin-top: 8px; font-weight: 600; font-family: monospace; letter-spacing: 1px;">MODELS ENGAGED...</div>
        `;
        mediaHtml = `<div class="card-media" style="aspect-ratio: ${task.ratio.replace(':','/')}; padding: 20px;"><div style="display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%; color: var(--accent);"><svg class="spinner" viewBox="0 0 50 50" style="width:36px;height:36px;"><circle cx="25" cy="25" r="20"></circle></svg><div class="generating-text" style="margin-top: 12px;">视频生成中...</div>${progressHtml}</div></div>`; 
    } else if (task.status === 'failed') { statusBadge = `<span class="status-badge failed">失败</span>`; mediaHtml = `<div class="card-media" style="background:#2c2c2e; color:var(--danger); aspect-ratio: ${task.ratio.replace(':','/')}; font-size:12px;">生成超时或失败</div>`; 
    } else { statusBadge = `<span class="status-badge success">已完成</span>`; mediaHtml = `<div class="card-media" data-tip="双击全屏播放视频"><video src="${task.videoUrl}" preload="none" poster="${thumbUrl || ''}" controls playsinline ondblclick="this.requestFullscreen()"></video></div>`; }
    
    const thumbHtml = thumbImg ? `<img src="${thumbUrl}" draggable="true" ondragstart="event.dataTransfer.setData('application/json', JSON.stringify({taskId: '${task.id}', type: 'thumb'}))" ondblclick="openLightbox(this.src)" data-tip="双击全屏高清预览，按住可拖动复用">` : `<div style="width:44px;height:44px;border-radius:4px;background:#2c2c2e;display:flex;align-items:center;justify-content:center;"><span class="material-symbols-outlined" style="color:#666;">image</span></div>`;
    return `<div class="card-header"><div class="time-model"><span class="material-symbols-outlined" style="font-size: 14px;">schedule</span> ${task.time} · ${task.modelStr}</div>${statusBadge}</div><div class="card-prompt">${thumbHtml}<p title="${task.prompt}">${task.prompt}</p></div><div class="card-tags"><span class="card-tag">${task.ratio}</span>${task.autoRetry ? `<span class="card-tag" style="color:var(--success); border: 1px solid var(--success);">已开挂机重试</span>` : ''}</div>${mediaHtml}<div class="card-actions">${task.status === 'success' ? `<button onclick="downloadVideo('${task.videoUrl}')" data-tip="下载此视频到本地"><span class="material-symbols-outlined">download</span></button>` : ''}${task.status === 'failed' ? `<button class="retry-btn" onclick="retryTask('${task.id}', this)" data-tip="原地重新发起此任务"><span class="material-symbols-outlined">refresh</span></button>` : ''}<button class="reuse-btn" onclick="reuseTask('${task.id}')" data-tip="提取该任务的所有图文参数，反填至底部控制台"><span class="material-symbols-outlined">edit_note</span></button><button onclick="removeTask('${task.id}')" data-tip="删除此生成记录"><span class="material-symbols-outlined">delete</span></button></div>`;
}

// 🌟 初次挂载与排版专用的全局刷新函数
async function renderBoard() {
    const tasks = await getAllTasksDB(); const boardTasks = tasks.filter(t => t.type !== 'local_image'), boardTaskIds = new Set(boardTasks.map(t => 'card-' + t.id));
    const existingCards = Array.from(board.children); existingCards.forEach(card => { if (!boardTaskIds.has(card.id)) card.remove(); });
    
    const frameMap = {}; boardTasks.filter(t => t.type === 'frame').forEach(f => frameMap[f.id] = f);

    boardTasks.forEach(task => {
        normalizeTaskPosition(task);
        let cardEl = document.getElementById('card-' + task.id);
        const currentImgLen = (task.state && task.state.images) ? task.state.images.length : 0, currentProgress = task.progress || '', cropSrc = task.state && task.state.sourceBlob ? 'hasSrc' : 'noSrc', cropRes = task.state && task.state.resultBlob ? 'hasRes' : 'noRes', currentChannel = (task.state && task.state.channel) ? task.state.channel : 'channel_1', currentVersion = (task.state && task.state.version) ? task.state.version : 'trial', currentPreviewCollapsed = (task.type === 'tool_image_gen' && task.state) ? String(task.state.previewCollapsed === true) : 'na'; 
        
        let isHiddenInFrame = false;
        if (task.parentId && frameMap[task.parentId] && frameMap[task.parentId].isCollapsed) isHiddenInFrame = true;

        if (!cardEl) {
            cardEl = document.createElement('div'); cardEl.id = 'card-' + task.id;
            
            if (task.type === 'frame') {
                cardEl.className = 'frame-box';
                cardEl.style.width = `${task.width}px`;
                cardEl.style.height = task.isCollapsed ? '0px' : `${task.height}px`;
                if (task.isCollapsed) cardEl.style.border = 'none';
            }
            else if (task.type === 'note') { cardEl.className = 'video-card sticky-note'; cardEl.style.width = `${task.width || 260}px`; cardEl.style.height = `${task.height || 180}px`; } else if (task.type === 'tool_generator') cardEl.className = 'video-card tool-generator'; else if (task.type === 'tool_image_gen') cardEl.className = 'video-card tool-image-gen'; else if (task.type === 'tool_cropper') cardEl.className = 'video-card tool-cropper'; else cardEl.className = 'video-card';
            
            cardEl.style.transform = `translate(${task.x}px, ${task.y}px)`; morphCardDOM(cardEl, generateCardHTML(task)); board.appendChild(cardEl); 
            applyImgGenCardFrame(cardEl, task);
            if (task.type === 'note') cardEl.addEventListener('mouseup', () => saveNoteSize(task.id, cardEl.offsetWidth, cardEl.offsetHeight));
            if (!task.type && task.status === 'processing' && !activeTasks.includes(task.id)) { activeTasks.push(task.id); startTaskPolling(task.id); }
        } else {
            cardEl.style.transform = `translate(${task.x}px, ${task.y}px)`;
            
            if (task.type === 'frame') {
                cardEl.style.width = `${task.width}px`;
                cardEl.style.height = task.isCollapsed ? '0px' : `${task.height}px`;
                cardEl.style.border = task.isCollapsed ? 'none' : '';
            }
            else if (task.type === 'note' && task.width && task.height) { cardEl.style.width = `${task.width}px`; cardEl.style.height = `${task.height}px`; }
            
            const oldStatus = cardEl.getAttribute('data-sync-status'), oldRetry = cardEl.getAttribute('data-sync-retry'), oldImgLen = cardEl.getAttribute('data-sync-img-len'), oldProgress = cardEl.getAttribute('data-sync-progress'), oldCropSrc = cardEl.getAttribute('data-sync-crop-src'), oldCropRes = cardEl.getAttribute('data-sync-crop-res'), oldChannel = cardEl.getAttribute('data-sync-channel'), oldVersion = cardEl.getAttribute('data-sync-version'), oldPreviewCollapsed = cardEl.getAttribute('data-sync-preview-collapsed'); 
            const oldFrameTitle = cardEl.getAttribute('data-sync-title'), oldFrameCollapsed = cardEl.getAttribute('data-sync-collapsed');

            if (oldStatus !== task.status || oldRetry != task.retryCount || oldImgLen != currentImgLen || oldProgress !== currentProgress || oldCropSrc !== cropSrc || oldCropRes !== cropRes || oldChannel !== currentChannel || oldVersion !== currentVersion || oldPreviewCollapsed !== currentPreviewCollapsed || oldFrameTitle !== task.title || oldFrameCollapsed !== String(task.isCollapsed)) { 
                morphCardDOM(cardEl, generateCardHTML(task)); 
            }
            applyImgGenCardFrame(cardEl, task);
        }

        if (isHiddenInFrame) cardEl.classList.add('hidden-in-frame'); else cardEl.classList.remove('hidden-in-frame');

        bindCardDrag(cardEl, task);
        
        cardEl.setAttribute('data-sync-status', task.status || 'static'); cardEl.setAttribute('data-sync-retry', task.retryCount || 0); cardEl.setAttribute('data-sync-img-len', currentImgLen); cardEl.setAttribute('data-sync-progress', currentProgress); cardEl.setAttribute('data-sync-crop-src', cropSrc); cardEl.setAttribute('data-sync-crop-res', cropRes); cardEl.setAttribute('data-sync-channel', currentChannel); cardEl.setAttribute('data-sync-version', currentVersion); cardEl.setAttribute('data-sync-preview-collapsed', currentPreviewCollapsed);
        cardEl.setAttribute('data-sync-title', task.title || ''); cardEl.setAttribute('data-sync-collapsed', String(task.isCollapsed));
    });

    renderMinimap();
}

async function removeTask(id) {
    if (!confirm('确定删除这张卡片吗？')) return;
    clearTaskPolling(id);
    await deleteTaskDB(id);
    const card = document.getElementById('card-' + id);
    if (card) card.remove();
    renderMinimap();
}
function downloadVideo(url) { const a = document.createElement('a'); a.href = url; a.target = "_blank"; a.download = `Studio_${Date.now()}.mp4`; a.click(); }

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initDB();
        board.style.transform = `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`;
        document.body.style.backgroundPosition = `${transform.x}px ${transform.y}px`;
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
            ensureImgGenState(clone);
            clone.status = 'idle';
            clone.state.resultBlob = null;
            clone.state.resultBlobs = [];
            clone.state.resultUrl = null;
            clone.state.maskImage = null;
            clone.retryCount = 0;
        }
        if (clone.type === 'tool_cropper') clone.state.resultBlob = null;
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
    newCardEl.style.transform = `translate(${clone.x}px, ${clone.y}px)`;
    newCardEl.classList.remove('hidden-in-frame');

    clearSelection();
    selectedTasks.add(newId);
    newCardEl.classList.add('selected');

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
            initialY: toFiniteNumber(newCardEl.__veoTask.y, clone.y)
        };
    } else {
        newCardEl.style.willChange = 'auto';
        // 若用户已松手，立即落库校正后坐标，避免刷新后回弹到旧位置
        try { await saveTaskDB(newCardEl.__veoTask || clone); } catch(err) { console.warn('clone settle save failed:', err); }
    }

    showToast("🪄 已克隆组件及参数", "success");
}

// ==========================================
// 🎨 AI 多模生图核心控制模块 (局部渲染完全体)
// ==========================================
const IMG_GEN_PRO_SIZE_PRESETS = Object.freeze({
    '1:1': Object.freeze({ '1k': '1024x1024', '2k': '2048x2048', '4k': '4096x4096' }),
    '3:2': Object.freeze({ '1k': '1536x1024', '2k': '3072x2048', '4k': '3840x2560' }),
    '2:3': Object.freeze({ '1k': '1024x1536', '2k': '2048x3072', '4k': '2560x3840' }),
    '16:9': Object.freeze({ '1k': '1024x576', '2k': '2048x1152', '4k': '3840x2160' }),
    '9:16': Object.freeze({ '1k': '576x1024', '2k': '1152x2048', '4k': '2160x3840' })
});

const IMG_GEN_PRO_RULES = Object.freeze({
    MAX_SIDE: 3840,
    GRID: 16,
    MAX_RATIO: 3,
    MIN_PIXELS: 655360,
    MAX_PIXELS: 8294400
});

function clampNumber(v, min, max) {
    return Math.min(max, Math.max(min, v));
}

function snapToGrid(v, grid) {
    const g = Math.max(1, parseInt(grid, 10) || 1);
    return Math.max(g, Math.round(v / g) * g);
}

function parseImgSizeValue(sizeStr) {
    if (typeof sizeStr !== 'string') return null;
    const m = sizeStr.trim().match(/^(\d+)\s*x\s*(\d+)$/i);
    if (!m) return null;
    const w = parseInt(m[1], 10);
    const h = parseInt(m[2], 10);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
    return { width: w, height: h };
}

function detectProPresetFromSize(sizeValue) {
    if (sizeValue === '') return { proRatio: 'custom', proResolution: '1k' };
    if (!sizeValue || sizeValue === 'auto') return { proRatio: 'auto', proResolution: '1k' };
    const value = String(sizeValue).trim().toLowerCase();
    for (const ratioKey of Object.keys(IMG_GEN_PRO_SIZE_PRESETS)) {
        const perRes = IMG_GEN_PRO_SIZE_PRESETS[ratioKey];
        for (const resKey of Object.keys(perRes)) {
            if (perRes[resKey].toLowerCase() === value) return { proRatio: ratioKey, proResolution: resKey };
        }
    }
    const parsed = parseImgSizeValue(value);
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
    const rules = IMG_GEN_PRO_RULES;
    const fallback = { width: 1024, height: 1024 };
    const parsed = parseImgSizeValue(sizeValue) || fallback;
    let w = parsed.width;
    let h = parsed.height;
    const original = `${w}x${h}`;

    for (let i = 0; i < 8; i++) {
        w = Math.max(rules.GRID, w);
        h = Math.max(rules.GRID, h);

        const ratio = w / h;
        if (ratio > rules.MAX_RATIO) w = h * rules.MAX_RATIO;
        else if (ratio < (1 / rules.MAX_RATIO)) h = w * rules.MAX_RATIO;

        let maxSide = Math.max(w, h);
        if (maxSide > rules.MAX_SIDE) {
            const scaleDown = rules.MAX_SIDE / maxSide;
            w *= scaleDown;
            h *= scaleDown;
        }

        let pixels = w * h;
        if (pixels > rules.MAX_PIXELS) {
            const scaleDownPixels = Math.sqrt(rules.MAX_PIXELS / pixels);
            w *= scaleDownPixels;
            h *= scaleDownPixels;
        }

        pixels = w * h;
        if (pixels < rules.MIN_PIXELS) {
            const scaleUpPixels = Math.sqrt(rules.MIN_PIXELS / Math.max(1, pixels));
            w *= scaleUpPixels;
            h *= scaleUpPixels;
        }

        maxSide = Math.max(w, h);
        if (maxSide > rules.MAX_SIDE) {
            const scaleDownAgain = rules.MAX_SIDE / maxSide;
            w *= scaleDownAgain;
            h *= scaleDownAgain;
        }

        w = snapToGrid(w, rules.GRID);
        h = snapToGrid(h, rules.GRID);
    }

    w = clampNumber(snapToGrid(w, rules.GRID), rules.GRID, rules.MAX_SIDE);
    h = clampNumber(snapToGrid(h, rules.GRID), rules.GRID, rules.MAX_SIDE);

    if (w / h > rules.MAX_RATIO) w = snapToGrid(h * rules.MAX_RATIO, rules.GRID);
    if (h / w > rules.MAX_RATIO) h = snapToGrid(w * rules.MAX_RATIO, rules.GRID);

    w = clampNumber(w, rules.GRID, rules.MAX_SIDE);
    h = clampNumber(h, rules.GRID, rules.MAX_SIDE);

    let area = w * h;
    if (area > rules.MAX_PIXELS) {
        const scale = Math.sqrt(rules.MAX_PIXELS / area);
        w = clampNumber(snapToGrid(w * scale, rules.GRID), rules.GRID, rules.MAX_SIDE);
        h = clampNumber(snapToGrid(h * scale, rules.GRID), rules.GRID, rules.MAX_SIDE);
        area = w * h;
    }
    if (area < rules.MIN_PIXELS) {
        const scale = Math.sqrt(rules.MIN_PIXELS / Math.max(1, area));
        w = clampNumber(snapToGrid(w * scale, rules.GRID), rules.GRID, rules.MAX_SIDE);
        h = clampNumber(snapToGrid(h * scale, rules.GRID), rules.GRID, rules.MAX_SIDE);
        area = w * h;
    }

    // 兜底：若经过缩放后仍未满足最小像素，优先抬升较短边，保持比例不超过 3:1。
    if (area < rules.MIN_PIXELS) {
        if (w >= h) {
            h = clampNumber(snapToGrid(Math.sqrt(rules.MIN_PIXELS / Math.max(1, w / h)), rules.GRID), rules.GRID, rules.MAX_SIDE);
            w = clampNumber(snapToGrid(Math.min(rules.MAX_SIDE, h * (w / h)), rules.GRID), rules.GRID, rules.MAX_SIDE);
        } else {
            w = clampNumber(snapToGrid(Math.sqrt(rules.MIN_PIXELS / Math.max(1, h / w)), rules.GRID), rules.GRID, rules.MAX_SIDE);
            h = clampNumber(snapToGrid(Math.min(rules.MAX_SIDE, w * (h / w)), rules.GRID), rules.GRID, rules.MAX_SIDE);
        }
        area = w * h;
    }

    const normalized = `${w}x${h}`;
    return {
        size: normalized,
        changed: normalized !== original,
        isValid:
            Math.max(w, h) <= rules.MAX_SIDE &&
            (w % rules.GRID === 0) &&
            (h % rules.GRID === 0) &&
            (Math.max(w / h, h / w) <= rules.MAX_RATIO) &&
            (area >= rules.MIN_PIXELS && area <= rules.MAX_PIXELS)
    };
}

function resolveImgGenSize(state) {
    if (!state || typeof state !== 'object') return '1024x1024';
    if (state.version !== 'pro') {
        const trialRatio = state.trialRatio || '1:1';
        if (trialRatio === 'custom') return buildCustomSizeByResolution(state.customW, state.customH, '1k');
        const preset = IMG_GEN_PRO_SIZE_PRESETS[trialRatio];
        if (preset && preset['1k']) return preset['1k'];
        if (typeof state.size === 'string' && state.size.trim()) return state.size;
        return '1024x1024';
    }
    const ratio = state.proRatio || '1:1';
    const res = state.proResolution || '1k';
    if (ratio === 'auto') return 'auto';
    if (ratio === 'custom') return enforceProSizeRules(buildCustomSizeByResolution(state.customW, state.customH, res)).size;
    const preset = IMG_GEN_PRO_SIZE_PRESETS[ratio];
    if (preset && preset[res]) return enforceProSizeRules(preset[res]).size;
    return enforceProSizeRules('1024x1024').size;
}

function ensureImgGenState(task) {
    if (!task || task.type !== 'tool_image_gen') return;
    if (!task.state || typeof task.state !== 'object') task.state = {};
    if (!Array.isArray(task.state.images)) task.state.images = [];
    if (!task.state.version) task.state.version = 'trial';
    if (!task.state.providerSort) task.state.providerSort = 'quality';
    if (!task.state.quality) task.state.quality = 'auto';
    if (!task.state.format) task.state.format = 'png';
    if (!task.state.background) task.state.background = 'auto';
    if (!task.state.moderation) task.state.moderation = 'auto';
    const parsedN = parseInt(task.state.n, 10);
    task.state.n = Number.isFinite(parsedN) && parsedN > 0 ? Math.min(parsedN, 10) : 1;
    if (!task.state.size && task.state.size !== '') task.state.size = '1024x1024';
    if (!task.state.trialRatio) {
        if (task.state.size === '') {
            task.state.trialRatio = 'custom';
        } else {
            const trialDetected = detectProPresetFromSize(task.state.size);
            task.state.trialRatio = (trialDetected.proRatio && trialDetected.proRatio !== 'auto') ? trialDetected.proRatio : '1:1';
        }
    }
    if (!['1:1', '3:2', '2:3', '16:9', '9:16', 'custom'].includes(task.state.trialRatio)) {
        task.state.trialRatio = '1:1';
    }
    if (!task.state.proRatio) task.state.proRatio = '1:1';
    if (!task.state.proResolution) task.state.proResolution = '1k';
    const ratioCustomW = parseInt(task.state.customW, 10);
    const ratioCustomH = parseInt(task.state.customH, 10);
    if (!Number.isFinite(ratioCustomW) || ratioCustomW < 1) task.state.customW = 9;
    if (!Number.isFinite(ratioCustomH) || ratioCustomH < 1) task.state.customH = 16;
    if (!task.state.prompt) task.state.prompt = '';
    if (!task.state.channel) task.state.channel = 'channel_1';
    if (typeof task.state.autoRetry !== 'boolean') task.state.autoRetry = false;
    if (typeof task.state.previewCollapsed !== 'boolean') task.state.previewCollapsed = false;
    if (typeof task.state.maskImage === 'undefined') task.state.maskImage = null;
    if (!Array.isArray(task.state.resultBlobs)) task.state.resultBlobs = [];
    if (task.state.resultBlob && task.state.resultBlobs.length === 0) task.state.resultBlobs = [task.state.resultBlob];
    if (task.state.version === 'pro') {
        const detected = detectProPresetFromSize(task.state.size);
        if (!task.state.proRatio || task.state.proRatio === 'auto') task.state.proRatio = detected.proRatio;
        if (!task.state.proResolution) task.state.proResolution = detected.proResolution;
        task.state.size = resolveImgGenSize(task.state);
    } else {
        task.state.size = resolveImgGenSize(task.state);
    }
}

function resolveImgGenMode(state) {
    const imageCount = Array.isArray(state.images) ? state.images.length : 0;
    if (imageCount === 0) return 'text2img';
    if (state.maskImage) return 'mask_edit';
    return 'img2img';
}

function buildImgGenHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const pwd = sessionStorage.getItem('veo_admin_pwd');
    if (pwd) headers['wally123'] = pwd;
    if (API_IMAGE_AUTH) headers['Authorization'] = API_IMAGE_AUTH;
    return headers;
}

function extractImageUrlsFromResponse(rawData) {
    const resData = Array.isArray(rawData) ? rawData[0] : rawData;
    if (!resData) return [];
    const urls = [];
    const pushIf = (u) => {
        if (!u || typeof u !== 'string') return;
        const v = u.trim();
        if (!v) return;
        if (!urls.includes(v)) urls.push(v);
    };
    const fmt = (resData.output_format || resData.format || 'png').toString().toLowerCase();
    const toDataUrl = (b64) => `data:image/${fmt};base64,${b64}`;

    if (typeof resData === 'string' && (resData.startsWith('http://') || resData.startsWith('https://') || resData.startsWith('data:image'))) pushIf(resData);
    if (resData.imageUrl) pushIf(resData.imageUrl);
    if (resData.url) pushIf(resData.url);
    if (resData.output && Array.isArray(resData.output) && resData.output[0]) {
        for (const outItem of resData.output) {
            if (typeof outItem === 'string') pushIf(outItem);
            else if (outItem && outItem.url) pushIf(outItem.url);
        }
    }
    if (resData.images && Array.isArray(resData.images) && resData.images[0]) {
        for (const imgItem of resData.images) {
            if (typeof imgItem === 'string') pushIf(imgItem);
            else if (imgItem && imgItem.url) pushIf(imgItem.url);
        }
    }
    if (resData.data && Array.isArray(resData.data) && resData.data[0]) {
        for (const d of resData.data) {
            if (typeof d === 'string') pushIf(d);
            else if (d && d.url) pushIf(d.url);
            else if (d && d.b64_json) pushIf(toDataUrl(d.b64_json));
        }
    }
    if (resData.result && resData.result.url) pushIf(resData.result.url);
    if (resData.body && resData.body.imageUrl) pushIf(resData.body.imageUrl);
    return urls;
}

function extractImageUrlFromResponse(rawData) {
    const list = extractImageUrlsFromResponse(rawData);
    return list.length > 0 ? list[0] : null;
}

async function toggleImgGenPreviewPanel(e, taskId) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    const task = await getTaskDB(taskId);
    if (!task) return;
    ensureImgGenState(task);
    task.state.previewCollapsed = !task.state.previewCollapsed;
    task.timestamp = Date.now();
    await saveTaskDB(task);
    renderCard(taskId);
}

async function updateImgGenState(taskId, key, val) {
    const task = await getTaskDB(taskId);
    if (!task) return;
    ensureImgGenState(task);
    if (key === 'n') {
        const n = parseInt(val, 10);
        task.state.n = Number.isFinite(n) && n > 0 ? Math.min(n, 10) : 1;
    } else if (key === 'proResolution') {
        task.state.proResolution = ['1k', '2k', '4k'].includes(String(val)) ? String(val) : '1k';
        if (task.state.version === 'pro') task.state.size = resolveImgGenSize(task.state);
    } else if (key === 'proRatio') {
        task.state.proRatio = String(val || '1:1');
        if (task.state.version === 'pro') task.state.size = resolveImgGenSize(task.state);
    } else if (key === 'customW' || key === 'customH') {
        const parsed = parseInt(val, 10);
        task.state[key] = Number.isFinite(parsed) && parsed > 0 ? parsed : (key === 'customW' ? 9 : 16);
        if (task.state.version === 'pro' && task.state.proRatio === 'custom') task.state.size = resolveImgGenSize(task.state);
        if (task.state.version !== 'pro' && task.state.trialRatio === 'custom') task.state.size = resolveImgGenSize(task.state);
    } else if (key === 'trialRatio') {
        task.state.trialRatio = ['1:1', '3:2', '2:3', '16:9', '9:16', 'custom'].includes(String(val)) ? String(val) : '1:1';
        task.state.size = resolveImgGenSize(task.state);
    } else if (key === 'version') {
        const nextVersion = val === 'pro' ? 'pro' : 'trial';
        task.state.version = nextVersion;
        if (nextVersion === 'pro') {
            const detected = detectProPresetFromSize(task.state.size);
            if (detected.proRatio && detected.proRatio !== 'auto') task.state.proRatio = detected.proRatio;
            if (detected.proResolution) task.state.proResolution = detected.proResolution;
            task.state.size = resolveImgGenSize(task.state);
        } else {
            task.state.size = resolveImgGenSize(task.state);
        }
    } else if (key === 'size') {
        task.state.size = val;
        if (task.state.version === 'pro') {
            const detected = detectProPresetFromSize(val);
            if (detected.proRatio !== 'auto') task.state.proRatio = detected.proRatio;
            task.state.proResolution = detected.proResolution;
        } else {
            if (val === '') task.state.trialRatio = 'custom';
            else {
                const trialDetected = detectProPresetFromSize(val);
                if (trialDetected.proRatio && trialDetected.proRatio !== 'auto') task.state.trialRatio = trialDetected.proRatio;
            }
            task.state.size = resolveImgGenSize(task.state);
        }
    } else {
        task.state[key] = val;
        if (key === 'prompt' && typeof task.state.prompt !== 'string') task.state.prompt = '';
    }
    await saveTaskDB(task);
    renderCard(taskId);
}

async function handleGenImageUpload(input, taskId) {
    if (!input.files || input.files.length === 0) return;
    const task = await getTaskDB(taskId); if (!task) return;
    ensureImgGenState(task);
    for (let file of Array.from(input.files)) {
        if (task.state.images.length >= 5) break;
        task.state.images.push(await compressImageToBlob(file, 1024));
    }
    task.timestamp = Date.now();
    await saveTaskDB(task); renderCard(taskId); input.value = '';
}

// ==========================================
// ✅ 修复版：生图卡片拖拽处理函数 (免疫 dataTransfer 销毁)
// ==========================================
async function handleGenImageDrop(e, taskId) {
    e.preventDefault(); e.stopPropagation();
    const zone = document.getElementById(`img-gen-zone-${taskId}`);
    if (zone) zone.classList.remove('drag-over');
    
    // 🌟 核心破局点：必须在任何 await (如查库) 发生之前，优先且“同步”地提取拖放数据！
    const srcToUse = await parseDroppedImage(e);
    
    // 如果没有拿到有效图片，直接拦截，节约性能
    if (!srcToUse) return; 

    // 数据落袋为安后，再从容地去查库和校验
    const task = await getTaskDB(taskId); 
    if (!task) return;
    ensureImgGenState(task);
    
    if (task.state.images.length >= 5) {
        return showToast("最多只能垫入 5 张图", "error");
    }
    
    // 赋值并击穿缓存
    task.state.images.push(srcToUse);
    task.timestamp = Date.now();
    await saveTaskDB(task); 
    
    // 局部重绘
    renderCard(taskId);
}

async function removeGenImage(e, taskId, index) {
    e.stopPropagation(); const task = await getTaskDB(taskId); if (!task) return;
    ensureImgGenState(task);
    task.state.images.splice(index, 1); 
    task.timestamp = Date.now();
    await saveTaskDB(task); renderCard(taskId);
}

// ==========================================
// 🎨 AI 多模生图核心控制模块 (完全融合版)
// ==========================================
async function submitImgGen(taskId) {
    const task = await getTaskDB(taskId);
    if (!task) return;
    ensureImgGenState(task);
    if (!task.state.prompt) return showToast("请输入生图提示词", "error");
    if (task.state.previewCollapsed) task.state.previewCollapsed = false;

    task.status = 'processing';
    task.retryCount = 0;
    task.isBilled = false;
    task.state.resultBlob = null;
    task.state.resultBlobs = [];
    task.state.startTime = Date.now();
    await saveTaskDB(task);
    renderCard(taskId);

    const version = task.state.version === 'pro' ? 'pro' : 'trial';
    let resolvedSize = resolveImgGenSize(task.state);
    let finalPrompt = task.state.prompt;
    const trialCustomW = task.state.customW || 9;
    const trialCustomH = task.state.customH || 16;
    const trialCustomRatio = (version !== 'pro' && task.state.trialRatio === 'custom') ? `${trialCustomW}:${trialCustomH}` : '';
    if (trialCustomRatio) finalPrompt = `${finalPrompt} 画面比例${trialCustomRatio}`;

    if (version === 'pro' && resolvedSize !== 'auto') {
        const strict = enforceProSizeRules(resolvedSize);
        if (!strict.isValid) {
            task.status = 'failed';
            await saveTaskDB(task);
            renderCard(taskId);
            return showToast('Pro 尺寸不符合规则，请调整比例后重试', 'error');
        }
        if (strict.changed) {
            resolvedSize = strict.size;
            showToast(`Pro 尺寸已按规则校正为 ${strict.size}`, 'info');
        }
    }
    task.state.size = resolvedSize;
    const sizeToSend = resolvedSize;
    const mode = resolveImgGenMode(task.state);
    const imagesBase64 = await blobsToBase64Sequential(task.state.images, { mode: 'network', maxBytes: 8 * 1024 * 1024, maxEdge: 2048 });
    const maskBase64 = task.state.maskImage ? await blobToBase64(task.state.maskImage, { mode: 'network', maxBytes: 8 * 1024 * 1024, maxEdge: 2048 }) : null;
    const nValue = Number.isFinite(parseInt(task.state.n, 10)) ? Math.min(Math.max(parseInt(task.state.n, 10), 1), 10) : 1;

    const unifiedPayloadCore = {
        version: version,
        channel: task.state.channel || 'channel_1',
        mode: mode,
        prompt: finalPrompt,
        size: sizeToSend,
        providerSort: task.state.providerSort || 'quality',
        provider: { sort: task.state.providerSort || 'quality' },
        quality: task.state.quality || 'auto',
        format: task.state.format || 'png',
        output_format: task.state.format || 'png',
        background: task.state.background || 'auto',
        moderation: task.state.moderation || 'auto',
        n: nValue,
        images: imagesBase64,
        mask: maskBase64,
        custom_ratio: trialCustomRatio || undefined,
        custom_w: trialCustomRatio ? trialCustomW : undefined,
        custom_h: trialCustomRatio ? trialCustomH : undefined
    };

    const unifiedPayload = {
        body: { ...unifiedPayloadCore },
        ...unifiedPayloadCore,
        inputImages: imagesBase64,
        maskImage: maskBase64
    };

    const legacyPayload = {
        prompt: finalPrompt,
        size: sizeToSend,
        channel: task.state.channel || 'channel_1',
        n: nValue,
        quality: task.state.quality || 'auto',
        format: task.state.format || 'png',
        output_format: task.state.format || 'png',
        background: task.state.background || 'auto',
        moderation: task.state.moderation || 'auto',
        providerSort: task.state.providerSort || 'quality',
        images: imagesBase64,
        custom_ratio: trialCustomRatio || undefined,
        custom_w: trialCustomRatio ? trialCustomW : undefined,
        custom_h: trialCustomRatio ? trialCustomH : undefined
    };

    const requestImgGenOnce = async (payloadForUnified, payloadForLegacy) => {
        const headers = buildImgGenHeaders();
        const useTrialLegacyFirst = version !== 'pro';
        let response = null;

        if (useTrialLegacyFirst) {
            const legacyUrl = API_IMAGE_GEN_LEGACY || API_IMAGE_GEN;
            response = await fetch(legacyUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(payloadForLegacy)
            });
            if ((response.status === 404 || response.status === 405) && legacyUrl !== API_IMAGE_GEN) {
                response = await fetch(API_IMAGE_GEN, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payloadForUnified)
                });
            }
        } else {
            response = await fetch(API_IMAGE_GEN, {
                method: 'POST',
                headers,
                body: JSON.stringify(payloadForUnified)
            });
            if ((response.status === 404 || response.status === 405) && API_IMAGE_GEN_LEGACY && API_IMAGE_GEN_LEGACY !== API_IMAGE_GEN) {
                response = await fetch(API_IMAGE_GEN_LEGACY, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payloadForLegacy)
                });
            }
        }

        if (response.status === 401 || response.status === 403) {
            handleAuthError();
            throw new Error("密钥校验失败");
        }
        if (!response.ok) throw new Error("API 异常: " + response.status);

        const contentType = (response.headers.get('content-type') || '').toLowerCase();
        let rawData = null;
        if (contentType.includes('application/json')) {
            rawData = await response.json();
        } else {
            const rawText = await response.text();
            try { rawData = JSON.parse(rawText); } catch (parseErr) { rawData = rawText; }
        }

        const resData = Array.isArray(rawData) ? rawData[0] : rawData;
        const returnedUrls = extractImageUrlsFromResponse(rawData);
        return { rawData, resData, returnedUrls };
    };

    const collectRequestedUrls = async () => {
        const targetCount = Math.min(Math.max(nValue, 1), 10);
        const aggregatedUrls = [];

        const firstResult = await requestImgGenOnce(unifiedPayload, legacyPayload);
        if (Array.isArray(firstResult.returnedUrls) && firstResult.returnedUrls.length > 0) {
            aggregatedUrls.push(...firstResult.returnedUrls);
        }

        let latestResData = firstResult.resData;
        if (aggregatedUrls.length === 0 && firstResult.resData && firstResult.resData.taskId) {
            return { returnedUrls: [], resData: firstResult.resData };
        }

        if (targetCount > aggregatedUrls.length) {
            const missingCount = targetCount - aggregatedUrls.length;
            for (let i = 0; i < missingCount; i++) {
                const extraCore = { ...unifiedPayloadCore, n: 1 };
                const extraUnifiedPayload = {
                    body: { ...extraCore },
                    ...extraCore,
                    inputImages: imagesBase64,
                    maskImage: maskBase64
                };
                const extraLegacyPayload = { ...legacyPayload, n: 1 };
                try {
                    const extraResult = await requestImgGenOnce(extraUnifiedPayload, extraLegacyPayload);
                    latestResData = extraResult.resData || latestResData;
                    if (Array.isArray(extraResult.returnedUrls) && extraResult.returnedUrls.length > 0) {
                        aggregatedUrls.push(...extraResult.returnedUrls);
                    }
                    if (aggregatedUrls.length >= targetCount) break;
                } catch (extraErr) {
                    console.warn('[submitImgGen] extra image request failed:', extraErr);
                }
            }
        }

        return { returnedUrls: aggregatedUrls.slice(0, targetCount), resData: latestResData };
    };

    let success = false;
    let attempts = 0;
    const maxAttempts = task.state.autoRetry ? 3 : 1;
    let lastError = null;

    while (attempts < maxAttempts && !success) {
        attempts++;
        try {
            const resultPack = await collectRequestedUrls();
            const resData = resultPack.resData;
            const returnedUrls = resultPack.returnedUrls;

            if (returnedUrls.length > 0) {
                const resultBlobs = [];
                for (const u of returnedUrls) {
                    try {
                        const r = await fetch(u);
                        if (!r.ok) throw new Error('fetch image failed');
                        resultBlobs.push(await r.blob());
                    } catch (fetchErr) {
                        // CORS/临时 URL 失败时回退成原始 URL 字符串，仍可预览与复用
                        resultBlobs.push(u);
                    }
                }
                task.status = 'success';
                task.state.resultBlobs = resultBlobs;
                task.state.resultBlob = resultBlobs[0] || null;
                task.state.costTime = Math.floor((Date.now() - task.state.startTime) / 1000);
                task.timestamp = Date.now();
                success = true;
                if (nValue > 1 && resultBlobs.length < nValue) {
                    showToast(`当前通道只返回 ${resultBlobs.length}/${nValue} 张，已自动补发并完成聚合`, "warning");
                }

                if (!task.isBilled) {
                    let cost = 0.084;
                    let detail = `AI生图 试用版 (${task.state.channel || 'channel_1'})`;
                    if (version === 'pro') {
                        cost = 0.12;
                        detail = "AI生图 专业版 GPT Image 2";
                    } else if (task.state.channel === 'channel_2') {
                        cost = 0.06;
                    }
                    await addBillingRecord({ id: 'bill_img_' + task.id + '_' + Date.now(), taskId: task.id, type: 'image', cost: cost, detail: detail });
                    task.isBilled = true;
                    updateBillingUI();
                }
            } else if (resData && resData.taskId) {
                task.genTaskId = resData.taskId;
                await saveTaskDB(task);
                startTaskPolling(taskId);
                return;
            } else {
                throw new Error("无返回有效图片结构");
            }
        } catch (err) {
            lastError = err;
            if (attempts >= maxAttempts) {
                task.status = 'failed';
            } else {
                task.retryCount = attempts;
                await saveTaskDB(task);
                renderCard(taskId);
                await new Promise(r => setTimeout(r, 2000));
            }
        }
    }

    await saveTaskDB(task);
    renderCard(taskId);
    if (!success && task.status === 'failed') {
        showToast("生图请求失败，请检查 webhook、密钥或网络", "error");
        if (lastError) console.warn('[submitImgGen] failed:', lastError);
    }
}

// ==========================================
// ✂️ 局部裁切器 物理引擎 (拖拽与缩放)
// ==========================================
document.addEventListener('mousedown', (e) => {
    const handle = e.target.closest('.crop-handle'); const box = e.target.closest('.crop-box');
    if (!handle && (!box || e.target.tagName === 'BUTTON')) return;
    
    e.stopPropagation(); isPanning = false; if (document.getElementById('canvas-board')) document.getElementById('canvas-board').classList.remove('is-moving');

    const targetBox = handle ? handle.closest('.crop-box') : box;
    const taskId = targetBox.getAttribute('data-task-id');
    const el = document.getElementById('card-' + taskId);
    if (!el || !el.__veoTask) return;

    activeCrop = {
        task: el.__veoTask, boxEl: targetBox, container: targetBox.parentElement,
        mode: handle ? handle.getAttribute('data-dir') : 'move',
        startX: e.clientX, startY: e.clientY,
        startLeft: el.__veoTask.state.cropParams.left, startTop: el.__veoTask.state.cropParams.top,
        startWidth: el.__veoTask.state.cropParams.width, startHeight: el.__veoTask.state.cropParams.height
    };
});

document.addEventListener('mousemove', (e) => {
    if (!activeCrop) return;
    const dx = (e.clientX - activeCrop.startX) / transform.scale, dy = (e.clientY - activeCrop.startY) / transform.scale;
    const cw = activeCrop.container.offsetWidth, ch = activeCrop.container.offsetHeight;
    const dxPct = (dx / cw) * 100, dyPct = (dy / ch) * 100;

    let { startLeft, startTop, startWidth, startHeight, mode } = activeCrop;
    let newLeft = startLeft, newTop = startTop, newWidth = startWidth, newHeight = startHeight;

    if (mode === 'move') {
        newLeft = Math.max(0, Math.min(100 - newWidth, startLeft + dxPct));
        newTop = Math.max(0, Math.min(100 - newHeight, startTop + dyPct));
    } else {
        if (mode.includes('e')) newWidth = Math.max(5, Math.min(100 - startLeft, startWidth + dxPct));
        if (mode.includes('s')) newHeight = Math.max(5, Math.min(100 - startTop, startHeight + dyPct));
        if (mode.includes('w')) { let maxW = startLeft + startWidth; newLeft = Math.max(0, Math.min(maxW - 5, startLeft + dxPct)); newWidth = maxW - newLeft; }
        if (mode.includes('n')) { let maxH = startTop + startHeight; newTop = Math.max(0, Math.min(maxH - 5, startTop + dyPct)); newHeight = maxH - newTop; }
    }
    activeCrop.task.state.cropParams = { left: newLeft, top: newTop, width: newWidth, height: newHeight };
    activeCrop.boxEl.style.left = newLeft + '%'; activeCrop.boxEl.style.top = newTop + '%';
    activeCrop.boxEl.style.width = newWidth + '%'; activeCrop.boxEl.style.height = newHeight + '%';
});

document.addEventListener('mouseup', async () => {
    if (activeCrop) { await saveTaskDB(activeCrop.task); activeCrop = null; renderMinimap(); }
});
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

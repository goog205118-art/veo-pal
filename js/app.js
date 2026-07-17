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
    if (rawMode === THEME_DARK) return THEME_DARK;
    if (rawMode === THEME_LIGHT || rawMode === 'mono') return THEME_LIGHT;
    return THEME_LIGHT;
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

const APP_API_CONFIG = {
    videoSubmit: 'https://api.wallyai.top/webhook/proxy-submit',
    videoPoll: 'https://api.wallyai.top/webhook/proxy-poll',
    imageUnified: (window.VEO_IMAGE_UNIFIED_WEBHOOK && String(window.VEO_IMAGE_UNIFIED_WEBHOOK).trim()) || 'https://api.wallyai.top/webhook/proxy-image-unified',
    imageLegacy: (window.VEO_IMAGE_LEGACY_WEBHOOK && String(window.VEO_IMAGE_LEGACY_WEBHOOK).trim()) || 'https://api.wallyai.top/webhook/proxy-image-gen',
    imagePoll: (window.VEO_IMAGE_POLL_WEBHOOK && String(window.VEO_IMAGE_POLL_WEBHOOK).trim()) || '',
    imageAuth: (window.VEO_WEBHOOK_AUTH && String(window.VEO_WEBHOOK_AUTH).trim()) || ''
};
const API_SUBMIT = APP_API_CONFIG.videoSubmit;
const API_POLL = APP_API_CONFIG.videoPoll;
const API_IMAGE_GEN = APP_API_CONFIG.imageUnified;
const API_IMAGE_GEN_LEGACY = APP_API_CONFIG.imageLegacy;
const API_IMAGE_POLL = APP_API_CONFIG.imagePoll;
const API_IMAGE_AUTH = APP_API_CONFIG.imageAuth;
const IMG_GEN_PRO_INPUT_PRICE_PER_1M = 5;
const IMG_GEN_PRO_OUTPUT_PRICE_PER_1M = 30;
const IMG_GEN_PROXY_RECHARGE_FACTOR = 0.5;
const IMG_GEN_PRO_FALLBACK_COST = 0.12;
const IMG_GEN_PREVIEW_LIMIT = 6;
const IMG_GEN_CLICK_COOLDOWN_MS = 3000;
const IMG_GEN_VARIATION_COUNT = 4;
const IMG_GEN_STAGE_DOCK_MIN_TRAVEL = 96;
const IMG_GEN_FEATURES = {
    trialAvailable: false
};
const IMG_GEN_ROUTE_CONFIG = {
    stable: { key: 'stable', aliases: ['stable', 'success_rate', 'default'], suffix: '', mode: 'success_rate', label: '默认专业通道', maxRefs: 5 },
    ai666: { key: 'ai666', aliases: ['ai666', 'ai_ai666', 'ai666_gpt_image_2', 'ai666-gpt-image-2'], suffix: '', mode: 'ai666', label: 'AI666 中转站', maxRefs: 1 },
    apimart_stable_co: { key: 'apimart_stable_co', aliases: ['apimart_stable_co', 'apimart-stable-co', 'apimart_stable', 'stable_co', 'stable-co', 'apimart'], suffix: '', mode: 'apimart_stable_co', label: 'APIMart 官方通道', maxRefs: 5 }
};
const IMG_GEN_TRIAL_AVAILABLE = IMG_GEN_FEATURES.trialAvailable;
function normalizeWebhookEndpointForCompare(rawUrl) {
    const raw = String(rawUrl || '').trim();
    if (!raw) return '';
    try {
        const url = new URL(raw, window.location.href);
        return `${url.origin}${url.pathname.replace(/\/+$/, '')}`.toLowerCase();
    } catch (err) {
        return raw.split('?')[0].replace(/\/+$/, '').toLowerCase();
    }
}

function isSameWebhookEndpoint(a, b) {
    const left = normalizeWebhookEndpointForCompare(a);
    const right = normalizeWebhookEndpointForCompare(b);
    return !!left && !!right && left === right;
}

function isImageGenerationWebhookEndpoint(rawUrl) {
    const endpoint = normalizeWebhookEndpointForCompare(rawUrl);
    return endpoint.endsWith('/proxy-image-unified') || endpoint.endsWith('/proxy-image-gen');
}

function isUnifiedImageWebhookEndpoint(rawUrl) {
    return normalizeWebhookEndpointForCompare(rawUrl).endsWith('/proxy-image-unified');
}

function isLegacyImageWebhookEndpoint(rawUrl) {
    return normalizeWebhookEndpointForCompare(rawUrl).endsWith('/proxy-image-gen');
}

function resolveImgGenPollEndpoint() {
    const url = String(API_IMAGE_POLL || '').trim();
    if (!url) {
        return isUnifiedImageWebhookEndpoint(API_IMAGE_GEN)
            ? { url: API_IMAGE_GEN, reason: 'unified_fallback' }
            : { url: '', reason: 'missing' };
    }
    if (isUnifiedImageWebhookEndpoint(url) || (isSameWebhookEndpoint(url, API_IMAGE_GEN) && isUnifiedImageWebhookEndpoint(API_IMAGE_GEN))) {
        return { url, reason: 'unified_poll' };
    }
    if (isLegacyImageWebhookEndpoint(url) || isSameWebhookEndpoint(url, API_IMAGE_GEN_LEGACY)) {
        return { url: '', reason: 'points_to_generation' };
    }
    return { url, reason: '' };
}

const IMG_GEN_REF_INTENTS = [
    { value: 'structure', label: '结构', hint: '产品轮廓 / 深度 / 构图' },
    { value: 'style', label: '风格', hint: '影调 / 氛围 / 电影感' },
    { value: 'color', label: '色彩', hint: '配色 / 材质倾向' },
    { value: 'detail', label: '细节', hint: '局部纹理 / 功能点' },
    { value: 'layout', label: '版式', hint: '海报排版 / 留白' }
];
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
let activeTasks = [], activeRetries = new Set();
const taskPollControllers = new Map();
const taskPollTimers = new Map();
const imgGenPollControllers = new Map();
const imgGenPollTimers = new Map();
const taskShadowCache = new Map();
const imgGenUpdateQueues = new Map();
const imgGenPreviewGuards = new Map();
const imgMaskEditorInstances = new Map();
const imgGenPromptDraftTimers = new Map();
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

function cssEscapeSafe(id) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(id);
    return String(id).replace(/([!"#$%&'()*+,./:;<=>?@[\]^`{|}~\\])/g, '\\$1');
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
    return escapeHtml(value);
}

function sanitizeAspectRatioCss(value, fallback = '1/1') {
    const text = String(value || '').trim();
    const match = text.match(/^(\d{1,4})\s*:\s*(\d{1,4})$/);
    if (!match) return fallback;
    const w = Math.max(1, Math.min(4096, parseInt(match[1], 10)));
    const h = Math.max(1, Math.min(4096, parseInt(match[2], 10)));
    return `${w}/${h}`;
}

function revokeBlobPrefixSafe(prefix) {
    if (!prefix || typeof revokeBlobUrlsByPrefix !== 'function') return;
    try { revokeBlobUrlsByPrefix(prefix); } catch (err) {}
}

function revokeBlobKeySafe(key) {
    if (!key) return;
    if (typeof revokeBlobUrl === 'function') {
        try { revokeBlobUrl(key); return; } catch (err) {}
    }
    revokeBlobPrefixSafe(key);
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

function syncFormControlState(fromEl, toEl) {
    if (!fromEl || !toEl || fromEl.nodeType !== Node.ELEMENT_NODE || toEl.nodeType !== Node.ELEMENT_NODE) return;
    const tag = fromEl.tagName;
    if (tag === 'INPUT') {
        const type = (fromEl.getAttribute('type') || '').toLowerCase();
        if (type === 'checkbox' || type === 'radio') {
            if (fromEl.checked !== toEl.checked) fromEl.checked = toEl.checked;
        } else if (fromEl.value !== toEl.value) {
            fromEl.value = toEl.value;
        }
        if (fromEl.disabled !== toEl.disabled) fromEl.disabled = toEl.disabled;
        return;
    }
    if (tag === 'TEXTAREA') {
        if (fromEl.value !== toEl.value) fromEl.value = toEl.value;
        if (fromEl.disabled !== toEl.disabled) fromEl.disabled = toEl.disabled;
        return;
    }
    if (tag === 'SELECT') {
        if (fromEl.disabled !== toEl.disabled) fromEl.disabled = toEl.disabled;
        const nextValue = toEl.value;
        if (fromEl.value !== nextValue) fromEl.value = nextValue;
        if (fromEl.selectedIndex !== toEl.selectedIndex) fromEl.selectedIndex = toEl.selectedIndex;
        return;
    }
    if (tag === 'OPTION') {
        if (fromEl.selected !== toEl.selected) fromEl.selected = toEl.selected;
        if (fromEl.defaultSelected !== toEl.defaultSelected) fromEl.defaultSelected = toEl.defaultSelected;
    }
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
    syncFormControlState(fromNode, toNode);
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

function buildImgGenImagePayloadFields(imagesBase64, maskBase64 = null, maxImages = 5) {
    const maxCount = Math.max(1, Math.min(5, parseInt(maxImages, 10) || 5));
    const images = Array.isArray(imagesBase64) ? imagesBase64.filter(Boolean).slice(0, maxCount) : [];
    return {
        images,
        image_urls: images,
        mask: maskBase64 || null,
        mask_url: maskBase64 || null,
        image_count: images.length,
        reference_count: Math.max(0, images.length - 1)
    };
}

function getImgGenMaxReferenceCount(task) {
    if (!task || task.type !== 'tool_image_gen') return 5;
    const state = task.state && typeof task.state === 'object' ? task.state : {};
    if (state.version !== 'pro') return 5;
    const route = normalizeImgGenRoute(state.providerSort || state.routeMode || state.modelSuffix);
    return route.maxRefs || 5;
}

function limitImgGenReferencesForRoute(task, incomingImages = []) {
    const images = Array.isArray(incomingImages) ? incomingImages.filter(Boolean) : [];
    const maxCount = getImgGenMaxReferenceCount(task);
    return maxCount <= 1 ? images.slice(-1) : images.slice(0, 5);
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
    if (routeKey === 'ai666') {
        if (kind === 'mask') {
            return {
                mode: 'network',
                maxBytes: 2 * 1024 * 1024,
                maxEdge: 1280,
                maxPixels: 1280 * 1280,
                forceResize: true,
                keepPng: true,
                outputType: 'image/png'
            };
        }
        return {
            mode: 'network',
            maxBytes: 1536 * 1024,
            maxEdge: 1280,
            maxPixels: 1280 * 1280,
            forceResize: true,
            outputType: 'image/jpeg',
            quality: 0.78
        };
    }
    return { mode: 'network', maxBytes: 8 * 1024 * 1024, maxEdge: 2048 };
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

async function readImageMeta(imageLike) {
    if (!imageLike) return null;
    try {
        if (typeof imageLike !== 'string' && typeof createImageBitmap === 'function') {
            const bitmap = await createImageBitmap(imageLike);
            const width = toFiniteNumber(bitmap.width, 0);
            const height = toFiniteNumber(bitmap.height, 0);
            try { bitmap.close(); } catch (err) {}
            if (width > 0 && height > 0) {
                const ratio = width / height;
                return {
                    width,
                    height,
                    ratio,
                    layout: ratio >= 1.2 ? 'landscape' : (ratio <= 0.85 ? 'portrait' : 'square')
                };
            }
        }
    } catch (err) {}

    try {
        const src = typeof imageLike === 'string' ? imageLike : URL.createObjectURL(imageLike);
        const meta = await new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const width = toFiniteNumber(img.naturalWidth || img.width, 0);
                const height = toFiniteNumber(img.naturalHeight || img.height, 0);
                if (width > 0 && height > 0) {
                    const ratio = width / height;
                    resolve({
                        width,
                        height,
                        ratio,
                        layout: ratio >= 1.2 ? 'landscape' : (ratio <= 0.85 ? 'portrait' : 'square')
                    });
                } else {
                    resolve(null);
                }
            };
            img.onerror = () => resolve(null);
            img.src = src;
        });
        if (typeof imageLike !== 'string') {
            try { URL.revokeObjectURL(src); } catch (err) {}
        }
        return meta;
    } catch (err) {
        return null;
    }
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

function buildImgGenPollKey(taskId, previewItemId = '') {
    return `${taskId}::${previewItemId || 'default'}`;
}

function clearImgGenPolling(taskId, previewItemId = null) {
    const keys = [];
    if (previewItemId) keys.push(buildImgGenPollKey(taskId, previewItemId));
    else {
        imgGenPollControllers.forEach((_, key) => {
            if (String(key).startsWith(`${taskId}::`)) keys.push(key);
        });
        imgGenPollTimers.forEach((_, key) => {
            if (String(key).startsWith(`${taskId}::`) && !keys.includes(key)) keys.push(key);
        });
        if (keys.length === 0) keys.push(buildImgGenPollKey(taskId, 'default'));
    }

    keys.forEach((pollKey) => {
        const controller = imgGenPollControllers.get(pollKey);
        if (controller) {
            try { controller.abort(); } catch (err) {}
            imgGenPollControllers.delete(pollKey);
        }
        const timerId = imgGenPollTimers.get(pollKey);
        if (timerId) {
            clearTimeout(timerId);
            imgGenPollTimers.delete(pollKey);
        }
    });
}

function hasImgGenPolling(taskId) {
    const prefix = `${taskId}::`;
    for (const key of imgGenPollControllers.keys()) {
        if (String(key).startsWith(prefix)) return true;
    }
    for (const key of imgGenPollTimers.keys()) {
        if (String(key).startsWith(prefix)) return true;
    }
    return false;
}

function setTaskShadow(task) {
    if (!task || !task.id) return;
    taskShadowCache.set(task.id, task);
    const cardEl = document.getElementById('card-' + task.id);
    if (cardEl) cardEl.__veoTask = task;
}

function getTaskShadow(taskId) {
    if (!taskId) return null;
    const cardEl = document.getElementById('card-' + taskId);
    if (cardEl && cardEl.__veoTask) return cardEl.__veoTask;
    return taskShadowCache.get(taskId) || null;
}

function getImgGenStageStatus(task) {
    if (!task || task.type !== 'tool_image_gen') return 'idle';
    ensureImgGenState(task);
    if (getImgGenPendingCount(task) > 0 || task.status === 'processing') return 'pending';
    if (task.status === 'failed') return 'failed';
    const history = Array.isArray(task.state.previewHistory) ? task.state.previewHistory : [];
    if (history.some((item) => item && item.status === 'success')) return 'success';
    return task.status === 'success' ? 'success' : 'idle';
}

function getImgGenStageThumb(task) {
    if (!task || task.type !== 'tool_image_gen') return null;
    ensureImgGenState(task);
    const history = Array.isArray(task.state.previewHistory) ? task.state.previewHistory : [];
    const latest = history.slice().reverse().find((item) => item && item.status === 'success' && item.image);
    if (latest && latest.image) return latest.image;
    if (task.state.resultBlob) return task.state.resultBlob;
    if (Array.isArray(task.state.resultBlobs) && task.state.resultBlobs.length) {
        return task.state.resultBlobs[task.state.resultBlobs.length - 1];
    }
    if (Array.isArray(task.state.images) && task.state.images[0]) return task.state.images[0];
    return null;
}

function getImgGenStageThumbVersion(task) {
    if (!task || !task.state) return '0';
    const history = Array.isArray(task.state.previewHistory) ? task.state.previewHistory : [];
    const latest = history.slice().reverse().find((item) => item && item.status === 'success' && item.image);
    if (latest) return latest.id || latest.createdAt || task.timestamp || 'result';
    if (task.state.resultBlob) return `result_${task.timestamp || 0}`;
    if (Array.isArray(task.state.resultBlobs) && task.state.resultBlobs.length) return `results_${task.state.resultBlobs.length}_${task.timestamp || 0}`;
    if (Array.isArray(task.state.images) && task.state.images[0]) return `base_${task.state.images.length}_${task.timestamp || 0}`;
    return 'empty';
}

function getImgGenStageLabel(task, index) {
    const identity = getImgGenStageIdentity(task, index);
    if (identity) return identity.length > 18 ? `${identity.slice(0, 18)}...` : identity;
    const fallback = `生图 ${index + 1}`;
    if (!task || !task.state) return fallback;
    const prompt = String(task.state.prompt || '').replace(/\s+/g, ' ').trim();
    if (!prompt) return fallback;
    return prompt.length > 18 ? `${prompt.slice(0, 18)}...` : prompt;
}

function getImgGenStageMeta(task) {
    if (!task || task.type !== 'tool_image_gen') return 'IMAGE';
    ensureImgGenState(task);
    const mode = task.state.version === 'pro' ? 'PRO' : 'TRIAL';
    const status = getImgGenStageStatus(task).toUpperCase();
    const ratio = task.state.version === 'pro'
        ? (task.state.proRatio === 'custom' ? `${task.state.customW || 1}:${task.state.customH || 1}` : (task.state.proRatio || '1:1'))
        : (task.state.trialRatio === 'custom' ? `${task.state.customW || 1}:${task.state.customH || 1}` : (task.state.trialRatio || '1:1'));
    return `${mode} · ${ratio} · ${status}`;
}

function renderImgGenStageItem(task, index, activeId) {
    const status = getImgGenStageStatus(task);
    const thumb = getImgGenStageThumb(task);
    const thumbKey = `img_stage_${task.id}_${getImgGenStageThumbVersion(task)}`;
    const thumbUrl = thumb ? getBlobUrl(thumbKey, thumb) : '';
    const isActive = activeId === task.id || selectedTasks.has(task.id);
    const title = getImgGenStageLabel(task, index);
    const meta = getImgGenStageMeta(task);
    const safeId = escapeAttr(task.id);
    const safeTitle = escapeAttr(title);
    const identity = getImgGenStageIdentity(task, index);
    const thumbHtml = thumbUrl
        ? `<img src="${escapeAttr(thumbUrl)}" alt="${safeTitle}" loading="lazy">`
        : `<span class="material-symbols-outlined">auto_awesome</span>`;

    return `
        <button class="img-gen-stage-item is-${status} ${isActive ? 'is-active' : ''}" type="button" onclick="focusImgGenStageCard(event, '${safeId}')" onmousedown="event.stopPropagation()" data-tip="释放到画布：${safeTitle}">
            <span class="img-gen-stage-dot"></span>
            <span class="img-gen-stage-thumb">${thumbHtml}</span>
            <span class="img-gen-stage-meta">
                <strong>${escapeHtml(identity)}</strong>
                <em>${escapeHtml(meta)}</em>
            </span>
            <span class="img-gen-stage-edit" onclick="renameImgGenStageLabel(event, '${safeId}')" data-tip="编辑识别符">
                <span class="material-symbols-outlined">edit</span>
            </span>
        </button>
    `;
}

function isImgGenTaskStageDocked(task) {
    return !!(task && task.type === 'tool_image_gen' && task.state && task.state.stageDocked === true);
}

function isPointInImgGenStageRail(clientX, clientY) {
    const rail = document.getElementById('img-gen-stage-rail');
    if (!rail || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;
    const rect = rail.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
}

function isPointInImgGenStageDockZone(clientX, clientY) {
    const rail = document.getElementById('img-gen-stage-rail');
    if (!rail || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;
    const rect = rail.getBoundingClientRect();
    const expandedLeft = Math.max(0, rect.left - 24);
    const expandedRight = rect.right + 16;
    const expandedTop = Math.max(0, rect.top + 16);
    const expandedBottom = rect.bottom - 16;
    return clientX >= expandedLeft && clientX <= expandedRight && clientY >= expandedTop && clientY <= expandedBottom;
}

function isPointNearImgGenStageRail(clientX, clientY) {
    const rail = document.getElementById('img-gen-stage-rail');
    if (!rail || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;
    const rect = rail.getBoundingClientRect();
    return clientX >= rect.left - 96 && clientX <= rect.right + 8 && clientY >= rect.top - 24 && clientY <= rect.bottom + 24;
}

function buildImgGenStageDefaultLabel(task, index = 0) {
    const rawTitle = String(task && (task.title || task.prompt || task.state?.prompt) || '').replace(/\s+/g, ' ').trim();
    if (rawTitle) {
        const short = rawTitle.length > 14 ? rawTitle.slice(0, 14) : rawTitle;
        return short;
    }
    const suffix = String(task && task.id ? task.id : '').replace(/[^a-z0-9]/gi, '').slice(-4).toUpperCase();
    if (suffix) return `STG-${suffix}`;
    return `STG-${String(index + 1).padStart(2, '0')}`;
}

function getImgGenStageIdentity(task, index = 0) {
    ensureImgGenState(task);
    const custom = String(task && task.state && task.state.stageLabel ? task.state.stageLabel : '').replace(/\s+/g, ' ').trim();
    if (custom) return custom;
    return buildImgGenStageDefaultLabel(task, index);
}

async function renameImgGenStageLabel(event, taskId) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    }
    if (!taskId) return;
    const task = getTaskShadow(taskId) || await getTaskDB(taskId);
    if (!task || task.type !== 'tool_image_gen') return;
    ensureImgGenState(task);
    const current = getImgGenStageIdentity(task, 0);
    const nextRaw = window.prompt('输入调度识别符', current);
    if (nextRaw === null) return;
    const next = String(nextRaw).replace(/\s+/g, ' ').trim().slice(0, 24);
    task.state.stageLabel = next || buildImgGenStageDefaultLabel(task, 0);
    task.state.stageLabelCustom = !!next;
    task.timestamp = Date.now();
    setTaskShadow(task);
    imgGenStageRailFingerprint = '';
    await saveTaskDB(task);
    await renderImgGenStageRail();
    showToast('识别符已更新', 'success');
}

function setImgGenStageDragOver(isOver) {
    const rail = document.getElementById('img-gen-stage-rail');
    if (!rail) return;
    rail.classList.toggle('is-drag-over', !!isOver);
}

function canDragInfoDockToImgGenStage(dragInfo, clientX, clientY) {
    const drawer = document.getElementById('tool-drawer');
    const travel = dragInfo
        ? Math.hypot(toFiniteNumber(clientX, dragInfo.startMouseX) - toFiniteNumber(dragInfo.startMouseX, clientX), toFiniteNumber(clientY, dragInfo.startMouseY) - toFiniteNumber(dragInfo.startMouseY, clientY))
        : 0;
    return !!(
        dragInfo &&
        dragInfo.fromCanvasCard === true &&
        dragInfo.startedInsideStageRail !== true &&
        dragInfo.justCreated !== true &&
        dragInfo.startedNearStageRail !== true &&
        (!drawer || !drawer.classList.contains('open')) &&
        travel >= IMG_GEN_STAGE_DOCK_MIN_TRAVEL &&
        !dragInfo.children &&
        dragInfo.task &&
        dragInfo.task.type === 'tool_image_gen' &&
        isImgGenTaskStageDocked(dragInfo.task) !== true &&
        isPointInImgGenStageDockZone(clientX, clientY)
    );
}

function getImgGenStageRailFingerprint(tasks, activeId) {
    return [
        imgGenStageRailCollapsed ? '1' : '0',
        activeId || '',
        activeImgGenStageReleasedTaskId || '',
        tasks.map((task) => {
            const state = task && task.state ? task.state : {};
            return [
                task.id,
                task.status || 'static',
                task.timestamp || 0,
                getImgGenPendingCount(task),
                Array.isArray(state.previewHistory) ? state.previewHistory.length : 0,
                state.version || '',
                state.proRatio || '',
                state.trialRatio || ''
            ].join(':');
        }).join('|')
    ].join('::');
}

function collectVisibleImgGenStageTasks(exceptTaskId = '') {
    const ids = new Set();
    if (activeImgGenStageReleasedTaskId && activeImgGenStageReleasedTaskId !== exceptTaskId) {
        ids.add(activeImgGenStageReleasedTaskId);
    }
    document.querySelectorAll('.canvas-board > .video-card.tool-image-gen.is-stage-released:not(.is-stage-docked)').forEach((cardEl) => {
        const taskId = resolveTaskIdFromCardElement(cardEl);
        if (taskId && taskId !== exceptTaskId) ids.add(taskId);
    });
    return Array.from(ids);
}

function restoreMountedImgGenStageCards(exceptTaskId = '') {
    const restored = [];
    collectVisibleImgGenStageTasks(exceptTaskId).forEach((id) => {
        const cardEl = document.getElementById('card-' + id);
        const existing = (cardEl && cardEl.__veoTask) || getTaskShadow(id);
        if (!existing || existing.type !== 'tool_image_gen') return;
        const task = cloneTaskDeep(existing) || { ...existing };
        ensureImgGenState(task);
        if (task.state.stageDocked === true) return;
        task.state.stageDocked = true;
        task.state.stageReleased = false;
        task.timestamp = Date.now();
        setTaskShadow(task);
        selectedTasks.delete(id);
        if (cardEl) {
            cardEl.classList.remove('selected', 'is-stage-focused', 'is-stage-released', 'is-stage-spawning');
            cardEl.classList.add('is-stage-docked');
            cardEl.style.willChange = 'auto';
        }
        restored.push(task);
    });
    return restored;
}

async function restoreVisibleImgGenStageCards(exceptTaskId = '') {
    const ids = new Set(collectVisibleImgGenStageTasks(exceptTaskId));
    const allTasks = await getAllTasksDB().catch(() => []);
    if (Array.isArray(allTasks)) {
        allTasks.forEach((item) => {
            if (
                item &&
                item.id &&
                item.id !== exceptTaskId &&
                item.type === 'tool_image_gen' &&
                item.state &&
                item.state.stageReleased === true &&
                item.state.stageDocked !== true
            ) {
                ids.add(item.id);
            }
        });
    }
    const restored = [];
    for (const id of Array.from(ids)) {
        const existing = getTaskShadow(id) || await getTaskDB(id);
        if (!existing || existing.type !== 'tool_image_gen') continue;
        const task = cloneTaskDeep(existing) || { ...existing };
        ensureImgGenState(task);
        if (task.state.stageDocked === true) continue;
        task.state.stageDocked = true;
        task.state.stageReleased = false;
        task.timestamp = Date.now();
        setTaskShadow(task);
        selectedTasks.delete(id);
        const cardEl = document.getElementById('card-' + id);
        if (cardEl) {
            cardEl.classList.remove('selected', 'is-stage-focused', 'is-stage-released');
            cardEl.classList.add('is-stage-docked');
            cardEl.style.willChange = 'auto';
        }
        restored.push(task);
    }
    if (restored.length > 0) {
        await Promise.all(restored.map((task) => saveTaskDB(task)));
    }
    return restored;
}

function ensureCardElementForTask(task) {
    if (!task || !task.id || !board) return null;
    let cardEl = document.getElementById('card-' + task.id);
    if (!cardEl) {
        cardEl = document.createElement('div');
        cardEl.id = 'card-' + task.id;
        if (task.type === 'frame') {
            cardEl.className = 'frame-box';
        } else if (task.type === 'note') {
            cardEl.className = 'video-card sticky-note';
        } else if (task.type === 'tool_generator') {
            cardEl.className = 'video-card tool-generator';
        } else if (task.type === 'tool_image_gen') {
            cardEl.className = 'video-card tool-image-gen';
        } else if (task.type === 'tool_cropper') {
            cardEl.className = 'video-card tool-cropper';
        } else {
            cardEl.className = 'video-card';
        }
        cardEl.style.transform = `translate3d(${toFiniteNumber(task.x, 0)}px, ${toFiniteNumber(task.y, 0)}px, 0)`;
        cardEl.__veoTask = task;
        board.appendChild(cardEl);
    }
    return cardEl;
}

function centerImgGenStageTaskInViewport(task, cardEl = null) {
    if (!task || task.type !== 'tool_image_gen') return;
    ensureImgGenState(task);
    const viewportRect = (viewport && typeof viewport.getBoundingClientRect === 'function')
        ? viewport.getBoundingClientRect()
        : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    const centerClientX = viewportRect.left + Math.max(1, toFiniteNumber(viewportRect.width, window.innerWidth)) / 2;
    const centerClientY = viewportRect.top + Math.max(1, toFiniteNumber(viewportRect.height, window.innerHeight)) / 2;
    const center = clientToBoard(centerClientX, centerClientY);
    const fallbackSize = getTaskFallbackSize(task);
    const measuredSize = cardEl ? getCardWorldSize(cardEl, task) : fallbackSize;
    const width = Math.max(1, toFiniteNumber(measuredSize && measuredSize.width, fallbackSize.width));
    const height = Math.max(1, toFiniteNumber(measuredSize && measuredSize.height, fallbackSize.height));
    task.x = Math.round(center.x - width / 2);
    task.y = Math.round(center.y - height / 2);
}

function selectStageReleasedCard(taskId, cardEl) {
    if (!taskId || !cardEl) return;
    clearSelection();
    selectedTasks.add(taskId);
    cardEl.classList.add('selected');
    cardEl.classList.remove('is-viewport-culled', 'is-stage-docked');
    highestZIndex += 8;
    cardEl.style.zIndex = highestZIndex;
    updateSelectionToolbar();
}

function scheduleStageReleaseAfterpaint(callback, delay = 280) {
    const run = () => {
        const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 0));
        idle(() => {
            try { callback(); } catch (err) { console.warn('Stage release afterpaint failed', err); }
        }, { timeout: 900 });
    };
    setTimeout(run, Math.max(0, delay));
}

async function renderImgGenStageRail(tasksArg = null) {
    const rail = document.getElementById('img-gen-stage-rail');
    const listEl = document.getElementById('img-gen-stage-list');
    const countEl = document.getElementById('img-gen-stage-count');
    if (!rail || !listEl) return;

    const rawTasks = Array.isArray(tasksArg) ? tasksArg : await getAllTasksDB();
    const imgTasks = rawTasks
        .filter((task) => task && task.type === 'tool_image_gen')
        .map((task) => mergeImgGenTaskWithShadow(task, getTaskShadow(task.id), { protectedIds: getImgGenProtectedPreviewIds(task.id) }))
        .filter((task) => {
            ensureImgGenState(task);
            return isImgGenTaskStageDocked(task);
        })
        .filter(Boolean)
        .sort((a, b) => {
            if (a.id === activeImgGenStageTaskId) return -1;
            if (b.id === activeImgGenStageTaskId) return 1;
            return toFiniteNumber(b.timestamp, 0) - toFiniteNumber(a.timestamp, 0);
        });

    const selectedImgId = Array.from(selectedTasks).find((id) => {
        const task = getTaskShadow(id) || imgTasks.find((item) => item && item.id === id);
        return isImgGenTaskStageDocked(task);
    });
    const activeId = activeImgGenStageTaskId || selectedImgId || '';
    const nextFingerprint = getImgGenStageRailFingerprint(imgTasks, activeId);
    if (nextFingerprint === imgGenStageRailFingerprint) {
        rail.classList.toggle('is-collapsed', imgGenStageRailCollapsed);
        rail.classList.toggle('is-empty', imgTasks.length === 0);
        return;
    }
    imgGenStageRailFingerprint = nextFingerprint;

    if (countEl) countEl.textContent = String(imgTasks.length);
    rail.classList.toggle('is-collapsed', imgGenStageRailCollapsed);
    rail.classList.toggle('is-empty', imgTasks.length === 0);

    if (imgTasks.length === 0) {
        listEl.innerHTML = `
            <div class="img-gen-stage-empty">
                <span class="material-symbols-outlined">add_photo_alternate</span>
                <span>把生图卡片拖到这里，即可收纳进台前调度</span>
            </div>
        `;
        return;
    }

    listEl.innerHTML = imgTasks.map((task, index) => renderImgGenStageItem(task, index, activeId)).join('');
}

function scheduleImgGenStageRailRender(delay = 80) {
    clearTimeout(imgGenStageRailTimer);
    imgGenStageRailTimer = setTimeout(() => {
        renderImgGenStageRail().catch((err) => console.warn('Image stage rail render failed', err));
    }, Math.max(0, delay));
}

function toggleImgGenStageRail(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    imgGenStageRailCollapsed = !imgGenStageRailCollapsed;
    try { localStorage.setItem('veo_img_gen_stage_collapsed', imgGenStageRailCollapsed ? '1' : '0'); } catch (err) {}
    renderImgGenStageRail().catch(() => {});
}

async function focusImgGenStageCard(event, taskId) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    if (!taskId) return;
    const sourceTask = getTaskShadow(taskId) || await getTaskDB(taskId);
    if (!sourceTask || sourceTask.type !== 'tool_image_gen') return;
    const task = cloneTaskDeep(sourceTask) || { ...sourceTask };
    ensureImgGenState(task);

    activeImgGenStageTaskId = taskId;
    const restored = restoreMountedImgGenStageCards(taskId);
    const existingCardEl = document.getElementById('card-' + taskId);
    task.state.stageDocked = false;
    task.state.stageReleased = true;
    centerImgGenStageTaskInViewport(task, existingCardEl);
    task.timestamp = Date.now();
    setTaskShadow(task);
    activeImgGenStageReleasedTaskId = taskId;
    imgGenStageRailFingerprint = '';

    const wasMounted = !!existingCardEl;
    const cardEl = ensureCardElementForTask(task);
    if (!cardEl) return;
    cardEl.style.transform = `translate3d(${toFiniteNumber(task.x, 0)}px, ${toFiniteNumber(task.y, 0)}px, 0)`;
    if (!wasMounted) {
        await renderCard(taskId, task);
    } else {
        cardEl.__veoTask = task;
        cardEl.classList.remove('is-stage-docked', 'is-viewport-culled');
        syncCardViewportMetrics(cardEl, task);
    }
    selectStageReleasedCard(taskId, cardEl);
    await waitNextPaint();
    if (cardEl) {
        cardEl.classList.remove('is-stage-docked');
        cardEl.classList.remove('is-stage-spawning');
        cardEl.classList.add('is-stage-focused', 'is-stage-released');
        void cardEl.offsetWidth;
        cardEl.classList.add('is-stage-spawning');
        setTimeout(() => cardEl.classList.remove('is-stage-focused', 'is-stage-spawning'), 260);
    }
    scheduleStageReleaseAfterpaint(() => {
        if (restored.length > 0) {
            const writeRestored = typeof saveTaskBatchDB === 'function'
                ? saveTaskBatchDB(restored)
                : Promise.all(restored.map((item) => saveTaskDB(item)));
            writeRestored.catch(() => {});
        }
        setTimeout(() => restoreVisibleImgGenStageCards(taskId).catch(() => {}), 360);
        saveTaskDB(task).catch(() => {});
        scheduleViewportCulling(120);
        renderMinimap();
        renderImgGenStageRail().catch(() => {});
    });
    showToast(restored.length > 0 ? '已切换台前卡片，上一张已自动收纳' : '已从台前调度释放到画布', 'success');
}

async function dockImgGenCardToStage(dragInfo) {
    if (!canDragInfoDockToImgGenStage(dragInfo, lastPointerClientX, lastPointerClientY)) return false;
    const task = dragInfo.el && dragInfo.el.__veoTask ? dragInfo.el.__veoTask : dragInfo.task;
    ensureImgGenState(task);
    task.x = toFiniteNumber(dragInfo.initialX, task.x);
    task.y = toFiniteNumber(dragInfo.initialY, task.y);
    task.state.stageDocked = true;
    task.state.stageReleased = false;
    task.timestamp = Date.now();
    setTaskShadow(task);
    activeImgGenStageTaskId = task.id;
    if (activeImgGenStageReleasedTaskId === task.id) activeImgGenStageReleasedTaskId = '';
    selectedTasks.delete(task.id);
    dragInfo.el.classList.remove('selected');
    dragInfo.el.classList.remove('is-stage-released');
    dragInfo.el.classList.add('is-stage-docked');
    dragInfo.el.style.willChange = 'auto';
    syncCardViewportMetrics(dragInfo.el, task);
    imgGenStageRailFingerprint = '';
    await saveTaskDB(task);
    setImgGenStageDragOver(false);
    scheduleImgGenStageRailRender(0);
    scheduleViewportCulling(40);
    updateSelectionToolbar();
    renderMinimap();
    showToast('已收纳至台前调度', 'success');
    return true;
}

async function dockImgGenTaskById(event, taskId) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    }
    const task = getTaskShadow(taskId) || await getTaskDB(taskId);
    if (!task || task.type !== 'tool_image_gen') return;
    ensureImgGenState(task);
    if (task.state.stageDocked === true) return;
    task.state.stageDocked = true;
    task.state.stageReleased = false;
    if (!String(task.state.stageLabel || '').trim()) task.state.stageLabel = buildImgGenStageDefaultLabel(task, 0);
    task.timestamp = Date.now();
    setTaskShadow(task);
    activeImgGenStageTaskId = task.id;
    if (activeImgGenStageReleasedTaskId === task.id) activeImgGenStageReleasedTaskId = '';
    selectedTasks.delete(task.id);
    const cardEl = document.getElementById('card-' + task.id);
    if (cardEl) {
        cardEl.classList.remove('selected', 'is-stage-released');
        cardEl.classList.add('is-stage-docked');
    }
    imgGenStageRailFingerprint = '';
    await saveTaskDB(task);
    scheduleImgGenStageRailRender(0);
    scheduleViewportCulling(40);
    updateSelectionToolbar();
    renderMinimap();
    showToast('已收纳至台前调度', 'success');
}

function cloneTaskDeep(task) {
    if (typeof structuredClone === 'function') {
        try { return structuredClone(task); } catch (err) {}
    }
    try { return JSON.parse(JSON.stringify(task)); } catch (err) { return null; }
}

function getImgGenPreviewStatusRank(item) {
    const status = item && item.status ? String(item.status) : '';
    if (status === 'success') return 4;
    if (status === 'failed') return 3;
    if (status === 'pending') return 2;
    return 1;
}

function mergeImgGenPreviewItem(prevItem, nextItem) {
    if (!prevItem) return nextItem ? { ...nextItem } : null;
    if (!nextItem) return { ...prevItem };
    const prevRank = getImgGenPreviewStatusRank(prevItem);
    const nextRank = getImgGenPreviewStatusRank(nextItem);
    const prevTime = toFiniteNumber(prevItem.updatedAt || prevItem.createdAt, 0);
    const nextTime = toFiniteNumber(nextItem.updatedAt || nextItem.createdAt, 0);
    const winner = (nextRank > prevRank || (nextRank === prevRank && nextTime >= prevTime)) ? nextItem : prevItem;
    const fallback = winner === nextItem ? prevItem : nextItem;
    return {
        ...fallback,
        ...winner,
        image: winner.image || fallback.image || null,
        remoteTaskId: winner.remoteTaskId || fallback.remoteTaskId || '',
        errorReason: winner.errorReason || fallback.errorReason || '',
        costTime: Number.isFinite(winner.costTime) ? winner.costTime : (Number.isFinite(fallback.costTime) ? fallback.costTime : null),
        width: toFiniteNumber(winner.width, toFiniteNumber(fallback.width, 0)),
        height: toFiniteNumber(winner.height, toFiniteNumber(fallback.height, 0)),
        ratio: toFiniteNumber(winner.ratio, toFiniteNumber(fallback.ratio, 0)),
        layout: winner.layout || fallback.layout || '',
        referenceControls: Array.isArray(winner.referenceControls) && winner.referenceControls.length
            ? winner.referenceControls
            : (Array.isArray(fallback.referenceControls) ? fallback.referenceControls : [])
    };
}

function getImgGenPreviewList(task) {
    return task && task.state && Array.isArray(task.state.previewHistory) ? task.state.previewHistory : [];
}

function guardImgGenPreviewItem(taskId, item) {
    if (!taskId || !item || !item.id) return;
    const bucket = imgGenPreviewGuards.get(taskId) || new Map();
    bucket.set(item.id, { ...item });
    imgGenPreviewGuards.set(taskId, bucket);
}

function updateImgGenPreviewGuard(taskId, itemId, patch = {}) {
    if (!taskId || !itemId) return;
    const bucket = imgGenPreviewGuards.get(taskId);
    if (!bucket || !bucket.has(itemId)) return;
    bucket.set(itemId, { ...bucket.get(itemId), ...patch });
}

function releaseImgGenPreviewGuard(taskId, itemId) {
    if (!taskId || !itemId) return;
    const bucket = imgGenPreviewGuards.get(taskId);
    if (!bucket) return;
    bucket.delete(itemId);
    if (bucket.size === 0) imgGenPreviewGuards.delete(taskId);
}

function getImgGenPreviewGuardItems(taskId) {
    const bucket = imgGenPreviewGuards.get(taskId);
    return bucket ? Array.from(bucket.values()) : [];
}

function getImgGenProtectedPreviewIds(taskId) {
    return getImgGenPreviewGuardItems(taskId).map((item) => item && item.id).filter(Boolean);
}

function mergeImgGenPreviewHistory(primaryTask, secondaryTask, options = {}) {
    const protectedIds = new Set(Array.isArray(options.protectedIds) ? options.protectedIds.filter(Boolean) : []);
    const primaryList = getImgGenPreviewList(primaryTask);
    const secondaryList = getImgGenPreviewList(secondaryTask);
    const primaryIds = new Set(primaryList.map((item) => item && item.id).filter(Boolean));
    const merged = new Map();

    primaryList.forEach((item) => {
        if (!item || !item.id) return;
        merged.set(item.id, { ...item });
    });

    secondaryList.forEach((item) => {
        if (!item || !item.id) return;
        const existing = merged.get(item.id);
        if (existing) {
            merged.set(item.id, mergeImgGenPreviewItem(existing, item));
            return;
        }

        // Only carry missing older items when they are protected in-flight previews.
        // This prevents stale IndexedDB reads from resurrecting images the user deleted.
        if (protectedIds.has(item.id) && item.status === 'pending' && !primaryIds.has(item.id)) {
            merged.set(item.id, { ...item });
        }
    });

    return Array.from(merged.values()).sort((a, b) => toFiniteNumber(a.createdAt, 0) - toFiniteNumber(b.createdAt, 0));
}

function mergeImgGenTaskWithShadow(task, shadowTask, options = {}) {
    if (!task || task.type !== 'tool_image_gen') return task;
    if (!shadowTask || shadowTask.type !== 'tool_image_gen' || shadowTask.id !== task.id) return task;

    const dbTask = cloneTaskDeep(task) || { ...task };
    const liveTask = cloneTaskDeep(shadowTask) || { ...shadowTask };
    ensureImgGenState(dbTask);
    ensureImgGenState(liveTask);

    const dbTime = toFiniteNumber(dbTask.timestamp, 0);
    const liveTime = toFiniteNumber(liveTask.timestamp, 0);
    const primary = liveTime >= dbTime ? liveTask : dbTask;
    const secondary = primary === liveTask ? dbTask : liveTask;
    const merged = cloneTaskDeep(primary) || { ...primary };
    ensureImgGenState(merged);

    const protectedIds = Array.isArray(options.protectedIds) ? options.protectedIds : [];
    merged.state.previewHistory = mergeImgGenPreviewHistory(primary, secondary, { protectedIds });
    getImgGenPreviewGuardItems(merged.id).forEach((guardItem) => {
        if (!guardItem || !guardItem.id) return;
        const exists = merged.state.previewHistory.some((item) => item && item.id === guardItem.id);
        if (!exists) merged.state.previewHistory.push({ ...guardItem });
    });
    normalizeImgGenPreviewHistory(merged);

    const pendingCount = getImgGenPendingCount(merged);
    if (pendingCount > 0) {
        merged.status = 'processing';
        merged.state.previewCollapsed = false;
        merged.genTaskId = merged.genTaskId || secondary.genTaskId || null;
        merged.retryCount = Math.max(toFiniteNumber(merged.retryCount, 0), toFiniteNumber(secondary.retryCount, 0));
        merged.state.startTime = merged.state.startTime || (secondary.state && secondary.state.startTime) || Date.now();
        merged.state.nextSubmitAt = Math.max(
            toFiniteNumber(merged.state.nextSubmitAt, 0),
            toFiniteNumber(secondary.state && secondary.state.nextSubmitAt, 0)
        );
    } else {
        recalcImgGenTaskStatus(merged);
    }
    merged.timestamp = Math.max(dbTime, liveTime, toFiniteNumber(merged.timestamp, 0));
    return merged;
}

function queueImgGenTaskUpdate(taskId, runner) {
    const prev = imgGenUpdateQueues.get(taskId) || Promise.resolve();
    const next = prev
        .catch(() => null)
        .then(() => runner())
        .catch((err) => {
            console.error('[img-gen-update] failed:', err);
            throw err;
        });

    imgGenUpdateQueues.set(taskId, next);
    next.finally(() => {
        if (imgGenUpdateQueues.get(taskId) === next) imgGenUpdateQueues.delete(taskId);
    });
    return next;
}

function resolveTaskIdFromCardElement(cardEl) {
    if (!cardEl || !cardEl.id || !String(cardEl.id).startsWith('card-')) return '';
    return String(cardEl.id).slice(5);
}

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

function scheduleImgGenPromptPersist(taskId, value) {
    if (!taskId) return;
    const prevTimer = imgGenPromptDraftTimers.get(taskId);
    if (prevTimer) clearTimeout(prevTimer);
    const promptValue = typeof value === 'string' ? value : String(value || '');
    const timer = setTimeout(() => {
        imgGenPromptDraftTimers.delete(taskId);
        queueImgGenTaskUpdate(taskId, async () => {
            const baseTask = getTaskShadow(taskId) || await getTaskDB(taskId);
            if (!baseTask) return;
            const task = cloneTaskDeep(baseTask) || { ...baseTask };
            ensureImgGenState(task);
            task.state.prompt = promptValue;
            task.timestamp = Date.now();
            setTaskShadow(task);
            await saveTaskDB(task);
        }).catch(() => {});
    }, 360);
    imgGenPromptDraftTimers.set(taskId, timer);
}

function updateImgGenPromptDraft(taskId, value) {
    const promptValue = typeof value === 'string' ? value : String(value || '');
    const task = getTaskShadow(taskId);
    if (task && task.type === 'tool_image_gen') {
        ensureImgGenState(task);
        task.state.prompt = promptValue;
        task.timestamp = Date.now();
        setTaskShadow(task);
    }
    scheduleImgGenPromptPersist(taskId, promptValue);
}

function clearImgGenPromptDraftTimer(taskId) {
    const timer = imgGenPromptDraftTimers.get(taskId);
    if (timer) clearTimeout(timer);
    imgGenPromptDraftTimers.delete(taskId);
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
    const modelValue = String(state.model || '');
    let cost = 0.35;
    if (modelValue.toLowerCase().includes('4k')) {
        cost = 0.50;
    } else if (modelValue.toLowerCase().includes('lite')) { // 🌟 兼容特惠模型 fast-lite-1.0
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

    selected.forEach((t) => {
        t.parentId = frameId;
        fitTaskInsideFrameBounds(t, newFrame, FRAME_SAFE_PADDING);
    });
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
    const taskSize = measureTaskAABB(task);
    const cardCenter = { x: task.x + taskSize.width / 2, y: task.y + taskSize.height / 2 };

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
        const frame = await getTaskDB(droppedIntoFrame) || validFrames.find((f) => f.id === droppedIntoFrame);
        const prevParent = task.parentId;
        task.parentId = droppedIntoFrame;
        const fitState = fitTaskInsideFrameBounds(task, frame, FRAME_SAFE_PADDING);
        const saveList = [task];
        if (fitState.frameChanged && frame) saveList.push(frame);
        if (typeof saveTaskBatchDB === 'function') await saveTaskBatchDB(saveList);
        else for (const item of saveList) await saveTaskDB(item);
        if (fitState.taskChanged || fitState.frameChanged) await renderBoard();
        if (prevParent !== droppedIntoFrame) showToast("📦 卡片已移入项目组", "success");
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
let selectionCandidates = [];
let selectionToolbarFrame = 0;
let activeCrop = null, activeFrameResize = null;
let isPrimaryPointerDown = false;
let lastPointerClientX = 0;
let lastPointerClientY = 0;
let toolDragSession = null;
let lastViewportDragClientX = NaN;
let lastViewportDragClientY = NaN;
const CANVAS_MIN_SCALE = 0.18;
const CANVAS_MAX_SCALE = 3.5;
const CANVAS_GRID_BASE = 30;
const CANVAS_CULL_PADDING = 900;
let cameraAnimFrame = 0;
let inertiaFrame = 0;
let cullTimer = null;
let minimapAwakeTimer = null;
let panSamples = [];
let resizeRefreshTimer = null;

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
        ensureImgGenState(task);
        const isCollapsed = task.state.previewCollapsed === true;
        return {
            width: isCollapsed
                ? Math.max(320, Math.min(760, toFiniteNumber(task.state.cardWidthCollapsed, 360)))
                : Math.max(560, Math.min(1200, toFiniteNumber(task.state.cardWidthOpen, 680))),
            height: Math.max(420, Math.min(1100, toFiniteNumber(task.state.cardHeight, 520)))
        };
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

function getVisibleWorldRect(screenPadding = 80) {
    const scaleSafe = Math.max(0.1, toFiniteNumber(transform && transform.scale, 1));
    const viewportRect = (viewport && typeof viewport.getBoundingClientRect === 'function')
        ? viewport.getBoundingClientRect()
        : { width: window.innerWidth, height: window.innerHeight };
    const pad = Math.max(0, toFiniteNumber(screenPadding, 80));
    return {
        left: (pad - toFiniteNumber(transform.x, 0)) / scaleSafe,
        top: (pad - toFiniteNumber(transform.y, 0)) / scaleSafe,
        right: (Math.max(1, viewportRect.width) - pad - toFiniteNumber(transform.x, 0)) / scaleSafe,
        bottom: (Math.max(1, viewportRect.height) - pad - toFiniteNumber(transform.y, 0)) / scaleSafe
    };
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
    if (!el) return '';
    const attr = el.getAttribute('ondragstart') || '';
    if (attr.includes("'generator'")) return 'generator';
    if (attr.includes("'image_gen'")) return 'image_gen';
    if (attr.includes("'cropper'")) return 'cropper';
    return '';
}

function clampCanvasScale(value) {
    return Math.min(CANVAS_MAX_SCALE, Math.max(CANVAS_MIN_SCALE, toFiniteNumber(value, 1)));
}

function cancelCameraAnimation() {
    if (cameraAnimFrame) {
        cancelAnimationFrame(cameraAnimFrame);
        cameraAnimFrame = 0;
    }
}

function cancelCanvasInertia() {
    if (inertiaFrame) {
        cancelAnimationFrame(inertiaFrame);
        inertiaFrame = 0;
    }
    panSamples = [];
}

function setCanvasMoving(active) {
    if (board) board.classList.toggle('is-moving', !!active);
    if (viewport) viewport.classList.toggle('is-panning', !!active);
    document.body.classList.toggle('canvas-camera-active', !!active);
    if (active) wakeMinimap(900);
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
    const container = document.getElementById('minimap-container');
    if (!container || container.classList.contains('is-minimized')) return;
    container.classList.add('is-awake');
    clearTimeout(minimapAwakeTimer);
    minimapAwakeTimer = setTimeout(() => {
        container.classList.remove('is-awake');
    }, Math.max(260, duration));
}

function updateDynamicGrid() {
    const scaleSafe = clampCanvasScale(transform.scale);
    let gridSize = CANVAS_GRID_BASE * scaleSafe;
    while (gridSize < 18) gridSize *= 2;
    while (gridSize > 72) gridSize /= 2;
    const posX = ((toFiniteNumber(transform.x, 0) % gridSize) + gridSize) % gridSize;
    const posY = ((toFiniteNumber(transform.y, 0) % gridSize) + gridSize) % gridSize;
    document.body.style.backgroundSize = `${gridSize}px ${gridSize}px`;
    document.body.style.backgroundPosition = `${posX}px ${posY}px`;
    document.body.style.setProperty('--canvas-grid-size', `${gridSize}px`);
    document.body.style.setProperty('--canvas-grid-opacity', `${Math.max(0.08, Math.min(0.26, 0.22 - Math.abs(scaleSafe - 1) * 0.035))}`);
}

function applyCanvasTransform(options = {}) {
    transform.x = toFiniteNumber(transform.x, window.innerWidth / 2);
    transform.y = toFiniteNumber(transform.y, 100);
    transform.scale = clampCanvasScale(transform.scale);
    if (board) {
        board.style.transform = `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`;
    }
    updateDynamicGrid();
    syncMinimapViewport();
    updateSelectionToolbar();
    if (options.revealMinimap !== false) wakeMinimap(options.minimapDuration || 900);
    if (options.cull !== false) scheduleViewportCulling(options.cullDelay || 120);
}

function zoomCanvasAt(clientX, clientY, nextScale, options = {}) {
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const oldScale = clampCanvasScale(transform.scale);
    const scale = clampCanvasScale(nextScale);
    if (Math.abs(scale - oldScale) < 0.0005) return;
    const mouseX = toFiniteNumber(clientX, rect.left + rect.width / 2) - rect.left;
    const mouseY = toFiniteNumber(clientY, rect.top + rect.height / 2) - rect.top;
    transform.x = mouseX - (mouseX - transform.x) * (scale / oldScale);
    transform.y = mouseY - (mouseY - transform.y) * (scale / oldScale);
    transform.scale = scale;
    applyCanvasTransform(options);
}

function panCanvasBy(deltaX, deltaY, options = {}) {
    transform.x += toFiniteNumber(deltaX, 0);
    transform.y += toFiniteNumber(deltaY, 0);
    applyCanvasTransform(options);
}

function animateCameraTo(target, options = {}) {
    if (!target) return;
    cancelCameraAnimation();
    cancelCanvasInertia();
    const from = { x: transform.x, y: transform.y, scale: transform.scale };
    const to = {
        x: toFiniteNumber(target.x, from.x),
        y: toFiniteNumber(target.y, from.y),
        scale: clampCanvasScale(target.scale !== undefined ? target.scale : from.scale)
    };
    const duration = Math.max(120, toFiniteNumber(options.duration, 420));
    const start = performance.now();
    setCanvasMoving(true);
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
    const step = (now) => {
        const p = Math.min(1, (now - start) / duration);
        const eased = easeOutCubic(p);
        transform.x = from.x + (to.x - from.x) * eased;
        transform.y = from.y + (to.y - from.y) * eased;
        transform.scale = from.scale + (to.scale - from.scale) * eased;
        applyCanvasTransform({ cull: false, minimapDuration: 900 });
        if (p < 1) {
            cameraAnimFrame = requestAnimationFrame(step);
        } else {
            cameraAnimFrame = 0;
            setCanvasMoving(false);
            scheduleViewportCulling(40);
            renderMinimap();
        }
    };
    cameraAnimFrame = requestAnimationFrame(step);
}

function recordPanSample(clientX, clientY) {
    const now = performance.now();
    panSamples.push({ x: toFiniteNumber(clientX, 0), y: toFiniteNumber(clientY, 0), t: now });
    panSamples = panSamples.filter((sample) => now - sample.t <= 120);
}

function startCanvasInertia() {
    if (panSamples.length < 2) {
        scheduleViewportCulling(60);
        return;
    }
    const last = panSamples[panSamples.length - 1];
    let first = panSamples[0];
    for (let i = panSamples.length - 2; i >= 0; i--) {
        if (last.t - panSamples[i].t >= 48) {
            first = panSamples[i];
            break;
        }
    }
    const dt = Math.max(16, last.t - first.t);
    let velocityX = (last.x - first.x) / dt;
    let velocityY = (last.y - first.y) / dt;
    const speed = Math.hypot(velocityX, velocityY);
    panSamples = [];
    if (speed < 0.05) {
        scheduleViewportCulling(60);
        return;
    }
    let prev = performance.now();
    setCanvasMoving(true);
    const decayPerFrame = 0.91;
    const step = (now) => {
        const delta = Math.min(34, Math.max(8, now - prev));
        prev = now;
        transform.x += velocityX * delta;
        transform.y += velocityY * delta;
        velocityX *= Math.pow(decayPerFrame, delta / 16.67);
        velocityY *= Math.pow(decayPerFrame, delta / 16.67);
        applyCanvasTransform({ cull: false, minimapDuration: 700 });
        if (Math.hypot(velocityX, velocityY) > 0.018) {
            inertiaFrame = requestAnimationFrame(step);
        } else {
            inertiaFrame = 0;
            setCanvasMoving(false);
            scheduleViewportCulling(40);
            renderMinimap();
        }
    };
    inertiaFrame = requestAnimationFrame(step);
}

function getCardWorldSize(cardEl, task) {
    const fallback = getTaskFallbackSize(task);
    const dataW = toFiniteNumber(cardEl && cardEl.dataset ? cardEl.dataset.aabbWidth : 0, 0);
    const dataH = toFiniteNumber(cardEl && cardEl.dataset ? cardEl.dataset.aabbHeight : 0, 0);
    return {
        width: Math.max(1, dataW || fallback.width),
        height: Math.max(1, dataH || fallback.height)
    };
}

function syncCardViewportMetrics(cardEl, task) {
    if (!cardEl || !task) return;
    if (cardEl.classList.contains('is-viewport-culled')) return;
    const size = measureTaskAABB(task);
    cardEl.dataset.aabbWidth = String(size.width);
    cardEl.dataset.aabbHeight = String(size.height);
    cardEl.style.setProperty('--culled-width', `${size.width}px`);
    cardEl.style.setProperty('--culled-height', `${size.height}px`);
}

function updateViewportCulling() {
    if (!viewport || !board) return;
    const scaleSafe = clampCanvasScale(transform.scale);
    const padding = CANVAS_CULL_PADDING / scaleSafe;
    const view = {
        left: -transform.x / scaleSafe - padding,
        top: -transform.y / scaleSafe - padding,
        right: (-transform.x + window.innerWidth) / scaleSafe + padding,
        bottom: (-transform.y + window.innerHeight) / scaleSafe + padding
    };
    document.querySelectorAll('.canvas-board > .video-card, .canvas-board > .frame-box').forEach((cardEl) => {
        const task = cardEl.__veoTask;
        if (!task || cardEl.classList.contains('hidden-in-frame') || cardEl.classList.contains('is-stage-docked') || cardEl.classList.contains('selected') || (draggingCardInfo && draggingCardInfo.el === cardEl)) {
            cardEl.classList.remove('is-viewport-culled');
            return;
        }
        const size = getCardWorldSize(cardEl, task);
        const left = toFiniteNumber(task.x, 0);
        const top = toFiniteNumber(task.y, 0);
        const outside = left + size.width < view.left || left > view.right || top + size.height < view.top || top > view.bottom;
        cardEl.classList.toggle('is-viewport-culled', outside);
    });
}

function scheduleViewportCulling(delay = 120) {
    clearTimeout(cullTimer);
    cullTimer = setTimeout(updateViewportCulling, Math.max(0, delay));
}

function getSelectedCanvasElements() {
    return Array.from(selectedTasks)
        .map((id) => document.getElementById('card-' + id))
        .filter((el) => el && !el.classList.contains('hidden-in-frame') && !el.classList.contains('is-stage-docked'));
}

function ensureSelectionToolbar() {
    let toolbar = document.getElementById('canvas-selection-toolbar');
    if (toolbar) return toolbar;
    toolbar = document.createElement('div');
    toolbar.id = 'canvas-selection-toolbar';
    toolbar.className = 'canvas-selection-toolbar';
    toolbar.innerHTML = `
        <button type="button" data-action="focus" data-tip="聚焦选中节点"><span class="material-symbols-outlined">center_focus_strong</span></button>
        <button type="button" data-action="duplicate" data-tip="复制选中节点"><span class="material-symbols-outlined">content_copy</span></button>
        <button type="button" data-action="delete" data-tip="删除选中节点"><span class="material-symbols-outlined">delete</span></button>
        <button type="button" data-action="clear" data-tip="取消选择"><span class="material-symbols-outlined">close</span></button>
    `;
    toolbar.addEventListener('mousedown', (event) => event.stopPropagation());
    toolbar.addEventListener('click', async (event) => {
        const button = event.target.closest('button[data-action]');
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();
        const action = button.dataset.action;
        if (action === 'focus') focusSelectedTasks();
        if (action === 'duplicate') await duplicateSelectedTasks();
        if (action === 'delete') await deleteSelectedTasks();
        if (action === 'clear') clearSelection();
    });
    document.body.appendChild(toolbar);
    return toolbar;
}

function updateSelectionToolbar() {
    const toolbar = ensureSelectionToolbar();
    const elements = getSelectedCanvasElements().filter((el) => !el.classList.contains('is-viewport-culled'));
    if (elements.length === 0 || isPanning || isSelecting) {
        toolbar.classList.remove('show');
        return;
    }
    const rects = elements.map((el) => el.getBoundingClientRect()).filter((rect) => rect.width > 0 && rect.height > 0);
    if (rects.length === 0) {
        toolbar.classList.remove('show');
        return;
    }
    const bounds = rects.reduce((acc, rect) => ({
        left: Math.min(acc.left, rect.left),
        top: Math.min(acc.top, rect.top),
        right: Math.max(acc.right, rect.right),
        bottom: Math.max(acc.bottom, rect.bottom)
    }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
    const x = Math.max(86, Math.min(window.innerWidth - 86, (bounds.left + bounds.right) / 2));
    const y = Math.max(14, bounds.top - 48);
    toolbar.style.transform = `translate(${x}px, ${y}px) translateX(-50%)`;
    toolbar.classList.add('show');
}

function requestSelectionToolbarUpdate() {
    if (selectionToolbarFrame) return;
    selectionToolbarFrame = requestAnimationFrame(() => {
        selectionToolbarFrame = 0;
        updateSelectionToolbar();
    });
}

function buildSelectionCandidates() {
    return Array.from(document.querySelectorAll('.canvas-board > .video-card, .canvas-board > .frame-box'))
        .filter((card) => card && !card.classList.contains('hidden-in-frame') && !card.classList.contains('is-stage-docked') && !card.classList.contains('is-viewport-culled'))
        .map((card) => ({
            el: card,
            id: card.id ? card.id.replace('card-', '') : '',
            rect: card.getBoundingClientRect()
        }))
        .filter((item) => item.id && item.rect && item.rect.width > 0 && item.rect.height > 0);
}

window.addEventListener('mousedown', (e) => {
    if (e.button === 0) isPrimaryPointerDown = true;
    if (Number.isFinite(e.clientX)) lastPointerClientX = e.clientX;
    if (Number.isFinite(e.clientY)) lastPointerClientY = e.clientY;
}, true);

function clearSelection() {
    selectionCandidates = [];
    selectedTasks.clear();
    document.querySelectorAll('.video-card.selected, .frame-box.selected').forEach(c => c.classList.remove('selected'));
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
            else if (isSelecting) {
                const currentX = e.clientX, currentY = e.clientY, left = Math.min(startSelX, currentX), top = Math.min(startSelY, currentY), width = Math.abs(currentX - startSelX), height = Math.abs(currentY - startSelY);
                const isCrossing = currentX < startSelX;
                if(marquee) {
                    marquee.style.left = left + 'px';
                    marquee.style.top = top + 'px';
                    marquee.style.width = width + 'px';
                    marquee.style.height = height + 'px';
                    marquee.classList.toggle('is-crossing', isCrossing);
                    marquee.classList.toggle('is-window', !isCrossing);
                }
                const selRect = { left, top, right: left + width, bottom: top + height };
                const candidates = selectionCandidates.length ? selectionCandidates : buildSelectionCandidates();
                candidates.forEach((candidate) => {
                    const card = candidate.el;
                    const rect = candidate.rect;
                    const intersects = rect.left < selRect.right && rect.right > selRect.left && rect.top < selRect.bottom && rect.bottom > selRect.top;
                    const contains = rect.left >= selRect.left && rect.right <= selRect.right && rect.top >= selRect.top && rect.bottom <= selRect.bottom;
                    const hit = isCrossing ? intersects : contains;
                    if (hit) { card.classList.add('selected'); selectedTasks.add(candidate.id); }
                    else { card.classList.remove('selected'); selectedTasks.delete(candidate.id); }
                });
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
            else if (activeFrameResize) {
                const dx = (e.clientX - activeFrameResize.startX) / transform.scale, dy = (e.clientY - activeFrameResize.startY) / transform.scale;
                const newW = Math.max(activeFrameResize.minW, activeFrameResize.startW + dx);
                const newH = Math.max(activeFrameResize.minH, activeFrameResize.startH + dy);
                activeFrameResize.el.style.width = newW + 'px'; activeFrameResize.el.style.height = newH + 'px';
                activeFrameResize.task.width = newW; activeFrameResize.task.height = newH;
                syncCardViewportMetrics(activeFrameResize.el, activeFrameResize.task);
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
        ? e.target.closest('input, textarea, select, button, .img-gen-preview-panel, .cropper-workspace, .img-gen-mask-block')
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
            isSelecting = true;
            startSelX = e.clientX;
            startSelY = e.clientY;
            selectionCandidates = buildSelectionCandidates();
            if(marquee) {
                marquee.style.left = startSelX + 'px';
                marquee.style.top = startSelY + 'px';
                marquee.style.width = '0';
                marquee.style.height = '0';
                marquee.style.display = 'block';
                marquee.classList.add('is-window');
                marquee.classList.remove('is-crossing');
            }
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
    if (isSelecting) {
        isSelecting = false;
        selectionCandidates = [];
        if(marquee) {
            marquee.style.display = 'none';
            marquee.classList.remove('is-crossing', 'is-window');
        }
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
    if (activeFrameResize) {
        syncCardViewportMetrics(activeFrameResize.el, activeFrameResize.task);
        await saveTaskDB(activeFrameResize.task);
        activeFrameResize = null;
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
    e.stopPropagation();
    isPanning = false; setCanvasMoving(false);
    const el = document.getElementById('card-' + id);
    const task = el.__veoTask;

    let minW = 340;
    let minH = 140;

    if (task) {
        document.querySelectorAll('.video-card, .frame-box').forEach(childEl => {
            if (childEl.__veoTask && childEl.__veoTask.parentId === id) {
                const childTask = childEl.__veoTask;
                const childSize = measureTaskAABB(childTask);
                const childRight = (childTask.x - task.x) + childSize.width + FRAME_SAFE_PADDING;
                const childBottom = (childTask.y - task.y) + childSize.height + FRAME_SAFE_PADDING;
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
    cardEl.oncontextmenu = (e) => {
        const interactive = e.target && typeof e.target.closest === 'function'
            ? e.target.closest('input, textarea, select, button, video, .cropper-workspace, .img-gen-mask-block, .img-gen-preview-panel')
            : null;
        if (interactive) return;
        openCanvasTaskContextMenu(e, task.id);
    };
    cardEl.onmousedown = (e) => {
        if(e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON' && !e.target.classList.contains('frame-resize-handle')) {
            highestZIndex++; cardEl.style.zIndex = highestZIndex;
            if (task.type === 'tool_image_gen') {
                activeImgGenStageTaskId = task.id;
                if (isImgGenTaskStageDocked(task)) scheduleImgGenStageRailRender(80);
            }
        }
    };

    const header = cardEl.querySelector('.card-header') || cardEl.querySelector('.frame-header');
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
                initialY: toFiniteNumber(cardEl.__veoTask && cardEl.__veoTask.y, 0),
                fromCanvasCard: true,
                startedInsideStageRail: isPointInImgGenStageRail(e.clientX, e.clientY),
                startedNearStageRail: isPointNearImgGenStageRail(e.clientX, e.clientY),
                justCreated: false
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
            e.stopPropagation(); isPanning = false; setCanvasMoving(false);
            startFrameResize(e, task.id);
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
    if (clone.type === 'tool_cropper' && clone.state) clone.state.resultBlob = null;

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
        selectedTasks.add(clone.id);
        const el = document.getElementById('card-' + clone.id);
        if (el) {
            el.classList.add('selected');
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
    selectedTasks.add(taskId);
    el.classList.add('selected');
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
        e.preventDefault(); document.querySelectorAll('.video-card, .frame-box').forEach(card => { if(card.classList.contains('hidden-in-frame')) return; selectedTasks.add(card.id.replace('card-', '')); card.classList.add('selected'); }); updateSelectionToolbar(); scheduleViewportCulling(40); showToast(`已全选可视节点`, "info");
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

let mapMeta = { minX: 0, minY: 0, mapScale: 0, offsetX: 0, offsetY: 0 };

async function renderMinimap() {
    const container = document.getElementById('minimap-container');
    if (!container || container.classList.contains('is-minimized')) return;

    const canvas = document.getElementById('minimap-canvas'), viewBox = document.getElementById('minimap-viewport-box');
    if (!canvas || !viewBox) return;
    const ctx = canvas.getContext('2d'), cw = container.clientWidth, ch = container.clientHeight;
    canvas.width = cw; canvas.height = ch;

    const tasks = await getAllTasksDB(); const boardTasks = tasks.filter(t => t.type !== 'local_image' && !isImgGenTaskStageDocked(t));
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
    if (!mapMeta || !Number.isFinite(mapMeta.mapScale) || mapMeta.mapScale <= 0) {
        viewBox.style.display = 'none';
        return;
    }
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
    animateCameraTo({
        x: -targetWorldX * transform.scale + window.innerWidth / 2,
        y: -targetWorldY * transform.scale + window.innerHeight / 2,
        scale: transform.scale
    }, { duration: 420 });
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
    document.body.classList.add('is-tool-dragging');

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
    document.body.classList.remove('is-tool-dragging');
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
                version: 'pro',
                providerSort: 'stable',
                modelSuffix: '',
                routeMode: 'success_rate',
                imageModel: 'gpt-image-2',
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
                channel: 'channel_1',
                autoRetry: false,
                stageDocked: false,
                stageReleased: false
            },
            retryCount: 0
        };
        else if (pluginType === 'cropper') newTool = { id: 'tool_crop_' + Date.now(), type: 'tool_cropper', x: spawnX, y: spawnY, timestamp: Date.now(), state: { sourceBlob: null, resultBlob: null, cropParams: { left: 10, top: 10, width: 80, height: 80 } } };
        if (newTool) {
            await saveTaskDB(newTool);
            renderBoard();
            document.getElementById('tool-drawer').classList.remove('open');
            toolDragSession = null;
            document.body.classList.remove('is-tool-dragging');
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
                    if (meta.previewId && Array.isArray(t.state?.previewHistory)) {
                        const hit = t.state.previewHistory.find((entry) => entry && entry.id === meta.previewId && entry.status === 'success' && entry.image);
                        if (hit) srcToUse = hit.image;
                    }
                    if (!srcToUse) {
                        const idx = Number.isFinite(Number(meta.index)) ? Number(meta.index) : 0;
                        if (Array.isArray(t.state?.resultBlobs) && t.state.resultBlobs[idx]) srcToUse = t.state.resultBlobs[idx];
                        else srcToUse = t.state?.resultBlob;
                    }
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

function getTaskReusableImage(task) {
    if (!task || typeof task !== 'object') return null;
    if (task.type === 'local_image') return task.src || null;
    if (task.type === 'tool_cropper') return task.state && task.state.resultBlob ? task.state.resultBlob : (task.state && task.state.sourceBlob ? task.state.sourceBlob : null);
    if (task.type === 'tool_image_gen') {
        ensureImgGenState(task);
        const history = Array.isArray(task.state.previewHistory) ? task.state.previewHistory : [];
        const latest = history.slice().reverse().find((item) => item && item.status === 'success' && item.image);
        return latest ? latest.image : (task.state.resultBlob || (Array.isArray(task.state.images) ? task.state.images[0] : null));
    }
    if (task.rawImages) {
        return task.rawImages.firstFrame || (Array.isArray(task.rawImages.references) ? task.rawImages.references[0] : null) || task.rawImages.lastFrame || null;
    }
    return null;
}

async function sendTaskImageToConsole(taskId, target) {
    const task = getTaskShadow(taskId) || await getTaskDB(taskId);
    const image = getTaskReusableImage(task);
    if (!image) {
        showToast('该卡片没有可复用图片', 'warning');
        return;
    }
    if (target === 'lastFrame') {
        setConsoleFrameImage('lastFrame', image);
        showToast('已作为尾帧送入 Veo 控制台', 'success');
    } else if (target === 'reference') {
        if (addConsoleReferenceImage(image)) showToast('已作为参考图送入 Veo 控制台', 'success');
    } else {
        setConsoleFrameImage('firstFrame', image);
        showToast('已作为首帧送入 Veo 控制台', 'success');
    }
}

function closeCanvasContextMenu() {
    const menu = document.getElementById('canvas-card-context-menu');
    if (menu) menu.remove();
}

function openCanvasTaskContextMenu(e, taskId) {
    if (!taskId) return;
    e.preventDefault();
    e.stopPropagation();
    closeCanvasContextMenu();
    const task = document.getElementById('card-' + taskId)?.__veoTask || getTaskShadow(taskId);
    const hasImage = !!getTaskReusableImage(task);
    const menu = document.createElement('div');
    menu.id = 'canvas-card-context-menu';
    menu.className = 'canvas-card-context-menu';
    menu.innerHTML = `
        <button type="button" data-action="focus"><span class="material-symbols-outlined">center_focus_strong</span>聚焦卡片</button>
        <button type="button" data-action="duplicate"><span class="material-symbols-outlined">content_copy</span>复制卡片</button>
        ${hasImage ? '<div class="context-menu-divider"></div>' : ''}
        ${hasImage ? '<button type="button" data-action="first"><span class="material-symbols-outlined">first_page</span>作为首帧发送至 Veo</button>' : ''}
        ${hasImage ? '<button type="button" data-action="last"><span class="material-symbols-outlined">last_page</span>作为尾帧发送至 Veo</button>' : ''}
        ${hasImage ? '<button type="button" data-action="ref"><span class="material-symbols-outlined">add_photo_alternate</span>作为参考图发送至 Veo</button>' : ''}
        <div class="context-menu-divider"></div>
        <button type="button" data-action="delete" class="danger"><span class="material-symbols-outlined">delete</span>删除卡片</button>
    `;
    menu.style.left = `${Math.min(window.innerWidth - 230, Math.max(12, e.clientX))}px`;
    menu.style.top = `${Math.min(window.innerHeight - 280, Math.max(12, e.clientY))}px`;
    menu.addEventListener('mousedown', (event) => event.stopPropagation());
    menu.addEventListener('click', async (event) => {
        const btn = event.target.closest('button[data-action]');
        if (!btn) return;
        event.preventDefault();
        event.stopPropagation();
        const action = btn.dataset.action;
        closeCanvasContextMenu();
        if (action === 'focus') focusTaskById(taskId);
        if (action === 'duplicate') {
            const source = getTaskShadow(taskId) || await getTaskDB(taskId);
            if (source) {
                clearSelection();
                selectedTasks.add(taskId);
                await duplicateSelectedTasks();
            }
        }
        if (action === 'first') await sendTaskImageToConsole(taskId, 'firstFrame');
        if (action === 'last') await sendTaskImageToConsole(taskId, 'lastFrame');
        if (action === 'ref') await sendTaskImageToConsole(taskId, 'reference');
        if (action === 'delete') await removeTask(taskId);
    });
    document.body.appendChild(menu);
}

window.addEventListener('click', closeCanvasContextMenu);
window.addEventListener('blur', closeCanvasContextMenu);

// ==========================================
// 🚀 核心：单节点局部渲染引擎 (彻底告别全局闪烁)
// ==========================================
function applyImgGenCardFrame(cardEl, task) {
    if (!cardEl || !task || task.type !== 'tool_image_gen') return;
    ensureImgGenState(task);
    const isOpen = task.state.previewCollapsed !== true;
    cardEl.classList.toggle('is-img-variant-node', !!task.state.variantGroupId);
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
    const currentChannel = (task.state && task.state.channel) ? task.state.channel : 'channel_1';
    const currentVersion = (task.state && task.state.version) ? task.state.version : 'trial';
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
    cardEl.setAttribute('data-sync-channel', currentChannel);
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

// ==========================================
// ✂️ 局部裁切器 (Cropper) 核心交互逻辑 (局部渲染版)
// ==========================================
async function handleCropperDrop(e, taskId) {
    e.preventDefault(); e.stopPropagation();
    const srcToUse = await parseDroppedImage(e);
    if (srcToUse) {
        const task = await getTaskDB(taskId);
        if (task) {
            revokeBlobPrefixSafe(taskId + '_src_');
            revokeBlobPrefixSafe(taskId + '_res_');
            task.state.sourceBlob = srcToUse;
            task.state.resultBlob = null;
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
        revokeBlobPrefixSafe(taskId + '_src_');
        revokeBlobPrefixSafe(taskId + '_res_');
        task.state.sourceBlob = blob;
        task.state.resultBlob = null;
        task.timestamp = Date.now();
        await saveTaskDB(task);
        renderCard(taskId);
    }
    input.value = '';
}

async function resetCropper(taskId) {
    const task = await getTaskDB(taskId);
    if (task) {
        revokeBlobPrefixSafe(taskId + '_src_');
        revokeBlobPrefixSafe(taskId + '_res_');
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
        revokeBlobPrefixSafe(taskId + '_res_');
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
    const slot = document.getElementById(slotId);
    if (!slot) return;
    slot.addEventListener('dragover', (e) => { e.preventDefault(); slot.classList.add('drag-over'); });
    slot.addEventListener('dragleave', (e) => { e.preventDefault(); slot.classList.remove('drag-over'); });
    slot.addEventListener('drop', async (e) => {
        e.preventDefault(); slot.classList.remove('drag-over'); const srcToUse = await parseDroppedImage(e);
        if (srcToUse) {
            if (stateKey === 'references') {
                addConsoleReferenceImage(srcToUse);
                showToast('已送入 Veo 参考图槽', 'success');
            }
            else {
                setConsoleFrameImage(stateKey, srcToUse);
                showToast(stateKey === 'firstFrame' ? '已送入 Veo 首帧槽' : '已送入 Veo 尾帧槽', 'success');
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
    const value = toFiniteNumber(amount, NaN);
    if (!Number.isFinite(value) || value < 0) return '';
    return `￥${value.toFixed(4)}`;
}

function getVideoInputModeLabel(mode) {
    return mode === 'frame' ? '首尾帧' : '参考图';
}

function getVideoQualityModel(modelValue) {
    const raw = String(modelValue || '').toLowerCase();
    return raw.includes('4k') ? 'veo3.1-4k' : 'veo3.1';
}

function getVideoInputModeFromTask(task) {
    const rawMode = task && (task.inputMode || task.mode);
    if (rawMode === 'frame' || rawMode === 'ref') return rawMode;
    return task && String(task.modelVal || '').includes('components') ? 'ref' : 'frame';
}

function buildVideoSubmitModel(modelValue, inputMode) {
    const qualityModel = getVideoQualityModel(modelValue);
    const safeMode = inputMode === 'frame' ? 'frame' : 'ref';
    if (qualityModel === 'veo3.1-4k') {
        return safeMode === 'ref' ? 'veo3.1-components-4k' : 'veo3.1-4k';
    }
    return safeMode === 'ref' ? 'veo3.1-components' : 'veo3.1';
}

function getVideoModelDisplayName(modelValue, inputMode) {
    const raw = String(modelValue || '').toLowerCase();
    if (raw.includes('lite')) return '极速特惠版';
    const modelName = getVideoQualityModel(modelValue) === 'veo3.1-4k' ? 'Veo 3.1 4K' : 'Veo 3.1 普通';
    return `${modelName} · ${getVideoInputModeLabel(inputMode)}`;
}

function extractImgGenUsage(rawData) {
    const roots = [];
    const queue = [];
    const seen = typeof WeakSet === 'function' ? new WeakSet() : null;
    const pushCandidate = (candidate) => {
        if (!candidate || typeof candidate !== 'object') return;
        queue.push(candidate);
    };
    if (Array.isArray(rawData)) rawData.forEach(pushCandidate);
    else pushCandidate(rawData);

    while (queue.length > 0 && roots.length < 24) {
        const current = queue.shift();
        if (!current || typeof current !== 'object') continue;
        if (seen) {
            if (seen.has(current)) continue;
            seen.add(current);
        }
        roots.push(current);
        if (current.json && typeof current.json === 'object') queue.push(current.json);
        if (current.body && typeof current.body === 'object') queue.push(current.body);
        if (current.result && typeof current.result === 'object') queue.push(current.result);
        if (current.response && typeof current.response === 'object') queue.push(current.response);
        if (current.data && typeof current.data === 'object' && !Array.isArray(current.data)) queue.push(current.data);
    }

    const pickNumber = (obj, keys) => {
        for (const key of keys) {
            const value = obj && obj[key];
            const num = toFiniteNumber(value, NaN);
            if (Number.isFinite(num) && num >= 0) return num;
        }
        return NaN;
    };

    const normalizeDetails = (details) => {
        if (!details || typeof details !== 'object') return { textTokens: 0, imageTokens: 0 };
        const textTokens = pickNumber(details, ['text_tokens', 'textTokens', 'token_text', 'text']);
        const imageTokens = pickNumber(details, ['image_tokens', 'imageTokens', 'token_image', 'image']);
        return {
            textTokens: Number.isFinite(textTokens) ? textTokens : 0,
            imageTokens: Number.isFinite(imageTokens) ? imageTokens : 0
        };
    };

    for (const root of roots) {
        const usage = root.usage || root.token_usage || root.tokenUsage || root.usage_stats || root.usageStats || null;
        const source = usage && typeof usage === 'object' ? usage : root;
        const inputTokens = pickNumber(source, ['input_tokens', 'inputTokens', 'prompt_tokens', 'promptTokens', 'input_token_count']);
        const outputTokens = pickNumber(source, ['output_tokens', 'outputTokens', 'completion_tokens', 'completionTokens', 'output_token_count']);
        const totalTokens = pickNumber(source, ['total_tokens', 'totalTokens', 'tokens', 'token_count']);
        const inputDetails = normalizeDetails(source.input_tokens_details || source.inputTokensDetails || source.prompt_tokens_details || source.promptTokensDetails);
        const outputDetails = normalizeDetails(source.output_tokens_details || source.outputTokensDetails || source.completion_tokens_details || source.completionTokensDetails);
        const hasAny =
            Number.isFinite(inputTokens) || Number.isFinite(outputTokens) || Number.isFinite(totalTokens) ||
            inputDetails.textTokens > 0 || inputDetails.imageTokens > 0 || outputDetails.textTokens > 0 || outputDetails.imageTokens > 0;
        if (!hasAny) continue;

        const resolvedInputTokens = Number.isFinite(inputTokens)
            ? inputTokens
            : (inputDetails.textTokens + inputDetails.imageTokens);
        const resolvedOutputTokens = Number.isFinite(outputTokens)
            ? outputTokens
            : (outputDetails.textTokens + outputDetails.imageTokens);

        return {
            inputTokens: Math.max(0, Math.round(resolvedInputTokens || 0)),
            outputTokens: Math.max(0, Math.round(resolvedOutputTokens || 0)),
            totalTokens: Math.max(0, Math.round(Number.isFinite(totalTokens) ? totalTokens : (resolvedInputTokens + resolvedOutputTokens || 0))),
            inputDetails,
            outputDetails
        };
    }
    return null;
}

function calculateImgGenBilling(task, rawData) {
    const version = task && task.state && task.state.version === 'pro' ? 'pro' : 'trial';
    const channel = task && task.state && task.state.channel === 'channel_2' ? 'channel_2' : 'channel_1';
    if (version === 'pro') {
        const usage = extractImgGenUsage(rawData);
        if (usage && (usage.inputTokens > 0 || usage.outputTokens > 0)) {
            const officialCost = ((usage.inputTokens * IMG_GEN_PRO_INPUT_PRICE_PER_1M) + (usage.outputTokens * IMG_GEN_PRO_OUTPUT_PRICE_PER_1M)) / 1000000;
            const cost = officialCost * IMG_GEN_PROXY_RECHARGE_FACTOR;
            return {
                cost,
                detail: `AI生图 专业版 GPT Image 2 · 输入 ${usage.inputTokens} / 输出 ${usage.outputTokens} tokens · 中转半价`,
                usage
            };
        }
        return {
            cost: IMG_GEN_PRO_FALLBACK_COST,
            detail: 'AI生图 专业版 GPT Image 2 · usage 缺失兜底',
            usage: null
        };
    }

    const cost = channel === 'channel_2' ? 0.06 : 0.084;
    return {
        cost,
        detail: `AI生图 试用版 (${channel})`,
        usage: null
    };
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

async function submitBatchTask() {
    const prompt = document.getElementById('prompt-input').value.trim(); if (!prompt) return alert('请填写提示词');
    const batchCount = parseInt(document.getElementById('batch-select').value), btn = document.getElementById('generate-btn');
    btn.disabled = true; btn.innerHTML = `<svg class="spinner" viewBox="0 0 50 50"><circle cx="25" cy="25" r="20"></circle></svg>`;

    const state = globalStore.getState();
    const inputMode = state.currentMode === 'frame' ? 'frame' : 'ref';
    let submitRef = [...state.references], submitFirst = state.firstFrame, submitLast = state.lastFrame;
    if (inputMode === 'ref') { submitFirst = null; submitLast = null; } else submitRef = [];
    const taskParams = { model: buildVideoSubmitModel(state.model, inputMode), inputMode, aspectRatio: state.aspectRatio, enhancePrompt: state.enhancePrompt, enableUpsample: state.enableUpsample, autoRetry: state.autoRetry, firstFrame: submitFirst, lastFrame: submitLast, references: submitRef };
    let promises = []; for(let i=0; i<batchCount; i++) promises.push(executeSubmission(taskParams, prompt, i));

    await Promise.allSettled(promises);
    btn.disabled = false; btn.innerHTML = `<span class="material-symbols-outlined">arrow_upward</span>`; updateEstimatedCost();
    document.getElementById('prompt-input').value = '';
    // Keep all console cleanup on the same state/UI path as manual slot actions.
    clearFrame(null, 'firstFrame');
    clearFrame(null, 'lastFrame');
    clearReferences({ stopPropagation() {} });
    const firstFile = document.getElementById('first-file');
    const lastFile = document.getElementById('last-file');
    const refFile = document.getElementById('ref-file');
    if (firstFile) firstFile.value = '';
    if (lastFile) lastFile.value = '';
    if (refFile) refFile.value = '';
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
            const taskMode = params.inputMode || (params.references && params.references.length > 0 ? 'ref' : 'frame');
            const displayModelName = getVideoModelDisplayName(params.model, taskMode);

            const newTask = { id: returnedId, prompt: promptText, modelStr: displayModelName, modelVal: params.model, ratio: params.aspectRatio, autoRetry: params.autoRetry, retryCount: 0, rawImages: { firstFrame: params.firstFrame, lastFrame: params.lastFrame, references: params.references || [] }, mode: taskMode, inputMode: taskMode, status: 'processing', progress: null, timestamp: Date.now(), time: new Date().toLocaleTimeString('zh-CN', {hour: '2-digit', minute:'2-digit'}), videoUrl: null, x: spawnX, y: spawnY, isBilled: false };
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

function renderImgGenPendingItem(item, task) {
    const proStages = ['正在连接 GPT-Image 2...', '正在渲染画面细节...', '正在进行超分处理...', '正在封装输出图像...'];
    const trialStages = ['正在连接试用通道...', '正在生成主体构图...', '正在处理参考图...', '正在回传预览结果...'];
    const stages = task.state.version === 'pro' ? proStages : trialStages;
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
                        <button type="button" onclick="createImgGenVariations(event, '${task.id}', '${item.id}')" data-tip="基于这张图分裂 4 个变体节点">
                            <span class="material-symbols-outlined">hub</span> V1-4
                        </button>
                        <button type="button" onclick="sendImgGenPreviewToMask(event, '${task.id}', '${item.id}')" data-tip="把这张图作为 Base 打开蒙版重绘">
                            <span class="material-symbols-outlined">gesture</span>
                        </button>
                        <button type="button" onclick="sendImgGenPreviewToCropper(event, '${task.id}', '${item.id}')" data-tip="发送至局部裁切器">
                            <span class="material-symbols-outlined">crop</span>
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
            <p>AI 多模生图节点是工作台里的“图像发动机”：既能文生图，也能用垫图做变体，还能用蒙版局部重绘。当前一次点击只生成 1 张，右侧预览会保留最近 6 张结果，方便你连续试稿。</p>
            <div class="img-gen-help-tag-row">
                <span class="img-gen-help-tag">文生图</span>
                <span class="img-gen-help-tag">垫图变体</span>
                <span class="img-gen-help-tag">蒙版重绘</span>
                <span class="img-gen-help-tag">工作流复用</span>
                <span class="img-gen-help-tag">参考权重</span>
                <span class="img-gen-help-tag">V1-4 变体</span>
            </div>
        </section>
        <section class="img-gen-help-section">
            <h3>模型版本：Trial / Pro</h3>
            <div class="img-gen-help-grid">
                <div class="img-gen-help-card">
                    <strong>Trial 试用版</strong>
                    <p>使用旧通道逻辑，适合低成本草稿、构图测试和日常灵感。试用版锁定 1K 输出，只跟随画幅比例换算尺寸，不开放蒙版编辑。</p>
                </div>
                <div class="img-gen-help-card">
                    <strong>专业版 · GPT Image 2</strong>
                    <p>专业版面向正式图、产品海报、局部重绘和多参考图融合。支持高保真图片输入、1K/2K/4K 分辨率档位、质量和格式控制。</p>
                </div>
            </div>
            <p class="img-gen-help-note">官方边界：GPT Image 2 支持文字和图片输入并输出图片；透明背景目前不支持，背景建议使用 auto 或 opaque。</p>
        </section>
        <section class="img-gen-help-section">
            <h3>价格体系</h3>
            <div class="img-gen-help-table">
                <div><strong>试用版通道 1</strong><span>￥0.084 / 张，适合低成本试稿。</span></div>
                <div><strong>试用版通道 2</strong><span>￥0.06 / 张，适合更省钱的轻量出图。</span></div>
                <div><strong>Pro 输入</strong><span>￥5.0000 / 1M tokens。</span></div>
                <div><strong>Pro 输出</strong><span>￥30.0000 / 1M tokens。</span></div>
                <div><strong>中转折扣</strong><span>按上述 token 价格计算后再 × 1/2 入账。</span></div>
                <div><strong>计费方式</strong><span>按返回的 usage 里的 input_tokens / output_tokens 实时计费；示例：1643 + 1413 tokens 原价约 ￥0.0506，半价入账约 ￥0.0253。</span></div>
            </div>
        </section>
        <section class="img-gen-help-section">
            <h3>输入图槽位怎么用</h3>
            <ul>
                        <li><strong>底图 / 蒙版源</strong>：第一张主控图。做蒙版重绘时，蒙版会作用在这张图上；做变体时，它也是最强的结构参考。</li>
                <li><strong>REF 1-4</strong>：参考图槽。适合放产品细节、材质、风格、配色、版式灵感。它们会帮助 AI 理解“感觉”和“元素”，但不等于像素级复制。</li>
                <li><strong>参考意图 / 权重</strong>：每张垫图悬停后可设置“结构、风格、色彩、细节、版式”和 0-100 权重。产品白底图建议结构 85-95；环境图建议风格 45-70；配色板建议色彩 35-60。</li>
                <li><strong>拖放规则</strong>：可以从电脑、素材库或生成结果直接拖入槽位。第一张建议放要保留主体的图，其余放风格或局部细节参考。</li>
            </ul>
        </section>
        <section class="img-gen-help-section">
            <h3>高频参数</h3>
            <div class="img-gen-help-table">
                <div><strong>画幅比例</strong><span>决定横竖构图，例如 16:9 适合 YouTube 横版封面，9:16 适合 Shorts / Reels，1:1 适合社媒方图。</span></div>
                <div><strong>分辨率</strong><span>Trial 固定 1K；Pro 可选 1K/2K/4K。1K 适合快速试稿，2K 适合正式发布，4K 适合产品细节但更慢更贵。</span></div>
                <div><strong>Prompt</strong><span>建议写清主体、场景、风格、构图、光线、用途。做改图时要写“保留什么”和“只修改什么”。</span></div>
            </div>
            <p class="img-gen-help-note">Pro 后台会按“比例 + 分辨率档位”自动换算到 GPT Image 2 的有效尺寸范围，避免无效尺寸导致请求失败。</p>
        </section>
        <section class="img-gen-help-section">
                    <h3>高级参数字典</h3>
            <div class="img-gen-help-table">
                <div><strong>质量</strong><span>low 适合草稿和缩略图，medium 是速度/画质平衡，high 适合终稿。高质量 + 4K 会显著增加等待时间。</span></div>
                <div><strong>格式</strong><span>PNG 适合图文、UI、清晰边缘和后续再编辑；JPEG 速度快、体积小；WebP 适合网页展示和压缩存储。</span></div>
                <div><strong>背景</strong><span>GPT Image 2 建议 auto 或 opaque。透明背景不是 GPT Image 2 当前官方支持项，如果需要抠图请后续走单独抠图/去背节点。</span></div>
                <div><strong>审核</strong><span>auto 是标准安全过滤；low 更宽松但不能绕过安全策略。若被拦截，优先改 Prompt 的敏感描述。</span></div>
                <div><strong>重试</strong><span>单次适合避免重复扣费；失败面板里的“重试”会使用当前参数重新提交一次，不再自动切换通道。</span></div>
                <div><strong>Seed</strong><span>锁定后会尽量复现构图与随机性，适合在同一张产品图上连续做细节微调；点击 V1-4 时会沿用当前配置并分裂 4 个子节点。</span></div>
            </div>
        </section>
        <section class="img-gen-help-section">
            <h3>结果图快捷流转</h3>
            <ul>
                <li><strong>V1-4</strong>：在成功图上悬停，点击 V1-4 会基于该图、原 Prompt、原配置和 Seed 生成 4 个子生图节点，适合快速找产品海报变体。</li>
                <li><strong>蒙版</strong>：点击手势按钮会把该结果图送回当前节点作为 Base，并自动打开蒙版工作室，用于局部修瑕或换背景。</li>
                <li><strong>裁切</strong>：点击裁切按钮会在旁边创建局部裁切器，先提取局部，再拖回生图节点做局部参考或蒙版底图。</li>
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
                <li><strong>等待时间</strong>：复杂 Prompt、参考图、4K 和 high 质量会更慢，官方也提示复杂请求可能需要较长处理时间。</li>
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
    const isPro = task.state.version === 'pro';
    const isChannel2 = task.state.channel === 'channel_2';
    const previewCollapsed = task.state.previewCollapsed === true;
    const isVariantNode = !!task.state.variantGroupId;
    const variantIndex = Math.max(1, Math.min(99, parseInt(task.state.variantIndex, 10) || 1));
    const resolvedSize = resolveImgGenSize(task.state);
    const lastUsageCost = isPro ? toFiniteNumber(task.state.lastUsageCost, NaN) : NaN;
    const currentCost = isPro
        ? (Number.isFinite(lastUsageCost) && lastUsageCost > 0 ? formatImgGenMoney(lastUsageCost) : 'Token计费')
        : (isChannel2 ? '0.06' : '0.084');
    const previewEntries = Array.isArray(task.state.previewHistory) ? task.state.previewHistory : [];
    const pendingCount = previewEntries.filter((item) => item && item.status === 'pending' && item.hidden !== true).length;
    const cooldownMs = Math.max(0, toFiniteNumber(task.state.nextSubmitAt, 0) - Date.now());
    const cooldownSec = Math.ceil(cooldownMs / 1000);
    const isBtnCooling = cooldownSec > 0;
    const retryTxt = task.retryCount ? ` (重试 ${task.retryCount})` : '';
    const safePrompt = escapeHtml(task.state.prompt || '');

    let btnContent = `<span class="material-symbols-outlined">draw</span> ${isPro ? '专业生成' : '试用生成'} <span class="img-gen-btn-price">${isPro ? currentCost : `￥${currentCost}`}</span>`;
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

    return `<div class="card-header img-gen-card-header"><span class="img-gen-card-title"><span class="material-symbols-outlined">brush</span> AI 多模生图 ${isVariantNode ? `<span class="img-gen-variant-chip">V${variantIndex}</span>` : ''}</span><div class="img-gen-card-actions"><button class="img-gen-help-trigger" type="button" onclick="dockImgGenTaskById(event, '${task.id}')" data-tip="收纳到左侧台前调度"><span class="material-symbols-outlined">view_sidebar</span></button><button class="img-gen-help-trigger" type="button" onclick="openImgGenHelp(event, '${task.id}')" data-tip="用于生成、重绘和变体图像的 AI 节点"><span class="material-symbols-outlined">info</span></button><button class="img-gen-card-close" onclick="removeTask('${task.id}')" data-tip="删除该组件"><span class="material-symbols-outlined">close</span></button></div></div>
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
                        <span class="img-gen-status-badge ${isPro ? 'is-pro' : 'is-trial'}">${isPro ? '专业版 · GPT Image 2' : '试用版 · 旧通道'}</span>
                        ${isVariantNode ? `<span class="img-gen-status-badge is-variant">变体 ${variantIndex}</span>` : ''}
                        <span class="img-gen-size-chip">${isPro ? `${(task.state.proRatio === 'custom') ? `${task.state.customW}:${task.state.customH}` : task.state.proRatio} / ${(task.state.proResolution || '1k').toUpperCase()}` : `${(task.state.trialRatio === 'custom') ? `${task.state.customW}:${task.state.customH}` : (task.state.trialRatio || '1:1')} / 1K`}</span>
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

function generateCardHTML(task) {
    if (task.type === 'frame') {
        const safeTitle = escapeAttr(task.title || '');
        return `
        <div class="frame-header" onmousedown="event.stopPropagation()">
            <span class="material-symbols-outlined" style="font-size:18px;">dashboard_customize</span>
            <input type="text" class="frame-title-input" value="${safeTitle}" placeholder="未命名项目组" onchange="updateTaskField('${task.id}', 'title', this.value)">
            <div style="display:flex; gap: 4px; margin-left: auto;">
                <button class="frame-btn" onclick="toggleFrameCollapse('${task.id}')" data-tip="折叠/展开此项目收纳"><span class="material-symbols-outlined" style="font-size:22px;">${task.isCollapsed ? 'expand_more' : 'expand_less'}</span></button>
                <button class="frame-btn" onclick="removeFrame('${task.id}')" data-tip="解散该项目组"><span class="material-symbols-outlined" style="font-size:18px;">close</span></button>
            </div>
        </div>
        ${!task.isCollapsed ? `<div class="frame-resize-handle" data-tip="按住拖拽调节框架大小"></div>` : ''}
        `;
    }
    if (task.type === 'note') return `<div class="card-header"><span style="color:#ffca28; display:flex; align-items:center; gap:4px;"><span class="material-symbols-outlined" style="font-size:14px;">sticky_note_2</span> 即时便签</span><button onclick="removeTask('${task.id}')" data-tip="删除此便签" style="background:transparent; border:none; color:#ffca28; cursor:pointer; opacity:0.6;"><span class="material-symbols-outlined" style="font-size:16px;">close</span></button></div><textarea oninput="updateNoteText('${task.id}', this.value)" placeholder="在此输入灵感、提示词或分组备注...">${escapeHtml(task.text || '')}</textarea>`;
    if (task.type === 'tool_generator') return `<div class="card-header"><span style="color:#818cf8; display:flex; align-items:center; gap:4px;"><span class="material-symbols-outlined" style="font-size:14px;">auto_awesome</span> 社媒灵感生成器</span><button onclick="removeTask('${task.id}')" data-tip="删除该组件" style="background:transparent; border:none; color:var(--text-sub); cursor:pointer;"><span class="material-symbols-outlined" style="font-size:16px;">close</span></button></div><div class="gen-grid"><div class="gen-item"><label><span class="material-symbols-outlined" style="font-size:12px;">video_camera_front</span> 带货形式</label><select onchange="updateGeneratorState('${task.id}', 'format', this.value)">${buildGeneratorOptions(genData.formats, task.state.format)}</select></div><div class="gen-item"><label><span class="material-symbols-outlined" style="font-size:12px;">play_circle</span> 开头节奏</label><select onchange="updateGeneratorState('${task.id}', 'opening', this.value)">${buildGeneratorOptions(genData.openings, task.state.opening)}</select></div><div class="gen-item"><label><span class="material-symbols-outlined" style="font-size:12px;">sell</span> 内容属性</label><select onchange="updateGeneratorState('${task.id}', 'attribute', this.value)">${buildGeneratorOptions(genData.attributes, task.state.attribute)}</select></div><div class="gen-item"><label><span class="material-symbols-outlined" style="font-size:12px;">magic_button</span> 通用调性</label><select onchange="updateGeneratorState('${task.id}', 'general', this.value)">${buildGeneratorOptions(genData.generals, task.state.general)}</select></div></div><div class="gen-actions"><button class="gen-btn shuffle" onclick="shuffleGenerator('${task.id}')" data-tip="摇骰子：随机抽取一套爆款剧本组合"><span class="material-symbols-outlined" style="font-size:16px;">shuffle</span> 随机抽取</button><button class="gen-btn copy" onclick="applyGeneratorToPrompt('${task.id}', this)" data-tip="一键将结构化剧本反填至底部 Prompt 框"><span class="material-symbols-outlined" style="font-size:16px;">move_down</span> 应用至控制台</button></div>`;

    if (task.type === 'tool_image_gen') return renderImgGenCardHTML(task);

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
    const safeVideoPrompt = escapeHtml(task.prompt || '');
    const safeVideoPromptAttr = escapeAttr(task.prompt || '');
    const safeVideoTime = escapeHtml(task.time || '');
    const safeVideoModel = escapeHtml(task.modelStr || '');
    const safeVideoRatio = escapeHtml(task.ratio || '');
    const safeVideoAspect = sanitizeAspectRatioCss(task.ratio, '16/9');
    const safeVideoUrl = escapeAttr(task.videoUrl || '');
    const safeThumbUrl = escapeAttr(thumbUrl || '');
    if (task.status === 'processing') {
        const retryTxt = task.retryCount ? ` (重试 ${task.retryCount})` : ''; statusBadge = `<span class="status-badge processing">生成中...${retryTxt}</span>`;
        let progressHtml = `
            <div class="cyber-scanner-box"><div class="cyber-scanner-line"></div></div>
            <div style="font-size: 11px; color: var(--accent); margin-top: 8px; font-weight: 600; font-family: monospace; letter-spacing: 1px;">MODELS ENGAGED...</div>
        `;
        mediaHtml = `<div class="card-media" style="aspect-ratio: ${safeVideoAspect}; padding: 20px;"><div style="display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%; color: var(--accent);"><svg class="spinner" viewBox="0 0 50 50" style="width:36px;height:36px;"><circle cx="25" cy="25" r="20"></circle></svg><div class="generating-text" style="margin-top: 12px;">视频生成中...</div>${progressHtml}</div></div>`;
    } else if (task.status === 'failed') { statusBadge = `<span class="status-badge failed">失败</span>`; mediaHtml = `<div class="card-media" style="background:#2c2c2e; color:var(--danger); aspect-ratio: ${safeVideoAspect}; font-size:12px;">生成超时或失败</div>`;
    } else { statusBadge = `<span class="status-badge success">已完成</span>`; mediaHtml = `<div class="card-media" data-tip="双击全屏播放视频"><video src="${safeVideoUrl}" preload="none" poster="${safeThumbUrl}" controls playsinline ondblclick="this.requestFullscreen()"></video></div>`; }

    const thumbHtml = thumbImg ? `<img src="${safeThumbUrl}" draggable="true" ondragstart="event.dataTransfer.setData('application/json', JSON.stringify({taskId: '${task.id}', type: 'thumb'}))" ondblclick="openLightbox(this.src)" data-tip="双击全屏高清预览，按住可拖动复用">` : `<div style="width:44px;height:44px;border-radius:4px;background:#2c2c2e;display:flex;align-items:center;justify-content:center;"><span class="material-symbols-outlined" style="color:#666;">image</span></div>`;
    return `<div class="card-header"><div class="time-model"><span class="material-symbols-outlined" style="font-size: 14px;">schedule</span> ${safeVideoTime} · ${safeVideoModel}</div>${statusBadge}</div><div class="card-prompt">${thumbHtml}<p title="${safeVideoPromptAttr}">${safeVideoPrompt}</p></div><div class="card-tags"><span class="card-tag">${safeVideoRatio}</span>${task.autoRetry ? `<span class="card-tag" style="color:var(--success); border: 1px solid var(--success);">已开挂机重试</span>` : ''}</div>${mediaHtml}<div class="card-actions">${task.status === 'success' ? `<button onclick="downloadVideo(this.dataset.url)" data-url="${safeVideoUrl}" data-tip="下载此视频到本地"><span class="material-symbols-outlined">download</span></button>` : ''}${task.status === 'failed' ? `<button class="retry-btn" onclick="retryTask('${task.id}', this)" data-tip="原地重新发起此任务"><span class="material-symbols-outlined">refresh</span></button>` : ''}<button class="reuse-btn" onclick="reuseTask('${task.id}')" data-tip="提取该任务的所有图文参数，反填至底部控制台"><span class="material-symbols-outlined">edit_note</span></button><button onclick="removeTask('${task.id}')" data-tip="删除此生成记录"><span class="material-symbols-outlined">delete</span></button></div>`;
}

// 🌟 初次挂载与排版专用的全局刷新函数
async function renderBoard() {
    const tasks = await getAllTasksDB(); const boardTasks = tasks.filter(t => t.type !== 'local_image'), boardTaskIds = new Set(boardTasks.map(t => 'card-' + t.id));
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

    const frameMap = {}; boardTasks.filter(t => t.type === 'frame').forEach(f => frameMap[f.id] = f);

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
        const currentChannel = (task.state && task.state.channel) ? task.state.channel : 'channel_1';
        const currentVersion = (task.state && task.state.version) ? task.state.version : 'trial';
        const currentPreviewCollapsed = (task.type === 'tool_image_gen' && task.state) ? String(task.state.previewCollapsed === true) : 'na';
        const currentPreviewFeed = (task.type === 'tool_image_gen' && task.state) ? getImgGenPreviewFingerprint(task) : 'na';
        const currentParamsCollapsed = (task.type === 'tool_image_gen' && task.state) ? String(task.state.paramsCollapsed === true) : 'na';
        const currentPromptToolsCollapsed = (task.type === 'tool_image_gen' && task.state) ? String(task.state.promptToolsCollapsed === true) : 'na';
        const currentMaskPanelCollapsed = (task.type === 'tool_image_gen' && task.state) ? String(task.state.maskPanelCollapsed === true) : 'na';
        const currentMaskEditMode = (task.type === 'tool_image_gen' && task.state) ? String(task.state.maskEditMode === true) : 'na';
        const currentMaskBrushSize = (task.type === 'tool_image_gen' && task.state) ? String(clampImgMaskBrushSize(task.state.maskBrushSize)) : 'na';
        const currentMaskStageHeight = (task.type === 'tool_image_gen' && task.state) ? String(clampImgMaskStageHeight(task.state.maskStageHeight)) : 'na';

        let isHiddenInFrame = false;
        if (task.parentId && frameMap[task.parentId] && frameMap[task.parentId].isCollapsed) isHiddenInFrame = true;
        const isStageDocked = isImgGenTaskStageDocked(task);

        if (!cardEl) {
            cardEl = document.createElement('div'); cardEl.id = 'card-' + task.id;

            if (task.type === 'frame') {
                cardEl.className = 'frame-box';
                cardEl.style.width = `${task.width}px`;
                cardEl.style.height = task.isCollapsed ? '0px' : `${task.height}px`;
                if (task.isCollapsed) cardEl.style.border = 'none';
            }
            else if (task.type === 'note') { cardEl.className = 'video-card sticky-note'; cardEl.style.width = `${task.width || 260}px`; cardEl.style.height = `${task.height || 180}px`; } else if (task.type === 'tool_generator') cardEl.className = 'video-card tool-generator'; else if (task.type === 'tool_image_gen') cardEl.className = 'video-card tool-image-gen'; else if (task.type === 'tool_cropper') cardEl.className = 'video-card tool-cropper'; else cardEl.className = 'video-card';

            cardEl.style.transform = `translate3d(${task.x}px, ${task.y}px, 0)`; morphCardDOM(cardEl, generateCardHTML(task)); board.appendChild(cardEl);
            applyImgGenCardFrame(cardEl, task);
            syncImgMaskEditor(cardEl, task).catch(() => {});
            bindImgGenCardResizeSave(cardEl, task);
            if (task.type === 'note') cardEl.addEventListener('mouseup', () => saveNoteSize(task.id, cardEl.offsetWidth, cardEl.offsetHeight));
            if (!task.type && task.status === 'processing' && !activeTasks.includes(task.id)) { activeTasks.push(task.id); startTaskPolling(task.id); }
        } else {
            cardEl.style.transform = `translate3d(${task.x}px, ${task.y}px, 0)`;

            if (task.type === 'frame') {
                cardEl.style.width = `${task.width}px`;
                cardEl.style.height = task.isCollapsed ? '0px' : `${task.height}px`;
                cardEl.style.border = task.isCollapsed ? 'none' : '';
            }
            else if (task.type === 'note' && task.width && task.height) { cardEl.style.width = `${task.width}px`; cardEl.style.height = `${task.height}px`; }

            const oldStatus = cardEl.getAttribute('data-sync-status'), oldRetry = cardEl.getAttribute('data-sync-retry'), oldImgLen = cardEl.getAttribute('data-sync-img-len'), oldProgress = cardEl.getAttribute('data-sync-progress'), oldCropSrc = cardEl.getAttribute('data-sync-crop-src'), oldCropRes = cardEl.getAttribute('data-sync-crop-res'), oldChannel = cardEl.getAttribute('data-sync-channel'), oldVersion = cardEl.getAttribute('data-sync-version'), oldPreviewCollapsed = cardEl.getAttribute('data-sync-preview-collapsed'), oldPreviewFeed = cardEl.getAttribute('data-sync-preview-feed'), oldParamsCollapsed = cardEl.getAttribute('data-sync-params-collapsed'), oldPromptToolsCollapsed = cardEl.getAttribute('data-sync-prompt-tools-collapsed'), oldMaskPanelCollapsed = cardEl.getAttribute('data-sync-mask-panel-collapsed'), oldMaskEditMode = cardEl.getAttribute('data-sync-mask-edit'), oldMaskBrushSize = cardEl.getAttribute('data-sync-mask-brush'), oldMaskStageHeight = cardEl.getAttribute('data-sync-mask-height');
            const oldFrameTitle = cardEl.getAttribute('data-sync-title'), oldFrameCollapsed = cardEl.getAttribute('data-sync-collapsed');

            if (oldStatus !== task.status || oldRetry != task.retryCount || oldImgLen != currentImgLen || oldProgress !== currentProgress || oldCropSrc !== cropSrc || oldCropRes !== cropRes || oldChannel !== currentChannel || oldVersion !== currentVersion || oldPreviewCollapsed !== currentPreviewCollapsed || oldPreviewFeed !== currentPreviewFeed || oldParamsCollapsed !== currentParamsCollapsed || oldPromptToolsCollapsed !== currentPromptToolsCollapsed || oldMaskPanelCollapsed !== currentMaskPanelCollapsed || oldMaskEditMode !== currentMaskEditMode || oldMaskBrushSize !== currentMaskBrushSize || oldMaskStageHeight !== currentMaskStageHeight || oldFrameTitle !== task.title || oldFrameCollapsed !== String(task.isCollapsed)) {
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
                    const pollKey = buildImgGenPollKey(task.id, entry.id);
                    if (!imgGenPollTimers.has(pollKey) && !imgGenPollControllers.has(pollKey)) {
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

        cardEl.setAttribute('data-sync-status', task.status || 'static'); cardEl.setAttribute('data-sync-retry', task.retryCount || 0); cardEl.setAttribute('data-sync-img-len', currentImgLen); cardEl.setAttribute('data-sync-progress', currentProgress); cardEl.setAttribute('data-sync-crop-src', cropSrc); cardEl.setAttribute('data-sync-crop-res', cropRes); cardEl.setAttribute('data-sync-channel', currentChannel); cardEl.setAttribute('data-sync-version', currentVersion); cardEl.setAttribute('data-sync-preview-collapsed', currentPreviewCollapsed); cardEl.setAttribute('data-sync-preview-feed', currentPreviewFeed); cardEl.setAttribute('data-sync-params-collapsed', currentParamsCollapsed); cardEl.setAttribute('data-sync-prompt-tools-collapsed', currentPromptToolsCollapsed); cardEl.setAttribute('data-sync-mask-panel-collapsed', currentMaskPanelCollapsed); cardEl.setAttribute('data-sync-mask-edit', currentMaskEditMode); cardEl.setAttribute('data-sync-mask-brush', currentMaskBrushSize); cardEl.setAttribute('data-sync-mask-height', currentMaskStageHeight);
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
    imgGenPreviewGuards.delete(id);
    destroyImgMaskStudio(id);
    destroyImgMaskEditor(id);
    await deleteTaskDB(id);
    taskShadowCache.delete(id);
    imgGenUpdateQueues.delete(id);
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
    newCardEl.style.transform = `translate3d(${clone.x}px, ${clone.y}px, 0)`;
    newCardEl.classList.remove('hidden-in-frame');

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

function normalizeImgGenRoute(raw = 'stable') {
    const key = String(raw || 'stable').trim().toLowerCase().replace(/^:/, '');
    for (const route of Object.values(IMG_GEN_ROUTE_CONFIG)) {
        if (route.key === key || (Array.isArray(route.aliases) && route.aliases.includes(key))) {
            return { ...route };
        }
    }
    return { ...IMG_GEN_ROUTE_CONFIG.stable };
}

function getImgGenModelForRoute(route) {
    const safeRoute = route && typeof route === 'object' ? route : normalizeImgGenRoute(route || 'stable');
    if (safeRoute.key === 'apimart_stable_co') return 'gpt-image-2-official';
    return `gpt-image-2${safeRoute.suffix || ''}`;
}

function ensureImgGenState(task) {
    if (!task || task.type !== 'tool_image_gen') return;
    if (!task.state || typeof task.state !== 'object') task.state = {};
    if (!Array.isArray(task.state.images)) task.state.images = [];
    if (!task.state.version || (task.state.version === 'trial' && !IMG_GEN_TRIAL_AVAILABLE)) task.state.version = 'pro';
    const route = normalizeImgGenRoute(task.state.providerSort || task.state.modelSuffix || task.state.routeMode || 'stable');
    task.state.providerSort = route.key;
    task.state.modelSuffix = route.suffix;
    task.state.routeMode = route.mode;
    task.state.imageModel = getImgGenModelForRoute(route);
    enforceImgGenRouteReferenceLimit(task);
    if (!task.state.quality) task.state.quality = 'auto';
    if (!task.state.format) task.state.format = 'png';
    if (!task.state.background) task.state.background = 'auto';
    if (!task.state.moderation) task.state.moderation = 'auto';
    if (typeof task.state.stageDocked !== 'boolean') task.state.stageDocked = false;
    if (typeof task.state.stageReleased !== 'boolean') task.state.stageReleased = false;
    task.state.n = 1;
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
    if (task.state.version !== 'pro') {
        if (task.id && (task.state.maskBlob || task.state.maskImage)) {
            revokeBlobPrefixSafe(`${task.id}_mask_preview_`);
            revokeBlobPrefixSafe(`${task.id}_mask_studio_`);
        }
        task.state.maskEditMode = false;
        task.state.maskBlob = null;
        task.state.maskImage = null;
        if (task.id) {
            destroyImgMaskStudio(task.id);
            destroyImgMaskEditor(task.id);
        }
    }
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
    if (task.state.version === 'pro') {
        const detected = detectProPresetFromSize(task.state.size);
        if (!task.state.proRatio || task.state.proRatio === 'auto') task.state.proRatio = detected.proRatio;
        if (!task.state.proResolution) task.state.proResolution = detected.proResolution;
        task.state.size = resolveImgGenSize(task.state);
    } else {
        task.state.size = resolveImgGenSize(task.state);
    }
    recalcImgGenTaskStatus(task);
}

function resolveImgGenMode(state) {
    const imageCount = Array.isArray(state.images) ? state.images.length : 0;
    if (imageCount === 0) return 'text2img';
    if (state.maskBlob || state.maskImage) return 'mask_edit';
    return 'img2img';
}

function createImgGenPreviewId() {
    return `img_item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeImgGenPreviewHistory(task) {
    if (!task || task.type !== 'tool_image_gen') return;
    if (!task.state || typeof task.state !== 'object') task.state = {};

    let list = Array.isArray(task.state.previewHistory) ? task.state.previewHistory.slice() : [];
    if (list.length === 0) {
        const seeded = [];
        const seededBlobs = Array.isArray(task.state.resultBlobs) && task.state.resultBlobs.length > 0
            ? task.state.resultBlobs
            : (task.state.resultBlob ? [task.state.resultBlob] : []);
        seededBlobs.forEach((img) => {
            if (!img) return;
            seeded.push({
                id: createImgGenPreviewId(),
                status: 'success',
                image: img,
                createdAt: Date.now()
            });
        });
        list = seeded;
    }

    list = list
        .filter((item) => item && typeof item === 'object')
        .map((item) => ({
            id: item.id || createImgGenPreviewId(),
            status: item.status || 'success',
            image: item.image || null,
            createdAt: Number.isFinite(item.createdAt) ? item.createdAt : Date.now(),
            costTime: Number.isFinite(item.costTime) ? item.costTime : null,
            remoteTaskId: item.remoteTaskId ? String(item.remoteTaskId) : '',
            width: toFiniteNumber(item.width, 0),
            height: toFiniteNumber(item.height, 0),
            ratio: toFiniteNumber(item.ratio, 0),
            layout: item.layout || '',
            errorReason: item.errorReason || '',
            seed: typeof item.seed === 'undefined' ? '' : item.seed,
            prompt: item.prompt || '',
            version: item.version || '',
            size: item.size || '',
            referenceControls: Array.isArray(item.referenceControls) ? item.referenceControls : [],
            hidden: item.hidden === true
        }))
        .sort((a, b) => a.createdAt - b.createdAt);

    task.state.previewHistory = list;
    if (!Number.isFinite(task.state.nextSubmitAt)) task.state.nextSubmitAt = 0;

    const successImages = task.state.previewHistory
        .filter((item) => item.status === 'success' && item.image)
        .map((item) => item.image);
    if (successImages.length > IMG_GEN_PREVIEW_LIMIT) {
        let dropCount = successImages.length - IMG_GEN_PREVIEW_LIMIT;
        const trimmed = [];
        for (const item of task.state.previewHistory) {
            if (item.status === 'success' && item.image && dropCount > 0) {
                if (item.id) revokeBlobPrefixSafe(`${task.id}_feed_${item.id}_`);
                dropCount--;
                continue;
            }
            trimmed.push(item);
        }
        task.state.previewHistory = trimmed;
    }

    const finalSuccessImages = task.state.previewHistory
        .filter((item) => item.status === 'success' && item.image)
        .map((item) => item.image)
        .slice(-IMG_GEN_PREVIEW_LIMIT);
    task.state.resultBlobs = finalSuccessImages;
    task.state.resultBlob = finalSuccessImages.length ? finalSuccessImages[finalSuccessImages.length - 1] : null;
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

function getImgGenPendingCount(task) {
    if (!task || !task.state || !Array.isArray(task.state.previewHistory)) return 0;
    return task.state.previewHistory.filter((item) => item && item.status === 'pending').length;
}

function getVisibleImgGenPendingCount(task) {
    if (!task || !task.state || !Array.isArray(task.state.previewHistory)) return 0;
    return task.state.previewHistory.filter((item) => item && item.status === 'pending' && item.hidden !== true).length;
}

async function isImgGenPreviewItemStillPending(taskId, itemId) {
    if (!taskId || !itemId) return true;
    const guarded = getImgGenPreviewGuardItems(taskId).find((item) => item && item.id === itemId);
    if (guarded && guarded.status === 'pending') return true;
    const liveTask = mergeImgGenTaskWithShadow(await getTaskDB(taskId), getTaskShadow(taskId), { protectedIds: getImgGenProtectedPreviewIds(taskId) });
    if (!liveTask || liveTask.type !== 'tool_image_gen') return false;
    ensureImgGenState(liveTask);
    return liveTask.state.previewHistory.some((item) => item && item.id === itemId && item.status === 'pending');
}

async function getImgGenTaskForPreviewWrite(taskId, itemId, fallbackTask = null) {
    let dbTask = null;
    try { dbTask = await getTaskDB(taskId); } catch (err) {}
    const shadowTask = getTaskShadow(taskId);
    let task = null;
    if (dbTask && dbTask.type === 'tool_image_gen') {
        task = mergeImgGenTaskWithShadow(dbTask, shadowTask, { protectedIds: getImgGenProtectedPreviewIds(taskId) });
    } else if (shadowTask && shadowTask.type === 'tool_image_gen') {
        task = cloneTaskDeep(shadowTask) || { ...shadowTask };
    } else if (fallbackTask && fallbackTask.type === 'tool_image_gen') {
        task = cloneTaskDeep(fallbackTask) || { ...fallbackTask };
    }
    if (!task || task.type !== 'tool_image_gen') return null;
    ensureImgGenState(task);
    const hasItem = task.state.previewHistory.some((item) => item && item.id === itemId);
    if (!hasItem && fallbackTask && fallbackTask.state && Array.isArray(fallbackTask.state.previewHistory)) {
        const fallbackItem = fallbackTask.state.previewHistory.find((item) => item && item.id === itemId);
        if (fallbackItem) {
            task.state.previewHistory.push({ ...fallbackItem });
            normalizeImgGenPreviewHistory(task);
        }
    }
    return task;
}

function recalcImgGenTaskStatus(task) {
    if (!task || task.type !== 'tool_image_gen') return;
    normalizeImgGenPreviewHistory(task);
    const pendingCount = getImgGenPendingCount(task);
    if (pendingCount > 0) {
        task.status = 'processing';
        return;
    }
    const hasSuccess = task.state.previewHistory.some((item) => item && item.status === 'success');
    if (hasSuccess) {
        task.status = 'success';
        return;
    }
    const hasFailed = task.state.previewHistory.some((item) => item && item.status === 'failed');
    if (hasFailed) {
        task.status = 'failed';
        return;
    }
    task.status = 'idle';
}

function pushImgGenPendingItem(task) {
    normalizeImgGenPreviewHistory(task);
    const itemId = createImgGenPreviewId();
    const pendingItem = {
        id: itemId,
        status: 'pending',
        image: null,
        createdAt: Date.now(),
        costTime: null,
        remoteTaskId: '',
        width: 0,
        height: 0,
        ratio: 0,
        layout: '',
        seed: task.state.seedLocked ? task.state.seed : '',
        prompt: task.state.prompt || '',
        version: task.state.version || 'trial',
        size: task.state.size || '',
        referenceControls: buildImgGenRefControlPayload(task),
        hidden: false
    };
    task.state.previewHistory.push(pendingItem);
    guardImgGenPreviewItem(task.id, pendingItem);
    recalcImgGenTaskStatus(task);
    return itemId;
}

function markImgGenPreviewSuccess(task, itemId, imageBlobOrUrl, costTimeSec = null, meta = null) {
    normalizeImgGenPreviewHistory(task);
    const item = task.state.previewHistory.find((entry) => entry && entry.id === itemId);
    if (item) {
        item.status = 'success';
        item.image = imageBlobOrUrl || null;
        item.costTime = Number.isFinite(costTimeSec) ? costTimeSec : null;
        item.remoteTaskId = '';
        item.width = meta && Number.isFinite(meta.width) ? meta.width : item.width;
        item.height = meta && Number.isFinite(meta.height) ? meta.height : item.height;
        item.ratio = meta && Number.isFinite(meta.ratio) ? meta.ratio : item.ratio;
        item.layout = meta && meta.layout ? meta.layout : item.layout;
        item.hidden = false;
        releaseImgGenPreviewGuard(task.id, itemId);
    } else {
        task.state.previewHistory.push({
            id: itemId || createImgGenPreviewId(),
            status: 'success',
            image: imageBlobOrUrl || null,
            createdAt: Date.now(),
            costTime: Number.isFinite(costTimeSec) ? costTimeSec : null,
            remoteTaskId: '',
            width: meta && Number.isFinite(meta.width) ? meta.width : 0,
            height: meta && Number.isFinite(meta.height) ? meta.height : 0,
            ratio: meta && Number.isFinite(meta.ratio) ? meta.ratio : 0,
            layout: meta && meta.layout ? meta.layout : '',
            hidden: false
        });
    }
    releaseImgGenPreviewGuard(task.id, itemId);
    recalcImgGenTaskStatus(task);
    return true;
}

function normalizeImgGenErrorReason(errorLike) {
    const raw = errorLike && errorLike.message ? errorLike.message : String(errorLike || '');
    const msg = raw.toLowerCase();
    if (msg.includes('401') || msg.includes('403') || msg.includes('密钥') || msg.includes('auth')) return '密钥或权限校验失败';
    if (msg.includes('safe') || msg.includes('moderation') || msg.includes('policy') || msg.includes('安全')) return '提示词可能触发安全拦截';
    if (msg.includes('timeout') || msg.includes('超时') || msg.includes('taskid') || msg.includes('异步')) return '通道超时或未返回任务 ID';
    if (msg.includes('429') || msg.includes('rate')) return '通道限流，请稍后重试';
    if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504')) return '后端通道暂时不可用';
    if (raw) return raw.slice(0, 42);
    return '通道响应异常或超时';
}

function markImgGenPreviewFailed(task, itemId, reason = '') {
    normalizeImgGenPreviewHistory(task);
    const errorReason = normalizeImgGenErrorReason(reason);
    const item = task.state.previewHistory.find((entry) => entry && entry.id === itemId);
    if (item) {
        item.status = 'failed';
        item.remoteTaskId = '';
        item.errorReason = errorReason;
        item.hidden = false;
        releaseImgGenPreviewGuard(task.id, itemId);
    }
    else {
        task.state.previewHistory.push({
            id: itemId || createImgGenPreviewId(),
            status: 'failed',
            image: null,
            createdAt: Date.now(),
            costTime: null,
            remoteTaskId: '',
            width: 0,
            height: 0,
            ratio: 0,
            layout: '',
            errorReason
        });
    }
    releaseImgGenPreviewGuard(task.id, itemId);
    recalcImgGenTaskStatus(task);
    return true;
}

function findImgGenPreviewItem(task, itemId) {
    if (!task || !task.state || !Array.isArray(task.state.previewHistory)) return null;
    return task.state.previewHistory.find((item) => item && item.id === itemId) || null;
}

async function createImgGenVariations(event, taskId, itemId) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const sourceTask = getTaskShadow(taskId) || await getTaskDB(taskId);
    if (!sourceTask || sourceTask.type !== 'tool_image_gen') return;
    ensureImgGenState(sourceTask);
    const item = findImgGenPreviewItem(sourceTask, itemId);
    if (!item || item.status !== 'success' || !item.image) {
        showToast('没有可衍生的成功图片', 'warning');
        return;
    }

    const seedBase = sourceTask.state.seedLocked && sourceTask.state.seed !== ''
        ? parseInt(sourceTask.state.seed, 10)
        : Math.floor(Math.random() * 2147483647);
    const clones = [];
    const groupId = `var_group_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const variantW = 330;
    const variantH = 440;
    const variantGap = 18;
    const clusterSize = {
        width: variantW * 2 + variantGap,
        height: variantH * 2 + variantGap
    };
    const clusterOrigin = resolveLinkedNodePosition(sourceTask, clusterSize, { gap: 42, yOffset: -8 });
    const framePadding = 34;
    const variantFrame = {
        id: `frame_img_var_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: 'frame',
        x: clusterOrigin.x - framePadding,
        y: clusterOrigin.y - framePadding,
        width: clusterSize.width + framePadding * 2,
        height: clusterSize.height + framePadding * 2,
        title: 'V1-4 变体组',
        isCollapsed: false,
        timestamp: Date.now()
    };
    for (let i = 0; i < IMG_GEN_VARIATION_COUNT; i++) {
        const clone = cloneTaskDeep(sourceTask) || { ...sourceTask, state: { ...(sourceTask.state || {}) } };
        clone.id = `tool_img_var_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`;
        clone.x = clusterOrigin.x + (i % 2) * (variantW + variantGap);
        clone.y = clusterOrigin.y + Math.floor(i / 2) * (variantH + variantGap);
        clone.timestamp = Date.now() + i;
        clone.status = 'idle';
        clone.retryCount = 0;
        clone.genTaskId = null;
        clone.isBilled = false;
        clone.parentId = variantFrame.id;
        clone.state = cloneTaskDeep(sourceTask.state) || { ...(sourceTask.state || {}) };
        ensureImgGenState(clone);
        clone.state.images = getImgGenMaxReferenceCount(clone) === 1
            ? [item.image]
            : [item.image, ...(Array.isArray(sourceTask.state.images) ? sourceTask.state.images.slice(0, 4) : [])].slice(0, 5);
        clone.state.refControls = clone.state.images.map((_, index) => createImgGenRefControl(index, {
            intent: index === 0 ? 'structure' : (sourceTask.state.refControls && sourceTask.state.refControls[index - 1] ? sourceTask.state.refControls[index - 1].intent : getImgGenDefaultRefIntent(index)),
            weight: index === 0 ? 0.92 : (sourceTask.state.refControls && sourceTask.state.refControls[index - 1] ? sourceTask.state.refControls[index - 1].weight : undefined)
        }));
        clone.state.prompt = `${sourceTask.state.prompt || ''}, variation ${i + 1}, preserve product identity and premium cinematic lighting`.trim();
        clone.state.previewHistory = [];
        clone.state.resultBlob = null;
        clone.state.resultBlobs = [];
        clone.state.resultUrl = null;
        clone.state.nextSubmitAt = 0;
        clone.state.maskBlob = null;
        clone.state.maskImage = null;
        clone.state.maskEditMode = false;
        clone.state.stageDocked = false;
        clone.state.stageReleased = false;
        clone.state.previewCollapsed = true;
        clone.state.paramsCollapsed = true;
        clone.state.cardWidthCollapsed = variantW;
        clone.state.cardWidthOpen = 650;
        clone.state.cardHeight = variantH;
        clone.state.variantGroupId = groupId;
        clone.state.variantIndex = i + 1;
        clone.state.variantSourceTaskId = sourceTask.id;
        clone.state.variantSourcePreviewId = itemId;
        clone.state.seedLocked = true;
        clone.state.seed = seedBase + i;
        recalcImgGenTaskStatus(clone);
        clones.push(clone);
    }

    const saveList = [variantFrame].concat(clones);
    if (typeof saveTaskBatchDB === 'function') await saveTaskBatchDB(saveList);
    else for (const task of saveList) await saveTaskDB(task);
    await renderBoard();
    setTimeout(() => selectAndFocusTaskIds([variantFrame.id]), 60);
    showToast(`已创建 ${IMG_GEN_VARIATION_COUNT} 个紧凑变体节点，并收纳为便携变体组`, 'success');
}

async function sendImgGenPreviewToMask(event, taskId, itemId) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const sourceTask = getTaskShadow(taskId) || await getTaskDB(taskId);
    if (!sourceTask || sourceTask.type !== 'tool_image_gen') return;
    ensureImgGenState(sourceTask);
    const item = findImgGenPreviewItem(sourceTask, itemId);
    if (!item || !item.image) return showToast('没有可送入蒙版的图片', 'warning');
    sourceTask.state.version = 'pro';
    sourceTask.state.images = getImgGenMaxReferenceCount(sourceTask) === 1
        ? [item.image]
        : [item.image, ...(Array.isArray(sourceTask.state.images) ? sourceTask.state.images.slice(0, 4) : [])].slice(0, 5);
    sourceTask.state.refControls = sourceTask.state.images.map((_, index) => createImgGenRefControl(index, { intent: index === 0 ? 'structure' : getImgGenDefaultRefIntent(index) }));
    sourceTask.state.maskBlob = null;
    sourceTask.state.maskImage = null;
    sourceTask.state.maskEditMode = false;
    sourceTask.state.size = resolveImgGenSize(sourceTask.state);
    normalizeImgGenRefControls(sourceTask);
    sourceTask.timestamp = Date.now();
    setTaskShadow(sourceTask);
    await saveTaskDB(sourceTask);
    renderCard(taskId, sourceTask);
    setTimeout(() => openImgGenMaskStudio(null, taskId), 80);
}

async function sendImgGenPreviewToCropper(event, taskId, itemId) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const sourceTask = getTaskShadow(taskId) || await getTaskDB(taskId);
    if (!sourceTask || sourceTask.type !== 'tool_image_gen') return;
    ensureImgGenState(sourceTask);
    const item = findImgGenPreviewItem(sourceTask, itemId);
    if (!item || !item.image) return showToast('没有可裁切的图片', 'warning');
    const dock = resolveLinkedNodePosition(sourceTask, { width: 340, height: 420 }, { gap: 42, yOffset: 10 });
    const cropTask = {
        id: `tool_crop_from_img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: 'tool_cropper',
        x: dock.x,
        y: dock.y,
        timestamp: Date.now(),
        state: {
            sourceBlob: item.image,
            resultBlob: null,
            cropParams: { left: 15, top: 15, width: 70, height: 70 }
        }
    };
    await saveTaskDB(cropTask);
    await renderBoard();
    setTimeout(() => focusTaskById(cropTask.id), 60);
    showToast('已创建局部裁切器', 'success');
}

function buildImgGenHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const pwd = sessionStorage.getItem('veo_admin_pwd');
    if (pwd) headers['wally123'] = pwd;
    if (API_IMAGE_AUTH) headers['Authorization'] = API_IMAGE_AUTH;
    return headers;
}

async function parseImgGenHttpResponse(response, fallbackStatus = 'accepted') {
    if (!response) return { status: fallbackStatus, accepted: true, empty_response: true };
    const httpStatus = response.status;
    let rawText = '';
    try {
        rawText = await response.text();
    } catch (err) {
        return {
            status: fallbackStatus,
            accepted: response.ok,
            empty_response: true,
            http_status: httpStatus,
            parse_warning: err && err.message ? err.message : String(err || '')
        };
    }
    const text = String(rawText || '').trim();
    if (!text) {
        return {
            status: fallbackStatus,
            accepted: response.ok,
            empty_response: true,
            http_status: httpStatus
        };
    }
    try {
        return JSON.parse(text);
    } catch (err) {
        // Some n8n Respond nodes return plain text or an image URL with a JSON content-type.
        return text;
    }
}

function unwrapImgGenResponseData(rawData) {
    const head = Array.isArray(rawData) ? rawData[0] : rawData;
    if (head && typeof head === 'object' && head.json && typeof head.json === 'object') return head.json;
    return head;
}

function extractImageUrlsFromResponse(rawData) {
    const resData = unwrapImgGenResponseData(rawData);
    if (!resData) return [];
    const urls = [];
    const pushIf = (u) => {
        if (Array.isArray(u)) {
            u.forEach((item) => pushIf(item));
            return;
        }
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
            else if (d && d.imageUrl) pushIf(d.imageUrl);
            else if (d && d.image_url) pushIf(d.image_url);
            else if (d && d.b64_json) pushIf(toDataUrl(d.b64_json));
            if (d && d.result && typeof d.result === 'object') {
                pushIf(d.result.url);
                pushIf(d.result.imageUrl);
                pushIf(d.result.image_url);
                if (Array.isArray(d.result.images)) {
                    d.result.images.forEach((item) => {
                        if (typeof item === 'string') pushIf(item);
                        else if (item && item.url) pushIf(item.url);
                        else if (item && item.imageUrl) pushIf(item.imageUrl);
                        else if (item && item.image_url) pushIf(item.image_url);
                    });
                }
            }
            if (d && Array.isArray(d.images)) {
                d.images.forEach((item) => {
                    if (typeof item === 'string') pushIf(item);
                    else if (item && item.url) pushIf(item.url);
                    else if (item && item.imageUrl) pushIf(item.imageUrl);
                    else if (item && item.image_url) pushIf(item.image_url);
                });
            }
        }
    }
    if (resData.data && typeof resData.data === 'object' && !Array.isArray(resData.data)) {
        const dataObj = resData.data;
        pushIf(dataObj.url);
        pushIf(dataObj.imageUrl);
        pushIf(dataObj.image_url);
        if (Array.isArray(dataObj.images)) {
            dataObj.images.forEach((item) => {
                if (typeof item === 'string') pushIf(item);
                else if (item && item.url) pushIf(item.url);
                else if (item && item.imageUrl) pushIf(item.imageUrl);
                else if (item && item.image_url) pushIf(item.image_url);
            });
        }
        if (dataObj.result && typeof dataObj.result === 'object') {
            pushIf(dataObj.result.url);
            pushIf(dataObj.result.imageUrl);
            pushIf(dataObj.result.image_url);
            if (Array.isArray(dataObj.result.images)) {
                dataObj.result.images.forEach((item) => {
                    if (typeof item === 'string') pushIf(item);
                    else if (item && item.url) pushIf(item.url);
                    else if (item && item.imageUrl) pushIf(item.imageUrl);
                    else if (item && item.image_url) pushIf(item.image_url);
                });
            }
        }
    }
    if (resData.result && typeof resData.result === 'object') {
        if (resData.result.url) pushIf(resData.result.url);
        if (resData.result.imageUrl) pushIf(resData.result.imageUrl);
        if (resData.result.image_url) pushIf(resData.result.image_url);
        if (Array.isArray(resData.result.images)) {
            resData.result.images.forEach((item) => {
                if (typeof item === 'string') pushIf(item);
                else if (item && item.url) pushIf(item.url);
                else if (item && item.imageUrl) pushIf(item.imageUrl);
                else if (item && item.image_url) pushIf(item.image_url);
            });
        }
    }
    if (resData.body && typeof resData.body === 'object') {
        if (resData.body.imageUrl) pushIf(resData.body.imageUrl);
        if (resData.body.image_url) pushIf(resData.body.image_url);
        if (resData.body.url) pushIf(resData.body.url);
        if (Array.isArray(resData.body.output)) {
            resData.body.output.forEach((item) => {
                if (typeof item === 'string') pushIf(item);
                else if (item && item.url) pushIf(item.url);
                else if (item && item.imageUrl) pushIf(item.imageUrl);
                else if (item && item.image_url) pushIf(item.image_url);
            });
        }
        if (Array.isArray(resData.body.images)) {
            resData.body.images.forEach((item) => {
                if (typeof item === 'string') pushIf(item);
                else if (item && item.url) pushIf(item.url);
                else if (item && item.imageUrl) pushIf(item.imageUrl);
                else if (item && item.image_url) pushIf(item.image_url);
            });
        }
    }
    return urls;
}

function extractImageUrlFromResponse(rawData) {
    const list = extractImageUrlsFromResponse(rawData);
    return list.length > 0 ? list[0] : null;
}

function extractImgGenTaskId(rawData) {
    const resData = unwrapImgGenResponseData(rawData);
    if (!resData || typeof resData !== 'object') return '';
    const picks = [
        resData.taskId, resData.task_id, resData.jobId, resData.job_id, resData.requestId, resData.request_id, resData.id,
        resData.body && resData.body.taskId,
        resData.body && resData.body.task_id,
        resData.body && resData.body.jobId,
        resData.body && resData.body.job_id,
        resData.result && resData.result.taskId,
        resData.result && resData.result.task_id,
        resData.result && resData.result.jobId,
        resData.result && resData.result.job_id,
        resData.data && resData.data.taskId,
        resData.data && resData.data.task_id
    ];

    if (Array.isArray(resData.data) && resData.data.length > 0) {
        const head = resData.data[0];
        if (head && typeof head === 'object') {
            picks.push(head.taskId, head.task_id, head.jobId, head.job_id, head.id);
        }
    }

    for (const item of picks) {
        if (item === undefined || item === null) continue;
        const v = String(item).trim();
        if (v) return v;
    }
    return '';
}

function extractImgGenStatus(rawData) {
    const resData = unwrapImgGenResponseData(rawData);
    if (!resData) return '';
    const candidates = [
        resData.status, resData.state, resData.phase,
        resData.body && resData.body.status,
        resData.body && resData.body.state,
        resData.result && resData.result.status,
        resData.result && resData.result.state,
        resData.data && resData.data.status
    ];

    if (Array.isArray(resData.data) && resData.data.length > 0) {
        const head = resData.data[0];
        if (head && typeof head === 'object') {
            candidates.push(head.status, head.state, head.phase);
        }
    }

    for (const c of candidates) {
        if (c === undefined || c === null) continue;
        const s = String(c).trim().toLowerCase();
        if (s) return s;
    }
    return '';
}

function isImgGenSuccessStatus(status) {
    return ['success', 'succeeded', 'completed', 'done', 'finished', 'ok'].includes(status);
}

function isImgGenFailedStatus(status) {
    return ['failed', 'error', 'rejected', 'cancelled', 'canceled', 'timeout', 'aborted'].includes(status);
}

function isImgGenPendingStatus(status) {
    return ['processing', 'pending', 'queued', 'in_progress', 'running', 'submitted', 'accepted', 'created'].includes(status);
}

function resolveImgGenPollDelayMs(rawData, fallback = 3500) {
    const resData = unwrapImgGenResponseData(rawData);
    const retryAfterSec = toFiniteNumber(resData && (resData.retry_after || (resData.body && resData.body.retry_after)), NaN);
    const candidateMs = toFiniteNumber(
        resData && (
            resData.pollIntervalMs ||
            resData.poll_interval_ms ||
            resData.retryAfterMs ||
            (resData.body && (resData.body.pollIntervalMs || resData.body.poll_interval_ms || resData.body.retryAfterMs))
        ),
        NaN
    );
    if (Number.isFinite(retryAfterSec) && retryAfterSec > 0) return Math.max(1000, Math.min(15000, Math.round(retryAfterSec * 1000)));
    if (Number.isFinite(candidateMs) && candidateMs > 0) return Math.max(1000, Math.min(15000, Math.round(candidateMs)));
    return Math.max(1000, fallback);
}

function buildImgGenPollPayload(task, remoteTaskId) {
    const version = (task && task.state && task.state.version === 'pro') ? 'pro' : 'trial';
    const channel = (task && task.state && task.state.channel) ? task.state.channel : 'channel_1';
    const mode = task && task.state ? resolveImgGenMode(task.state) : 'text2img';
    const route = task && task.state ? normalizeImgGenRoute(task.state.providerSort || task.state.routeMode || task.state.modelSuffix || 'stable') : normalizeImgGenRoute();
    const core = {
        action: 'poll',
        poll: true,
        version,
        channel,
        mode,
        providerSort: route.key,
        providerKey: route.key,
        provider_key: route.key,
        routeMode: route.mode,
        route_mode: route.mode,
        taskId: remoteTaskId,
        task_id: remoteTaskId,
        request_id: remoteTaskId
    };
    return {
        unified: { body: { ...core }, ...core },
        legacy: {
            action: 'poll',
            poll: true,
            channel,
            taskId: remoteTaskId,
            task_id: remoteTaskId,
            request_id: remoteTaskId
        },
        fallback: {
            taskId: remoteTaskId,
            task_id: remoteTaskId,
            model: 'image'
        }
    };
}

function isLocalImgGenFallbackTaskId(remoteTaskId, taskId = '') {
    const id = String(remoteTaskId || '').trim();
    if (!id) return true;
    if (taskId && id === taskId) return true;
    return /^tool_img_/i.test(id) || /_img_item_/i.test(id);
}

function startImgGenTaskPolling(taskId, remoteTaskId, previewItemId = '') {
    const itemId = previewItemId || remoteTaskId || createImgGenPreviewId();
    const pollKey = buildImgGenPollKey(taskId, itemId);
    clearImgGenPolling(taskId, itemId);
    let attempts = 0;
    let errorCount = 0;
    const maxAttempts = 180;
    const maxErrors = 24;

    const scheduleNext = (delayMs = 3500) => {
        const timer = setTimeout(() => {
            poll().catch(() => {});
        }, Math.max(1000, toFiniteNumber(delayMs, 3500)));
        imgGenPollTimers.set(pollKey, timer);
    };

    const poll = async () => {
        imgGenPollTimers.delete(pollKey);
        attempts++;

        const task = mergeImgGenTaskWithShadow(await getTaskDB(taskId), getTaskShadow(taskId), { protectedIds: getImgGenProtectedPreviewIds(taskId) });
        if (!task) { clearImgGenPolling(taskId, itemId); return; }
        ensureImgGenState(task);
        normalizeImgGenPreviewHistory(task);

        const targetItem = task.state.previewHistory.find((entry) => entry && entry.id === itemId);
        if (!targetItem || targetItem.status !== 'pending') {
            clearImgGenPolling(taskId, itemId);
            return;
        }

        const remoteId = String(remoteTaskId || targetItem.remoteTaskId || '').trim();
        if (!remoteId) {
            const writeTask = await getImgGenTaskForPreviewWrite(taskId, itemId, task);
            if (!writeTask) { clearImgGenPolling(taskId, itemId); return; }
            markImgGenPreviewFailed(writeTask, itemId, '轮询缺少任务 ID');
            writeTask.timestamp = Date.now();
            clearImgGenPolling(taskId, itemId);
            setTaskShadow(writeTask);
            await saveTaskDB(writeTask);
            renderCard(taskId, writeTask);
            forceRenderImgGenPreviewPanel(writeTask, itemId);
            showToast('轮询缺少任务ID，已终止', 'error');
            return;
        }

        const pollPayload = buildImgGenPollPayload(task, remoteId);
        const headers = buildImgGenHeaders();
        const attemptsList = [];
        const pollEndpoint = resolveImgGenPollEndpoint();

        if (isLocalImgGenFallbackTaskId(remoteId, taskId)) {
            const writeTask = await getImgGenTaskForPreviewWrite(taskId, itemId, task);
            if (!writeTask) { clearImgGenPolling(taskId, itemId); return; }
            markImgGenPreviewFailed(writeTask, itemId, '后端未返回真实图片任务 ID，已停止无效轮询');
            writeTask.timestamp = Date.now();
            clearImgGenPolling(taskId, itemId);
            setTaskShadow(writeTask);
            await saveTaskDB(writeTask);
            renderCard(taskId, writeTask);
            forceRenderImgGenPreviewPanel(writeTask, itemId);
            showToast('后端未返回真实任务ID，已停止轮询避免刷屏', 'warning');
            return;
        }

        if (!pollEndpoint.url) {
            const reason = pollEndpoint.reason === 'points_to_generation'
                ? '图片轮询接口误指向生图生成入口，已停止轮询，避免 n8n 空 prompt 刷屏'
                : '未配置可用图片轮询接口，已停止轮询；默认 unified 入口需支持 action=poll，或单独配置 VEO_IMAGE_POLL_WEBHOOK';
            const writeTask = await getImgGenTaskForPreviewWrite(taskId, itemId, task);
            if (!writeTask) { clearImgGenPolling(taskId, itemId); return; }
            markImgGenPreviewFailed(writeTask, itemId, reason);
            writeTask.genTaskId = null;
            writeTask.timestamp = Date.now();
            clearImgGenPolling(taskId, itemId);
            setTaskShadow(writeTask);
            await saveTaskDB(writeTask);
            renderCard(taskId, writeTask);
            forceRenderImgGenPreviewPanel(writeTask, itemId);
            console.warn('[img-poll] stopped invalid image polling:', {
                reason: pollEndpoint.reason,
                imagePollWebhook: API_IMAGE_POLL || '',
                imageGenWebhook: API_IMAGE_GEN,
                legacyWebhook: API_IMAGE_GEN_LEGACY,
                remoteId
            });
            showToast('图片轮询已熔断：请检查 VEO_IMAGE_POLL_WEBHOOK，不要填旧版生成入口', 'warning');
            return;
        }
        attemptsList.push({ url: pollEndpoint.url, body: pollPayload.unified });

        let rawData = null;
        let lastHttpError = null;
        for (const target of attemptsList) {
            if (!target || !target.url) continue;
            try {
                const controller = new AbortController();
                imgGenPollControllers.set(pollKey, controller);
                const response = await fetch(target.url, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(target.body),
                    signal: controller.signal
                });
                imgGenPollControllers.delete(pollKey);
                if (response.status === 401 || response.status === 403) {
                    clearImgGenPolling(taskId, itemId);
                    handleAuthError();
                    return;
                }
                if (!response.ok) {
                    lastHttpError = new Error(`poll http ${response.status}`);
                    continue;
                }
                rawData = await parseImgGenHttpResponse(response, 'processing');
                if (rawData !== null && rawData !== undefined) break;
            } catch (err) {
                if (err && err.name === 'AbortError') return;
                lastHttpError = err;
            } finally {
                imgGenPollControllers.delete(pollKey);
            }
        }

        if (rawData === null || rawData === undefined) {
            errorCount++;
            if (errorCount >= maxErrors || attempts >= maxAttempts) {
                const writeTask = await getImgGenTaskForPreviewWrite(taskId, itemId, task);
                if (!writeTask) { clearImgGenPolling(taskId, itemId); return; }
                markImgGenPreviewFailed(writeTask, itemId, lastHttpError || '轮询无有效响应');
                writeTask.timestamp = Date.now();
                clearImgGenPolling(taskId, itemId);
                setTaskShadow(writeTask);
                await saveTaskDB(writeTask);
                renderCard(taskId, writeTask);
                forceRenderImgGenPreviewPanel(writeTask, itemId);
                showToast('生图轮询超时，请稍后重试', 'error');
                if (lastHttpError) console.warn('[img-poll] no valid response:', lastHttpError);
                return;
            }
            scheduleNext(3500);
            return;
        }

        const returnedUrls = extractImageUrlsFromResponse(rawData);
        if (Array.isArray(returnedUrls) && returnedUrls.length > 0) {
            let output = returnedUrls[0];
            try {
                const r = await fetch(output);
                if (r.ok) output = await r.blob();
            } catch (fetchErr) {}

            const writeTask = await getImgGenTaskForPreviewWrite(taskId, itemId, task);
            if (!writeTask) { clearImgGenPolling(taskId, itemId); return; }
            const writeItem = writeTask.state.previewHistory.find((entry) => entry && entry.id === itemId) || targetItem;
            const costTime = Math.floor((Date.now() - (writeItem.createdAt || targetItem.createdAt || Date.now())) / 1000);
            const imageMeta = await readImageMeta(output);
            markImgGenPreviewSuccess(writeTask, itemId, output, costTime, imageMeta);
            writeTask.state.costTime = costTime;
            writeTask.timestamp = Date.now();
            if (!getImgGenPendingCount(writeTask)) writeTask.genTaskId = null;
            const billingInfo = calculateImgGenBilling(writeTask, rawData);
            writeTask.state.lastUsageCost = billingInfo.cost;
            writeTask.state.lastUsageDetail = billingInfo.detail;
            writeTask.state.lastUsageAt = Date.now();
            clearImgGenPolling(taskId, itemId);
            await addBillingRecord({
                id: 'bill_img_' + writeTask.id + '_' + Date.now(),
                taskId: writeTask.id,
                type: 'image',
                cost: billingInfo.cost,
                detail: billingInfo.detail,
                inputTokens: billingInfo.usage ? billingInfo.usage.inputTokens : 0,
                outputTokens: billingInfo.usage ? billingInfo.usage.outputTokens : 0,
                version: writeTask.state.version || 'trial',
                channel: writeTask.state.channel || 'channel_1'
            });
            updateBillingUI();
            setTaskShadow(writeTask);
            await saveTaskDB(writeTask);
            renderCard(taskId, writeTask);
            forceRenderImgGenPreviewPanel(writeTask, itemId);
            return;
        }

        const status = extractImgGenStatus(rawData);
        if (isImgGenSuccessStatus(status)) {
            scheduleNext(resolveImgGenPollDelayMs(rawData, 1800));
            return;
        }
        if (isImgGenFailedStatus(status)) {
            const writeTask = await getImgGenTaskForPreviewWrite(taskId, itemId, task);
            if (!writeTask) { clearImgGenPolling(taskId, itemId); return; }
            markImgGenPreviewFailed(writeTask, itemId, `后端返回失败状态: ${status}`);
            writeTask.timestamp = Date.now();
            clearImgGenPolling(taskId, itemId);
            setTaskShadow(writeTask);
            await saveTaskDB(writeTask);
            renderCard(taskId, writeTask);
            forceRenderImgGenPreviewPanel(writeTask, itemId);
            showToast('生图任务失败，请调整参数后重试', 'error');
            return;
        }

        const nextTaskId = extractImgGenTaskId(rawData);
        if (nextTaskId && nextTaskId !== remoteId) {
            remoteTaskId = nextTaskId;
            const dynamicItem = task.state.previewHistory.find((entry) => entry && entry.id === itemId);
            if (dynamicItem) dynamicItem.remoteTaskId = nextTaskId;
            updateImgGenPreviewGuard(taskId, itemId, { remoteTaskId: nextTaskId });
            const writeTask = await getImgGenTaskForPreviewWrite(taskId, itemId, task);
            if (!writeTask) { clearImgGenPolling(taskId, itemId); return; }
            writeTask.genTaskId = nextTaskId;
            writeTask.timestamp = Date.now();
            setTaskShadow(writeTask);
            await saveTaskDB(writeTask);
        }

        if (!status || isImgGenPendingStatus(status)) {
            if (attempts >= maxAttempts) {
                const writeTask = await getImgGenTaskForPreviewWrite(taskId, itemId, task);
                if (!writeTask) { clearImgGenPolling(taskId, itemId); return; }
                markImgGenPreviewFailed(writeTask, itemId, '轮询超时');
                writeTask.timestamp = Date.now();
                clearImgGenPolling(taskId, itemId);
                setTaskShadow(writeTask);
                await saveTaskDB(writeTask);
                renderCard(taskId, writeTask);
                forceRenderImgGenPreviewPanel(writeTask, itemId);
                showToast('生图轮询超时，请稍后重试', 'error');
                return;
            }
            scheduleNext(resolveImgGenPollDelayMs(rawData, 3500));
            return;
        }

        scheduleNext(resolveImgGenPollDelayMs(rawData, 3500));
    };

    scheduleNext(800);
}

async function toggleImgGenPreviewPanel(e, taskId) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    const baseTask = getTaskShadow(taskId) || await getTaskDB(taskId);
    const task = baseTask ? (cloneTaskDeep(baseTask) || { ...baseTask }) : null;
    if (!task) return;
    ensureImgGenState(task);
    task.state.previewCollapsed = !task.state.previewCollapsed;
    task.timestamp = Date.now();
    setTaskShadow(task);
    renderCard(taskId, task);
    await saveTaskDB(task);
}

async function switchImgGenChannelAndRetry(e, taskId) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    await queueImgGenTaskUpdate(taskId, async () => {
        const baseTask = getTaskShadow(taskId) || await getTaskDB(taskId);
        if (!baseTask) return;
        const task = cloneTaskDeep(baseTask) || { ...baseTask };
        ensureImgGenState(task);
        if (task.state.version === 'pro') {
            const route = normalizeImgGenRoute();
            task.state.providerSort = route.key;
            task.state.modelSuffix = route.suffix;
            task.state.routeMode = route.mode;
            task.state.imageModel = getImgGenModelForRoute(route);
            showToast('Pro 将使用默认通道重试', 'info');
        } else {
            task.state.channel = task.state.channel === 'channel_2' ? 'channel_1' : 'channel_2';
            showToast(`已切换试用通道：${task.state.channel === 'channel_2' ? '通道 2' : '通道 1'}，准备重试`, 'info');
        }
        task.state.nextSubmitAt = 0;
        task.retryCount = 0;
        task.timestamp = Date.now();
        setTaskShadow(task);
        renderCard(taskId, task);
        await saveTaskDB(task);
    }).catch(() => {
        showToast('切换通道失败，请手动重试', 'error');
    });
    setTimeout(() => submitImgGen(taskId), 80);
}

async function retryImgGenPreviewItem(e, taskId) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    await queueImgGenTaskUpdate(taskId, async () => {
        const baseTask = getTaskShadow(taskId) || await getTaskDB(taskId);
        if (!baseTask) return;
        const task = cloneTaskDeep(baseTask) || { ...baseTask };
        ensureImgGenState(task);
        task.state.nextSubmitAt = 0;
        task.state.previewCollapsed = false;
        task.retryCount = 0;
        task.timestamp = Date.now();
        setTaskShadow(task);
        renderCard(taskId, task);
        await saveTaskDB(task);
    }).catch(() => {
        showToast('重试准备失败，请再点一次', 'error');
    });
    setTimeout(() => submitImgGen(taskId), 80);
}

async function removeImgGenPreviewItem(e, taskId, itemId) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    if (!itemId) return;
    await queueImgGenTaskUpdate(taskId, async () => {
        const baseTask = getTaskShadow(taskId) || await getTaskDB(taskId);
        if (!baseTask) return;
        const task = cloneTaskDeep(baseTask) || { ...baseTask };
        ensureImgGenState(task);
        const removedItem = Array.isArray(task.state.previewHistory)
            ? task.state.previewHistory.find((item) => item && item.id === itemId)
            : null;
        task.state.previewHistory = Array.isArray(task.state.previewHistory)
            ? task.state.previewHistory.filter((item) => item && item.id !== itemId)
            : [];
        if (removedItem && removedItem.status === 'pending') {
            task.state.previewHistory.push({ ...removedItem, hidden: true });
            guardImgGenPreviewItem(taskId, { ...removedItem, hidden: true, status: 'pending' });
        } else {
            clearImgGenPolling(taskId, itemId);
            releaseImgGenPreviewGuard(taskId, itemId);
        }
        recalcImgGenTaskStatus(task);
        if (removedItem && removedItem.status === 'pending' && getImgGenPendingCount(task) === 0) {
            task.genTaskId = null;
            task.retryCount = 0;
            task.state.startTime = null;
        }
        if (removedItem && removedItem.remoteTaskId && task.genTaskId === removedItem.remoteTaskId) {
            task.genTaskId = null;
        }
        if (removedItem && removedItem.id) {
            revokeBlobPrefixSafe(`${taskId}_feed_${removedItem.id}_`);
        }
        task.timestamp = Date.now();
        setTaskShadow(task);
        renderCard(taskId, task);
        if (removedItem && removedItem.status === 'pending') {
            forceRenderImgGenPreviewPanel(task, '');
            showToast('已隐藏等待框，后台结果返回后会自动补回预览', 'info');
        }
        await saveTaskDB(task);
    }).catch(() => {
        showToast('删除失败记录失败，请重试', 'error');
    });
}

async function toggleImgGenParamsPanel(e, taskId) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    await queueImgGenTaskUpdate(taskId, async () => {
        const baseTask = getTaskShadow(taskId) || await getTaskDB(taskId);
        if (!baseTask) return;
        const task = cloneTaskDeep(baseTask) || { ...baseTask };
        ensureImgGenState(task);
        task.state.paramsCollapsed = !task.state.paramsCollapsed;
        task.timestamp = Date.now();
        setTaskShadow(task);
        renderCard(taskId, task);
        await saveTaskDB(task);
    }).catch(() => {
        showToast('参数面板切换失败', 'error');
    });
}

async function toggleImgGenPromptTools(e, taskId) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    await queueImgGenTaskUpdate(taskId, async () => {
        const baseTask = getTaskShadow(taskId) || await getTaskDB(taskId);
        if (!baseTask) return;
        const task = cloneTaskDeep(baseTask) || { ...baseTask };
        ensureImgGenState(task);
        task.state.promptToolsCollapsed = !task.state.promptToolsCollapsed;
        task.timestamp = Date.now();
        setTaskShadow(task);
        renderCard(taskId, task);
        await saveTaskDB(task);
    }).catch(() => {
        showToast('快捷提示词切换失败', 'error');
    });
}

async function toggleImgGenMaskTools(e, taskId) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    await queueImgGenTaskUpdate(taskId, async () => {
        const baseTask = getTaskShadow(taskId) || await getTaskDB(taskId);
        if (!baseTask) return;
        const task = cloneTaskDeep(baseTask) || { ...baseTask };
        ensureImgGenState(task);
        task.state.maskPanelCollapsed = !task.state.maskPanelCollapsed;
        task.timestamp = Date.now();
        setTaskShadow(task);
        renderCard(taskId, task);
        await saveTaskDB(task);
    }).catch(() => {
        showToast('蒙版工具切换失败', 'error');
    });
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

async function updateImgGenState(taskId, key, val) {
    await queueImgGenTaskUpdate(taskId, async () => {
        const baseTask = getTaskShadow(taskId) || await getTaskDB(taskId);
        if (!baseTask) return;

        const task = cloneTaskDeep(baseTask) || { ...baseTask };
        ensureImgGenState(task);

        if (key === 'n') {
            task.state.n = 1;
        } else if (key === 'proResolution') {
            task.state.proResolution = ['1k', '2k', '4k'].includes(String(val)) ? String(val) : '1k';
            if (task.state.version === 'pro') task.state.size = resolveImgGenSize(task.state);
        } else if (key === 'proRatio') {
            task.state.proRatio = String(val || '1:1');
            if (task.state.version === 'pro') task.state.size = resolveImgGenSize(task.state);
        } else if (key === 'providerSort') {
            const route = normalizeImgGenRoute(val);
            task.state.providerSort = route.key;
            task.state.modelSuffix = route.suffix;
            task.state.routeMode = route.mode;
            task.state.imageModel = getImgGenModelForRoute(route);
        } else if (key === 'maskBrushSize') {
            task.state.maskBrushSize = clampImgMaskBrushSize(val);
        } else if (key === 'maskStageHeight') {
            task.state.maskStageHeight = clampImgMaskStageHeight(val);
        } else if (key === 'seedLocked') {
            task.state.seedLocked = val === true || val === 'true';
            if (task.state.seedLocked && task.state.seed === '') {
                task.state.seed = Math.floor(Math.random() * 2147483647);
            }
        } else if (key === 'seed') {
            const parsedSeed = parseInt(val, 10);
            task.state.seed = Number.isFinite(parsedSeed) && parsedSeed >= 0 ? parsedSeed : '';
            if (task.state.seed !== '') task.state.seedLocked = true;
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
            if (nextVersion === 'trial' && !IMG_GEN_TRIAL_AVAILABLE) {
                task.state.version = 'pro';
                task.state.size = resolveImgGenSize(task.state);
                showToast('试用版服务通道已关闭，已保持专业版', 'warning');
            } else {
                task.state.version = nextVersion;
                if (nextVersion === 'pro') {
                    const detected = detectProPresetFromSize(task.state.size);
                    if (detected.proRatio && detected.proRatio !== 'auto') task.state.proRatio = detected.proRatio;
                    if (detected.proResolution) task.state.proResolution = detected.proResolution;
                    task.state.size = resolveImgGenSize(task.state);
                } else {
                    task.state.size = resolveImgGenSize(task.state);
                }
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

        enforceImgGenRouteReferenceLimit(task);
        normalizeImgGenRefControls(task);
        task.timestamp = Date.now();
        setTaskShadow(task);
        renderCard(taskId, task);
        await saveTaskDB(task);
    }).catch(() => {
        showToast('参数更新失败，请重试', 'error');
    });
}

async function updateImgGenRefControl(taskId, index, key, value) {
    const slotIndex = parseInt(index, 10);
    if (!Number.isFinite(slotIndex) || slotIndex < 0 || slotIndex > 4) return;
    await queueImgGenTaskUpdate(taskId, async () => {
        const baseTask = getTaskShadow(taskId) || await getTaskDB(taskId);
        if (!baseTask) return;
        const task = cloneTaskDeep(baseTask) || { ...baseTask };
        ensureImgGenState(task);
        normalizeImgGenRefControls(task);
        if (!task.state.refControls[slotIndex]) return;
        if (key === 'intent') {
            const allowed = new Set(IMG_GEN_REF_INTENTS.map((item) => item.value));
            task.state.refControls[slotIndex].intent = allowed.has(value) ? value : getImgGenDefaultRefIntent(slotIndex);
        } else if (key === 'weight') {
            task.state.refControls[slotIndex].weight = clampImgGenRefWeight(value);
        } else if (key === 'locked') {
            task.state.refControls[slotIndex].locked = value === true || value === 'true';
        }
        task.timestamp = Date.now();
        setTaskShadow(task);
        renderCard(taskId, task);
        await saveTaskDB(task);
    }).catch(() => {
        showToast('参考图控制更新失败', 'error');
    });
}

async function appendImgGenPromptTag(event, taskId, text) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const tagIndex = parseInt(text, 10);
    const tag = Number.isFinite(tagIndex) && IMG_GEN_PROMPT_TAGS[tagIndex]
        ? IMG_GEN_PROMPT_TAGS[tagIndex].text
        : String(text || '').trim();
    if (!tag) return;
    const baseTask = getTaskShadow(taskId) || await getTaskDB(taskId);
    if (!baseTask) return;
    const task = cloneTaskDeep(baseTask) || { ...baseTask };
    ensureImgGenState(task);
    const current = String(task.state.prompt || '').trim();
    task.state.prompt = current ? `${current}, ${tag}` : tag;
    task.timestamp = Date.now();
    setTaskShadow(task);
    renderCard(taskId, task);
    await saveTaskDB(task).catch((err) => {
        console.warn('[submitImgGen] pending save failed, continue request:', err);
    });
    const promptEl = document.querySelector(`#card-${cssEscapeSafe(taskId)} .img-gen-prompt`);
    if (promptEl) {
        promptEl.focus();
        try { promptEl.setSelectionRange(promptEl.value.length, promptEl.value.length); } catch (err) {}
    }
}

async function handleGenImageUpload(input, taskId) {
    if (!input.files || input.files.length === 0) return;
    const task = await getTaskDB(taskId); if (!task) return;
    ensureImgGenState(task);
    const maxImageCount = getImgGenMaxReferenceCount(task);
    const files = Array.from(input.files);
    const filesToUse = maxImageCount === 1 ? files.slice(-1) : files;
    if (maxImageCount === 1 && files.length > 1) {
        showToast('AI666 通道仅支持 1 张参考图，已使用最后选择的图片', 'info');
    }
    for (let file of filesToUse) {
        const blob = await compressImageToBlob(file, 1024);
        if (maxImageCount === 1) {
            task.state.images = [blob];
            break;
        }
        if (task.state.images.length >= 5) break;
        task.state.images.push(blob);
    }
    enforceImgGenRouteReferenceLimit(task);
    normalizeImgGenRefControls(task);
    task.timestamp = Date.now();
    revokeBlobPrefixSafe(`${taskId}_img_`);
    revokeBlobPrefixSafe(`${taskId}_mask_preview_`);
    renderCard(taskId, task);
    await saveTaskDB(task);
    input.value = '';
}

// ==========================================
// ✅ 修复版：生图卡片拖拽处理函数 (免疫 dataTransfer 销毁)
// ==========================================
async function handleGenImageDrop(e, taskId) {
    e.preventDefault(); e.stopPropagation();
    const zone = document.getElementById(`img-gen-zone-${taskId}`);
    if (zone) zone.classList.remove('drag-over');

    const srcToUse = await parseDroppedImage(e);
    if (!srcToUse) return;

    const task = await getTaskDB(taskId);
    if (!task) return;
    ensureImgGenState(task);

    const maxImageCount = getImgGenMaxReferenceCount(task);
    if (maxImageCount === 1) {
        task.state.images = [srcToUse];
        task.state.maskBlob = null;
        task.state.maskImage = null;
        task.state.maskEditMode = false;
        revokeBlobPrefixSafe(`${taskId}_mask_preview_`);
        revokeBlobPrefixSafe(`${taskId}_mask_studio_`);
        destroyImgMaskStudio(taskId);
        destroyImgMaskEditor(taskId);
        showToast('AI666 通道仅保留 1 张参考图，已替换为新图', 'info');
    } else {
        if (task.state.images.length >= 5) {
            return showToast('最多只能垫入 5 张图', 'error');
        }
        task.state.images.push(srcToUse);
    }

    enforceImgGenRouteReferenceLimit(task);
    normalizeImgGenRefControls(task);
    task.timestamp = Date.now();
    revokeBlobPrefixSafe(`${taskId}_img_`);
    revokeBlobPrefixSafe(`${taskId}_mask_preview_`);
    renderCard(taskId, task);
    await saveTaskDB(task);
}
async function removeGenImage(e, taskId, index) {
    e.stopPropagation(); const task = await getTaskDB(taskId); if (!task) return;
    ensureImgGenState(task);
    const removedBase = index === 0;
    task.state.images.splice(index, 1);
    if (Array.isArray(task.state.refControls)) task.state.refControls.splice(index, 1);
    normalizeImgGenRefControls(task);
    revokeBlobPrefixSafe(`${taskId}_img_`);
    revokeBlobPrefixSafe(`${taskId}_mask_preview_`);
    revokeBlobPrefixSafe(`${taskId}_mask_studio_`);
    if (removedBase) {
        task.state.maskBlob = null;
        task.state.maskImage = null;
        if (task.state.images.length === 0) task.state.maskEditMode = false;
        destroyImgMaskStudio(taskId);
        destroyImgMaskEditor(taskId);
    }
    if (task.state.images.length === 0) {
        task.state.maskBlob = null;
        task.state.maskImage = null;
        task.state.maskEditMode = false;
        destroyImgMaskStudio(taskId);
        destroyImgMaskEditor(taskId);
    }
    task.timestamp = Date.now();
    renderCard(taskId, task);
    await saveTaskDB(task);
}

// ==========================================
// 🎨 AI 多模生图核心控制模块 (完全融合版)
// ==========================================
async function submitImgGen(taskId) {
    clearImgGenPromptDraftTimer(taskId);
    const shadowTask = getTaskShadow(taskId);
    const task = (shadowTask && shadowTask.type === 'tool_image_gen')
        ? (cloneTaskDeep(shadowTask) || { ...shadowTask })
        : await getTaskDB(taskId);
    if (!task) return;
    ensureImgGenState(task);
    if (!task.state.prompt) return showToast("请输入生图提示词", "error");
    const version = task.state.version === 'pro' ? 'pro' : 'trial';
    if (version !== 'pro' && !IMG_GEN_TRIAL_AVAILABLE) {
        task.state.version = 'pro';
        task.state.size = resolveImgGenSize(task.state);
        task.timestamp = Date.now();
        setTaskShadow(task);
        await renderCard(taskId, task);
        await saveTaskDB(task).catch(() => {});
        return showToast('试用版服务通道已关闭，请使用专业版 GPT Image 2', 'warning');
    }
    const now = Date.now();
    const nextSubmitAt = toFiniteNumber(task.state.nextSubmitAt, 0);
    if (now < nextSubmitAt) {
        const waitSec = Math.max(1, Math.ceil((nextSubmitAt - now) / 1000));
        showToast(`请等待 ${waitSec}s 后再生成`, "warning");
        renderCard(taskId, task);
        return;
    }
    if (task.state.previewCollapsed) task.state.previewCollapsed = false;
    try {
        await captureImgMaskFromEditor(taskId, task, { clearIfEmpty: true });
    } catch (err) {}

    task.state.nextSubmitAt = now + IMG_GEN_CLICK_COOLDOWN_MS;
    task.retryCount = 0;
    task.isBilled = false;
    task.state.startTime = now;
    task.state.previewCollapsed = false;
    const previewItemId = pushImgGenPendingItem(task);
    task.timestamp = now;
    setTaskShadow(task);
    await renderCard(taskId, task);
    forceRenderImgGenPreviewPanel(task, previewItemId);
    await waitNextPaint();
    await saveTaskDB(task).catch((err) => {
        console.warn('[submitImgGen] pending save failed, continue request:', err);
    });

    setTimeout(async () => {
        try {
            const fresh = await getTaskDB(taskId);
            const live = getTaskShadow(taskId);
            const next = fresh ? mergeImgGenTaskWithShadow(fresh, live, { protectedIds: getImgGenProtectedPreviewIds(taskId) }) : live;
            if (!next) return;
            setTaskShadow(next);
            await renderCard(taskId, next);
            forceRenderImgGenPreviewPanel(next, previewItemId);
        } catch (err) {}
    }, IMG_GEN_CLICK_COOLDOWN_MS + 40);

    let resolvedSize = resolveImgGenSize(task.state);
    let finalPrompt = task.state.prompt;
    const trialCustomW = task.state.customW || 9;
    const trialCustomH = task.state.customH || 16;
    const trialCustomRatio = (version !== 'pro' && task.state.trialRatio === 'custom') ? `${trialCustomW}:${trialCustomH}` : '';
    if (trialCustomRatio) finalPrompt = `${finalPrompt} 画面比例${trialCustomRatio}`;

    if (version === 'pro' && resolvedSize !== 'auto') {
        const strict = enforceProSizeRules(resolvedSize);
        if (!strict.isValid) {
            markImgGenPreviewFailed(task, previewItemId, 'Pro 尺寸不符合规则');
            await saveTaskDB(task);
            renderCard(taskId, task);
            forceRenderImgGenPreviewPanel(task, previewItemId);
            return showToast('Pro 尺寸不符合规则，请调整比例后重试', 'error');
        }
        if (strict.changed) {
            resolvedSize = strict.size;
            showToast(`Pro 尺寸已按规则校正为 ${strict.size}`, 'info');
        }
    }
    task.state.size = resolvedSize;
    const sizeToSend = resolvedSize;
    const route = normalizeImgGenRoute(task.state.providerSort);
    enforceImgGenRouteReferenceLimit(task);
    const maxImageCount = getImgGenMaxReferenceCount(task);
    const imagesForSubmit = limitImgGenReferencesForRoute(task, task.state.images);
    task.state.images = imagesForSubmit;
    normalizeImgGenRefControls(task);
    const mode = resolveImgGenMode(task.state);
    const imageModel = version === 'pro' ? getImgGenModelForRoute(route) : 'legacy-image';
    const imageEncodeOptions = resolveImgGenNetworkEncodeOptions(route.key, 'image');
    const maskEncodeOptions = resolveImgGenNetworkEncodeOptions(route.key, 'mask');
    const imagesBase64 = await blobsToBase64Sequential(imagesForSubmit, imageEncodeOptions);
    const maskSource = task.state.maskBlob || task.state.maskImage || null;
    const maskBase64 = maskSource ? await blobToBase64(maskSource, maskEncodeOptions) : null;
    const imagePayloadFields = buildImgGenImagePayloadFields(imagesBase64, maskBase64, maxImageCount);
    const encodedImageBytes = imagesBase64.reduce((sum, item) => sum + String(item || '').length, 0) + String(maskBase64 || '').length;
    if (route.key === 'ai666' && encodedImageBytes > 10 * 1024 * 1024) {
        markImgGenPreviewFailed(task, previewItemId, 'AI666 垫图请求体仍然过大，请减少参考图或先裁切压缩');
        await saveTaskDB(task);
        renderCard(taskId, task);
        forceRenderImgGenPreviewPanel(task, previewItemId);
        return showToast('AI666 通道垫图体积过大，请减少参考图或先裁切压缩', 'error');
    }
    const referenceControls = buildImgGenRefControlPayload(task);
    const lockedSeed = task.state.seedLocked && task.state.seed !== '' ? parseInt(task.state.seed, 10) : null;
    const clientRequestId = `${task.id}_${previewItemId}`;
    const nValue = 1;
    const rawOutputCompression = toFiniteNumber(task.state.outputCompression ?? task.state.output_compression, NaN);
    const outputCompression = Number.isFinite(rawOutputCompression)
        ? Math.max(0, Math.min(100, Math.round(rawOutputCompression)))
        : undefined;

    const unifiedPayloadCore = {
        version: version,
        channel: task.state.channel || 'channel_1',
        mode: mode,
        model: imageModel,
        imageModel: imageModel,
        modelSuffix: route.suffix,
        routeMode: route.mode,
        ratio: version === 'pro' ? (task.state.proRatio || '1:1') : (task.state.trialRatio || '1:1'),
        aspect_ratio: version === 'pro' ? (task.state.proRatio || '1:1') : (task.state.trialRatio || '1:1'),
        resolution: version === 'pro' ? (task.state.proResolution || '1k') : '1k',
        proRatio: task.state.proRatio || '1:1',
        proResolution: task.state.proResolution || '1k',
        prompt: finalPrompt,
        size: sizeToSend,
        providerSort: route.key,
        providerKey: route.key,
        provider_key: route.key,
        provider: { key: route.key, sort: route.mode, suffix: route.suffix, model: imageModel },
        quality: task.state.quality || 'auto',
        format: task.state.format || 'png',
        output_format: task.state.format || 'png',
        outputCompression,
        output_compression: outputCompression,
        background: task.state.background || 'auto',
        moderation: task.state.moderation || 'auto',
        n: nValue,
        clientRequestId,
        client_request_id: clientRequestId,
        previewItemId: previewItemId,
        preview_item_id: previewItemId,
        requestId: clientRequestId,
        request_id: clientRequestId,
        seed: Number.isFinite(lockedSeed) ? lockedSeed : undefined,
        seedLocked: task.state.seedLocked === true,
        seed_locked: task.state.seedLocked === true,
        referenceControls,
        reference_controls: referenceControls,
        imageControls: referenceControls,
        image_controls: referenceControls,
        imageWeights: referenceControls.map((item) => item.weight),
        image_weights: referenceControls.map((item) => item.weight),
        imageIntents: referenceControls.map((item) => item.intent),
        image_intents: referenceControls.map((item) => item.intent),
        ...imagePayloadFields,
        custom_ratio: trialCustomRatio || undefined,
        custom_w: trialCustomRatio ? trialCustomW : undefined,
        custom_h: trialCustomRatio ? trialCustomH : undefined
    };

    const unifiedPayload = {
        ...unifiedPayloadCore
    };

    const legacyPayload = {
        prompt: finalPrompt,
        size: sizeToSend,
        channel: task.state.channel || 'channel_1',
        model: imageModel,
        imageModel: imageModel,
        modelSuffix: route.suffix,
        routeMode: route.mode,
        ratio: version === 'pro' ? (task.state.proRatio || '1:1') : (task.state.trialRatio || '1:1'),
        aspect_ratio: version === 'pro' ? (task.state.proRatio || '1:1') : (task.state.trialRatio || '1:1'),
        resolution: version === 'pro' ? (task.state.proResolution || '1k') : '1k',
        proRatio: task.state.proRatio || '1:1',
        proResolution: task.state.proResolution || '1k',
        n: nValue,
        quality: task.state.quality || 'auto',
        format: task.state.format || 'png',
        output_format: task.state.format || 'png',
        outputCompression,
        output_compression: outputCompression,
        background: task.state.background || 'auto',
        moderation: task.state.moderation || 'auto',
        providerSort: route.key,
        providerKey: route.key,
        provider_key: route.key,
        provider: { key: route.key, sort: route.mode, suffix: route.suffix, model: imageModel },
        clientRequestId,
        client_request_id: clientRequestId,
        previewItemId: previewItemId,
        preview_item_id: previewItemId,
        requestId: clientRequestId,
        request_id: clientRequestId,
        seed: Number.isFinite(lockedSeed) ? lockedSeed : undefined,
        seedLocked: task.state.seedLocked === true,
        seed_locked: task.state.seedLocked === true,
        referenceControls,
        reference_controls: referenceControls,
        imageControls: referenceControls,
        image_controls: referenceControls,
        imageWeights: referenceControls.map((item) => item.weight),
        image_weights: referenceControls.map((item) => item.weight),
        imageIntents: referenceControls.map((item) => item.intent),
        image_intents: referenceControls.map((item) => item.intent),
        ...imagePayloadFields,
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

        const rawData = await parseImgGenHttpResponse(response, 'processing');

        const resData = unwrapImgGenResponseData(rawData);
        const returnedUrls = extractImageUrlsFromResponse(rawData);
        return { rawData, resData, returnedUrls };
    };

    let success = false;
    let attempts = 0;
    const maxAttempts = task.state.autoRetry ? 3 : 1;
    let lastError = null;

    while (attempts < maxAttempts && !success) {
        attempts++;
        try {
            const resultPack = await requestImgGenOnce(unifiedPayload, legacyPayload);
            const resData = resultPack.resData;
            const returnedUrls = resultPack.returnedUrls;

            if (!(await isImgGenPreviewItemStillPending(taskId, previewItemId))) {
                clearImgGenPolling(taskId, previewItemId);
                return;
            }

            if (returnedUrls.length > 0) {
                let output = returnedUrls[0];
                try {
                    const r = await fetch(output);
                    if (r.ok) output = await r.blob();
                } catch (fetchErr) {}
                const costTime = Math.floor((Date.now() - task.state.startTime) / 1000);
                const imageMeta = await readImageMeta(output);
                if (!(await isImgGenPreviewItemStillPending(taskId, previewItemId))) {
                    clearImgGenPolling(taskId, previewItemId);
                    return;
                }
                const writeTask = await getImgGenTaskForPreviewWrite(taskId, previewItemId, task);
                if (!writeTask) {
                    clearImgGenPolling(taskId, previewItemId);
                    return;
                }
                if (!markImgGenPreviewSuccess(writeTask, previewItemId, output, costTime, imageMeta)) {
                    clearImgGenPolling(taskId, previewItemId);
                    return;
                }
                writeTask.state.costTime = costTime;
                writeTask.timestamp = Date.now();
                if (!getImgGenPendingCount(writeTask)) writeTask.genTaskId = null;
                const billingInfo = calculateImgGenBilling(writeTask, resultPack.rawData);
                writeTask.state.lastUsageCost = billingInfo.cost;
                writeTask.state.lastUsageDetail = billingInfo.detail;
                writeTask.state.lastUsageAt = Date.now();
                success = true;
                forceRenderImgGenPreviewPanel(writeTask, previewItemId);

                await addBillingRecord({
                    id: 'bill_img_' + writeTask.id + '_' + Date.now(),
                    taskId: writeTask.id,
                    type: 'image',
                    cost: billingInfo.cost,
                    detail: billingInfo.detail,
                    inputTokens: billingInfo.usage ? billingInfo.usage.inputTokens : 0,
                    outputTokens: billingInfo.usage ? billingInfo.usage.outputTokens : 0,
                    version: writeTask.state.version || 'trial',
                    channel: writeTask.state.channel || 'channel_1'
                });
                updateBillingUI();
                setTaskShadow(writeTask);
                await saveTaskDB(writeTask);
                renderCard(taskId, writeTask);
                forceRenderImgGenPreviewPanel(writeTask, previewItemId);
            } else {
                const asyncTaskId = extractImgGenTaskId(resData);
                const status = extractImgGenStatus(resData);
                if (asyncTaskId) {
                    if (!(await isImgGenPreviewItemStillPending(taskId, previewItemId))) {
                        clearImgGenPolling(taskId, previewItemId);
                        return;
                    }
                    const writeTask = await getImgGenTaskForPreviewWrite(taskId, previewItemId, task);
                    if (!writeTask) {
                        clearImgGenPolling(taskId, previewItemId);
                        return;
                    }
                    const item = writeTask.state.previewHistory.find((entry) => entry && entry.id === previewItemId);
                    if (item) item.remoteTaskId = asyncTaskId;
                    updateImgGenPreviewGuard(taskId, previewItemId, { remoteTaskId: asyncTaskId });
                    writeTask.genTaskId = asyncTaskId;
                    writeTask.timestamp = Date.now();
                    setTaskShadow(writeTask);
                    await saveTaskDB(writeTask);
                    renderCard(taskId, writeTask);
                    forceRenderImgGenPreviewPanel(writeTask, previewItemId);
                    startImgGenTaskPolling(taskId, asyncTaskId, previewItemId);
                    return;
                }
                if (isImgGenPendingStatus(status) || !status) {
                    if (!(await isImgGenPreviewItemStillPending(taskId, previewItemId))) {
                        clearImgGenPolling(taskId, previewItemId);
                        return;
                    }
                    if (!asyncTaskId) {
                        const writeTask = await getImgGenTaskForPreviewWrite(taskId, previewItemId, task);
                        if (!writeTask) {
                            clearImgGenPolling(taskId, previewItemId);
                            return;
                        }
                        markImgGenPreviewFailed(writeTask, previewItemId, '后端未返回图片或真实任务ID');
                        writeTask.genTaskId = null;
                        writeTask.timestamp = Date.now();
                        setTaskShadow(writeTask);
                        await saveTaskDB(writeTask);
                        renderCard(taskId, writeTask);
                        forceRenderImgGenPreviewPanel(writeTask, previewItemId);
                        showToast('后端未返回图片或真实任务ID，请检查 n8n Respond 输出', 'warning');
                        return;
                    }
                    const fallbackTaskId = asyncTaskId;
                    const writeTask = await getImgGenTaskForPreviewWrite(taskId, previewItemId, task);
                    if (!writeTask) {
                        clearImgGenPolling(taskId, previewItemId);
                        return;
                    }
                    const item = writeTask.state.previewHistory.find((entry) => entry && entry.id === previewItemId);
                    if (item) {
                        item.remoteTaskId = fallbackTaskId;
                        item.errorReason = '';
                    }
                    updateImgGenPreviewGuard(taskId, previewItemId, { remoteTaskId: fallbackTaskId, errorReason: '' });
                    writeTask.genTaskId = fallbackTaskId;
                    writeTask.timestamp = Date.now();
                    setTaskShadow(writeTask);
                    await saveTaskDB(writeTask);
                    renderCard(taskId, writeTask);
                    forceRenderImgGenPreviewPanel(writeTask, previewItemId);
                    startImgGenTaskPolling(taskId, fallbackTaskId, previewItemId);
                    if (resultPack.rawData && resultPack.rawData.empty_response) {
                        showToast('后端已接收请求，但未返回任务ID，已启动兜底轮询', 'warning');
                    }
                    return;
                }
                if (isImgGenFailedStatus(status)) {
                    throw new Error(`后端返回失败状态: ${status}`);
                }
                throw new Error("无返回有效图片结构");
            }
        } catch (err) {
            lastError = err;
            if (attempts >= maxAttempts) {
                if (!(await isImgGenPreviewItemStillPending(taskId, previewItemId))) {
                    clearImgGenPolling(taskId, previewItemId);
                    return;
                }
                const writeTask = await getImgGenTaskForPreviewWrite(taskId, previewItemId, task);
                if (!writeTask) {
                    clearImgGenPolling(taskId, previewItemId);
                    return;
                }
                markImgGenPreviewFailed(writeTask, previewItemId, err);
                writeTask.timestamp = Date.now();
                setTaskShadow(writeTask);
                await saveTaskDB(writeTask);
                renderCard(taskId, writeTask);
                forceRenderImgGenPreviewPanel(writeTask, previewItemId);
            } else {
                if (!(await isImgGenPreviewItemStillPending(taskId, previewItemId))) {
                    clearImgGenPolling(taskId, previewItemId);
                    return;
                }
                const writeTask = await getImgGenTaskForPreviewWrite(taskId, previewItemId, task);
                if (!writeTask) {
                    clearImgGenPolling(taskId, previewItemId);
                    return;
                }
                writeTask.retryCount = attempts;
                writeTask.timestamp = Date.now();
                setTaskShadow(writeTask);
                await saveTaskDB(writeTask);
                renderCard(taskId, writeTask);
                forceRenderImgGenPreviewPanel(writeTask, previewItemId);
                await new Promise(r => setTimeout(r, 2000));
            }
        }
    }

    const finalTask = await getImgGenTaskForPreviewWrite(taskId, previewItemId, task);
    if (finalTask) {
        setTaskShadow(finalTask);
        await saveTaskDB(finalTask);
        renderCard(taskId, finalTask);
        forceRenderImgGenPreviewPanel(finalTask, previewItemId);
    }
    if (!success) {
        clearImgGenPolling(taskId, previewItemId);
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

    e.stopPropagation(); isPanning = false; setCanvasMoving(false);

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

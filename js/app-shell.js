// ==========================================
// Core app shell, login gate, theme, and route transition
// ==========================================
let loginAnimationId = null;
let appShellBalanceBootRefreshed = false;

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
let tooltipTimer = null;
let tooltipsBound = false;
let lightboxEl = null;

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

function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const safeType = ['error', 'success', 'warning', 'info'].includes(type) ? type : 'info';
    const toast = document.createElement('div');
    toast.className = `veo-toast toast-${safeType}`;
    const icon = safeType === 'error' ? 'error' : (safeType === 'success' ? 'check_circle' : (safeType === 'warning' ? 'warning' : 'info'));
    toast.innerHTML = `<span class="material-symbols-outlined icon" style="font-size: 16px;">${icon}</span> <span class="toast-message">${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function bindGlobalTooltips() {
    if (tooltipsBound) return;
    tooltipsBound = true;
    document.addEventListener('mouseover', (e) => {
        const target = e.target.closest('[data-tip]');
        if (!target) return;
        tooltipTimer = setTimeout(() => {
            const tipText = target.getAttribute('data-tip');
            const globalTooltip = document.getElementById('global-tooltip');
            if (!tipText || !globalTooltip) return;
            globalTooltip.innerText = tipText;
            const rect = target.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            let y = rect.top;
            if (y < 60) {
                y = rect.bottom;
                globalTooltip.classList.add('tooltip-bottom');
            } else {
                globalTooltip.classList.remove('tooltip-bottom');
            }
            globalTooltip.style.left = `${x}px`;
            globalTooltip.style.top = `${y}px`;
            globalTooltip.classList.add('show');
        }, 500);
    });
    document.addEventListener('mouseout', (e) => {
        const target = e.target.closest('[data-tip]');
        if (!target) return;
        clearTimeout(tooltipTimer);
        const globalTooltip = document.getElementById('global-tooltip');
        if (globalTooltip) globalTooltip.classList.remove('show');
    });
}

function openHelpModal() {
    const modal = document.getElementById('help-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    modal.offsetHeight;
    modal.classList.add('show');
}

function closeHelpModal() {
    const modal = document.getElementById('help-modal');
    if (!modal) return;
    modal.classList.remove('show');
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
}

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

function openLightbox(src) {
    if (!lightboxEl) {
        lightboxEl = document.createElement('div');
        lightboxEl.className = 'image-lightbox';
        lightboxEl.innerHTML = `<img>`;
        lightboxEl.onclick = () => {
            lightboxEl.classList.remove('show');
            setTimeout(() => {
                lightboxEl.style.display = 'none';
            }, 200);
        };
        document.body.appendChild(lightboxEl);
    }
    lightboxEl.querySelector('img').src = src;
    lightboxEl.style.display = 'flex';
    lightboxEl.offsetHeight;
    lightboxEl.classList.add('show');
}

function markAppShellReady() {
    document.body.classList.remove('app-shell-init');
    document.body.classList.add('app-shell-ready');
    if (!appShellBalanceBootRefreshed && window.VeoBilling && typeof window.VeoBilling.refreshBalance === 'function') {
        appShellBalanceBootRefreshed = true;
        window.VeoBilling.refreshBalance({ force: true, silent: true }).catch(() => {});
    }
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
    bindGlobalTooltips();
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

window.VeoAppShell = {
    bindGlobalTooltips,
    closeAnnouncement,
    closeErrorModal,
    closeHelpModal,
    handleAuthError,
    isReducedMotion,
    openHelpModal,
    openLightbox,
    showAnnouncement,
    showErrorModal,
    showToast,
    startLoginTransition,
    startRouteTransition
};

window.showToast = showToast;
window.alert = (msg) => showToast(msg, 'error');
window.handleAuthError = handleAuthError;
window.openHelpModal = openHelpModal;
window.closeHelpModal = closeHelpModal;
window.openLightbox = openLightbox;

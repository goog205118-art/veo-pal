// ==========================================
// 馃煝 鏍稿績搴旂敤閫昏緫涓庡畨鍏ㄦ嫤鎴?(Veo Studio Infinity Flow)
// ==========================================
let loginAnimationId = null;

// 馃専 鑷姩娉ㄥ叆鏍稿績缂哄け鏍峰紡 (鍖呭惈寮圭獥銆佸皬鍦板浘銆佹壂鎻忕嚎銆佹媺浼告妸鎵?
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

document.addEventListener('DOMContentLoaded', () => {
    const gate = document.getElementById('login-gate');
    const savedSessionPwd = sessionStorage.getItem('veo_admin_pwd');
    if (savedSessionPwd) { gate.style.display = 'none'; }

    const rememberedPwd = localStorage.getItem('veo_admin_pwd_saved');
    if (rememberedPwd) {
        const pwdInput = document.getElementById('studio-pwd-input'), rememberCheckbox = document.getElementById('remember-pwd');
        if (pwdInput) pwdInput.value = rememberedPwd; if (rememberCheckbox) rememberCheckbox.checked = true; 
    }

    const canvas = document.getElementById('login-canvas');
    if (canvas && gate && gate.style.display !== 'none') {
        const ctx = canvas.getContext('2d');
        let width, height, particles = [], mouse = { x: null, y: null };
        function resize() { width = canvas.width = window.innerWidth; height = canvas.height = window.innerHeight; }
        window.addEventListener('resize', resize); resize();
        gate.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
        gate.addEventListener('mouseleave', () => { mouse.x = null; mouse.y = null; });

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
            <div class="minimap-toggle" onclick="toggleMinimap(event)" data-tip="鏀惰捣灏忓湴鍥?><span class="material-symbols-outlined" style="font-size:14px;">close</span></div>
            <span class="material-symbols-outlined minimap-icon" onclick="toggleMinimap(event)" data-tip="灞曞紑灏忓湴鍥?>map</span>
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
    document.getElementById('gate-step-1').classList.remove('step-active'); document.getElementById('gate-step-1').classList.add('step-passed'); 
    setTimeout(() => { document.getElementById('gate-step-2').classList.add('step-active'); document.getElementById('studio-pwd-input').focus(); }, 200); 
}

async function handleLoginSubmit(e) {
    e.preventDefault(); 
    const pwdInput = document.getElementById('studio-pwd-input').value.trim(), btn = document.getElementById('login-submit-btn');
    if (!pwdInput) return showToast("璇疯緭鍏ュ瘑閽?, "error");
    btn.innerHTML = `<svg class="spinner" viewBox="0 0 50 50" style="width:20px;height:20px;stroke:currentColor;margin:0 auto;"><circle cx="25" cy="25" r="20"></circle></svg>`; btn.style.pointerEvents = 'none';

    const inputHash = await hashPassword(pwdInput);
    const TARGET_HASH = "acc8ca2c94bcfaf05736fe29176ad5ec6f766a47ae3597a4186507ece27e5f0f";

    setTimeout(() => {
        if (inputHash !== TARGET_HASH) {
            showErrorModal(); btn.innerHTML = `楠岃瘉韬唤 / LOGIN`; btn.style.pointerEvents = 'auto';
            document.getElementById('studio-pwd-input').value = ''; localStorage.removeItem('veo_admin_pwd_saved'); return; 
        }
        sessionStorage.setItem('veo_admin_pwd', pwdInput);
        const rememberCheckbox = document.getElementById('remember-pwd');
        if (rememberCheckbox && rememberCheckbox.checked) localStorage.setItem('veo_admin_pwd_saved', pwdInput); else localStorage.removeItem('veo_admin_pwd_saved'); 
        btn.innerHTML = `<span class="material-symbols-outlined">check_circle</span> 楠岃瘉閫氳繃`; btn.style.background = 'var(--success)';
        
        setTimeout(() => {
            document.getElementById('gate-step-2').classList.remove('step-active'); document.getElementById('gate-step-2').classList.add('step-passed');
            const gate = document.getElementById('login-gate'); gate.classList.add('unlocked');
            setTimeout(() => {
                if (typeof loginAnimationId !== 'undefined' && loginAnimationId) cancelAnimationFrame(loginAnimationId);
                gate.remove(); showToast("娆㈣繋鍥炴潵", "success");
                setTimeout(showAnnouncement, 500); 
            }, 800);
        }, 400);
    }, 600);
}

const API_SUBMIT = 'https://api.wallyai.top/webhook/proxy-submit'; 
const API_POLL = 'https://api.wallyai.top/webhook/proxy-poll'; 
const API_IMAGE_GEN = 'https://api.wallyai.top/webhook/proxy-image-gen'; 
let activeTasks = [], activeRetries = new Set(); 

function removeActiveTask(id) { const index = activeTasks.indexOf(id); if (index > -1) activeTasks.splice(index, 1); }
function toggleDrawer() { document.getElementById('tool-drawer').classList.toggle('open'); }
function toggleMaterialDrawer() { document.getElementById('material-drawer').classList.toggle('open'); }

function handleAuthError() { 
    if (!sessionStorage.getItem('veo_admin_pwd')) return; 
    sessionStorage.removeItem('veo_admin_pwd'); 
    showToast("瀵嗛挜楠岃瘉澶辫触鎴栧凡杩囨湡锛屽嵆灏嗛€€鍥炵櫥褰曡埍", "error"); 
    setTimeout(() => location.reload(), 1500); 
}

// ==========================================
// 馃梻锔?鏅鸿兘绱犳潗搴撶鐞嗗紩鎿?// ==========================================
async function renderMaterialLibrary() {
    const tasks = await getAllTasksDB(); 
    const materials = tasks.filter(t => t.type === 'local_image');
    const grid = document.getElementById('material-grid'); 
    if (!grid) return;
    
    if (materials.length === 0) { 
        grid.innerHTML = `<div style="grid-column: span 2; text-align: center; padding: 40px 0; color: var(--text-sub); font-size: 12px;">浠撳簱绌虹┖濡備篃</div>`; 
        return; 
    }

    const now = Date.now(), ONE_DAY = 86400000;
    const groups = { "浠婂ぉ": [], "鏄ㄥぉ": [], "鏈懆": [], "鏇存棭": [] };

    materials.forEach(m => {
        const diff = now - m.timestamp;
        if (diff < ONE_DAY) groups["浠婂ぉ"].push(m);
        else if (diff < ONE_DAY * 2) groups["鏄ㄥぉ"].push(m);
        else if (diff < ONE_DAY * 7) groups["鏈懆"].push(m);
        else groups["鏇存棭"].push(m);
    });

    let html = '';
    for (const [groupName, items] of Object.entries(groups)) {
        if (items.length > 0) {
            html += `<div style="grid-column: span 2; font-size: 12px; font-weight: 600; color: var(--text-sub); margin-top: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 4px;">${groupName} (${items.length})</div>`;
            html += items.map(m => `
                <div class="material-item" draggable="true" ondragstart="event.dataTransfer.setData('application/json', JSON.stringify({taskId: '${m.id}', type: 'local'}))" ondblclick="openLightbox(this.querySelector('img').src)" data-tip="鎸変綇鎷栨嫿澶嶇敤 | 鍙屽嚮鏀惧ぇ">
                    <img src="${getBlobUrl(m.id, m.src)}" loading="lazy">
                    <button class="delete-btn material-symbols-outlined" onclick="deleteMaterial(event, '${m.id}')" data-tip="褰诲簳鍒犻櫎绱犳潗">close</button>
                </div>
            `).join('');
        }
    }
    grid.innerHTML = html;
}

async function deduplicateMaterials(event) {
    const btn = event.currentTarget;
    const originalHTML = btn.innerHTML;
    btn.innerHTML = `<svg class="spinner" viewBox="0 0 50 50" style="width:16px;height:16px;stroke:currentColor;margin-right:6px;"><circle cx="25" cy="25" r="20"></circle></svg> 鎵弿涓?..`;
    btn.style.pointerEvents = 'none';

    try {
        const tasks = await getAllTasksDB();
        const materials = tasks.filter(t => t.type === 'local_image');
        const seenSignatures = new Set();
        let removedCount = 0;

        for (let m of materials) {
            if (!m.src) continue; 
            const base64 = await blobToBase64(m.src);
            if (!base64) continue; 
            const size = m.src.size || m.src.length || 0;
            const signature = size + '_' + base64.slice(-150); 

            if (seenSignatures.has(signature)) {
                await deleteTaskDB(m.id); 
                removedCount++;
            } else {
                seenSignatures.add(signature);
            }
        }

        if (removedCount > 0) {
            await renderMaterialLibrary();
            showToast(`鉁?娓呯悊瀹屾瘯锛氬凡鎴愬姛鍓旈櫎 ${removedCount} 寮犲畬鍏ㄩ噸澶嶇殑绱犳潗锛乣, "success");
        } else {
            showToast("馃専 鎮ㄧ殑绱犳潗搴撳緢骞插噣锛屾病鏈夊彂鐜伴噸澶嶅浘鐗囥€?, "info");
        }
    } catch (err) {
        console.error('鍘婚噸寮曟搸鏁呴殰:', err);
        showToast("鍘婚噸鎵弿澶辫触", "error");
    } finally {
        btn.innerHTML = originalHTML;
        btn.style.pointerEvents = 'auto';
    }
}

async function clearAllMaterials() {
    if(confirm('馃毃 鍗遍櫓鎿嶄綔锛乗n纭畾瑕佹竻绌烘暣涓礌鏉愬簱鍚楋紵\n(杩欑粷瀵瑰畨鍏細瀹冨彧娓呯┖渚ц竟鏍忓浘搴擄紝涓嶄細褰卞搷鎮ㄧ敾甯冧笂宸茬粡鍨繘鍘汇€佹鍦ㄤ娇鐢ㄧ殑鍗＄墖鍥剧墖锛?')) {
        const tasks = await getAllTasksDB();
        const materials = tasks.filter(t => t.type === 'local_image');
        await Promise.all(materials.map(m => deleteTaskDB(m.id)));
        await renderMaterialLibrary();
        showToast("馃棏锔?绱犳潗搴撳凡鍏ㄩ儴娓呯┖锛岀┖闂村凡閲婃斁銆?, "success");
    }
}

async function deleteMaterial(e, id) {
    e.stopPropagation();
    if(confirm('馃棏锔?纭畾瑕佷粠绱犳潗搴撳交搴曢攢姣佽繖寮犲浘鐗囧悧锛?)) { await deleteTaskDB(id); renderMaterialLibrary(); showToast("宸查攢姣佺礌鏉?, "success"); }
}

async function updateBillingUI() { const stats = await getBillingStats(); const txtEl = document.getElementById('top-bill-text'); if(txtEl) txtEl.innerText = `锟?{stats.totalCost}`; }
async function openBillingModal() {
    const stats = await getBillingStats(); document.getElementById('bill-total').innerText = '锟? + stats.totalCost; document.getElementById('bill-video-count').innerText = stats.videoCount; document.getElementById('bill-image-count').innerText = stats.imageCount;
    const modal = document.getElementById('billing-modal'); modal.style.display = 'flex'; modal.offsetHeight; modal.classList.add('show');
}
function closeBillingModal() { const modal = document.getElementById('billing-modal'); modal.classList.remove('show'); setTimeout(() => modal.style.display = 'none', 300); }

function updateEstimatedCost() {
    const state = globalStore.getState(); 
    let cost = 0.35; 
    if (state.model.includes('4k')) {
        cost = 0.50; 
    } else if (state.model.includes('lite')) { // 馃専 鍏煎鐗规儬妯″瀷 fast-lite-1.0
        cost = 0.20; 
    }
    
    const batchSelect = document.getElementById('batch-select');
    const batch = batchSelect ? parseInt(batchSelect.value) : 1;
    const total = (cost * batch).toFixed(2);
    
    const btn = document.getElementById('generate-btn'); 
    if (btn) btn.setAttribute('data-tip', `鍙戦€佽嚦鏈嶅姟鍣ㄧ敓鎴?| 棰勪及娑堣€? 锟?{total}`);
}
function updateBatchCount(select) { document.getElementById('batch-text').innerText = select.options[select.selectedIndex].text; updateEstimatedCost(); }

async function alignSelectedCards() {
    const tasks = await getAllTasksDB();
    if (tasks.length === 0) return showToast("鐢诲竷涓婄洰鍓嶆病鏈変换浣曞崱鐗?, "info");
    let targetIds = selectedTasks.size > 0 ? Array.from(selectedTasks) : tasks.map(t => t.id);
    let cardsToAlign = tasks.filter(t => targetIds.includes(t.id) && t.type !== 'local_image' && t.type !== 'frame' && !t.parentId);
    
    if(cardsToAlign.length === 0) return showToast("娌℃湁鍙帓鐗堢殑鏁ｈ惤鍗＄墖", "info");
    
    cardsToAlign.sort((a, b) => (Math.abs(a.y) + Math.abs(a.x)) - (Math.abs(b.y) + Math.abs(b.x)));
    let minX = Math.min(...cardsToAlign.map(c => c.x)), minY = Math.min(...cardsToAlign.map(c => c.y)), currentX = minX, currentY = minY, xGap = 340, yGap = 420, col = 0;
    const maxCols = Math.max(3, Math.floor((window.innerWidth / transform.scale) / xGap));
    const promises = cardsToAlign.map(async (task) => { task.x = minX + (col * xGap); task.y = currentY; col++; if (col >= maxCols) { col = 0; currentY += yGap; } await saveTaskDB(task); });
    await Promise.all(promises); renderBoard(); showToast(`馃獎 绌洪棿娓呯悊瀹屾垚锛氬凡鑷姩瀵归綈鏁ｈ惤鑺傜偣`, "success");
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
    if (selectedTasks.size === 0) return showToast("璇峰厛鎸変綇 Shift 妗嗛€夐渶瑕佹墦缁勭殑鍗＄墖", "error");
    const tasks = await getAllTasksDB();
    const selected = tasks.filter(t => selectedTasks.has(t.id) && t.type !== 'frame' && t.type !== 'local_image' && !t.parentId);
    if (selected.length === 0) return showToast("閫変腑鐨勫崱鐗囧凡琚墦缁勬垨鏃犳晥", "error");

    let minX = Math.min(...selected.map(t => t.x)), minY = Math.min(...selected.map(t => t.y)), maxX = Math.max(...selected.map(t => t.x + (t.width || 340))), maxY = Math.max(...selected.map(t => t.y + (t.height || 400)));
    const frameId = 'frame_' + Date.now(), padding = 60;
    const newFrame = { id: frameId, type: 'frame', x: minX - padding, y: minY - padding, width: maxX - minX + padding * 2, height: maxY - minY + padding * 2, title: '鏈懡鍚嶉」鐩粍', isCollapsed: false, timestamp: Date.now() };

    await saveTaskDB(newFrame);
    for (let t of selected) { t.parentId = frameId; await saveTaskDB(t); }
    clearSelection(); await renderBoard(); showToast(`鉁?宸插皢 ${selected.length} 涓崱鐗囨敹绾充负椤圭洰缁刞, "success");
}

async function updateTaskField(id, key, val) { const task = await getTaskDB(id); if (task) { task[key] = val; await saveTaskDB(task); } }
async function toggleFrameCollapse(id) { const frame = await getTaskDB(id); if (frame) { frame.isCollapsed = !frame.isCollapsed; await saveTaskDB(frame); await renderBoard(); } }
async function removeFrame(id) {
    if(confirm('馃摝 纭畾瑕佽В鏁ｈ繖涓」鐩粍鍚楋紵\n(鍐呴儴鍗＄墖灏嗗畨鍏ㄤ繚鐣欏湪鐢诲竷涓?')) {
        await deleteTaskDB(id); const tasks = await getAllTasksDB();
        for (let t of tasks) { if (t.parentId === id) { delete t.parentId; await saveTaskDB(t); } }
        await renderBoard(); showToast("椤圭洰缁勫凡瑙ｆ暎", "success");
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
            showToast("馃摝 鍗＄墖宸茬Щ鍏ラ」鐩粍", "success");
        }
    } else {
        if (task.parentId) {
            task.parentId = null; await saveTaskDB(task);
            showToast("馃摛 鍗＄墖宸茶嚜鐢辫劚绂婚」鐩粍", "info");
        }
    }
}


const viewport = document.getElementById('canvas-viewport'), board = document.getElementById('canvas-board'), marquee = document.getElementById('selection-marquee'); 
let transform = { x: window.innerWidth / 2, y: 100, scale: 1 }, isPanning = false, startPanX = 0, startPanY = 0, ticking = false; 
let draggingCardInfo = null, highestZIndex = 10, scrollTimeout; 
let selectedTasks = new Set(), isSelecting = false, startSelX = 0, startSelY = 0;
let activeCrop = null, activeFrameResize = null; 

function clearSelection() { selectedTasks.clear(); document.querySelectorAll('.video-card.selected, .frame-box.selected').forEach(c => c.classList.remove('selected')); }

window.addEventListener('mousemove', (e) => {
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
                draggingCardInfo.task.x = draggingCardInfo.initialX + dx; draggingCardInfo.task.y = draggingCardInfo.initialY + dy;
                draggingCardInfo.el.style.transform = `translate(${draggingCardInfo.task.x}px, ${draggingCardInfo.task.y}px)`;
                if (draggingCardInfo.children) {
                    draggingCardInfo.children.forEach(child => {
                        child.task.x = child.initialX + dx; child.task.y = child.initialY + dy;
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

// 鉁?鏇挎崲涓烘敮鎸?Alt 鍏嬮殕鐨勬嫋鎷界粦瀹氬紩鎿?function bindCardDrag(cardEl, task) {
    cardEl.__veoTask = task; 
    cardEl.onmousedown = (e) => { 
        if(e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON' && !e.target.classList.contains('frame-resize-handle')) { 
            highestZIndex++; cardEl.style.zIndex = highestZIndex; 
        } 
    };
    
    const header = cardEl.querySelector('.card-header') || cardEl.querySelector('.frame-header');
    if(header) {
        // 馃専 鏀逛负 async 鍑芥暟锛屽洜涓哄厠闅嗛渶瑕佹煡搴?        header.onmousedown = async (e) => {
            if(e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.closest('button')) return;

            // 馃専馃専馃専 鏂板锛氫睛娴嬪埌鎸変綇 Alt 閿紝鐩存帴鎵ц鍏嬮殕骞堕樆鏂師鍗＄墖鐨勬嫋鎷?            if (e.altKey) {
                e.stopPropagation();
                await duplicateTask(task, e);
                return;
            }

            highestZIndex++; cardEl.style.zIndex = highestZIndex; cardEl.style.willChange = 'transform'; 
            if (e.shiftKey || e.ctrlKey || e.metaKey) {
                if (selectedTasks.has(task.id)) { selectedTasks.delete(task.id); cardEl.classList.remove('selected'); } else { selectedTasks.add(task.id); cardEl.classList.add('selected'); }
            } else {
                if (!selectedTasks.has(task.id)) { clearSelection(); selectedTasks.add(task.id); cardEl.classList.add('selected'); }
            }
            draggingCardInfo = { el: cardEl, task: cardEl.__veoTask, startMouseX: e.clientX, startMouseY: e.clientY, initialX: cardEl.__veoTask.x || 0, initialY: cardEl.__veoTask.y || 0 }; 
            
            if (task.type === 'frame') {
                draggingCardInfo.children = [];
                document.querySelectorAll('.video-card, .frame-box').forEach(childEl => {
                    if (childEl.__veoTask && childEl.__veoTask.parentId === task.id) {
                        childEl.style.willChange = 'transform';
                        draggingCardInfo.children.push({ el: childEl, task: childEl.__veoTask, initialX: childEl.__veoTask.x || 0, initialY: childEl.__veoTask.y || 0 });
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
        e.preventDefault(); document.querySelectorAll('.video-card, .frame-box').forEach(card => { if(card.classList.contains('hidden-in-frame')) return; selectedTasks.add(card.id.replace('card-', '')); card.classList.add('selected'); }); showToast(`宸插叏閫夊彲瑙嗚妭鐐筦, "info");
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
        if (selectedTasks.size > 0) {
            if (confirm(`馃棏锔?纭畾瑕佸交搴曞垹闄ら€変腑鐨?${selectedTasks.size} 涓璞″悧锛?鑻ュ寘鍚」鐩粍锛屽唴閮ㄥ崱鐗囦篃浼氳繛閿呯锛?`)) {
                const deletePromises = Array.from(selectedTasks).map(async (id) => { 
                    await deleteTaskDB(id); const card = document.getElementById('card-' + id); if (card) card.remove(); 
                    const allTasks = await getAllTasksDB(); for(let t of allTasks) { if(t.parentId === id) { await deleteTaskDB(t.id); const childEl = document.getElementById('card-' + t.id); if(childEl) childEl.remove(); } }
                });
                await Promise.all(deletePromises); showToast(`娓呯悊瀹屾垚`, "success"); selectedTasks.clear(); renderMinimap();
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
    if (added) { await renderMaterialLibrary(); showToast(`鉁?宸插皢鍓创鏉垮浘鐗囨敹鍏ュ叏灞€绱犳潗搴揱, 'success'); document.getElementById('material-drawer').classList.add('open'); }
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
viewport.addEventListener('dblclick', (e) => { if (e.target === viewport || e.target === board) createStickyNote((e.clientX - transform.x) / transform.scale, (e.clientY - transform.y) / transform.scale); });

let noteTimeout;
async function updateNoteText(id, text) { clearTimeout(noteTimeout); noteTimeout = setTimeout(async () => { const note = await getTaskDB(id); if (note) { note.text = text; await saveTaskDB(note); } }, 500); }
function saveNoteSize(id, w, h) { setTimeout(async () => { const note = await getTaskDB(id); if (note && (note.width !== w || note.height !== h)) { note.width = w; note.height = h; await saveTaskDB(note); renderMinimap(); } }, 100); }

async function exportWorkspace() {
    const btn = document.getElementById('export-btn'); const originalHTML = btn.innerHTML; btn.innerHTML = `<svg class="spinner" viewBox="0 0 50 50" style="width:16px;height:16px;stroke:currentColor;margin-right:6px;"><circle cx="25" cy="25" r="20"></circle></svg> 鎵撳寘涓?..`;
    try {
        const tasks = await getAllTasksDB(); const exportData = [];
        for (let t of tasks) {
            let clone = { ...t }; if (clone.type === 'local_image' && clone.src) clone.src = await blobToBase64(clone.src);
            if (clone.state) { if(clone.state.images) clone.state.images = await Promise.all(clone.state.images.map(b => blobToBase64(b))); if(clone.state.resultBlob) clone.state.resultBlob = await blobToBase64(clone.state.resultBlob); if(clone.state.sourceBlob) clone.state.sourceBlob = await blobToBase64(clone.state.sourceBlob); }
            if (clone.rawImages) { if (clone.rawImages.firstFrame) clone.rawImages.firstFrame = await blobToBase64(clone.rawImages.firstFrame); if (clone.rawImages.lastFrame) clone.rawImages.lastFrame = await blobToBase64(clone.rawImages.lastFrame); if (clone.rawImages.references) clone.rawImages.references = await Promise.all(clone.rawImages.references.map(b => blobToBase64(b))); }
            exportData.push(clone);
        }
        const blob = new Blob([JSON.stringify(exportData)], {type: 'application/json'}); const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `VeoStudio_Flow_${Date.now()}.veo`; a.click(); URL.revokeObjectURL(url);
    } catch (e) { alert('瀵煎嚭澶辫触: ' + e.message); } finally { btn.innerHTML = originalHTML; }
}

async function importWorkspace(input) {
    if (!input.files[0]) return; const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (confirm(`馃摝 瑙ｆ瀽鎴愬姛锛佸寘鍚?${data.length} 涓妭鐐广€俓n杩欎細涓庢偍褰撳墠鐨勭敾甯冨悎骞讹紝鏄惁缁х画锛焋)) {
                for (let t of data) {
                    if (t.type === 'local_image' && typeof t.src === 'string') t.src = await fetch(t.src).then(r => r.blob());
                    if (t.state) { if(t.state.images) t.state.images = await Promise.all(t.state.images.map(async b => typeof b === 'string' ? await fetch(b).then(r => r.blob()) : b)); if(t.state.resultBlob && typeof t.state.resultBlob === 'string') t.state.resultBlob = await fetch(t.state.resultBlob).then(r => r.blob()); if(t.state.sourceBlob && typeof t.state.sourceBlob === 'string') t.state.sourceBlob = await fetch(t.state.sourceBlob).then(r => r.blob()); }
                    if (t.rawImages) { if (typeof t.rawImages.firstFrame === 'string') t.rawImages.firstFrame = await fetch(t.rawImages.firstFrame).then(r => r.blob()); if (typeof t.rawImages.lastFrame === 'string') t.rawImages.lastFrame = await fetch(t.rawImages.lastFrame).then(r => r.blob()); if (t.rawImages.references) t.rawImages.references = await Promise.all(t.rawImages.references.map(async b => typeof b === 'string' ? await fetch(b).then(r => r.blob()) : b)); }
                    await saveTaskDB(t);
                }
                renderBoard(); await renderMaterialLibrary(); await updateBillingUI(); renderMinimap();
            }
        } catch(err) { alert('鉂?鏂囦欢瑙ｆ瀽澶辫触锛岃纭繚瀵煎叆鐨勬槸鏈夋晥鐨?.veo 鏍煎紡鏂囦欢'); } input.value = '';
    };
    reader.readAsText(input.files[0]);
}

window.addEventListener("dragover", function(e){ e.preventDefault(); }, false); window.addEventListener("drop", function(e){ e.preventDefault(); }, false);

viewport.addEventListener('drop', async (e) => {
    e.preventDefault(); const pluginType = e.dataTransfer.getData('plugin');
    if (pluginType) {
        const spawnX = (e.clientX - transform.x) / transform.scale, spawnY = (e.clientY - transform.y) / transform.scale; let newTool = null;
        if (pluginType === 'generator') newTool = { id: 'tool_' + Date.now(), type: 'tool_generator', x: spawnX, y: spawnY, timestamp: Date.now(), state: { format: '', opening: '', attribute: '', general: '' } };
        else if (pluginType === 'image_gen') newTool = { id: 'tool_img_' + Date.now(), type: 'tool_image_gen', x: spawnX, y: spawnY, timestamp: Date.now(), status: 'idle', state: { size: '1024x1024', prompt: '', images: [], resultUrl: null, resultBlob: null, channel: 'channel_1', autoRetry: false }, retryCount: 0 };
        else if (pluginType === 'cropper') newTool = { id: 'tool_crop_' + Date.now(), type: 'tool_cropper', x: spawnX, y: spawnY, timestamp: Date.now(), state: { sourceBlob: null, resultBlob: null, cropParams: { left: 10, top: 10, width: 80, height: 80 } } };
        if (newTool) { await saveTaskDB(newTool); renderBoard(); document.getElementById('tool-drawer').classList.remove('open'); return; }
    }
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
        let added = false;
        for (let file of files) { if (file.type.startsWith('image/')) { const blob = await compressImageToBlob(file, 1024); await saveTaskDB({ id: 'local_img_' + Date.now() + Math.random().toString(36).substr(2, 5), type: 'local_image', src: blob, timestamp: Date.now() }); added = true; } }
        if(added) { await renderMaterialLibrary(); showToast(`鉁?宸插皢鎷栧叆鐨勫浘鐗囨敹鍏ュ叏灞€绱犳潗搴揱, 'success'); document.getElementById('material-drawer').classList.add('open'); }
    }
});

// 馃専 寮哄姏鎷栨斁瑙ｆ瀽寮曟搸 (閫氭潃鎵€鏈夋暟鎹牸寮?
async function parseDroppedImage(e) {
    let srcToUse = null;
    try {
        const jsonStr = e.dataTransfer.getData('application/json');
        if (jsonStr) {
            const meta = JSON.parse(jsonStr); const t = await getTaskDB(meta.taskId);
            if (t) {
                if (meta.type === 'local') srcToUse = t.src;
                else if (meta.type === 'thumb') srcToUse = t.rawImages?.firstFrame || (t.rawImages?.references && t.rawImages.references[0]);
                else if (meta.type === 'gen_result') srcToUse = t.state?.resultBlob;
                else if (meta.type === 'crop_result') srcToUse = t.state?.resultBlob;
            }
        }
    } catch(err) {}

    // 鍏滃簳 1锛氳В鏋?Base64 鏂囨湰鏁版嵁 (浠庡叾浠栫綉椤垫嫋鎷?
    if (!srcToUse) {
        let textData = e.dataTransfer.getData('text/plain');
        if (textData && textData.startsWith('data:image')) {
            try { srcToUse = await (await fetch(textData)).blob(); } catch(err) {}
        }
    }

    // 鍏滃簳 2锛氳В鏋愮函鏈湴鏂囦欢 (浠庣數鑴戞闈㈡垨鏂囦欢澶规嫋鎷?
    if (!srcToUse && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('image/'));
        if (file) srcToUse = await compressImageToBlob(file, 1024);
    }
    
    return srcToUse;
}

// ==========================================
// 馃殌 鏍稿績锛氬崟鑺傜偣灞€閮ㄦ覆鏌撳紩鎿?(褰诲簳鍛婂埆鍏ㄥ眬闂儊)
// ==========================================
async function renderCard(taskId) {
    const task = await getTaskDB(taskId); if (!task) return;
    const cardEl = document.getElementById('card-' + taskId); if (!cardEl) return;

    // 浠呴噸缁樺綋鍓嶇殑杩欎竴寮犲崱鐗?    cardEl.innerHTML = generateCardHTML(task);
    bindCardDrag(cardEl, task);

    // 鍚屾杩借釜灞炴€э紝闃叉鍚庣画琚鍒?    const currentImgLen = (task.state && task.state.images) ? task.state.images.length : 0;
    const currentProgress = task.progress || '';
    const cropSrc = task.state && task.state.sourceBlob ? 'hasSrc' : 'noSrc';
    const cropRes = task.state && task.state.resultBlob ? 'hasRes' : 'noRes';
    const currentChannel = (task.state && task.state.channel) ? task.state.channel : 'channel_1';

    cardEl.setAttribute('data-sync-status', task.status || 'static');
    cardEl.setAttribute('data-sync-retry', task.retryCount || 0);
    cardEl.setAttribute('data-sync-img-len', currentImgLen);
    cardEl.setAttribute('data-sync-progress', currentProgress);
    cardEl.setAttribute('data-sync-crop-src', cropSrc);
    cardEl.setAttribute('data-sync-crop-res', cropRes);
    cardEl.setAttribute('data-sync-channel', currentChannel);
    cardEl.setAttribute('data-sync-title', task.title || '');
    cardEl.setAttribute('data-sync-collapsed', String(task.isCollapsed));
}

// ==========================================
// 鉁傦笍 灞€閮ㄨ鍒囧櫒 (Cropper) 鏍稿績浜や簰閫昏緫 (灞€閮ㄦ覆鏌撶増)
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
            showToast("鉁?鎴愬姛瀵煎叆寰呰鍒囩礌鏉?, "success"); 
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

// 鉁?鏇挎崲涓猴細甯︾姸鎬侀噸缃殑杩斿洖閲嶉€夊櫒
async function reEditCropper(taskId) {
    const task = await getTaskDB(taskId);
    if (task) { 
        task.state.resultBlob = null; 
        
        // 馃専 琛ヤ笂杩欎竴琛岋紝娓呯悊鎺変笂娆¤鍒囩殑娈嬬暀鎸囩汗
        task.timestamp = Date.now(); 
        
        await saveTaskDB(task); 
        renderCard(taskId); 
    }
}

// 鉁?鏇挎崲涓猴細甯︹€滄椂闂存埑鍑荤┛缂撳瓨鈥濆姛鑳界殑瑁佸垏鐢熸垚鍣?async function generateCrop(taskId) {
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
            
            // 馃専 鏍稿績淇锛氬己鍒舵洿鏂版椂闂存埑锛岃娴忚鍣ㄦ槑鐧借繖鏄竴寮犲叏鏂扮殑鍥?            task.timestamp = Date.now(); 
            
            await saveTaskDB(task);
            renderCard(taskId); // 灞€閮ㄩ噸缁?            showToast("鉁傦笍 瑁佸垏鎻愬彇瀹屾垚锛佸彲鎸変綇鏂板浘鐗囨嫋鎷藉鐢?, "success");
        }, 'image/jpeg', 0.9);
    };
}

function bindMainConsoleDrop(slotId, stateKey) {
    const slot = document.getElementById(slotId); slot.addEventListener('dragover', (e) => { e.preventDefault(); slot.classList.add('drag-over'); }); slot.addEventListener('dragleave', (e) => { e.preventDefault(); slot.classList.remove('drag-over'); });
    slot.addEventListener('drop', async (e) => {
        e.preventDefault(); slot.classList.remove('drag-over'); const srcToUse = await parseDroppedImage(e);
        if (srcToUse) {
            if (stateKey === 'references') { 
                if (globalStore.getState().references.length < 3) globalStore.dispatch('ADD_REFERENCE', srcToUse); 
                renderReferences(); 
                document.getElementById('ref-popover').style.display = 'flex'; 
            } 
            else { 
                if (stateKey === 'firstFrame') globalStore.dispatch('SET_FIRST_FRAME', srcToUse); 
                if (stateKey === 'lastFrame') globalStore.dispatch('SET_LAST_FRAME', srcToUse); 
                const t = stateKey === 'firstFrame' ? 'first' : 'last'; 
                // 馃専 鏍稿績锛氬姞涓?Date.now() 鎵撶牬缂撳瓨
                document.getElementById(`${t}-img`).src = getBlobUrl(`temp_${t}_${Date.now()}`, srcToUse); 
                document.getElementById(`slot-${t}-box`).classList.add('has-img'); 
            }
        }
    });
}

function toggleRefPopover(e) { e.stopPropagation(); if (globalStore.getState().references.length === 0) document.getElementById('ref-file').click(); else { const p = document.getElementById('ref-popover'); p.style.display = p.style.display === 'flex' ? 'none' : 'flex'; } }

const genData = { formats: ["涓绘挱甯﹁揣", "琛楀ご閲囪", "鏁欑▼婕旂ず", "鍓嶅悗鍙嶅樊", "寮€绠辨祴璇?, "瀵规瘮瀹為獙", "鍓ф儏鐭墽", "鍐茬獊澶稿紶", "鐢ㄦ埛璇佽█", "璇勮鍖哄洖澶?, "鐢熸椿鏂瑰紡妞嶅叆"], openings: ["浜у搧鐥涚偣寮€鍦?, "澶稿紶鍚哥潧寮€鍦?, "缁撴灉鍏堢粰寮€鍦?, "闂鎻愰棶寮€鍦?, "鍦烘櫙浠ｅ叆寮€鍦?, "娴嬭瘎瀵规瘮寮€鍦?, "璇勮缇ゅ洖澶嶅紑鍦?, "鏁板瓧娓呭崟寮€鍦?], attributes: ["寮哄寲涓绘挱浜鸿", "鎯呯华寮犲姏鏇村己", "鎻愬墠甯﹀嚭绂忓埄", "鍔犲叆鐪熷疄缁忓巻", "绉嶈崏骞茶揣鏀跺熬", "鍗曚竴鍗栫偣鏇磋仛鐒?], generals: ["鑺傚鏇村揩", "鎯呯华鏇村己", "鏇村儚鐪熷疄鍗氫富", "鏇村己缁撴灉鎰?, "鏇村急骞垮憡鎰?, "寮哄寲鏀跺熬涓嬪崟", "鏇村己璋冧骇鍝佺粏鑺?, "UGC鎰?, "鏇村儚璇勮鍖哄畨鍒?] };
function getRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
async function shuffleGenerator(id) { const task = await getTaskDB(id); if(!task) return; task.state.format = getRandom(genData.formats); task.state.opening = getRandom(genData.openings); task.state.attribute = getRandom(genData.attributes); task.state.general = getRandom(genData.generals); await saveTaskDB(task); renderCard(id); }
async function updateGeneratorState(id, key, value) { const task = await getTaskDB(id); if(task) { task.state[key] = value; await saveTaskDB(task); } }
async function applyGeneratorToPrompt(id, btnElement) {
    const task = await getTaskDB(id); if(!task) return;
    const { format, opening, attribute, general } = task.state;
    if (!format || !opening || !attribute || !general) return alert("璇峰厛鐐瑰嚮銆愰殢鏈烘娊鍙栥€戠敓鎴愬畬鏁寸殑缁勫悎");
    document.getElementById('prompt-input').value = `銆愬甫璐у舰寮忋€?{format} | 銆愬紑澶淬€?{opening} | 銆愬睘鎬с€?{attribute} | 銆愰€氱敤銆?{general} \n\n鍥寸粫浠ヤ笂瑕佹眰锛屽府鎴戠敓鎴?..`;
    document.getElementById('floating-console').classList.remove('minimized');
    const originalText = btnElement.innerHTML; btnElement.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px;">check_circle</span> 宸插簲鐢╜; btnElement.style.color = 'var(--success)'; setTimeout(() => { btnElement.innerHTML = originalText; btnElement.style.color = ''; }, 1500);
}
function buildGeneratorOptions(arr, selected) { let html = `<option value="" disabled ${!selected ? 'selected' : ''}>璇烽€夋嫨...</option>`; arr.forEach(item => { html += `<option value="${item}" ${selected === item ? 'selected' : ''}>${item}</option>`; }); return html; }

function switchMode(mode) { globalStore.dispatch('SET_MODE', mode); }
function updateModel(select) { globalStore.dispatch('SET_MODEL', { value: select.value, text: select.options[select.selectedIndex].text }); }
function updateRatio(select) { globalStore.dispatch('SET_RATIO', { value: select.value, text: select.options[select.selectedIndex].text }); }
function updateEnhance(select) { globalStore.dispatch('SET_ENHANCE', { value: select.value, text: select.options[select.selectedIndex].text }); }
function updateUpsample(select) { globalStore.dispatch('SET_UPSAMPLE', select.value === 'true'); document.getElementById('upsample-text').innerText = select.options[select.selectedIndex].text; }
function updateAutoRetry(select) { globalStore.dispatch('SET_AUTO_RETRY', select.value === 'true'); document.getElementById('retry-text').innerText = select.options[select.selectedIndex].text; }

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
        showToast("宸茶嚜鍔ㄥ垏鎹㈣嚦銆愬弬鑰冨浘 Cmp銆戜笓灞炲妯℃€侀€氶亾", "info");
    } else {
        if (globalStore.getState().currentMode !== 'frame') switchMode('frame');
        refTab.style.opacity = '0.3'; refTab.style.pointerEvents = 'none';
        frameTab.style.opacity = '1'; frameTab.style.pointerEvents = 'auto';
        showToast("宸茶嚜鍔ㄥ垏鎹㈣嚦銆愰灏惧抚銆戣棰戦€氶亾", "info");
    }
    updateEstimatedCost();
});

async function handleMultiRefs(input) {
    if (!input.files || input.files.length === 0) return; if (globalStore.getState().references.length + input.files.length > 3) { input.value = ''; return alert(`鏈€澶氫粎鏀寔 3 寮犲浘銆俙); }
    for (let file of Array.from(input.files)) {
        const refBlob = await compressImageToBlob(file);
        if (refBlob) globalStore.dispatch('ADD_REFERENCE', refBlob);
    }
    input.value = ''; renderReferences(); if(globalStore.getState().references.length > 0) document.getElementById('ref-popover').style.display = 'flex';
}
function removeReference(event, index) { event.stopPropagation(); globalStore.dispatch('REMOVE_REFERENCE_AT', index); renderReferences(); if(globalStore.getState().references.length === 0) document.getElementById('ref-popover').style.display = 'none'; }
function clearReferences(e) { e.stopPropagation(); globalStore.dispatch('SET_REFERENCES', []); renderReferences(); document.getElementById('ref-popover').style.display = 'none'; }
function renderReferences() {
    const box = document.getElementById('slot-ref-box'), imgEl = document.getElementById('ref-img'), countBadge = document.getElementById('ref-count-badge'), state = globalStore.getState();
    if (state.references.length === 0) { 
        box.classList.remove('has-img'); imgEl.src = ''; countBadge.style.display = 'none'; 
    } 
    else { 
        box.classList.add('has-img'); 
        // 馃専 鏍稿績锛氬姞涓?Date.now()
        imgEl.src = getBlobUrl(`temp_ref_main_${Date.now()}`, state.references[0]); 
        countBadge.style.display = state.references.length > 1 ? 'flex' : 'none'; 
        countBadge.innerText = state.references.length; 
    }
    // 馃専 鍒楄〃娓叉煋鍚屾牱鍔犱笂鏃堕棿鎴?    document.getElementById('ref-list-container').innerHTML = state.references.map((b, index) => `<div class="popover-img-item"><img src="${getBlobUrl(`temp_ref_${index}_${Date.now()}`, b)}"><div class="popover-rm-btn" onclick="removeReference(event, ${index})">脳</div></div>`).join('');
    document.getElementById('ref-popover-add').style.display = state.references.length >= 3 ? 'none' : 'flex';
}

async function handleSingleFrame(input, type) {
    if (!input.files[0]) return;
    const frameBlob = await compressImageToBlob(input.files[0]);
    if (type === 'firstFrame') globalStore.dispatch('SET_FIRST_FRAME', frameBlob);
    if (type === 'lastFrame') globalStore.dispatch('SET_LAST_FRAME', frameBlob);
    const t = type === 'firstFrame' ? 'first' : 'last';
    document.getElementById(`${t}-img`).src = getBlobUrl(`temp_${t}`, globalStore.getState()[type]);
    document.getElementById(`slot-${t}-box`).classList.add('has-img');
    input.value = '';
}
function clearFrame(event, type) {
    if(event) { event.preventDefault(); event.stopPropagation(); }
    if (type === 'firstFrame') globalStore.dispatch('SET_FIRST_FRAME', null);
    if (type === 'lastFrame') globalStore.dispatch('SET_LAST_FRAME', null);
    const t = type === 'firstFrame' ? 'first' : 'last';
    document.getElementById(`slot-${t}-box`).classList.remove('has-img');
    document.getElementById(`${t}-img`).src = '';
}

async function submitBatchTask() {
    const prompt = document.getElementById('prompt-input').value.trim(); if (!prompt) return alert('璇峰～鍐欐彁绀鸿瘝');
    const batchCount = parseInt(document.getElementById('batch-select').value), btn = document.getElementById('generate-btn');
    btn.disabled = true; btn.innerHTML = `<svg class="spinner" viewBox="0 0 50 50"><circle cx="25" cy="25" r="20"></circle></svg>`;
    
    let submitRef = [...globalStore.getState().references], submitFirst = globalStore.getState().firstFrame, submitLast = globalStore.getState().lastFrame;
    if (globalStore.getState().currentMode === 'ref') { submitFirst = null; submitLast = null; } else submitRef = [];
    const taskParams = { model: globalStore.getState().model, aspectRatio: globalStore.getState().aspectRatio, enhancePrompt: globalStore.getState().enhancePrompt, enableUpsample: globalStore.getState().enableUpsample, autoRetry: globalStore.getState().autoRetry, firstFrame: submitFirst, lastFrame: submitLast, references: submitRef };
    let promises = []; for(let i=0; i<batchCount; i++) promises.push(executeSubmission(taskParams, prompt, i));
    
    await Promise.allSettled(promises);
    btn.disabled = false; btn.innerHTML = `<span class="material-symbols-outlined">arrow_upward</span>`; updateEstimatedCost(); 
    document.getElementById('prompt-input').value = ''; 

    // 馃専 鏂板鏍稿績锛氬彂灏勫悗褰诲簳娓呯┖鎺у埗鍙板唴瀛樹笌缂╃暐鍥?
    globalStore.dispatch('RESET_MEDIA');
    document.getElementById('first-img').src = '';
    document.getElementById('last-img').src = '';
    document.getElementById('slot-first-box').classList.remove('has-img');
    document.getElementById('slot-last-box').classList.remove('has-img');
    document.getElementById('first-file').value = '';
    document.getElementById('last-file').value = '';
    renderReferences(); 
}

// 馃専 鎻愪氦寮曟搸 (楂樺閿?ID 瑙ｆ瀽鐗?
async function executeSubmission(params, promptText, offsetIndex = 0) {
    try {
        const apiPayload = { model: params.model, prompt: promptText, aspectRatio: params.aspectRatio, enhancePrompt: params.enhancePrompt, enableUpsample: params.enableUpsample, firstFrame: await blobToBase64(params.firstFrame), lastFrame: await blobToBase64(params.lastFrame), references: await Promise.all(params.references.map(b => blobToBase64(b))) };
        const response = await fetch(API_SUBMIT, { method: 'POST', headers: { 'Content-Type': 'application/json', 'wally123': sessionStorage.getItem('veo_admin_pwd') }, body: JSON.stringify(apiPayload) });
        
        if (response.status === 401 || response.status === 403) { handleAuthError(); throw new Error("瀵嗙爜閿欒"); }
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`API 杩斿洖寮傚父: ${response.status} - ${errText}`);
        }
        
        const data = await response.json();
        const returnedId = data.taskId || data.id || data.task_id; // 馃専 鍏煎鍚勭 n8n 杩斿洖缁撴瀯
        
        if (returnedId) {
            const spawnX = (-transform.x + window.innerWidth/2 - 170) / transform.scale + (offsetIndex * 360), spawnY = (-transform.y + window.innerHeight/2 - 150) / transform.scale + (offsetIndex * 40);
            let displayModelName = params.model.replace('veo3.1', 'Veo 3.1').replace('-components', ' Cmp').replace('-4k', ' 4K').toUpperCase();
            if (params.model.includes('lite')) displayModelName = '鏋侀€熺壒鎯犵増'; 
            
            const newTask = { id: returnedId, prompt: promptText, modelStr: displayModelName, modelVal: params.model, ratio: params.aspectRatio, autoRetry: params.autoRetry, retryCount: 0, rawImages: { firstFrame: params.firstFrame, lastFrame: params.lastFrame, references: params.references || [] }, mode: params.references && params.references.length > 0 ? 'ref' : 'frame', status: 'processing', progress: null, timestamp: Date.now(), time: new Date().toLocaleTimeString('zh-CN', {hour: '2-digit', minute:'2-digit'}), videoUrl: null, x: spawnX, y: spawnY, isBilled: false };
            await saveTaskDB(newTask); await renderBoard(); 
        }
    } catch (error) { 
        console.error('浠诲姟鎻愪氦澶辫触:', error); 
        showToast('瑙嗛鐢熸垚鎻愪氦澶辫触锛岃妫€鏌ョ綉缁滄垨浣欓銆?, 'error');
    }
}

async function retryTask(taskId, btnElement) {
    if (activeRetries.has(taskId)) return; activeRetries.add(taskId);
    if (btnElement) { btnElement.disabled = true; btnElement.innerHTML = `<svg class="spinner" viewBox="0 0 50 50" style="width:18px;height:18px;stroke:var(--text-sub);"><circle cx="25" cy="25" r="20"></circle></svg>`; }
    const task = await getTaskDB(taskId); if(!task) { activeRetries.delete(taskId); return; }
    try {
        const apiPayload = { model: task.modelVal, prompt: task.prompt, aspectRatio: task.ratio, enhancePrompt: true, enableUpsample: false, firstFrame: await blobToBase64(task.rawImages.firstFrame), lastFrame: await blobToBase64(task.rawImages.lastFrame), references: await Promise.all((task.rawImages.references || []).map(b => blobToBase64(b))) };
        const response = await fetch(API_SUBMIT, { method: 'POST', headers: { 'Content-Type': 'application/json', 'wally123': sessionStorage.getItem('veo_admin_pwd') }, body: JSON.stringify(apiPayload) });
        if (response.status === 401 || response.status === 403) { handleAuthError(); throw new Error("瀵嗙爜閿欒"); }
        if (!response.ok) throw new Error("API 寮傚父");
        const data = await response.json();
        
        const returnedId = data.taskId || data.id || data.task_id;
        if (returnedId) { 
            await deleteTaskDB(taskId); removeActiveTask(taskId); 
            task.id = returnedId; task.status = 'processing'; task.progress = null; task.retryCount = (task.retryCount || 0) + 1; task.timestamp = Date.now(); task.time = new Date().toLocaleTimeString('zh-CN', {hour: '2-digit', minute:'2-digit'}); task.isBilled = false; 
            await saveTaskDB(task); activeRetries.delete(taskId); await renderBoard(); 
        } else throw new Error("鏃犺繑鍥?ID");
    } catch (error) { task.status = 'failed'; task.autoRetry = false; await saveTaskDB(task); activeRetries.delete(taskId); renderCard(taskId); }
}

// 馃専 杞寮曟搸 (楂樺閿欑姸鎬佽В鏋愮増)
function startTaskPolling(taskId) {
    let attempts = 0;
    const poll = async () => {
        attempts++;
        try {
            const task = await getTaskDB(taskId); if (!task) { removeActiveTask(taskId); return; }
            const currentPwd = sessionStorage.getItem('veo_admin_pwd');
            if (!currentPwd) { setTimeout(poll, 2000); return; } 

            const response = await fetch(API_POLL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'wally123': currentPwd }, body: JSON.stringify({ taskId: taskId, model: task.modelVal }) });
            if (response.status === 401 || response.status === 403) { removeActiveTask(taskId); handleAuthError(); return; }
            if (!response.ok) throw new Error("API 寮傚父");
            const data = await response.json();
            
            // 馃専 寮哄姏鍏煎鍚勭 n8n 鐨勫瓧娈靛悕涓庣姸鎬佸悕
            const currentStatus = (data.status || data.state || 'processing').toLowerCase();
            const currentVideoUrl = data.videoUrl || data.video_url || data.url;

            if (data && (currentStatus === 'success' || currentStatus === 'completed' || currentStatus === 'succeeded') && currentVideoUrl) { 
                removeActiveTask(taskId); task.status = 'success'; task.videoUrl = currentVideoUrl; 
                if (!task.isBilled) {
                    let cost = 0.35, detailDesc = "Veo 3.1 (棣栧熬甯?";
                    if (task.modelVal === 'veo3.1-components') { cost = 0.35; detailDesc = "Veo 3.1 Cmp (鍙傝€冨浘)"; } 
                    else if (task.modelVal === 'veo3.1-4k') { cost = 0.50; detailDesc = "Veo 3.1 4K (棣栧熬甯?"; } 
                    else if (task.modelVal === 'veo3.1-components-4k') { cost = 0.50; detailDesc = "Veo 3.1 Cmp 4K (鍙傝€冨浘)"; } 
                    else if (task.modelVal.includes('lite')) { cost = 0.20; detailDesc = "鏋侀€熺壒鎯犵増妯″瀷"; }
                    
                    await addBillingRecord({ id: 'bill_' + task.id, taskId: task.id, type: 'video', cost: cost, detail: detailDesc }); 
                    task.isBilled = true; 
                    updateBillingUI();
                }
                await saveTaskDB(task); renderCard(taskId); return; 
            }
            if (data && (currentStatus === 'failed' || currentStatus === 'error' || currentStatus === 'canceled' || currentStatus === 'rejected')) { 
                removeActiveTask(taskId); 
                if (task.autoRetry) retryTask(task.id, null); 
                else { task.status = 'failed'; await saveTaskDB(task); renderCard(taskId); } 
                return; 
            }
            if (data && (currentStatus === 'processing' || currentStatus === 'pending' || currentStatus === 'queued' || currentStatus === 'in_progress') && data.progress && task.progress !== data.progress) { 
                task.progress = data.progress; await saveTaskDB(task); renderCard(taskId); 
            }
            
            if (attempts < 240) setTimeout(poll, 15000); else { removeActiveTask(taskId); if (task.autoRetry) retryTask(task.id, null); else { task.status = 'failed'; await saveTaskDB(task); renderCard(taskId); } }
        } catch (error) { setTimeout(poll, 15000); }
    };
    poll();
}

async function reuseTask(taskId) {
    const task = await getTaskDB(taskId); if(!task) return;
    document.getElementById('prompt-input').value = task.prompt || '';
    if (task.modelVal) { const modelSelect = document.getElementById('model-select'); if(modelSelect.querySelector(`option[value="${task.modelVal}"]`)) { modelSelect.value = task.modelVal; updateModel(modelSelect); } }
    if (task.ratio) { document.getElementById('ratio-select').value = task.ratio; updateRatio(document.getElementById('ratio-select')); }
    if (task.rawImages) {
        globalStore.dispatch('HYDRATE_MEDIA_STATE', { firstFrame: task.rawImages.firstFrame || null, lastFrame: task.rawImages.lastFrame || null, references: [...(task.rawImages.references || [])] }); switchMode(task.mode || 'ref');
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
            <input type="text" class="frame-title-input" value="${task.title || ''}" placeholder="鏈懡鍚嶉」鐩粍" onchange="updateTaskField('${task.id}', 'title', this.value)">
            <div style="display:flex; gap: 4px; margin-left: auto;">
                <button class="frame-btn" onclick="toggleFrameCollapse('${task.id}')" data-tip="鎶樺彔/灞曞紑姝ら」鐩敹绾?><span class="material-symbols-outlined" style="font-size:22px;">${task.isCollapsed ? 'expand_more' : 'expand_less'}</span></button>
                <button class="frame-btn" onclick="removeFrame('${task.id}')" data-tip="瑙ｆ暎璇ラ」鐩粍"><span class="material-symbols-outlined" style="font-size:18px;">close</span></button>
            </div>
        </div>
        ${!task.isCollapsed ? `<div class="frame-resize-handle" data-tip="鎸変綇鎷栨嫿璋冭妭妗嗘灦澶у皬"></div>` : ''}
        `;
    }
    if (task.type === 'note') return `<div class="card-header"><span style="color:#ffca28; display:flex; align-items:center; gap:4px;"><span class="material-symbols-outlined" style="font-size:14px;">sticky_note_2</span> 鍗虫椂渚跨</span><button onclick="removeTask('${task.id}')" data-tip="鍒犻櫎姝や究绛? style="background:transparent; border:none; color:#ffca28; cursor:pointer; opacity:0.6;"><span class="material-symbols-outlined" style="font-size:16px;">close</span></button></div><textarea oninput="updateNoteText('${task.id}', this.value)" placeholder="鍦ㄦ杈撳叆鐏垫劅銆佹彁绀鸿瘝鎴栧垎缁勫娉?..">${task.text || ''}</textarea>`;
    if (task.type === 'tool_generator') return `<div class="card-header"><span style="color:#818cf8; display:flex; align-items:center; gap:4px;"><span class="material-symbols-outlined" style="font-size:14px;">auto_awesome</span> 绀惧獟鐏垫劅鐢熸垚鍣?/span><button onclick="removeTask('${task.id}')" data-tip="鍒犻櫎璇ョ粍浠? style="background:transparent; border:none; color:var(--text-sub); cursor:pointer;"><span class="material-symbols-outlined" style="font-size:16px;">close</span></button></div><div class="gen-grid"><div class="gen-item"><label><span class="material-symbols-outlined" style="font-size:12px;">video_camera_front</span> 甯﹁揣褰㈠紡</label><select onchange="updateGeneratorState('${task.id}', 'format', this.value)">${buildGeneratorOptions(genData.formats, task.state.format)}</select></div><div class="gen-item"><label><span class="material-symbols-outlined" style="font-size:12px;">play_circle</span> 寮€澶磋妭濂?/label><select onchange="updateGeneratorState('${task.id}', 'opening', this.value)">${buildGeneratorOptions(genData.openings, task.state.opening)}</select></div><div class="gen-item"><label><span class="material-symbols-outlined" style="font-size:12px;">sell</span> 鍐呭灞炴€?/label><select onchange="updateGeneratorState('${task.id}', 'attribute', this.value)">${buildGeneratorOptions(genData.attributes, task.state.attribute)}</select></div><div class="gen-item"><label><span class="material-symbols-outlined" style="font-size:12px;">magic_button</span> 閫氱敤璋冩€?/label><select onchange="updateGeneratorState('${task.id}', 'general', this.value)">${buildGeneratorOptions(genData.generals, task.state.general)}</select></div></div><div class="gen-actions"><button class="gen-btn shuffle" onclick="shuffleGenerator('${task.id}')" data-tip="鎽囬瀛愶細闅忔満鎶藉彇涓€濂楃垎娆惧墽鏈粍鍚?><span class="material-symbols-outlined" style="font-size:16px;">shuffle</span> 闅忔満鎶藉彇</button><button class="gen-btn copy" onclick="applyGeneratorToPrompt('${task.id}', this)" data-tip="涓€閿皢缁撴瀯鍖栧墽鏈弽濉嚦搴曢儴 Prompt 妗?><span class="material-symbols-outlined" style="font-size:16px;">move_down</span> 搴旂敤鑷虫帶鍒跺彴</button></div>`;

    if (task.type === 'tool_image_gen') {
        const isProcessing = task.status === 'processing', isFailed = task.status === 'failed', resultHtml = task.status === 'success' && task.state.resultBlob ? `<div class="img-gen-result"><img src="${getBlobUrl(task.id+'_res_'+(task.timestamp||''), task.state.resultBlob)}" draggable="true" ondragstart="event.dataTransfer.setData('application/json', JSON.stringify({taskId: '${task.id}', type: 'gen_result'}))" ondblclick="openLightbox(this.src)" data-tip="鍙屽嚮鍏ㄥ睆楂樻竻棰勮锛屾寜浣忓彲鎷栧姩澶嶇敤"></div>` : '';
        let slotsHtml = task.state.images.map((img, i) => `<div class="img-gen-slot" style="border:none;"><img src="${getBlobUrl(task.id+'_img_'+i+'_'+(task.timestamp||''), img)}"><div class="popover-rm-btn remove-badge" onclick="removeGenImage(event, '${task.id}', ${i})">脳</div></div>`).join('');
        if (task.state.images.length < 5) slotsHtml += `<div class="img-gen-slot" id="img-gen-zone-${task.id}" data-tip="鐐瑰嚮涓婁紶鎴栦粠鐢诲竷鎷栧叆鍨浘 (鏈€澶?寮?" onclick="document.getElementById('file-input-${task.id}').click()"><span class="material-symbols-outlined" style="color:var(--text-sub);font-size:20px;">add</span><input type="file" id="file-input-${task.id}" style="display:none;" multiple accept="image/*" onchange="handleGenImageUpload(this, '${task.id}')" onclick="event.stopPropagation()"></div>`;
        
        const isChannel2 = task.state.channel === 'channel_2', currentCost = isChannel2 ? '0.06' : '0.084';
        // 馃専 1. 姝ｅ父/鎴愬姛鐘舵€佷笅鐨勬寜閽?(鏄剧ず鍘嗗彶鑰楁椂)
        let costTxt = task.state.costTime ? `<span style="font-family:monospace; opacity:0.8; margin-left:auto;">鈴憋笍 ${task.state.costTime}s</span>` : '';
        let btnContent = `<span class="material-symbols-outlined" style="font-size:18px;">draw</span> 鐢熸垚鍥惧儚 <span style="font-family:monospace; opacity:0.8; margin-left:4px;">锟?{currentCost}</span> ${costTxt}`;
        
        const retryTxt = task.retryCount ? ` (閲嶈瘯 ${task.retryCount})` : '';
        
        // 馃専 2. 鐢熸垚涓細灞曠ず璺冲姩鐨勭琛ㄤ笌杩涘害鏉?        if (isProcessing) {
            btnContent = `
                <div style="display:flex; flex-direction:column; width:100%; gap:6px; align-items:center;">
                    <div style="display:flex; justify-content:space-between; width:100%; font-size:13px;">
                        <div style="display:flex; align-items:center; gap:6px;">
                            <svg class="spinner" viewBox="0 0 50 50" style="width:14px;height:14px;stroke:currentColor;"><circle cx="25" cy="25" r="20"></circle></svg> 
                            鐢熸垚涓?..${retryTxt}
                        </div>
                        <div class="veo-dynamic-timer" data-start-time="${task.state.startTime || Date.now()}" style="font-family:monospace; color:var(--accent); font-weight:bold; letter-spacing:1px;">00:00</div>
                    </div>
                    <div style="width: 100%; height: 3px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden;">
                        <div style="height: 100%; background: var(--accent); width: 0%; animation: fakeImgProgress 60s cubic-bezier(0.1, 0.8, 0.2, 1) forwards;"></div>
                    </div>
                </div>
            `;
        }
        
        // 馃専 3. 澶辫触鐘舵€?        if (isFailed) {
            btnContent = `<span class="material-symbols-outlined" style="font-size:18px;">refresh</span> 澶辫触锛岀偣鍑婚噸璇?${task.state.costTime ? `(鍦?${task.state.costTime}s 澶勬柇寮€)` : ''}`;
        }
        
        // 馃専 鏍稿績淇敼 1锛氬鐞嗚嚜瀹氫箟姣斾緥 UI
        let customRatioHtml = '';
        if (task.state.size === '') {
            const w = task.state.customW || 9; 
            const h = task.state.customH || 21;
            customRatioHtml = `
            <div style="display:flex; align-items:center; gap:6px; padding: 0 12px; margin-top:-4px; margin-bottom:8px;">
                <span class="material-symbols-outlined" style="font-size:14px; color:var(--accent);">aspect_ratio</span>
                <span style="font-size:11px; color:var(--text-sub);">鐢诲箙:</span>
                <input type="number" class="img-gen-select" style="width:40px; text-align:center; padding:4px;" value="${w}" onchange="updateImgGenState('${task.id}', 'customW', this.value)">
                <span style="color:var(--text-sub);">:</span>
                <input type="number" class="img-gen-select" style="width:40px; text-align:center; padding:4px;" value="${h}" onchange="updateImgGenState('${task.id}', 'customH', this.value)">
                <span style="font-size:10px; color:rgba(255,255,255,0.3); margin-left:auto;">鎻愪氦鏃跺皢鑷姩闅愬紡鎷兼帴</span>
            </div>`;
        }
        
        // 馃専 鏍稿績淇敼 2锛氭墦鏁ｅ師鏈秴闀跨殑 return锛屽姞鍏ヨ嚜瀹氫箟閫夐」鍜屽姩鎬佹
        return `<div class="card-header"><span style="color:var(--accent); display:flex; align-items:center; gap:4px;"><span class="material-symbols-outlined" style="font-size:14px;">brush</span> AI 澶氭ā鐢熷浘</span><button onclick="removeTask('${task.id}')" data-tip="鍒犻櫎璇ョ粍浠? style="background:transparent; border:none; color:var(--text-sub); cursor:pointer;"><span class="material-symbols-outlined" style="font-size:16px;">close</span></button></div>
        <div class="img-gen-slots" ondragover="event.preventDefault(); document.getElementById('img-gen-zone-${task.id}')?.classList.add('drag-over');" ondragleave="document.getElementById('img-gen-zone-${task.id}')?.classList.remove('drag-over');" ondrop="handleGenImageDrop(event, '${task.id}')">${slotsHtml}</div>
        <div class="img-gen-controls">
            <select class="img-gen-select" onchange="updateImgGenState('${task.id}', 'size', this.value)" data-tip="閫夋嫨鍥惧儚鐢熸垚姣斾緥">
                <option value="1024x1024" ${task.state.size==='1024x1024'?'selected':''}>1:1</option>
                <option value="1536x1024" ${task.state.size==='1536x1024'?'selected':''}>3:2</option>
                <option value="1024x1536" ${task.state.size==='1024x1536'?'selected':''}>2:3</option>
                <option value="" ${task.state.size===''?'selected':''}>鑷畾涔?/option>
            </select>
            <select class="img-gen-select" onchange="updateImgGenState('${task.id}', 'channel', this.value)" style="flex: 1.5;" data-tip="鑻ョ敓鎴愬け璐ワ紝鍙皾璇曞垏鎹㈠鐢?API 鑺傜偣"><option value="channel_1" ${task.state.channel==='channel_1' || !task.state.channel ? 'selected' : ''}>鑺傜偣 1 (涓?</option><option value="channel_2" ${task.state.channel==='channel_2'?'selected':''}>鑺傜偣 2 (澶?</option></select>
            <select class="img-gen-select" onchange="updateImgGenState('${task.id}', 'autoRetry', this.value === 'true')" data-tip="閬囩綉缁滃紓甯告槸鍚﹁嚜鍔ㄩ噸璇?(鏈€澶?娆?"><option value="false" ${!task.state.autoRetry?'selected':''}>鍗曟</option><option value="true" ${task.state.autoRetry?'selected':''}>鑷姩閲嶈瘯</option></select>
        </div>
        ${customRatioHtml}
        <textarea class="img-gen-prompt" onchange="updateImgGenState('${task.id}', 'prompt', this.value)" placeholder="杈撳叆鐢婚潰鎻愮ず璇嶏紝鍙灚鍏?1-5 寮犲浘閰嶅悎鎻忚堪...">${task.state.prompt||''}</textarea>
        <button class="img-gen-btn" onclick="submitImgGen('${task.id}')" ${isProcessing?'disabled':''} style="${isFailed ? 'background: var(--danger);' : ''}">${btnContent}</button>${resultHtml}`;
    }

    if (task.type === 'tool_cropper') {
        const hasSource = !!task.state.sourceBlob, hasResult = !!task.state.resultBlob; let contentHtml = '';
        if (!hasSource) contentHtml = `<div class="img-slot" id="crop-zone-${task.id}" style="width:100%; height:200px; border-radius:8px;" data-tip="鐐瑰嚮涓婁紶鎴栦粠鐢诲竷鎷栧叆绱犳潗鍥剧墖" onclick="document.getElementById('crop-file-${task.id}').click()"><span class="material-symbols-outlined" style="font-size:32px; color:var(--text-sub);">add_photo_alternate</span><span style="margin-top:8px;">瀵煎叆绱犳潗鍥剧墖</span><input type="file" id="crop-file-${task.id}" style="display:none;" accept="image/*" onchange="handleCropperUpload(this, '${task.id}')"></div>`;
        else if (!hasResult) {
            const p = task.state.cropParams;
            contentHtml = `<div class="cropper-workspace" id="crop-workspace-${task.id}"><img id="crop-img-${task.id}" src="${getBlobUrl(task.id+'_src_'+(task.timestamp || ''), task.state.sourceBlob)}"><div class="crop-box" id="crop-box-${task.id}" data-task-id="${task.id}" style="left:${p.left}%; top:${p.top}%; width:${p.width}%; height:${p.height}%;"><div class="crop-grid"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div><div class="crop-handle ch-nw" data-dir="nw"></div><div class="crop-handle ch-ne" data-dir="ne"></div><div class="crop-handle ch-sw" data-dir="sw"></div><div class="crop-handle ch-se" data-dir="se"></div></div></div><div style="display:flex; gap:8px;"><button class="img-gen-btn" style="flex:1; background:var(--surface-hover); color:var(--text-main); margin:0;" onclick="resetCropper('${task.id}')">閲嶇疆鍥剧墖</button><button class="img-gen-btn" style="flex:2; background:var(--success); margin:0;" onclick="generateCrop('${task.id}')"><span class="material-symbols-outlined" style="font-size:16px;">crop</span> 纭瑁佸垏鎻愬彇</button></div>`;
        } else { contentHtml = `<div class="img-gen-result" style="border:none; border-radius:8px; background:transparent; min-height: unset;"><img src="${getBlobUrl(task.id+'_res_'+(task.timestamp||''), task.state.resultBlob)}" draggable="true" ondragstart="event.dataTransfer.setData('application/json', JSON.stringify({taskId: '${task.id}', type: 'crop_result'}))" data-tip="鎸変綇鎷栨嫿锛岄€佽嚦鍏朵粬鍗＄墖缁勪欢澶嶇敤" style="border-radius: 8px; border: 1px solid rgba(255,255,255,0.2);"></div><button class="img-gen-btn" style="width:100%; margin: 0; background:var(--surface-hover); color:var(--text-main);" onclick="reEditCropper('${task.id}')"><span class="material-symbols-outlined" style="font-size:16px;">history</span> 杩斿洖閲嶆柊璋冩暣妗嗛€夊尯</button>`; }
        return `<div class="card-header"><span style="color:var(--success); display:flex; align-items:center; gap:4px;"><span class="material-symbols-outlined" style="font-size:14px;">crop</span> 灞€閮ㄨ鍒囧櫒</span><button onclick="removeTask('${task.id}')" style="background:transparent; border:none; color:var(--text-sub); cursor:pointer;"><span class="material-symbols-outlined" style="font-size:16px;">close</span></button></div><div style="padding: 0 12px 12px 12px; display:flex; flex-direction:column; gap:12px;" ondragover="event.preventDefault();" ondrop="handleCropperDrop(event, '${task.id}')">${contentHtml}</div>`;
    }

    let statusBadge = '', mediaHtml = ''; const thumbImg = task.rawImages && (task.rawImages.firstFrame || (task.rawImages.references && task.rawImages.references[0])); const thumbUrl = getBlobUrl(task.id + '_thumb', thumbImg);
    if (task.status === 'processing') { 
        const retryTxt = task.retryCount ? ` (閲嶈瘯 ${task.retryCount})` : ''; statusBadge = `<span class="status-badge processing">鐢熸垚涓?..${retryTxt}</span>`; 
        let progressHtml = `
            <div class="cyber-scanner-box"><div class="cyber-scanner-line"></div></div>
            <div style="font-size: 11px; color: var(--accent); margin-top: 8px; font-weight: 600; font-family: monospace; letter-spacing: 1px;">MODELS ENGAGED...</div>
        `;
        mediaHtml = `<div class="card-media" style="aspect-ratio: ${task.ratio.replace(':','/')}; padding: 20px;"><div style="display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%; color: var(--accent);"><svg class="spinner" viewBox="0 0 50 50" style="width:36px;height:36px;"><circle cx="25" cy="25" r="20"></circle></svg><div class="generating-text" style="margin-top: 12px;">瑙嗛鐢熸垚涓?..</div>${progressHtml}</div></div>`; 
    } else if (task.status === 'failed') { statusBadge = `<span class="status-badge failed">澶辫触</span>`; mediaHtml = `<div class="card-media" style="background:#2c2c2e; color:var(--danger); aspect-ratio: ${task.ratio.replace(':','/')}; font-size:12px;">鐢熸垚瓒呮椂鎴栧け璐?/div>`; 
    } else { statusBadge = `<span class="status-badge success">宸插畬鎴?/span>`; mediaHtml = `<div class="card-media" data-tip="鍙屽嚮鍏ㄥ睆鎾斁瑙嗛"><video src="${task.videoUrl}" preload="none" poster="${thumbUrl || ''}" controls playsinline ondblclick="this.requestFullscreen()"></video></div>`; }
    
    const thumbHtml = thumbImg ? `<img src="${thumbUrl}" draggable="true" ondragstart="event.dataTransfer.setData('application/json', JSON.stringify({taskId: '${task.id}', type: 'thumb'}))" ondblclick="openLightbox(this.src)" data-tip="鍙屽嚮鍏ㄥ睆楂樻竻棰勮锛屾寜浣忓彲鎷栧姩澶嶇敤">` : `<div style="width:44px;height:44px;border-radius:4px;background:#2c2c2e;display:flex;align-items:center;justify-content:center;"><span class="material-symbols-outlined" style="color:#666;">image</span></div>`;
    return `<div class="card-header"><div class="time-model"><span class="material-symbols-outlined" style="font-size: 14px;">schedule</span> ${task.time} 路 ${task.modelStr}</div>${statusBadge}</div><div class="card-prompt">${thumbHtml}<p title="${task.prompt}">${task.prompt}</p></div><div class="card-tags"><span class="card-tag">${task.ratio}</span>${task.autoRetry ? `<span class="card-tag" style="color:var(--success); border: 1px solid var(--success);">宸插紑鎸傛満閲嶈瘯</span>` : ''}</div>${mediaHtml}<div class="card-actions">${task.status === 'success' ? `<button onclick="downloadVideo('${task.videoUrl}')" data-tip="涓嬭浇姝よ棰戝埌鏈湴"><span class="material-symbols-outlined">download</span></button>` : ''}${task.status === 'failed' ? `<button class="retry-btn" onclick="retryTask('${task.id}', this)" data-tip="鍘熷湴閲嶆柊鍙戣捣姝や换鍔?><span class="material-symbols-outlined">refresh</span></button>` : ''}<button class="reuse-btn" onclick="reuseTask('${task.id}')" data-tip="鎻愬彇璇ヤ换鍔＄殑鎵€鏈夊浘鏂囧弬鏁帮紝鍙嶅～鑷冲簳閮ㄦ帶鍒跺彴"><span class="material-symbols-outlined">edit_note</span></button><button onclick="removeTask('${task.id}')" data-tip="鍒犻櫎姝ょ敓鎴愯褰?><span class="material-symbols-outlined">delete</span></button></div>`;
}

// 馃専 鍒濇鎸傝浇涓庢帓鐗堜笓鐢ㄧ殑鍏ㄥ眬鍒锋柊鍑芥暟
async function renderBoard() {
    const tasks = await getAllTasksDB(); const boardTasks = tasks.filter(t => t.type !== 'local_image'), boardTaskIds = new Set(boardTasks.map(t => 'card-' + t.id));
    const existingCards = Array.from(board.children); existingCards.forEach(card => { if (!boardTaskIds.has(card.id)) card.remove(); });
    
    const frameMap = {}; boardTasks.filter(t => t.type === 'frame').forEach(f => frameMap[f.id] = f);

    boardTasks.forEach(task => {
        let cardEl = document.getElementById('card-' + task.id);
        const currentImgLen = (task.state && task.state.images) ? task.state.images.length : 0, currentProgress = task.progress || '', cropSrc = task.state && task.state.sourceBlob ? 'hasSrc' : 'noSrc', cropRes = task.state && task.state.resultBlob ? 'hasRes' : 'noRes', currentChannel = (task.state && task.state.channel) ? task.state.channel : 'channel_1'; 
        
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
            
            cardEl.style.transform = `translate(${task.x}px, ${task.y}px)`; cardEl.innerHTML = generateCardHTML(task); board.appendChild(cardEl); 
            if (task.type === 'note') cardEl.addEventListener('mouseup', () => saveNoteSize(task.id, cardEl.offsetWidth, cardEl.offsetHeight));
            if (task.status === 'processing' && !activeTasks.includes(task.id)) { activeTasks.push(task.id); startTaskPolling(task.id); }
        } else {
            cardEl.style.transform = `translate(${task.x}px, ${task.y}px)`;
            
            if (task.type === 'frame') {
                cardEl.style.width = `${task.width}px`;
                cardEl.style.height = task.isCollapsed ? '0px' : `${task.height}px`;
                cardEl.style.border = task.isCollapsed ? 'none' : '';
            }
            else if (task.type === 'note' && task.width && task.height) { cardEl.style.width = `${task.width}px`; cardEl.style.height = `${task.height}px`; }
            
            const oldStatus = cardEl.getAttribute('data-sync-status'), oldRetry = cardEl.getAttribute('data-sync-retry'), oldImgLen = cardEl.getAttribute('data-sync-img-len'), oldProgress = cardEl.getAttribute('data-sync-progress'), oldCropSrc = cardEl.getAttribute('data-sync-crop-src'), oldCropRes = cardEl.getAttribute('data-sync-crop-res'), oldChannel = cardEl.getAttribute('data-sync-channel'); 
            const oldFrameTitle = cardEl.getAttribute('data-sync-title'), oldFrameCollapsed = cardEl.getAttribute('data-sync-collapsed');

            if (oldStatus !== task.status || oldRetry != task.retryCount || oldImgLen != currentImgLen || oldProgress !== currentProgress || oldCropSrc !== cropSrc || oldCropRes !== cropRes || oldChannel !== currentChannel || oldFrameTitle !== task.title || oldFrameCollapsed !== String(task.isCollapsed)) { 
                cardEl.innerHTML = generateCardHTML(task); 
            }
        }

        if (isHiddenInFrame) cardEl.classList.add('hidden-in-frame'); else cardEl.classList.remove('hidden-in-frame');

        bindCardDrag(cardEl, task);
        
        cardEl.setAttribute('data-sync-status', task.status || 'static'); cardEl.setAttribute('data-sync-retry', task.retryCount || 0); cardEl.setAttribute('data-sync-img-len', currentImgLen); cardEl.setAttribute('data-sync-progress', currentProgress); cardEl.setAttribute('data-sync-crop-src', cropSrc); cardEl.setAttribute('data-sync-crop-res', cropRes); cardEl.setAttribute('data-sync-channel', currentChannel); 
        cardEl.setAttribute('data-sync-title', task.title || ''); cardEl.setAttribute('data-sync-collapsed', String(task.isCollapsed));
    });

    renderMinimap();
}

async function removeTask(id) { if(confirm('纭畾鍒犻櫎杩欏紶鍗＄墖鍚楋紵')) { await deleteTaskDB(id); const card = document.getElementById('card-' + id); if (card) card.remove(); renderMinimap(); } }
function downloadVideo(url) { const a = document.createElement('a'); a.href = url; a.target = "_blank"; a.download = `Studio_${Date.now()}.mp4`; a.click(); }

document.addEventListener('DOMContentLoaded', async () => {
    await initDB(); 
    board.style.transform = `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`; 
    document.body.style.backgroundPosition = `${transform.x}px ${transform.y}px`; 
    await renderBoard(); await renderMaterialLibrary();
    bindMainConsoleDrop('slot-ref-box', 'references'); bindMainConsoleDrop('slot-first-box', 'firstFrame'); bindMainConsoleDrop('slot-last-box', 'lastFrame');
    await updateBillingUI(); updateEstimatedCost();
});

// ==========================================
// 馃専 鏅鸿兘鍏嬮殕寮曟搸 (Alt + Drag 涓撶敤)
// ==========================================
async function duplicateTask(originalTask, mouseEvent) {
    // 1. 鐢熸垚鏂?ID 涓庡熀纭€娴呭厠闅?    const newId = originalTask.type + '_copy_' + Date.now();
    let clone = { ...originalTask, id: newId, timestamp: Date.now() };

    // 瑙ｉ櫎浠庡睘鍏崇郴锛岃鍏嬮殕鍑虹殑鍗＄墖鑷敱鏁ｈ惤
    delete clone.parentId; 

    // 2. 娣卞害鍏嬮殕鍐呴儴鐘舵€?(淇濇姢鎻愮ず璇嶃€佸昂瀵哥瓑锛岄槻姝㈠紩鐢ㄦ薄鏌?
    if (originalTask.state) {
        clone.state = { ...originalTask.state };
        if (Array.isArray(originalTask.state.images)) clone.state.images = [...originalTask.state.images]; // 缁ф壙澶氭ā鎬佸灚鍥?        if (originalTask.state.cropParams) clone.state.cropParams = { ...originalTask.state.cropParams };

        // 鈿狅笍 鐢熷浘缁勪欢鐗瑰垽锛氱户鎵垮弬鏁帮紝浣嗗繀椤绘竻绌轰箣鍓嶇殑鐢熸垚缁撴灉鍜岀姸鎬侊紒
        if (clone.type === 'tool_image_gen') {
            clone.status = 'idle';
            clone.state.resultBlob = null;
            clone.state.resultUrl = null;
            clone.retryCount = 0;
        }
        
        // 鈿狅笍 瑁佸垏鍣ㄧ壒鍒わ細缁ф壙鍘熷浘鍜岄€夊尯锛屾竻绌鸿鍒囩粨鏋?        if (clone.type === 'tool_cropper') {
            clone.state.resultBlob = null;
        }
    }

    // 3. 閽堝瑙嗛璁板綍鍗＄墖锛屾繁鎷疯礉鍙傝€冨浘
    if (originalTask.rawImages) {
        clone.rawImages = { ...originalTask.rawImages };
        if (Array.isArray(originalTask.rawImages.references)) {
            clone.rawImages.references = [...originalTask.rawImages.references];
        }
    }

    // 4. 灏嗘柊鍗＄墖浣嶇疆閿欏紑涓€鐐圭偣
    clone.x += 20;
    clone.y += 20;

    // 5. 鍏ュ簱骞惰Е鍙戝眬閮ㄩ噸缁樻寕杞?    await saveTaskDB(clone);
    await renderBoard(); 

    // 6. 馃専 鏍稿績锛氱灛闂村姭鎸侀紶鏍囩劍鐐癸紝璁╁厠闅嗗嚭鏉ョ殑鍗＄墖鐩存帴璺熺潃榧犳爣璧帮紒
    const newCardEl = document.getElementById('card-' + newId);
    if (newCardEl) {
        highestZIndex++;
        newCardEl.style.zIndex = highestZIndex;
        newCardEl.style.willChange = 'transform';

        clearSelection();
        selectedTasks.add(newId);
        newCardEl.classList.add('selected');

        // 灏嗙郴缁熺殑鎷栨嫿鎺у埗鏉冪Щ浜ょ粰鏂板崱鐗?            draggingCardInfo = {
                el: newCardEl,
                // 馃専 鏍稿績淇锛氭姏寮冨眬閮ㄥ彉閲?clone锛岀洿鎺ユ寚鍚?DOM 韬笂缁戝畾鐨勭湡瀹炲唴瀛樺湴鍧€
                task: newCardEl.__veoTask, 
                startMouseX: mouseEvent.clientX,
                startMouseY: mouseEvent.clientY,
                initialX: newCardEl.__veoTask.x,
                initialY: newCardEl.__veoTask.y
            };
        
        showToast("馃獎 宸插厠闅嗙粍浠跺強鍙傛暟", "success");
    }
}

// ==========================================
// 馃帹 AI 澶氭ā鐢熷浘鏍稿績鎺у埗妯″潡 (灞€閮ㄦ覆鏌撳畬鍏ㄤ綋)
// ==========================================
async function updateImgGenState(taskId, key, val) { const task = await getTaskDB(taskId); if (task) { task.state[key] = val; await saveTaskDB(task); renderCard(taskId); } }

async function handleGenImageUpload(input, taskId) {
    if (!input.files || input.files.length === 0) return;
    const task = await getTaskDB(taskId); if (!task) return;
    for (let file of Array.from(input.files)) {
        if (task.state.images.length >= 5) break;
        task.state.images.push(await compressImageToBlob(file, 1024));
    }
    task.timestamp = Date.now();
    await saveTaskDB(task); renderCard(taskId); input.value = '';
}

// ==========================================
// 鉁?淇鐗堬細鐢熷浘鍗＄墖鎷栨嫿澶勭悊鍑芥暟 (鍏嶇柅 dataTransfer 閿€姣?
// ==========================================
async function handleGenImageDrop(e, taskId) {
    e.preventDefault(); e.stopPropagation();
    const zone = document.getElementById(`img-gen-zone-${taskId}`);
    if (zone) zone.classList.remove('drag-over');
    
    // 馃専 鏍稿績鐮村眬鐐癸細蹇呴』鍦ㄤ换浣?await (濡傛煡搴? 鍙戠敓涔嬪墠锛屼紭鍏堜笖鈥滃悓姝モ€濆湴鎻愬彇鎷栨斁鏁版嵁锛?    const srcToUse = await parseDroppedImage(e);
    
    // 濡傛灉娌℃湁鎷垮埌鏈夋晥鍥剧墖锛岀洿鎺ユ嫤鎴紝鑺傜害鎬ц兘
    if (!srcToUse) return; 

    // 鏁版嵁钀借涓哄畨鍚庯紝鍐嶄粠瀹瑰湴鍘绘煡搴撳拰鏍￠獙
    const task = await getTaskDB(taskId); 
    if (!task) return;
    
    if (task.state.images.length >= 5) {
        return showToast("鏈€澶氬彧鑳藉灚鍏?5 寮犲浘", "error");
    }
    
    // 璧嬪€煎苟鍑荤┛缂撳瓨
    task.state.images.push(srcToUse);
    task.timestamp = Date.now();
    await saveTaskDB(task); 
    
    // 灞€閮ㄩ噸缁?    renderCard(taskId);
}

async function removeGenImage(e, taskId, index) {
    e.stopPropagation(); const task = await getTaskDB(taskId); if (!task) return;
    task.state.images.splice(index, 1); 
    task.timestamp = Date.now();
    await saveTaskDB(task); renderCard(taskId);
}

// ==========================================
// 馃帹 AI 澶氭ā鐢熷浘鏍稿績鎺у埗妯″潡 (瀹屽叏铻嶅悎鐗?
// ==========================================
async function submitImgGen(taskId) {
    const task = await getTaskDB(taskId); 
    if (!task) return;
    if (!task.state.prompt) return showToast("璇疯緭鍏ョ敓鍥炬彁绀鸿瘝", "error");

    // 1. 鍒濆鍖栫敓鍥剧姸鎬?    task.status = 'processing'; 
    task.retryCount = 0; 
    task.isBilled = false; 
    task.state.startTime = Date.now();
    await saveTaskDB(task); 
    renderCard(taskId); // 馃専 涓ユ牸閬靛畧灞€閮ㄦ覆鏌撴硶鍒?    
    // 馃専 鎷︽埅澶勭悊锛氬鏋?size 鏄┖鍊硷紝杩涜姣斾緥鎻愮ず璇嶇殑闅愬紡鏃犳劅鎷兼帴
    let finalPrompt = task.state.prompt;
    if (task.state.size === '') {
        const w = task.state.customW || 9;
        const h = task.state.customH || 21;
        // 鍦ㄥ彂缁欐湇鍔″櫒鍓嶏紝鎮勬倓鍦ㄧ敤鎴锋彁绀鸿瘝鏈熬鍔犱笂姣斾緥瑕佹眰
        finalPrompt = finalPrompt + ` 鐢婚潰姣斾緥${w}:${h}`; 
    }

    // 2. 鏋勯€?Payload锛岃瀺鍚堟棫鐗堜涪澶辩殑 channel 鍙傛暟
    const apiPayload = { 
        prompt: finalPrompt,  // 馃専 浣跨敤鎷兼帴鍚庣殑鏂?Prompt
        size: task.state.size, // 鐓ф牱浼犵┖瀛楃涓茬粰 n8n
        channel: task.state.channel || 'channel_1', 
        images: await Promise.all(task.state.images.map(b => blobToBase64(b))) 
    };

    let success = false;
    let attempts = 0;
    // 鎭㈠鏃х増鐨勬櫤鑳介噸璇曟満鍒?    const maxAttempts = task.state.autoRetry ? 3 : 1; 

    while (attempts < maxAttempts && !success) {
        attempts++;
        try {
            const response = await fetch(API_IMAGE_GEN, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json', 'wally123': sessionStorage.getItem('veo_admin_pwd') }, 
                body: JSON.stringify(apiPayload) 
            });

            if (response.status === 401 || response.status === 403) { handleAuthError(); throw new Error("瀵嗙爜閿欒"); }
            if (!response.ok) throw new Error("API 寮傚父: " + response.status);
            
            // 3. 馃専 n8n 楂樺閿欒В鏋愶細鍓ョ澶栧眰鏁扮粍
            const rawData = await response.json();
            const resData = Array.isArray(rawData) ? rawData[0] : rawData;
            
            // 绮惧噯鍚戜笅鍖归厤浣犳彁渚涚殑缁撴瀯: resData.data[0].url
            let returnedUrl = resData.imageUrl || resData.url;
            if (!returnedUrl && resData.data && Array.isArray(resData.data) && resData.data.length > 0) {
                returnedUrl = resData.data[0].url;
            }

            if (returnedUrl) {
                // 4. 鎴愬姛鎻愬彇鍥剧墖
                const imgBlob = await fetch(returnedUrl).then(r => r.blob());
                task.status = 'success'; 
                task.state.resultBlob = imgBlob; 
                task.state.costTime = Math.floor((Date.now() - task.state.startTime) / 1000);
                task.timestamp = Date.now(); // 馃専 鏍稿績锛氬己琛屽埛鏂版椂闂存埑锛屾墦绌垮菇鐏电紦瀛?                success = true;

                // 璐﹀崟璁板綍
                if (!task.isBilled) {
                    let cost = task.state.channel === 'channel_2' ? 0.06 : 0.084;
                    await addBillingRecord({ id: 'bill_img_' + task.id + '_' + Date.now(), taskId: task.id, type: 'image', cost: cost, detail: `AI鐢熷浘 (${task.state.channel || '涓婚€氶亾'})` });
                    task.isBilled = true;
                    updateBillingUI();
                }
            } else if (resData && resData.taskId) {
                // 鍏滃簳锛氬鏋滀綘鐨?API 鍙樻垚浜嗗紓姝ユ帓闃熸ā寮忥紝浜よ繕缁欒疆璇㈠紩鎿?                task.genTaskId = resData.taskId; 
                await saveTaskDB(task); 
                startTaskPolling(taskId); 
                return; 
            } else {
                throw new Error("鏃犺繑鍥炴湁鏁堝浘鐗囩粨鏋?);
            }
        } catch (err) { 
            // 澶辫触閲嶈瘯閫昏緫
            if (attempts >= maxAttempts) {
                task.status = 'failed'; 
            } else {
                task.retryCount = attempts;
                await saveTaskDB(task); 
                renderCard(taskId);
                await new Promise(r => setTimeout(r, 2000)); // 缂撳啿 2 绉掑悗閲嶈瘯
            }
        }
    }

    // 5. 寰幆缁撴潫锛岀粺涓€娓叉煋鏈€缁堢姸鎬?    await saveTaskDB(task); 
    renderCard(taskId); 
    if (!success && task.status === 'failed') {
        showToast("鐢熷浘璇锋眰澶辫触锛岃妫€鏌ラ€氶亾浣欓鎴栫綉缁?, "error"); 
    }
}

// ==========================================
// 鉁傦笍 灞€閮ㄨ鍒囧櫒 鐗╃悊寮曟搸 (鎷栨嫿涓庣缉鏀?
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
// 鈴憋笍 鍔ㄦ€佺琛ㄥ紩鎿?(Vanilla JS DOM 渚ф覆鏌擄紝涓嶈Е鍙戦噸缁?
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


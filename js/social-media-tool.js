(function (window, document) {
    'use strict';

    const HIDDEN_JSON_SCHEMA_PROMPT = `
\n\n=== 强制输出规则 (CRITICAL) ===
You MUST return ONLY a valid JSON object. Do NOT include any markdown wrappers (like \`\`\`json).
The JSON object must strictly match this schema:
{
  "content": "The main social media post text.",
  "hashtags": ["#tag1", "#tag2", "#tag3"],
  "imagePrompts": [
    "Detailed english prompt for image 1",
    "Detailed english prompt for image 2 (if needed)",
    "Detailed english prompt for image 3 (if needed)"
  ]
}
Ensure 'imagePrompts' contains at least 1 and up to 3 prompts optimized for DALL-E/Midjourney.`;

    const MAX_IMAGES = 5;
    const MAX_IMAGE_PROMPTS = 3;
    const SETTINGS_KEY = 'socialMediaEngineSettings';
    const DEFAULT_WORKSPACE_COUNT = 1;

    const defaultSettings = {
        textApiUrl: 'https://generativelanguage.googleapis.com/v1beta',
        textModelName: 'gemini-1.5-pro',
        textApiKey: '',
        imageRoute: 'stable_channel_1',
        systemPrompt: '你是一位资深的欧美社媒营销专家。请根据用户提供的商品图片、描述以及使用场景/节日，撰写极具吸引力的社媒贴文（如 Instagram, Facebook 风格）。贴文需包含引人入胜的标题、正文、行动呼吁（CTA），语言为符合欧美本土习惯的英语。同时生成3-5个高流量的Hashtag。另外，请根据产品和贴文内容，构思1-3张高质感的配图画面，并写出能直接提供给生图AI的纯英文生图提示词（Prompts）。'
    };

    let settings = { ...defaultSettings };
    let workspaces = [];
    let activeWorkspaceId = '';
    let initialized = false;
    let toastTimer = null;

    const $ = (selector) => document.querySelector(selector);
    const byId = (id) => document.getElementById(id);

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function safeJsonParse(text, fallback = null) {
        try {
            return JSON.parse(text);
        } catch (err) {
            return fallback;
        }
    }

    function delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    function createWorkspace() {
        const id = `social_ws_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        return {
            id,
            name: `W${workspaces.length + 1}`,
            uploadedImages: [],
            productDesc: '',
            contextDesc: '',
            guidanceLink: '',
            textResult: null,
            imagePrompts: [],
            imageResults: [],
            logs: ['运行日志'],
            isLoading: false,
            generationToken: 0
        };
    }

    function ensureWorkspaces() {
        while (workspaces.length < DEFAULT_WORKSPACE_COUNT) {
            workspaces.push(createWorkspace());
        }
        if (!activeWorkspaceId || !getWorkspace(activeWorkspaceId)) {
            activeWorkspaceId = workspaces[0].id;
        }
    }

    function getWorkspace(id) {
        return workspaces.find((workspace) => workspace.id === id) || null;
    }

    function getActiveWorkspace() {
        ensureWorkspaces();
        return getWorkspace(activeWorkspaceId) || workspaces[0];
    }

    function saveActiveForm() {
        const workspace = getActiveWorkspace();
        if (!workspace) return;
        const productDesc = byId('social-tool-product-desc');
        const contextDesc = byId('social-tool-context-desc');
        const guidanceLink = byId('social-tool-guidance-link');
        if (productDesc) workspace.productDesc = productDesc.value;
        if (contextDesc) workspace.contextDesc = contextDesc.value;
        if (guidanceLink) workspace.guidanceLink = guidanceLink.value;
    }

    function restoreActiveForm() {
        const workspace = getActiveWorkspace();
        const productDesc = byId('social-tool-product-desc');
        const contextDesc = byId('social-tool-context-desc');
        const guidanceLink = byId('social-tool-guidance-link');
        if (productDesc) productDesc.value = workspace.productDesc || '';
        if (contextDesc) contextDesc.value = workspace.contextDesc || '';
        if (guidanceLink) guidanceLink.value = workspace.guidanceLink || '';
    }

    function getWorkspaceStatus(workspace) {
        if (workspace.isLoading) return 'running';
        if (workspace.imageResults.some((item) => item && item.status === 'failed')) return 'failed';
        if (workspace.textResult || workspace.imageResults.some((item) => item && item.status === 'success')) return 'done';
        return 'idle';
    }

    function getImageRoute() {
        if (window.VeoImageCore && typeof window.VeoImageCore.normalizeRoute === 'function') {
            return window.VeoImageCore.normalizeRoute(settings.imageRoute || defaultSettings.imageRoute);
        }
        return {
            key: settings.imageRoute || defaultSettings.imageRoute,
            mode: 'stable',
            channel: settings.imageRoute === 'stable_channel_2' ? 'channel_2' : 'channel_1',
            version: settings.imageRoute === 'pro' ? 'pro' : 'trial',
            model: settings.imageRoute === 'pro' ? 'gpt-image-2' : 'gpt-image-2-c',
            suffix: '',
            maxRefs: 5
        };
    }

    function ensureStyles() {
        if (byId('social-media-tool-styles')) return;
        const style = document.createElement('style');
        style.id = 'social-media-tool-styles';
        style.textContent = `
.social-tool-modal { z-index: 10050; }
.social-tool-shell { width: min(1180px, calc(100vw - 36px)); max-height: min(860px, calc(100vh - 40px)); padding: 0; overflow: hidden; display: flex; flex-direction: column; }
.social-tool-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 22px 26px; border-bottom: 1px solid var(--border); }
.social-tool-title { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.social-tool-title h2 { margin: 0; font-size: 20px; }
.social-tool-title p { color: var(--text-sub); font-size: 13px; margin: 0; }
.social-tool-head-actions { display: flex; gap: 10px; align-items: center; }
.social-tool-head-actions .help-close { position: static; inset: auto; transform: none; flex: 0 0 34px; width: 34px; height: 34px; }
.social-tool-body { display: grid; grid-template-columns: 52px minmax(320px, 0.92fr) minmax(420px, 1.3fr); gap: 18px; padding: 18px; overflow: auto; }
.social-tool-workspaces { display: flex; flex-direction: column; align-items: center; gap: 9px; position: sticky; top: 0; align-self: start; }
.social-tool-workspace-list { display: flex; flex-direction: column; gap: 8px; width: 100%; }
.social-tool-workspace-btn, .social-tool-workspace-add { width: 38px; height: 38px; border-radius: 8px; border: 1px solid var(--border); background: rgba(255,255,255,0.05); color: var(--text-sub); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; position: relative; }
.social-tool-workspace-btn:hover, .social-tool-workspace-add:hover, .social-tool-workspace-btn.active { border-color: var(--accent); color: var(--accent); background: rgba(94,156,255,0.12); }
.social-tool-workspace-btn::after { content: ''; position: absolute; right: -2px; top: -2px; width: 9px; height: 9px; border-radius: 50%; background: transparent; border: 1px solid transparent; }
.social-tool-workspace-btn.running::after { background: #f3b342; border-color: rgba(0,0,0,.18); }
.social-tool-workspace-btn.failed::after { background: var(--danger); border-color: rgba(0,0,0,.18); }
.social-tool-workspace-btn.done::after { background: #43c279; border-color: rgba(0,0,0,.18); }
.social-tool-panel { background: rgba(255,255,255,0.045); border: 1px solid var(--border); border-radius: 10px; padding: 16px; }
:root[data-theme='light'] .social-tool-panel { background: rgba(246,249,255,0.78); }
.social-tool-panel h3 { color: var(--text-main); font-size: 14px; font-weight: 650; margin: 0 0 12px; display: flex; align-items: center; gap: 7px; }
.social-tool-field { display: flex; flex-direction: column; gap: 7px; margin-bottom: 14px; }
.social-tool-field label { color: var(--text-sub); font-size: 12px; font-weight: 600; }
.social-tool-input, .social-tool-textarea, .social-tool-select { width: 100%; border: 1px solid var(--border); border-radius: 8px; background: var(--input-muted-bg); color: var(--text-main); outline: none; font-size: 13px; padding: 10px 12px; user-select: text; }
.social-tool-textarea { min-height: 88px; resize: vertical; line-height: 1.5; }
.social-tool-output { min-height: 220px; max-height: 360px; overflow: auto; white-space: pre-wrap; user-select: text; }
.social-tool-muted { color: var(--text-sub); font-size: 12px; line-height: 1.5; }
.social-tool-gallery { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.social-tool-upload { aspect-ratio: 1; border: 1px dashed var(--border); border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; color: var(--text-sub); cursor: pointer; background: rgba(255,255,255,0.04); }
.social-tool-upload:hover, .social-tool-upload.is-drag { color: var(--accent); border-color: var(--accent); }
.social-tool-upload input { display: none; }
.social-tool-preview { position: relative; aspect-ratio: 1; border-radius: 8px; overflow: hidden; border: 1px solid var(--border); background: rgba(255,255,255,0.05); }
.social-tool-preview img, .social-tool-image-item img { width: 100%; height: 100%; object-fit: cover; display: block; }
.social-tool-remove { position: absolute; top: 6px; right: 6px; border: 0; width: 24px; height: 24px; border-radius: 50%; background: rgba(0,0,0,0.62); color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.social-tool-remove:hover { background: var(--danger); }
.social-tool-main-btn { width: 100%; justify-content: center; padding: 12px 14px; }
.social-tool-main-btn[disabled] { opacity: .62; cursor: not-allowed; transform: none; }
.social-tool-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
.social-tool-image-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; min-height: 156px; position: relative; }
.social-tool-image-item { aspect-ratio: 1; border-radius: 8px; overflow: hidden; border: 1px solid var(--border); background: rgba(255,255,255,0.05); position: relative; }
.social-tool-image-item a { position: absolute; right: 7px; bottom: 7px; border-radius: 8px; background: rgba(0,0,0,.62); color: #fff; padding: 5px 7px; font-size: 11px; text-decoration: none; }
.social-tool-image-item.pending, .social-tool-image-item.failed { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 12px; text-align: center; color: var(--text-sub); }
.social-tool-image-item.pending { border-style: dashed; }
.social-tool-image-item.failed { border-color: rgba(255,94,89,.42); color: var(--danger); }
.social-tool-image-item .material-symbols-outlined { font-size: 24px; }
.social-tool-image-retry { border: 1px solid rgba(255,94,89,.38); color: var(--danger); background: rgba(255,94,89,.08); border-radius: 8px; padding: 6px 9px; cursor: pointer; font-size: 12px; }
.social-tool-placeholder { min-height: 120px; display: flex; align-items: center; justify-content: center; color: var(--text-sub); font-size: 13px; text-align: center; grid-column: 1 / -1; border: 1px dashed var(--border); border-radius: 8px; padding: 12px; }
.social-tool-tags { display: flex; flex-wrap: wrap; gap: 8px; min-height: 28px; }
.social-tool-tag { color: var(--accent); background: rgba(94,156,255,0.11); border: 1px solid rgba(94,156,255,0.2); border-radius: 999px; padding: 5px 9px; font-size: 12px; user-select: text; }
.social-tool-log { min-height: 110px; max-height: 170px; overflow: auto; font-family: Consolas, Monaco, monospace; font-size: 11px; color: var(--text-sub); user-select: text; }
.social-tool-settings { display: none; border-top: 1px solid var(--border); padding: 18px; background: rgba(0,0,0,0.12); }
.social-tool-settings.show { display: block; }
.social-tool-settings-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.social-tool-toast { position: fixed; left: 50%; bottom: 34px; transform: translateX(-50%) translateY(14px); opacity: 0; pointer-events: none; z-index: 10080; border: 1px solid var(--border); background: var(--chrome-bg-strong); color: var(--text-main); border-radius: 8px; padding: 10px 14px; font-size: 13px; box-shadow: var(--panel-shadow); transition: opacity .2s ease, transform .2s ease; }
.social-tool-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
.social-tool-toast.error { border-color: rgba(255,94,89,.35); color: var(--danger); }
@media (max-width: 860px) {
  .social-tool-body { grid-template-columns: 48px minmax(0, 1fr); }
  .social-tool-body > .social-tool-grid { grid-column: 2; }
  .social-tool-settings-grid { grid-template-columns: 1fr; }
  .social-tool-gallery, .social-tool-image-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .social-tool-head { align-items: flex-start; }
}
`;
        document.head.appendChild(style);
    }

    function ensureShell() {
        if (byId('social-tool-modal')) return;
        const modal = document.createElement('div');
        modal.id = 'social-tool-modal';
        modal.className = 'help-modal social-tool-modal';
        modal.innerHTML = `
            <div class="help-content social-tool-shell" onclick="event.stopPropagation()">
                <div class="social-tool-head">
                    <div class="social-tool-title">
                        <h2><span class="material-symbols-outlined">campaign</span> 社媒内容制作引擎</h2>
                        <p>上传产品图，生成欧美社媒贴文、标签和可用配图。</p>
                    </div>
                    <div class="social-tool-head-actions">
                        <button class="top-btn icon-only" id="social-tool-settings-btn" data-tip="社媒引擎设置">
                            <span class="material-symbols-outlined">tune</span>
                        </button>
                        <button class="help-close" id="social-tool-close-btn" type="button">
                            <span class="material-symbols-outlined">close</span>
                        </button>
                    </div>
                </div>
                <div class="social-tool-body">
                    <aside class="social-tool-workspaces" aria-label="Social media workspaces">
                        <div class="social-tool-workspace-list" id="social-tool-workspace-list"></div>
                        <button class="social-tool-workspace-add" id="social-tool-workspace-add" type="button" title="新增工作区">
                            <span class="material-symbols-outlined" style="font-size:19px;">add</span>
                        </button>
                    </aside>
                    <section class="social-tool-grid">
                        <div class="social-tool-panel">
                            <h3><span class="material-symbols-outlined">image</span> 产品图片</h3>
                            <div class="social-tool-gallery" id="social-tool-gallery">
                                <label class="social-tool-upload" id="social-tool-upload">
                                    <span class="material-symbols-outlined">add_photo_alternate</span>
                                    <span>添加图片</span>
                                    <input id="social-tool-image-input" type="file" accept="image/*" multiple>
                                </label>
                            </div>
                            <p class="social-tool-muted" style="margin-top:10px;">最多上传 5 张，图片会同时提供给文本分析和 n8n 生图参考。</p>
                        </div>
                        <div class="social-tool-panel">
                            <h3><span class="material-symbols-outlined">edit_note</span> 内容需求</h3>
                            <div class="social-tool-field">
                                <label for="social-tool-product-desc">商品描述</label>
                                <textarea class="social-tool-textarea" id="social-tool-product-desc" placeholder="例如：环保材质便携咖啡杯，保温12小时，适合户外和通勤..."></textarea>
                            </div>
                            <div class="social-tool-field">
                                <label for="social-tool-context-desc">活动/场景说明</label>
                                <input class="social-tool-input" id="social-tool-context-desc" type="text" placeholder="例如：圣诞节促销，强调温馨和送礼属性">
                            </div>
                            <div class="social-tool-field">
                                <label for="social-tool-guidance-link">贴文引导链接</label>
                                <input class="social-tool-input" id="social-tool-guidance-link" type="url" placeholder="https://... 可选，用作贴文 CTA 或活动落点">
                            </div>
                            <button class="top-btn top-btn-primary social-tool-main-btn" id="social-tool-generate-btn" type="button">
                                <span class="material-symbols-outlined">auto_awesome</span>
                                <span id="social-tool-generate-text">一键生成社媒内容 & 图片</span>
                            </button>
                        </div>
                        <div class="social-tool-panel social-tool-log" id="social-tool-log">
                            <div>运行日志</div>
                        </div>
                    </section>
                    <section class="social-tool-grid">
                        <div class="social-tool-panel">
                            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px;">
                                <h3 style="margin:0;"><span class="material-symbols-outlined">stylus_note</span> 社媒文案输出</h3>
                                <button class="top-btn" id="social-tool-copy-btn" type="button">
                                    <span class="material-symbols-outlined">content_copy</span>
                                    复制文案+标签
                                </button>
                            </div>
                            <div class="social-tool-output social-tool-panel" id="social-tool-text-output">等待生成中...</div>
                            <div style="margin-top:14px;">
                                <h3><span class="material-symbols-outlined">tag</span> Hashtags</h3>
                                <div class="social-tool-tags" id="social-tool-tags"></div>
                            </div>
                        </div>
                        <div class="social-tool-panel">
                            <h3><span class="material-symbols-outlined">palette</span> 生成的配图</h3>
                            <div class="social-tool-image-grid" id="social-tool-images">
                                <div class="social-tool-placeholder">暂无生成的图片</div>
                            </div>
                        </div>
                    </section>
                </div>
                <div class="social-tool-settings" id="social-tool-settings">
                    <div class="social-tool-settings-grid">
                        <div class="social-tool-field">
                            <label for="social-tool-text-url">文本 API Base URL</label>
                            <input class="social-tool-input" id="social-tool-text-url" type="text">
                        </div>
                        <div class="social-tool-field">
                            <label for="social-tool-text-model">文本模型名称</label>
                            <input class="social-tool-input" id="social-tool-text-model" type="text">
                        </div>
                        <div class="social-tool-field">
                            <label for="social-tool-text-key">文本 API Key</label>
                            <input class="social-tool-input" id="social-tool-text-key" type="password">
                        </div>
                        <div class="social-tool-field">
                            <label for="social-tool-image-route">图片 n8n 通道</label>
                            <select class="social-tool-select" id="social-tool-image-route">
                                <option value="stable_channel_1">稳定版 Channel 1</option>
                                <option value="stable_channel_2">稳定版 Channel 2</option>
                                <option value="pro">专业版 GPT Image 2</option>
                            </select>
                        </div>
                    </div>
                    <div class="social-tool-field">
                        <label for="social-tool-system-prompt">文本引擎人设 & 风格提示词</label>
                        <textarea class="social-tool-textarea" id="social-tool-system-prompt"></textarea>
                    </div>
                    <div style="display:flex; justify-content:flex-end; gap:10px;">
                        <button class="top-btn" id="social-tool-settings-cancel" type="button">取消</button>
                        <button class="top-btn top-btn-primary" id="social-tool-settings-save" type="button">保存设置</button>
                    </div>
                </div>
            </div>
        `;
        modal.addEventListener('click', close);
        document.body.appendChild(modal);

        const toast = document.createElement('div');
        toast.id = 'social-tool-toast';
        toast.className = 'social-tool-toast';
        document.body.appendChild(toast);
    }

    function bindEvents() {
        byId('social-tool-close-btn').addEventListener('click', close);
        byId('social-tool-settings-btn').addEventListener('click', toggleSettings);
        byId('social-tool-settings-cancel').addEventListener('click', () => {
            loadSettings();
            byId('social-tool-settings').classList.remove('show');
        });
        byId('social-tool-settings-save').addEventListener('click', saveSettings);
        byId('social-tool-generate-btn').addEventListener('click', handleGenerate);
        byId('social-tool-copy-btn').addEventListener('click', copyText);
        byId('social-tool-workspace-add').addEventListener('click', addWorkspace);
        byId('social-tool-workspace-list').addEventListener('click', (event) => {
            const button = event.target.closest('.social-tool-workspace-btn');
            if (button && button.dataset.workspaceId) switchWorkspace(button.dataset.workspaceId);
        });
        byId('social-tool-images').addEventListener('click', (event) => {
            const button = event.target.closest('[data-social-retry-index]');
            if (button) retryImage(Number(button.dataset.socialRetryIndex), button.dataset.workspaceId || activeWorkspaceId);
        });
        byId('social-tool-image-input').addEventListener('change', handleImageSelect);

        const upload = byId('social-tool-upload');
        upload.addEventListener('dragover', (event) => {
            event.preventDefault();
            upload.classList.add('is-drag');
        });
        upload.addEventListener('dragleave', () => upload.classList.remove('is-drag'));
        upload.addEventListener('drop', (event) => {
            event.preventDefault();
            upload.classList.remove('is-drag');
            if (event.dataTransfer && event.dataTransfer.files) processFiles(event.dataTransfer.files);
        });
    }

    function init() {
        if (initialized) return;
        ensureStyles();
        ensureShell();
        loadSettings();
        ensureWorkspaces();
        renderActiveWorkspace();
        bindEvents();
        initialized = true;
    }

    function open() {
        init();
        byId('social-tool-modal').classList.add('show');
    }

    function close() {
        const modal = byId('social-tool-modal');
        if (modal) modal.classList.remove('show');
    }

    function addWorkspace() {
        saveActiveForm();
        const workspace = createWorkspace();
        workspaces.push(workspace);
        activeWorkspaceId = workspace.id;
        renderActiveWorkspace();
        showToast('已新增工作区');
    }

    function switchWorkspace(workspaceId) {
        if (!getWorkspace(workspaceId) || workspaceId === activeWorkspaceId) return;
        saveActiveForm();
        activeWorkspaceId = workspaceId;
        renderActiveWorkspace();
    }

    function renderWorkspaceRail() {
        const list = byId('social-tool-workspace-list');
        if (!list) return;
        list.innerHTML = '';
        workspaces.forEach((workspace, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `social-tool-workspace-btn ${workspace.id === activeWorkspaceId ? 'active' : ''} ${getWorkspaceStatus(workspace)}`;
            button.dataset.workspaceId = workspace.id;
            button.title = `${workspace.name || `W${index + 1}`} - ${getWorkspaceStatus(workspace)}`;
            button.textContent = String(index + 1);
            list.appendChild(button);
        });
    }

    function renderActiveWorkspace() {
        ensureWorkspaces();
        restoreActiveForm();
        renderWorkspaceRail();
        renderGallery();
        renderTextOutput(getActiveWorkspace().textResult);
        renderImageResults(getActiveWorkspace());
        renderLog(getActiveWorkspace());
        setLoadingState(getActiveWorkspace().isLoading);
    }

    function toggleSettings() {
        loadSettings();
        byId('social-tool-settings').classList.toggle('show');
    }

    function loadSettings() {
        const saved = safeJsonParse(window.localStorage && window.localStorage.getItem(SETTINGS_KEY), null);
        settings = saved && typeof saved === 'object' ? { ...defaultSettings, ...saved } : { ...defaultSettings };
        const fieldMap = {
            'social-tool-text-url': settings.textApiUrl,
            'social-tool-text-model': settings.textModelName,
            'social-tool-text-key': settings.textApiKey,
            'social-tool-image-route': settings.imageRoute,
            'social-tool-system-prompt': settings.systemPrompt
        };
        Object.entries(fieldMap).forEach(([id, value]) => {
            const el = byId(id);
            if (el) el.value = value || '';
        });
    }

    function saveSettings() {
        settings.textApiUrl = byId('social-tool-text-url').value.trim() || defaultSettings.textApiUrl;
        settings.textModelName = byId('social-tool-text-model').value.trim() || defaultSettings.textModelName;
        settings.textApiKey = byId('social-tool-text-key').value.trim();
        settings.imageRoute = byId('social-tool-image-route').value || defaultSettings.imageRoute;
        settings.systemPrompt = byId('social-tool-system-prompt').value.trim() || defaultSettings.systemPrompt;
        try {
            window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        } catch (err) {}
        byId('social-tool-settings').classList.remove('show');
        showToast('设置已应用');
    }

    function handleImageSelect(event) {
        if (event.target.files) processFiles(event.target.files);
        event.target.value = '';
    }

    function processFiles(files) {
        const workspace = getActiveWorkspace();
        const availableSlots = MAX_IMAGES - workspace.uploadedImages.length;
        if (availableSlots <= 0) {
            showToast('最多只能上传5张图片', true);
            return;
        }
        Array.from(files).slice(0, availableSlots).forEach((file) => {
            if (!file || !file.type || !file.type.startsWith('image/')) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                workspace.uploadedImages.push({
                    dataUrl: event.target.result,
                    mimeType: file.type
                });
                if (workspace.id === activeWorkspaceId) renderGallery();
            };
            reader.readAsDataURL(file);
        });
    }

    function removeImage(index) {
        getActiveWorkspace().uploadedImages.splice(index, 1);
        renderGallery();
    }

    function renderGallery() {
        const gallery = byId('social-tool-gallery');
        gallery.querySelectorAll('.social-tool-preview').forEach((item) => item.remove());
        const upload = byId('social-tool-upload');
        const workspace = getActiveWorkspace();
        workspace.uploadedImages.forEach((img, index) => {
            const item = document.createElement('div');
            item.className = 'social-tool-preview';
            const image = document.createElement('img');
            image.src = img.dataUrl;
            image.alt = `产品参考图 ${index + 1}`;
            const remove = document.createElement('button');
            remove.className = 'social-tool-remove';
            remove.type = 'button';
            remove.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">close</span>';
            remove.addEventListener('click', () => removeImage(index));
            item.append(image, remove);
            gallery.insertBefore(item, upload);
        });
        upload.style.display = workspace.uploadedImages.length >= MAX_IMAGES ? 'none' : 'flex';
    }

    async function handleGenerate() {
        saveActiveForm();
        const workspace = getActiveWorkspace();
        if (workspace.isLoading) {
            showToast('当前工作区正在生成中');
            return;
        }
        if (workspace.uploadedImages.length === 0) {
            showToast('请至少上传一张产品图片', true);
            return;
        }
        if (!settings.textApiKey) {
            showToast('请先配置文本大模型 API Key', true);
            byId('social-tool-settings').classList.add('show');
            return;
        }
        if (!window.VeoApi || typeof window.VeoApi.postEndpoint !== 'function') {
            showToast('当前页面缺少 n8n API 客户端', true);
            return;
        }

        const workspaceId = workspace.id;
        const generationToken = workspace.generationToken + 1;
        workspace.generationToken = generationToken;
        workspace.productDesc = (workspace.productDesc || '').trim();
        workspace.contextDesc = (workspace.contextDesc || '').trim();
        workspace.guidanceLink = (workspace.guidanceLink || '').trim();
        workspace.textResult = null;
        workspace.imagePrompts = [];
        workspace.imageResults = [];
        workspace.logs = ['运行日志'];
        workspace.isLoading = true;
        renderActiveWorkspace();

        try {
            logDebug('正在调用文本多模态大模型分析图片...', workspaceId);
            const textResult = await callTextMultimodalModel(workspace.productDesc, workspace.contextDesc, workspace.guidanceLink, workspaceId);
            if (!textResult) throw new Error('文本模型未返回有效数据');
            logDebug('文本生成成功，正在渲染到界面...', workspaceId);
            workspace.textResult = textResult;
            if (activeWorkspaceId === workspaceId) renderTextOutput(textResult);

            const prompts = Array.isArray(textResult.imagePrompts)
                ? textResult.imagePrompts.filter(Boolean).slice(0, MAX_IMAGE_PROMPTS)
                : [];
            workspace.imagePrompts = prompts;
            if (prompts.length === 0) {
                logDebug('模型未提供生图提示词，跳过生图步骤。', workspaceId);
            } else {
                logDebug(`准备通过 n8n 生成 ${prompts.length} 张图片...`, workspaceId);
                workspace.imageResults = prompts.map((prompt, index) => ({ index, prompt, status: 'pending', url: '', error: '' }));
                if (activeWorkspaceId === workspaceId) renderImageResults(workspace);
                const results = await Promise.allSettled(prompts.map((prompt, index) => generateImage(prompt, index, workspaceId)));
                results.forEach((result, index) => {
                    if (result.status === 'rejected' || !result.value) {
                        const message = result.reason && result.reason.message ? result.reason.message : 'Unknown image error';
                        workspace.imageResults[index] = { index, prompt: prompts[index], status: 'failed', url: '', error: message };
                    }
                });
                results.forEach((result, index) => {
                    if (result.status === 'fulfilled' && result.value) {
                        workspace.imageResults[index] = { index, prompt: prompts[index], status: 'success', url: result.value, error: '' };
                    } else {
                        const message = result.reason && result.reason.message ? result.reason.message : '未知错误';
                        logDebug(`第 ${index + 1} 张图片生成失败: ${escapeHtml(message)}`, workspaceId);
                    }
                });
                if (activeWorkspaceId === workspaceId) renderImageResults(workspace);
                if (activeWorkspaceId === workspaceId && !byId('social-tool-images').querySelector('.social-tool-image-item')) {
                    byId('social-tool-images').innerHTML = '<div class="social-tool-placeholder">图片生成失败，请查看日志</div>';
                }
            }

            if (window.VeoBilling && typeof window.VeoBilling.refreshBalanceAfterUsage === 'function') {
                window.VeoBilling.refreshBalanceAfterUsage();
            }
            showToast('生成完成');
        } catch (error) {
            console.error(error);
            logDebug(`<span style="color:var(--danger);">错误: ${escapeHtml(error.message || error)}</span>`, workspaceId);
            showToast('生成过程发生错误，请查看日志', true);
        } finally {
            if (workspace.generationToken === generationToken) workspace.isLoading = false;
            renderWorkspaceRail();
            if (activeWorkspaceId === workspaceId) setLoadingState(false);
        }
    }

    async function callTextMultimodalModel(productDesc, contextDesc, guidanceLink, workspaceId) {
        let baseUrl = String(settings.textApiUrl || defaultSettings.textApiUrl).replace(/\/$/, '');
        let url = `${baseUrl}/models/${settings.textModelName || defaultSettings.textModelName}:generateContent?key=${settings.textApiKey || ''}`;

        let promptText = `
商品描述: ${productDesc || '无'}
节日/场景: ${contextDesc || '常规发贴'}

请根据提供的图片和上述信息，执行任务。
`;
        if (guidanceLink) {
            promptText += `\n贴文引导链接: ${guidanceLink}`;
        }

        let parts = [];
        parts.push({ text: settings.systemPrompt + HIDDEN_JSON_SCHEMA_PROMPT + "\n\n" + promptText });

        const sourceWorkspace = getWorkspace(workspaceId) || getActiveWorkspace();
        sourceWorkspace.uploadedImages.forEach(img => {
            const base64Data = img.dataUrl.split(',')[1];
            parts.push({
                inlineData: {
                    mimeType: img.mimeType,
                    data: base64Data
                }
            });
        });

        const payload = {
            contents: [{ role: "user", parts: parts }],
            generationConfig: {
                responseMimeType: "application/json"
            }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const responseText = await response.text();

        if (!response.ok) {
            throw new Error(`文本 API 错误 (${response.status}): ${responseText.substring(0, 150)}...`);
        }

        let result;
        try {
            result = JSON.parse(responseText);
        } catch (e) {
            console.error("Raw Text API Response:", responseText);
            throw new Error("文案 API 返回了网页而不是数据（可能是 API Base URL 配置错误或受到拦截）。");
        }

        if (result.candidates && result.candidates[0].content.parts[0].text) {
            let jsonStr = result.candidates[0].content.parts[0].text;
            jsonStr = jsonStr.replace(/^```json/mi, '').replace(/^```/mi, '').replace(/```$/mi, '').trim();
            try {
                return JSON.parse(jsonStr);
            } catch (e) {
                console.error("Failed to parse JSON", jsonStr);
                throw new Error("模型返回的内容不是有效的 JSON 格式，请重试。");
            }
        }
        return null;
    }

    async function generateImage(promptText, index, workspaceId) {
        logDebug(`正在发起 n8n 生图请求 ${index + 1}...`, workspaceId);
        const route = getImageRoute();
        const imageModel = route.model || (route.version === 'pro' ? 'gpt-image-2' : 'gpt-image-2-c');
        const workspace = getWorkspace(workspaceId) || getActiveWorkspace();
        const refs = workspace.uploadedImages.map((img) => img.dataUrl).filter(Boolean).slice(0, Math.min(MAX_IMAGES, route.maxRefs || MAX_IMAGES));
        const routeKey = route.key || settings.imageRoute || defaultSettings.imageRoute;
        const state = {
            prompt: promptText,
            images: refs,
            providerSort: routeKey,
            routeMode: routeKey,
            channel: route.channel || 'channel_1',
            proRatio: '1:1',
            proResolution: '1k',
            size: '1024x1024',
            quality: 'auto',
            format: 'png',
            background: 'auto',
            moderation: 'auto'
        };
        const imagePayloadFields = window.VeoMedia && typeof window.VeoMedia.buildImgGenImagePayloadFields === 'function'
            ? window.VeoMedia.buildImgGenImagePayloadFields(refs, null, route.maxRefs || MAX_IMAGES)
            : {
                images: refs,
                image_urls: refs,
                image_count: refs.length,
                reference_count: Math.max(0, refs.length - 1),
                mask: null,
                mask_url: null
            };
        const clientRequestId = `social_${Date.now()}_${index + 1}`;
        const task = { id: clientRequestId, state };
        const payload = window.VeoImageRequest && typeof window.VeoImageRequest.buildUnifiedPayload === 'function'
            ? window.VeoImageRequest.buildUnifiedPayload({
                task,
                route,
                mode: refs.length > 0 ? 'img2img' : 'text2img',
                imageModel,
                sizeToSend: '1024x1024',
                previewItemId: `social_img_${index + 1}`,
                clientRequestId,
                promptContext: { finalPrompt: promptText },
                referenceControls: refs.map((_, refIndex) => ({ index: refIndex, weight: 1, intent: 'style' })),
                imagePayloadFields
            })
            : {
                action: 'generate',
                version: route.version === 'pro' ? 'pro' : 'trial',
                mode: refs.length > 0 ? 'img2img' : 'text2img',
                model: imageModel,
                imageModel,
                prompt: promptText,
                size: '1024x1024',
                ratio: '1:1',
                aspect_ratio: '1:1',
                resolution: '1k',
                providerSort: routeKey,
                providerKey: routeKey,
                provider_key: routeKey,
                channel: route.channel || 'channel_1',
                provider: { key: routeKey, sort: route.mode || 'stable', model: imageModel },
                n: 1,
                clientRequestId,
                client_request_id: clientRequestId,
                ...imagePayloadFields
            };

        const response = await window.VeoApi.postEndpoint('image.unified', payload);
        if (response.status === 401 || response.status === 403) {
            if (typeof window.handleAuthError === 'function') window.handleAuthError();
            throw new Error('n8n 图片接口密钥校验失败');
        }
        if (!response.ok) throw new Error(`n8n 图片接口异常: ${response.status}`);

        const rawData = await parseImageResponse(response, 'processing');
        const immediateUrl = extractFirstImageUrl(rawData);
        if (immediateUrl) return immediateUrl;

        const taskId = extractTaskId(rawData);
        const status = extractStatus(rawData);
        if (taskId && !isFailedStatus(status)) {
            logDebug(`图片 ${index + 1} 已进入异步队列: ${escapeHtml(taskId)}`, workspaceId);
            return pollImageResult(taskId, task, index, workspaceId);
        }
        if (isFailedStatus(status)) throw new Error(`n8n 返回失败状态: ${status}`);
        throw new Error('n8n 返回成功但未包含图片或任务ID');
    }

    async function pollImageResult(remoteTaskId, task, index, workspaceId) {
        const pollEndpoint = window.VeoApi.resolveImagePollEndpoint
            ? window.VeoApi.resolveImagePollEndpoint()
            : { url: window.VeoApi.resolveEndpoint('image.unified') };
        if (!pollEndpoint || !pollEndpoint.url) throw new Error('未配置可用的图片轮询接口');

        let currentTaskId = remoteTaskId;
        const route = getImageRoute();
        for (let attempt = 1; attempt <= 90; attempt++) {
            await delay(attempt === 1 ? 1200 : 3500);
            const payload = {
                action: 'poll',
                poll: true,
                version: route.version === 'pro' ? 'pro' : 'trial',
                mode: task.state.images.length > 0 ? 'img2img' : 'text2img',
                providerSort: route.key,
                providerKey: route.key,
                provider_key: route.key,
                routeMode: route.key,
                route_mode: route.key,
                channel: route.channel || 'channel_1',
                routeChannel: route.channel || 'channel_1',
                route_channel: route.channel || 'channel_1',
                taskId: currentTaskId,
                task_id: currentTaskId,
                request_id: currentTaskId
            };
            const response = await window.VeoApi.postEndpoint(pollEndpoint.url, payload, { includeImageAuth: true });
            if (response.status === 401 || response.status === 403) {
                if (typeof window.handleAuthError === 'function') window.handleAuthError();
                throw new Error('n8n 图片轮询密钥校验失败');
            }
            if (!response.ok) {
                logDebug(`图片 ${index + 1} 轮询 HTTP ${response.status}，继续等待...`, workspaceId);
                continue;
            }
            const rawData = await parseImageResponse(response, 'processing');
            const url = extractFirstImageUrl(rawData);
            if (url) return url;
            const nextTaskId = extractTaskId(rawData);
            if (nextTaskId) currentTaskId = nextTaskId;
            const status = extractStatus(rawData);
            if (isFailedStatus(status)) throw new Error(`n8n 图片任务失败: ${status}`);
            if (attempt % 8 === 0) logDebug(`图片 ${index + 1} 仍在生成中...`, workspaceId);
        }
        throw new Error('图片任务轮询超时');
    }

    async function parseImageResponse(response, fallbackStatus) {
        if (window.VeoApi && typeof window.VeoApi.parseResponse === 'function') {
            return window.VeoApi.parseResponse(response, fallbackStatus);
        }
        const text = await response.text();
        return safeJsonParse(text, text || { status: fallbackStatus });
    }

    function extractFirstImageUrl(rawData) {
        if (typeof window.extractImageUrlFromResponse === 'function') {
            return window.extractImageUrlFromResponse(rawData);
        }
        if (typeof window.extractImageUrlsFromResponse === 'function') {
            const list = window.extractImageUrlsFromResponse(rawData);
            return list && list[0] ? list[0] : null;
        }
        const data = Array.isArray(rawData) ? rawData[0] : rawData;
        if (!data) return null;
        if (typeof data === 'string' && /^(https?:\/\/|data:image)/i.test(data)) return data;
        const first = data.data && Array.isArray(data.data) ? data.data[0] : null;
        if (first && first.url) return first.url;
        if (first && first.b64_json) return `data:image/png;base64,${first.b64_json}`;
        return data.url || data.imageUrl || data.image_url || null;
    }

    function extractTaskId(rawData) {
        if (typeof window.extractImgGenTaskId === 'function') return window.extractImgGenTaskId(rawData);
        const data = Array.isArray(rawData) ? rawData[0] : rawData;
        return data && (data.taskId || data.task_id || data.jobId || data.job_id || data.id) ? String(data.taskId || data.task_id || data.jobId || data.job_id || data.id) : '';
    }

    function extractStatus(rawData) {
        if (typeof window.extractImgGenStatus === 'function') return window.extractImgGenStatus(rawData);
        const data = Array.isArray(rawData) ? rawData[0] : rawData;
        return data && (data.status || data.state || data.phase) ? String(data.status || data.state || data.phase).toLowerCase() : '';
    }

    function isFailedStatus(status) {
        if (!status) return false;
        if (typeof window.isImgGenFailedStatus === 'function') return window.isImgGenFailedStatus(status);
        return ['failed', 'error', 'rejected', 'cancelled', 'canceled', 'timeout', 'aborted'].includes(String(status).toLowerCase());
    }

    function renderTextOutput(data) {
        const output = byId('social-tool-text-output');
        if (!data) {
            output.textContent = '等待生成中...';
            byId('social-tool-tags').innerHTML = '';
            return;
        }
        output.textContent = data.content || '未能生成有效文案';
        const tags = byId('social-tool-tags');
        tags.innerHTML = '';
        if (data.hashtags && Array.isArray(data.hashtags)) {
            data.hashtags.forEach((tag) => {
                const span = document.createElement('span');
                span.className = 'social-tool-tag';
                span.textContent = String(tag || '').startsWith('#') ? tag : `#${tag}`;
                tags.appendChild(span);
            });
        }
    }

    function renderGeneratedImage(url, index) {
        const grid = byId('social-tool-images');
        grid.querySelectorAll('.social-tool-placeholder').forEach((item) => item.remove());
        const item = document.createElement('div');
        item.className = 'social-tool-image-item';
        const img = document.createElement('img');
        img.src = url;
        img.alt = `生成配图 ${index + 1}`;
        img.draggable = true;
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = '打开';
        item.append(img, link);
        grid.appendChild(item);
    }

    function renderImageResults(workspace) {
        const grid = byId('social-tool-images');
        if (!grid) return;
        const results = workspace && Array.isArray(workspace.imageResults) ? workspace.imageResults : [];
        if (results.length === 0) {
            grid.innerHTML = '<div class="social-tool-placeholder">暂无生成的图片</div>';
            return;
        }
        grid.innerHTML = '';
        results.forEach((result, index) => {
            const status = result && result.status ? result.status : 'pending';
            const item = document.createElement('div');
            item.className = `social-tool-image-item ${status}`;
            if (status === 'success' && result.url) {
                const img = document.createElement('img');
                img.src = result.url;
                img.alt = `生成配图 ${index + 1}`;
                img.draggable = true;
                const link = document.createElement('a');
                link.href = result.url;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.textContent = '打开';
                item.append(img, link);
            } else if (status === 'failed') {
                item.innerHTML = `
                    <span class="material-symbols-outlined">error</span>
                    <div>第 ${index + 1} 张生成失败</div>
                    <button class="social-tool-image-retry" type="button" data-workspace-id="${escapeHtml(workspace.id)}" data-social-retry-index="${index}">重试这张</button>
                `;
            } else {
                item.innerHTML = `
                    <span class="material-symbols-outlined">hourglass_empty</span>
                    <div>第 ${index + 1} 张生成中...</div>
                `;
            }
            grid.appendChild(item);
        });
    }

    async function retryImage(index, workspaceId) {
        const workspace = getWorkspace(workspaceId);
        if (!workspace || workspace.isLoading) {
            if (workspace && workspace.isLoading) showToast('该工作区正在生成中，请稍候');
            return;
        }
        const prompt = workspace.imagePrompts[index] || (workspace.imageResults[index] && workspace.imageResults[index].prompt);
        if (!prompt) {
            showToast('找不到这张图的提示词，无法重试', true);
            return;
        }
        workspace.imageResults[index] = { index, prompt, status: 'pending', url: '', error: '' };
        workspace.isLoading = true;
        renderWorkspaceRail();
        if (activeWorkspaceId === workspace.id) {
            renderImageResults(workspace);
            setLoadingState(true);
        }
        try {
            const url = await generateImage(prompt, index, workspace.id);
            workspace.imageResults[index] = { index, prompt, status: 'success', url, error: '' };
            if (window.VeoBilling && typeof window.VeoBilling.refreshBalanceAfterUsage === 'function') {
                window.VeoBilling.refreshBalanceAfterUsage();
            }
            showToast('单图重试完成');
        } catch (error) {
            const message = error && error.message ? error.message : String(error || 'Unknown image error');
            workspace.imageResults[index] = { index, prompt, status: 'failed', url: '', error: message };
            logDebug(`第 ${index + 1} 张图片重试失败: ${escapeHtml(message)}`, workspace.id);
            showToast('单图重试失败，可再次点击重试', true);
        } finally {
            workspace.isLoading = false;
            renderWorkspaceRail();
            if (activeWorkspaceId === workspace.id) {
                renderImageResults(workspace);
                setLoadingState(false);
            }
        }
    }

    function clearOutputs() {
        byId('social-tool-text-output').textContent = '生成中，请稍候...';
        byId('social-tool-tags').innerHTML = '';
        byId('social-tool-images').innerHTML = '<div class="social-tool-placeholder">等待图片生成中...</div>';
    }

    function setLoadingState(isLoading) {
        const btn = byId('social-tool-generate-btn');
        const text = byId('social-tool-generate-text');
        btn.disabled = isLoading;
        text.textContent = isLoading ? '正在制作...' : '一键生成社媒内容 & 图片';
    }

    function resetLog() {
        byId('social-tool-log').innerHTML = '<div>运行日志</div>';
    }

    function renderLog(workspace) {
        const log = byId('social-tool-log');
        if (!log) return;
        const entries = workspace && Array.isArray(workspace.logs) && workspace.logs.length ? workspace.logs : ['运行日志'];
        log.innerHTML = entries.map((entry) => `<div>${entry}</div>`).join('');
        log.scrollTop = log.scrollHeight;
    }

    function logDebug(message, workspaceId = activeWorkspaceId) {
        const workspace = getWorkspace(workspaceId) || getActiveWorkspace();
        const item = document.createElement('div');
        const time = new Date().toLocaleTimeString();
        item.innerHTML = `<span style="opacity:.7;">[${escapeHtml(time)}]</span> ${message}`;
        workspace.logs.push(item.innerHTML);
        renderWorkspaceRail();
        if (workspace.id !== activeWorkspaceId) return;
        const log = byId('social-tool-log');
        log.appendChild(item);
        log.scrollTop = log.scrollHeight;
    }

    async function copyText() {
        const workspace = getActiveWorkspace();
        const text = workspace.textResult && workspace.textResult.content
            ? workspace.textResult.content
            : (byId('social-tool-text-output').textContent || '');
        const tagList = workspace.textResult && Array.isArray(workspace.textResult.hashtags)
            ? workspace.textResult.hashtags.map((tag) => String(tag || '').startsWith('#') ? String(tag || '') : `#${tag}`)
            : Array.from(byId('social-tool-tags').children).map((item) => item.textContent);
        const hashtags = tagList.filter(Boolean).join(' ');
        const fullText = [text, hashtags].filter(Boolean).join('\n\n').trim();
        if (!fullText || fullText === '等待生成中...') return;
        try {
            if (window.navigator.clipboard && window.isSecureContext) {
                await window.navigator.clipboard.writeText(fullText);
            } else {
                const textarea = document.createElement('textarea');
                textarea.value = fullText;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                textarea.remove();
            }
            showToast('文案和标签已复制');
        } catch (err) {
            showToast('复制失败，当前环境不支持该操作', true);
        }
    }

    function showToast(message, isError = false) {
        const toast = byId('social-tool-toast');
        if (!toast) return;
        toast.textContent = message;
        toast.className = `social-tool-toast show${isError ? ' error' : ''}`;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toast.className = 'social-tool-toast';
        }, 2600);
    }

    window.openSocialMediaTool = open;
    window.closeSocialMediaTool = close;
    window.VeoSocialMediaTool = {
        open,
        close,
        init,
        getSettings: () => ({ ...settings })
    };
})(window, document);


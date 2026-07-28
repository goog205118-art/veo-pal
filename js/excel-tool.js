(function (window, document) {
    'use strict';

    const SETTINGS_KEY = 'veoExcelToolSettings';
    const MAX_SOURCE_ROWS = 60;
    const MAX_IMAGE_REFS = 6;
    const SHEETJS_CDN = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    const EXCELJS_CDN = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';

    const defaultSettings = {
        providerName: 'OpenAI Compatible',
        apiBaseUrl: 'https://api.openai.com/v1',
        apiKey: '',
        modelName: 'gpt-4o-mini',
        temperature: 0.2,
        maxRows: 30,
        systemPrompt: '你是专业的 Excel 数据整理助手。你的任务是读取源资料，理解目标模板字段，并生成可直接写入目标 Excel 的结构化数据。必须保持字段名与目标模板表头一致，不要编造无法从源资料推断的信息。'
    };

    let settings = { ...defaultSettings };
    let initialized = false;
    let toastTimer = null;
    let activeLayer = 'work';
    let sourceFiles = [];
    let sourceRows = [];
    let sourceHeaders = [];
    let sourceImages = [];
    let templateFile = null;
    let templateBuffer = null;
    let templateHeaders = [];
    let templateSheetName = '';
    let templateHeaderRowIndex = 1;
    let generatedRows = [];
    let lastRawResponse = '';
    let isRunning = false;

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

    function normalizeBaseUrl(value) {
        return String(value || '').trim().replace(/\/+$/, '') || defaultSettings.apiBaseUrl;
    }

    function getChatCompletionsUrl() {
        const base = normalizeBaseUrl(settings.apiBaseUrl);
        if (/\/chat\/completions$/i.test(base)) return base;
        return `${base}/chat/completions`;
    }

    function clampNumber(value, min, max, fallback) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return fallback;
        return Math.min(max, Math.max(min, parsed));
    }

    function ensureStyles() {
        if (byId('excel-tool-styles')) return;
        const style = document.createElement('style');
        style.id = 'excel-tool-styles';
        style.textContent = `
.excel-tool-modal { z-index: 10060; }
.excel-tool-shell { width: min(1240px, calc(100vw - 36px)); max-height: min(860px, calc(100vh - 40px)); padding: 0; overflow: hidden; display: flex; flex-direction: column; }
.excel-tool-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 20px 24px; border-bottom: 1px solid var(--border); }
.excel-tool-title { min-width: 0; }
.excel-tool-title h2 { margin: 0; color: var(--text-main); font-size: 20px; display: flex; align-items: center; gap: 8px; }
.excel-tool-title p { margin: 5px 0 0; color: var(--text-sub); font-size: 12px; }
.excel-tool-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
.excel-tool-actions .help-close { position: static; inset: auto; transform: none; width: 34px; height: 34px; flex: 0 0 34px; }
.excel-tool-tabs { display: flex; gap: 8px; padding: 12px 18px 0; border-bottom: 1px solid var(--border); }
.excel-tool-tab { border: 1px solid var(--border); border-bottom: 0; border-radius: 8px 8px 0 0; background: rgba(255,255,255,.04); color: var(--text-sub); padding: 9px 13px; cursor: pointer; display: flex; align-items: center; gap: 7px; font-size: 13px; }
.excel-tool-tab.active { color: var(--accent); background: rgba(94,156,255,.12); border-color: rgba(94,156,255,.32); }
.excel-tool-body { display: grid; grid-template-columns: minmax(330px, .82fr) minmax(500px, 1.28fr); gap: 16px; padding: 18px; overflow: auto; }
.excel-tool-settings { display: none; padding: 18px; overflow: auto; }
.excel-tool-shell[data-layer='settings'] .excel-tool-body { display: none; }
.excel-tool-shell[data-layer='settings'] .excel-tool-settings { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; }
.excel-tool-panel { border: 1px solid var(--border); border-radius: 10px; background: rgba(255,255,255,.045); padding: 16px; min-width: 0; }
:root[data-theme='light'] .excel-tool-panel { background: rgba(246,249,255,.82); }
.excel-tool-panel h3 { margin: 0 0 12px; color: var(--text-main); font-size: 14px; display: flex; align-items: center; gap: 7px; }
.excel-tool-stack { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
.excel-tool-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.excel-tool-field { display: flex; flex-direction: column; gap: 7px; margin-bottom: 13px; }
.excel-tool-field label { color: var(--text-sub); font-size: 12px; font-weight: 650; }
.excel-tool-input, .excel-tool-textarea, .excel-tool-select { width: 100%; border: 1px solid var(--border); border-radius: 8px; background: var(--input-muted-bg); color: var(--text-main); outline: none; font-size: 13px; padding: 10px 12px; user-select: text; }
.excel-tool-textarea { min-height: 96px; resize: vertical; line-height: 1.5; }
.excel-tool-drop { border: 1px dashed var(--border); border-radius: 8px; min-height: 120px; display: flex; align-items: center; justify-content: center; text-align: center; color: var(--text-sub); background: rgba(255,255,255,.035); cursor: pointer; padding: 14px; transition: border-color .18s ease, background .18s ease, color .18s ease; }
.excel-tool-drop:hover, .excel-tool-drop.is-drag { color: var(--accent); border-color: var(--accent); background: rgba(94,156,255,.08); }
.excel-tool-drop strong { display: block; color: var(--text-main); margin-bottom: 4px; font-size: 13px; }
.excel-tool-drop span.material-symbols-outlined { font-size: 26px; display: block; margin-bottom: 6px; }
.excel-tool-drop input { display: none; }
.excel-tool-file-list, .excel-tool-log { border: 1px solid var(--border); border-radius: 8px; background: rgba(0,0,0,.12); padding: 10px; color: var(--text-sub); font-size: 12px; line-height: 1.55; min-height: 42px; max-height: 150px; overflow: auto; }
:root[data-theme='light'] .excel-tool-file-list, :root[data-theme='light'] .excel-tool-log { background: rgba(255,255,255,.58); }
.excel-tool-chip-row { display: flex; gap: 8px; flex-wrap: wrap; }
.excel-tool-chip { border: 1px solid var(--border); border-radius: 8px; padding: 6px 8px; background: rgba(255,255,255,.04); color: var(--text-sub); font-size: 12px; }
.excel-tool-main-btn { width: 100%; justify-content: center; padding: 12px 14px; }
.excel-tool-main-btn[disabled] { opacity: .58; cursor: not-allowed; transform: none; }
.excel-tool-progress { display: none; border: 1px solid var(--border); border-radius: 8px; padding: 10px; background: rgba(255,255,255,.035); }
.excel-tool-progress.show { display: block; }
.excel-tool-progress-meta { display: flex; justify-content: space-between; color: var(--text-sub); font-size: 12px; margin-bottom: 8px; }
.excel-tool-progress-track { height: 6px; border-radius: 999px; background: rgba(255,255,255,.09); overflow: hidden; }
.excel-tool-progress-fill { height: 100%; width: 0; border-radius: inherit; background: var(--accent); transition: width .25s ease; }
.excel-tool-preview-shell { overflow: auto; max-height: 250px; border: 1px solid var(--border); border-radius: 8px; background: rgba(0,0,0,.1); }
.excel-tool-table { width: 100%; border-collapse: collapse; font-size: 12px; color: var(--text-main); }
.excel-tool-table th, .excel-tool-table td { border-bottom: 1px solid var(--border); padding: 8px 9px; text-align: left; vertical-align: top; min-width: 96px; }
.excel-tool-table th { position: sticky; top: 0; background: var(--chrome-bg-strong); color: var(--text-sub); font-weight: 700; z-index: 1; }
.excel-tool-empty { min-height: 180px; display: flex; align-items: center; justify-content: center; text-align: center; color: var(--text-sub); font-size: 13px; border: 1px dashed var(--border); border-radius: 8px; }
.excel-tool-result-meta { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 12px; color: var(--text-sub); font-size: 12px; }
.excel-tool-image-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.excel-tool-image-thumb { aspect-ratio: 1; border-radius: 8px; overflow: hidden; border: 1px solid var(--border); background: rgba(255,255,255,.05); }
.excel-tool-image-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.excel-tool-settings-actions { display: flex; justify-content: flex-end; gap: 10px; position: sticky; bottom: -18px; padding-top: 14px; background: linear-gradient(to bottom, transparent, rgba(0,0,0,.22) 45%, rgba(0,0,0,.22)); }
.excel-tool-toast { position: fixed; left: 50%; bottom: 34px; transform: translateX(-50%) translateY(14px); opacity: 0; pointer-events: none; z-index: 10090; border: 1px solid var(--border); background: var(--chrome-bg-strong); color: var(--text-main); border-radius: 8px; padding: 10px 14px; font-size: 13px; box-shadow: var(--panel-shadow); transition: opacity .2s ease, transform .2s ease; }
.excel-tool-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
.excel-tool-toast.error { border-color: rgba(255,94,89,.35); color: var(--danger); }
@media (max-width: 920px) {
  .excel-tool-body, .excel-tool-grid { grid-template-columns: 1fr; }
  .excel-tool-shell { width: calc(100vw - 20px); }
}
`;
        document.head.appendChild(style);
    }

    function ensureShell() {
        if (byId('excel-tool-modal')) return;
        const modal = document.createElement('div');
        modal.id = 'excel-tool-modal';
        modal.className = 'help-modal excel-tool-modal';
        modal.innerHTML = `
            <div class="help-content excel-tool-shell" data-layer="work" onclick="event.stopPropagation()">
                <div class="excel-tool-head">
                    <div class="excel-tool-title">
                        <h2><span class="material-symbols-outlined">table_chart</span> Excel 智能表格工具</h2>
                        <p>源资料解析、目标模板识别、AI 字段映射、回填导出</p>
                    </div>
                    <div class="excel-tool-actions">
                        <button class="top-btn" id="excel-tool-reset-btn" type="button">
                            <span class="material-symbols-outlined">restart_alt</span>
                            清空
                        </button>
                        <button class="top-btn icon-only" id="excel-tool-close-btn" type="button" data-tip="关闭">
                            <span class="material-symbols-outlined">close</span>
                        </button>
                    </div>
                </div>
                <div class="excel-tool-tabs">
                    <button class="excel-tool-tab active" type="button" data-excel-layer="work">
                        <span class="material-symbols-outlined">play_circle</span>
                        使用层
                    </button>
                    <button class="excel-tool-tab" type="button" data-excel-layer="settings">
                        <span class="material-symbols-outlined">tune</span>
                        设置层
                    </button>
                </div>
                <div class="excel-tool-body">
                    <div class="excel-tool-stack">
                        <section class="excel-tool-panel">
                            <h3><span class="material-symbols-outlined">source</span> 源资料</h3>
                            <label class="excel-tool-drop" id="excel-tool-source-drop">
                                <input id="excel-tool-source-input" type="file" multiple accept=".xlsx,.xls,.csv,image/*">
                                <div>
                                    <span class="material-symbols-outlined">upload_file</span>
                                    <strong>上传源 Excel / CSV / 图片</strong>
                                    <div>可多选；图片会作为多模态参考传给大模型</div>
                                </div>
                            </label>
                            <div class="excel-tool-file-list" id="excel-tool-source-list">尚未上传源资料</div>
                        </section>
                        <section class="excel-tool-panel">
                            <h3><span class="material-symbols-outlined">view_column</span> 目标模板</h3>
                            <label class="excel-tool-drop" id="excel-tool-template-drop">
                                <input id="excel-tool-template-input" type="file" accept=".xlsx,.xls,.csv">
                                <div>
                                    <span class="material-symbols-outlined">note_stack</span>
                                    <strong>上传需要回填的模板</strong>
                                    <div>自动读取首个非空行作为目标表头</div>
                                </div>
                            </label>
                            <div class="excel-tool-file-list" id="excel-tool-template-list">尚未上传目标模板</div>
                        </section>
                        <section class="excel-tool-panel">
                            <h3><span class="material-symbols-outlined">edit_note</span> 处理说明</h3>
                            <div class="excel-tool-field">
                                <label for="excel-tool-task">给 AI 的处理要求</label>
                                <textarea class="excel-tool-textarea" id="excel-tool-task" placeholder="例如：把商品资料整理成上架表，标题自然，卖点简洁，价格和规格按源文件填写，缺失字段留空。"></textarea>
                            </div>
                            <div class="excel-tool-grid">
                                <div class="excel-tool-field" style="margin-bottom:0;">
                                    <label for="excel-tool-row-limit">本次生成行数</label>
                                    <input class="excel-tool-input" id="excel-tool-row-limit" type="number" min="1" max="200" value="30">
                                </div>
                                <div class="excel-tool-field" style="margin-bottom:0;">
                                    <label for="excel-tool-start-row">模板写入起始行</label>
                                    <input class="excel-tool-input" id="excel-tool-start-row" type="number" min="1" value="2">
                                </div>
                            </div>
                            <div style="margin-top:14px;">
                                <button class="top-btn top-btn-primary excel-tool-main-btn" id="excel-tool-generate-btn" type="button">
                                    <span class="material-symbols-outlined">auto_awesome</span>
                                    <span id="excel-tool-generate-text">生成并预览表格</span>
                                </button>
                            </div>
                        </section>
                        <section class="excel-tool-panel">
                            <h3><span class="material-symbols-outlined">terminal</span> 运行日志</h3>
                            <div class="excel-tool-progress" id="excel-tool-progress">
                                <div class="excel-tool-progress-meta">
                                    <span id="excel-tool-progress-label">待开始</span>
                                    <span id="excel-tool-progress-value">0%</span>
                                </div>
                                <div class="excel-tool-progress-track">
                                    <div class="excel-tool-progress-fill" id="excel-tool-progress-fill"></div>
                                </div>
                            </div>
                            <div class="excel-tool-log" id="excel-tool-log">等待任务开始</div>
                        </section>
                    </div>
                    <div class="excel-tool-stack">
                        <section class="excel-tool-panel">
                            <h3><span class="material-symbols-outlined">schema</span> 模板字段</h3>
                            <div class="excel-tool-chip-row" id="excel-tool-template-fields"></div>
                        </section>
                        <section class="excel-tool-panel">
                            <h3><span class="material-symbols-outlined">preview</span> 源资料预览</h3>
                            <div id="excel-tool-source-preview" class="excel-tool-empty">上传源资料后在这里预览</div>
                            <div class="excel-tool-image-grid" id="excel-tool-image-preview" style="margin-top:10px;"></div>
                        </section>
                        <section class="excel-tool-panel">
                            <div class="excel-tool-result-meta">
                                <h3 style="margin:0;"><span class="material-symbols-outlined">fact_check</span> 生成结果</h3>
                                <div class="excel-tool-actions">
                                    <button class="top-btn" id="excel-tool-copy-btn" type="button">
                                        <span class="material-symbols-outlined">content_copy</span>
                                        复制 JSON
                                    </button>
                                    <button class="top-btn top-btn-primary" id="excel-tool-export-btn" type="button">
                                        <span class="material-symbols-outlined">download</span>
                                        导出 Excel
                                    </button>
                                </div>
                            </div>
                            <div id="excel-tool-result-preview" class="excel-tool-empty">AI 生成后在这里显示结果表格</div>
                        </section>
                    </div>
                </div>
                <div class="excel-tool-settings">
                    <section class="excel-tool-panel">
                        <h3><span class="material-symbols-outlined">hub</span> 大模型接口配置</h3>
                        <div class="excel-tool-grid">
                            <div class="excel-tool-field">
                                <label for="excel-tool-provider-name">通道名称</label>
                                <input class="excel-tool-input" id="excel-tool-provider-name" type="text">
                            </div>
                            <div class="excel-tool-field">
                                <label for="excel-tool-api-url">API Base URL</label>
                                <input class="excel-tool-input" id="excel-tool-api-url" type="text" placeholder="https://api.openai.com/v1">
                            </div>
                            <div class="excel-tool-field">
                                <label for="excel-tool-model-name">模型名称</label>
                                <input class="excel-tool-input" id="excel-tool-model-name" type="text" placeholder="gpt-4o-mini">
                            </div>
                            <div class="excel-tool-field">
                                <label for="excel-tool-api-key">API Key</label>
                                <input class="excel-tool-input" id="excel-tool-api-key" type="password">
                            </div>
                            <div class="excel-tool-field">
                                <label for="excel-tool-temperature">Temperature</label>
                                <input class="excel-tool-input" id="excel-tool-temperature" type="number" min="0" max="1" step="0.1">
                            </div>
                            <div class="excel-tool-field">
                                <label for="excel-tool-default-rows">默认生成行数</label>
                                <input class="excel-tool-input" id="excel-tool-default-rows" type="number" min="1" max="200">
                            </div>
                        </div>
                    </section>
                    <section class="excel-tool-panel">
                        <h3><span class="material-symbols-outlined">psychology</span> 前置提示词</h3>
                        <div class="excel-tool-field" style="margin-bottom:0;">
                            <label for="excel-tool-system-prompt">可直接更改：Excel 处理规则</label>
                            <textarea class="excel-tool-textarea" id="excel-tool-system-prompt"></textarea>
                        </div>
                    </section>
                    <div class="excel-tool-settings-actions">
                        <button class="top-btn" id="excel-tool-settings-cancel" type="button">取消</button>
                        <button class="top-btn top-btn-primary" id="excel-tool-settings-save" type="button">保存设置</button>
                    </div>
                </div>
            </div>
        `;
        modal.addEventListener('click', close);
        document.body.appendChild(modal);

        const toast = document.createElement('div');
        toast.id = 'excel-tool-toast';
        toast.className = 'excel-tool-toast';
        document.body.appendChild(toast);
    }

    function bindEvents() {
        byId('excel-tool-close-btn').addEventListener('click', close);
        byId('excel-tool-reset-btn').addEventListener('click', resetTool);
        byId('excel-tool-generate-btn').addEventListener('click', generateRows);
        byId('excel-tool-export-btn').addEventListener('click', exportWorkbook);
        byId('excel-tool-copy-btn').addEventListener('click', copyJson);
        byId('excel-tool-settings-save').addEventListener('click', saveSettings);
        byId('excel-tool-settings-cancel').addEventListener('click', () => {
            loadSettings();
            setLayer('work');
        });
        document.querySelectorAll('[data-excel-layer]').forEach((button) => {
            button.addEventListener('click', () => setLayer(button.dataset.excelLayer || 'work'));
        });
        bindDrop('excel-tool-source-drop', 'excel-tool-source-input', handleSourceFiles);
        bindDrop('excel-tool-template-drop', 'excel-tool-template-input', handleTemplateFile);
    }

    function bindDrop(dropId, inputId, handler) {
        const drop = byId(dropId);
        const input = byId(inputId);
        input.addEventListener('change', (event) => {
            handler(event.target.files);
            event.target.value = '';
        });
        drop.addEventListener('dragover', (event) => {
            event.preventDefault();
            drop.classList.add('is-drag');
        });
        drop.addEventListener('dragleave', () => drop.classList.remove('is-drag'));
        drop.addEventListener('drop', (event) => {
            event.preventDefault();
            drop.classList.remove('is-drag');
            if (event.dataTransfer && event.dataTransfer.files) handler(event.dataTransfer.files);
        });
    }

    function init() {
        if (initialized) return;
        ensureStyles();
        ensureShell();
        loadSettings();
        bindEvents();
        renderAll();
        initialized = true;
    }

    function open() {
        init();
        byId('excel-tool-modal').classList.add('show');
    }

    function close() {
        const modal = byId('excel-tool-modal');
        if (modal) modal.classList.remove('show');
    }

    function setLayer(layer) {
        activeLayer = layer === 'settings' ? 'settings' : 'work';
        const shell = document.querySelector('.excel-tool-shell');
        if (shell) shell.dataset.layer = activeLayer;
        document.querySelectorAll('[data-excel-layer]').forEach((button) => {
            button.classList.toggle('active', button.dataset.excelLayer === activeLayer);
        });
        if (activeLayer === 'settings') loadSettings();
    }

    function loadSettings() {
        const saved = safeJsonParse(window.localStorage && window.localStorage.getItem(SETTINGS_KEY), null);
        settings = saved && typeof saved === 'object' ? { ...defaultSettings, ...saved } : { ...defaultSettings };
        settings.temperature = clampNumber(settings.temperature, 0, 1, defaultSettings.temperature);
        settings.maxRows = clampNumber(settings.maxRows, 1, 200, defaultSettings.maxRows);
        const map = {
            'excel-tool-provider-name': settings.providerName,
            'excel-tool-api-url': settings.apiBaseUrl,
            'excel-tool-api-key': settings.apiKey,
            'excel-tool-model-name': settings.modelName,
            'excel-tool-temperature': settings.temperature,
            'excel-tool-default-rows': settings.maxRows,
            'excel-tool-system-prompt': settings.systemPrompt
        };
        Object.entries(map).forEach(([id, value]) => {
            const el = byId(id);
            if (el) el.value = value == null ? '' : String(value);
        });
        const rowLimit = byId('excel-tool-row-limit');
        if (rowLimit && !rowLimit.dataset.userTouched) rowLimit.value = String(settings.maxRows);
    }

    function saveSettings() {
        settings.providerName = byId('excel-tool-provider-name').value.trim() || defaultSettings.providerName;
        settings.apiBaseUrl = normalizeBaseUrl(byId('excel-tool-api-url').value);
        settings.apiKey = byId('excel-tool-api-key').value.trim();
        settings.modelName = byId('excel-tool-model-name').value.trim() || defaultSettings.modelName;
        settings.temperature = clampNumber(byId('excel-tool-temperature').value, 0, 1, defaultSettings.temperature);
        settings.maxRows = clampNumber(byId('excel-tool-default-rows').value, 1, 200, defaultSettings.maxRows);
        settings.systemPrompt = byId('excel-tool-system-prompt').value.trim() || defaultSettings.systemPrompt;
        try {
            window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        } catch (err) {}
        const rowLimit = byId('excel-tool-row-limit');
        if (rowLimit && !rowLimit.dataset.userTouched) rowLimit.value = String(settings.maxRows);
        setLayer('work');
        showToast('Excel 工具设置已保存');
    }

    function showToast(message, isError = false) {
        const toast = byId('excel-tool-toast');
        if (!toast) return;
        toast.textContent = message;
        toast.className = `excel-tool-toast show${isError ? ' error' : ''}`;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toast.className = 'excel-tool-toast';
        }, 2600);
    }

    function log(message) {
        const el = byId('excel-tool-log');
        if (!el) return;
        const time = new Date().toLocaleTimeString();
        const line = document.createElement('div');
        line.textContent = `[${time}] ${message}`;
        if (el.textContent === '等待任务开始') el.innerHTML = '';
        el.appendChild(line);
        el.scrollTop = el.scrollHeight;
    }

    function setProgress(percent, label) {
        const box = byId('excel-tool-progress');
        const fill = byId('excel-tool-progress-fill');
        const value = byId('excel-tool-progress-value');
        const text = byId('excel-tool-progress-label');
        const next = Math.round(Math.min(100, Math.max(0, Number(percent) || 0)));
        if (box) box.classList.add('show');
        if (fill) fill.style.width = `${next}%`;
        if (value) value.textContent = `${next}%`;
        if (text) text.textContent = label || '运行中';
    }

    function setRunning(running) {
        isRunning = running;
        const btn = byId('excel-tool-generate-btn');
        const text = byId('excel-tool-generate-text');
        if (btn) btn.disabled = running;
        if (text) text.textContent = running ? '正在生成...' : '生成并预览表格';
    }

    async function loadScriptOnce(url, globalName) {
        if (globalName && window[globalName]) return true;
        const existing = Array.from(document.scripts).find((script) => script.src === url);
        if (existing) {
            await new Promise((resolve, reject) => {
                existing.addEventListener('load', resolve, { once: true });
                existing.addEventListener('error', reject, { once: true });
                if (globalName && window[globalName]) resolve();
            });
            return !!(!globalName || window[globalName]);
        }
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.async = true;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
        return !!(!globalName || window[globalName]);
    }

    async function ensureSpreadsheetLibs() {
        if (!window.XLSX) await loadScriptOnce(SHEETJS_CDN, 'XLSX');
        if (!window.ExcelJS) {
            try {
                await loadScriptOnce(EXCELJS_CDN, 'ExcelJS');
            } catch (err) {
                log('ExcelJS 加载失败，将使用轻量导出模式');
            }
        }
        if (!window.XLSX) throw new Error('表格解析库加载失败，请检查网络后重试');
    }

    function readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    function readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function extractRowsFromSheet(sheet) {
        const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        return rows.map((row) => row.map((cell) => String(cell == null ? '' : cell).trim()));
    }

    function findHeaderRow(rows) {
        let bestIndex = 0;
        let bestCount = 0;
        rows.forEach((row, index) => {
            const count = row.filter(Boolean).length;
            if (count > bestCount) {
                bestCount = count;
                bestIndex = index;
            }
        });
        return bestIndex;
    }

    function rowsToObjects(rows, limit = MAX_SOURCE_ROWS) {
        if (!Array.isArray(rows) || rows.length === 0) return { headers: [], data: [] };
        const headerIndex = findHeaderRow(rows);
        const headers = rows[headerIndex].map((value, index) => value || `Column ${index + 1}`);
        const data = rows.slice(headerIndex + 1)
            .filter((row) => row.some(Boolean))
            .slice(0, limit)
            .map((row) => {
                const item = {};
                headers.forEach((header, index) => {
                    item[header] = row[index] || '';
                });
                return item;
            });
        return { headers, data };
    }

    async function parseSpreadsheetFile(file) {
        await ensureSpreadsheetLibs();
        const buffer = await readFileAsArrayBuffer(file);
        const workbook = window.XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) return { headers: [], data: [], rows: [] };
        const rows = extractRowsFromSheet(workbook.Sheets[firstSheetName]);
        const parsed = rowsToObjects(rows, MAX_SOURCE_ROWS);
        return { ...parsed, rows, sheetName: firstSheetName, buffer };
    }

    async function handleSourceFiles(fileList) {
        const files = Array.from(fileList || []);
        if (!files.length) return;
        setProgress(8, '读取源资料');
        try {
            await ensureSpreadsheetLibs();
            sourceFiles = files;
            sourceRows = [];
            sourceHeaders = [];
            sourceImages = [];
            for (const file of files) {
                if (file.type && file.type.startsWith('image/')) {
                    if (sourceImages.length < MAX_IMAGE_REFS) {
                        sourceImages.push({ name: file.name, type: file.type, dataUrl: await readFileAsDataUrl(file) });
                    }
                    continue;
                }
                const parsed = await parseSpreadsheetFile(file);
                if (!sourceHeaders.length) sourceHeaders = parsed.headers;
                sourceRows.push(...parsed.data);
            }
            generatedRows = [];
            renderAll();
            log(`源资料读取完成：${sourceRows.length} 行，${sourceImages.length} 张图片参考`);
            setProgress(18, '源资料已就绪');
        } catch (error) {
            console.error(error);
            showToast(error.message || '源资料解析失败', true);
            log(`源资料解析失败：${error.message || error}`);
        }
    }

    async function handleTemplateFile(fileList) {
        const file = Array.from(fileList || [])[0];
        if (!file) return;
        setProgress(8, '读取目标模板');
        try {
            await ensureSpreadsheetLibs();
            templateFile = file;
            const parsed = await parseSpreadsheetFile(file);
            templateBuffer = parsed.buffer || await readFileAsArrayBuffer(file);
            const rows = parsed.rows || [];
            const headerIndex = findHeaderRow(rows);
            templateHeaderRowIndex = headerIndex + 1;
            templateHeaders = rows[headerIndex]
                .map((value, index) => String(value || '').trim() || `Column ${index + 1}`)
                .filter(Boolean);
            templateSheetName = parsed.sheetName || 'Sheet1';
            const startRow = byId('excel-tool-start-row');
            if (startRow) startRow.value = String(templateHeaderRowIndex + 1);
            generatedRows = [];
            renderAll();
            log(`模板读取完成：${templateHeaders.length} 个字段，工作表 ${templateSheetName}`);
            setProgress(20, '模板已就绪');
        } catch (error) {
            console.error(error);
            showToast(error.message || '模板解析失败', true);
            log(`模板解析失败：${error.message || error}`);
        }
    }

    function renderAll() {
        renderFileLists();
        renderTemplateFields();
        renderSourcePreview();
        renderResultPreview();
    }

    function renderFileLists() {
        const sourceList = byId('excel-tool-source-list');
        if (sourceList) {
            sourceList.innerHTML = sourceFiles.length
                ? sourceFiles.map((file) => `<div>${escapeHtml(file.name)} · ${Math.round(file.size / 1024)} KB</div>`).join('')
                : '尚未上传源资料';
        }
        const templateList = byId('excel-tool-template-list');
        if (templateList) {
            templateList.innerHTML = templateFile
                ? `<div>${escapeHtml(templateFile.name)} · 表头行 ${templateHeaderRowIndex}</div>`
                : '尚未上传目标模板';
        }
    }

    function renderTemplateFields() {
        const box = byId('excel-tool-template-fields');
        if (!box) return;
        box.innerHTML = templateHeaders.length
            ? templateHeaders.map((header) => `<span class="excel-tool-chip">${escapeHtml(header)}</span>`).join('')
            : '<span class="excel-tool-chip">等待目标模板</span>';
    }

    function renderTable(targetId, rows, fallback) {
        const target = byId(targetId);
        if (!target) return;
        if (!Array.isArray(rows) || rows.length === 0) {
            target.className = 'excel-tool-empty';
            target.innerHTML = fallback;
            return;
        }
        const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row || {})))).slice(0, 24);
        target.className = 'excel-tool-preview-shell';
        target.innerHTML = `
            <table class="excel-tool-table">
                <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
                <tbody>
                    ${rows.slice(0, 12).map((row) => `
                        <tr>${headers.map((header) => `<td>${escapeHtml(row && row[header] != null ? row[header] : '')}</td>`).join('')}</tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    function renderSourcePreview() {
        renderTable('excel-tool-source-preview', sourceRows, '上传源资料后在这里预览');
        const imageBox = byId('excel-tool-image-preview');
        if (!imageBox) return;
        imageBox.innerHTML = sourceImages.map((image) => `
            <div class="excel-tool-image-thumb" title="${escapeHtml(image.name)}">
                <img src="${escapeHtml(image.dataUrl)}" alt="${escapeHtml(image.name)}">
            </div>
        `).join('');
    }

    function renderResultPreview() {
        renderTable('excel-tool-result-preview', generatedRows, 'AI 生成后在这里显示结果表格');
    }

    function buildModelPrompt() {
        const rowLimit = clampNumber(byId('excel-tool-row-limit').value, 1, 200, settings.maxRows);
        const userTask = byId('excel-tool-task').value.trim() || '请将源资料整理并映射到目标模板字段。';
        return [
            '请根据以下信息生成目标 Excel 行数据。',
            '',
            `处理要求：${userTask}`,
            `本次最多生成 ${rowLimit} 行。`,
            '',
            `目标模板工作表：${templateSheetName || 'Sheet1'}`,
            `目标模板字段：${JSON.stringify(templateHeaders, null, 2)}`,
            '',
            `源表头：${JSON.stringify(sourceHeaders, null, 2)}`,
            `源数据样例：${JSON.stringify(sourceRows.slice(0, Math.min(sourceRows.length, MAX_SOURCE_ROWS)), null, 2)}`,
            '',
            '输出要求：',
            '1. 只返回 JSON，不要 Markdown。',
            '2. JSON 格式必须是 {"rows":[{...}]}。',
            '3. rows 中每个对象的 key 必须来自目标模板字段。',
            '4. 无法确认的字段留空字符串，不要臆造。',
            '5. 如果源资料是图片，请结合图片内容填充可判断字段。'
        ].join('\n');
    }

    function buildMessages() {
        const content = [{ type: 'text', text: buildModelPrompt() }];
        sourceImages.slice(0, MAX_IMAGE_REFS).forEach((image) => {
            content.push({ type: 'image_url', image_url: { url: image.dataUrl } });
        });
        return [
            { role: 'system', content: settings.systemPrompt },
            { role: 'user', content }
        ];
    }

    async function generateRows() {
        if (isRunning) return;
        loadSettings();
        if (!settings.apiKey) {
            showToast('请先在设置层填写大模型 API Key', true);
            setLayer('settings');
            return;
        }
        if (!templateHeaders.length) {
            showToast('请先上传目标模板', true);
            return;
        }
        if (!sourceRows.length && !sourceImages.length) {
            showToast('请先上传源资料', true);
            return;
        }
        setRunning(true);
        setProgress(25, '准备模型请求');
        log(`开始调用 ${settings.providerName} / ${settings.modelName}`);
        try {
            const response = await fetch(getChatCompletionsUrl(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${settings.apiKey}`
                },
                body: JSON.stringify({
                    model: settings.modelName,
                    messages: buildMessages(),
                    temperature: settings.temperature,
                    response_format: { type: 'json_object' }
                })
            });
            setProgress(65, '等待模型返回');
            const text = await response.text();
            lastRawResponse = text;
            if (!response.ok) {
                throw new Error(`模型接口错误 ${response.status}: ${text.slice(0, 180)}`);
            }
            const data = safeJsonParse(text, null);
            const content = data && data.choices && data.choices[0] && data.choices[0].message
                ? data.choices[0].message.content
                : text;
            const parsed = parseRowsFromModel(content);
            generatedRows = normalizeGeneratedRows(parsed.rows || parsed, templateHeaders);
            if (!generatedRows.length) throw new Error('模型没有返回有效 rows 数据');
            renderResultPreview();
            setProgress(100, '生成完成');
            log(`生成完成：${generatedRows.length} 行`);
            showToast('表格结果已生成');
        } catch (error) {
            console.error(error);
            setProgress(100, '生成失败');
            log(`生成失败：${error.message || error}`);
            showToast(error.message || '生成失败', true);
        } finally {
            setRunning(false);
        }
    }

    function parseRowsFromModel(content) {
        if (content && typeof content === 'object') return content;
        let text = String(content || '').trim();
        text = text.replace(/^```json/mi, '').replace(/^```/mi, '').replace(/```$/mi, '').trim();
        let parsed = safeJsonParse(text, null);
        if (parsed) return parsed;
        const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        parsed = match ? safeJsonParse(match[0], null) : null;
        if (!parsed) throw new Error('模型返回内容不是有效 JSON');
        return parsed;
    }

    function normalizeGeneratedRows(rows, headers) {
        const source = Array.isArray(rows) ? rows : [];
        return source.map((row) => {
            const item = {};
            headers.forEach((header) => {
                const value = row && Object.prototype.hasOwnProperty.call(row, header) ? row[header] : '';
                item[header] = value == null ? '' : String(value);
            });
            return item;
        }).filter((row) => Object.values(row).some((value) => String(value || '').trim()));
    }

    async function exportWorkbook() {
        if (!generatedRows.length) {
            showToast('暂无可导出的生成结果', true);
            return;
        }
        setProgress(88, '写入 Excel');
        try {
            const filename = buildExportFilename();
            let blob;
            if (window.ExcelJS && templateBuffer && templateFile && /\.xlsx$/i.test(templateFile.name)) {
                blob = await exportWithExcelJs();
            } else {
                blob = exportWithSheetJs();
            }
            downloadBlob(filename, blob);
            setProgress(100, '导出完成');
            showToast('Excel 已导出');
        } catch (error) {
            console.error(error);
            log(`导出失败：${error.message || error}`);
            showToast('导出失败，已尝试轻量模式', true);
            try {
                downloadBlob(buildExportFilename(), exportWithSheetJs());
            } catch (fallbackError) {
                showToast(fallbackError.message || '导出失败', true);
            }
        }
    }

    async function exportWithExcelJs() {
        const workbook = new window.ExcelJS.Workbook();
        await workbook.xlsx.load(templateBuffer.slice(0));
        const worksheet = workbook.getWorksheet(templateSheetName) || workbook.worksheets[0];
        const startRow = clampNumber(byId('excel-tool-start-row').value, 1, 100000, templateHeaderRowIndex + 1);
        generatedRows.forEach((row, rowIndex) => {
            const targetRow = worksheet.getRow(startRow + rowIndex);
            templateHeaders.forEach((header, colIndex) => {
                targetRow.getCell(colIndex + 1).value = row[header] || '';
            });
            targetRow.commit();
        });
        const buffer = await workbook.xlsx.writeBuffer();
        return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }

    function exportWithSheetJs() {
        if (!window.XLSX) throw new Error('缺少表格导出库');
        const aoa = [templateHeaders, ...generatedRows.map((row) => templateHeaders.map((header) => row[header] || ''))];
        const sheet = window.XLSX.utils.aoa_to_sheet(aoa);
        const workbook = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(workbook, sheet, templateSheetName || 'Sheet1');
        const array = window.XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        return new Blob([array], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }

    function buildExportFilename() {
        const date = new Date();
        const stamp = [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, '0'),
            String(date.getDate()).padStart(2, '0')
        ].join('-');
        const base = templateFile ? templateFile.name.replace(/\.[^.]+$/, '') : 'excel-output';
        return `${base}-${stamp}-ai-filled.xlsx`;
    }

    function downloadBlob(filename, blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1200);
    }

    async function copyJson() {
        if (!generatedRows.length) {
            showToast('暂无 JSON 可复制', true);
            return;
        }
        const text = JSON.stringify({ rows: generatedRows }, null, 2);
        try {
            if (window.navigator.clipboard && window.isSecureContext) {
                await window.navigator.clipboard.writeText(text);
            } else {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                textarea.remove();
            }
            showToast('JSON 已复制');
        } catch (error) {
            showToast('复制失败', true);
        }
    }

    function resetTool() {
        sourceFiles = [];
        sourceRows = [];
        sourceHeaders = [];
        sourceImages = [];
        templateFile = null;
        templateBuffer = null;
        templateHeaders = [];
        templateSheetName = '';
        templateHeaderRowIndex = 1;
        generatedRows = [];
        lastRawResponse = '';
        const logEl = byId('excel-tool-log');
        if (logEl) logEl.textContent = '等待任务开始';
        setProgress(0, '待开始');
        const progress = byId('excel-tool-progress');
        if (progress) progress.classList.remove('show');
        renderAll();
        showToast('Excel 工具已清空');
    }

    window.openExcelTool = open;
    window.closeExcelTool = close;
    window.VeoExcelTool = {
        open,
        close,
        init,
        getSettings: () => ({ ...settings }),
        getRows: () => generatedRows.map((row) => ({ ...row })),
        getRawResponse: () => lastRawResponse
    };
})(window, document);

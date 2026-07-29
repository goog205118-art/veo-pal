(function (window, document) {
    'use strict';

    const SETTINGS_KEY = 'veoOfficeCliExcelToolSettings';
    const LAST_PLAN_KEY = 'veoOfficeCliExcelLastPlan';
    const FRONTEND_VERSION = '0.1.0';

    const DEFAULT_SYSTEM_PROMPT = [
        '你是 OfficeCLI Excel 操作规划器。',
        '你的目标不是直接改表格，而是把用户的自然语言需求转成 OfficeCLI 本地命令计划，让一个不懂表格操作的 LLM 也能通过本地工具读写 Excel / CSV 文件。',
        '必须只输出 JSON，不要输出 Markdown。',
        '命令计划必须使用 argv 数组，不允许输出 shell 字符串。',
        'argv 不要包含 officecli 本体，只写 officecli 后面的参数。',
        '使用 $file 作为当前上传或选择的表格文件占位符。',
        '建议流程：inspect / get / query 先理解文件，再 set / add / remove / batch 修改，最后 validate 和 view html 预览。',
        '如果用户任务不明确，生成只读 inspect + get + validate 计划，并在 notes 里说明需要补充的信息。',
        'JSON 结构：',
        '{"goal":"","file":"$file","summary":"","commands":[{"id":"inspect","title":"读取工作簿结构","op":"workbook.inspect","argv":["view","$file","--format","json"],"mutates":false,"explain":""}],"safety":{"writesFile":false,"requiresConfirmation":true},"expectedOutputs":["htmlPreview","logs"],"notes":[]}',
        '可用能力参考：create, view html, get workbook/sheet/range, query table, set cell/range/style, add row/column/sheet/chart, remove row/column/sheet, batch, validate, watch/view html。',
        '如需写入文件，优先生成备份/输出文件参数，不要覆盖原文件，除非用户明确要求。'
    ].join('\n');

    const defaultSettings = {
        apiBaseUrl: '',
        apiKey: '',
        model: 'gpt-4.1-mini',
        bridgeUrl: 'http://127.0.0.1:8765/officecli',
        assistantProtocol: 'wally-office://start',
        cliCommand: 'officecli',
        workspaceDir: '',
        dryRun: true,
        requireConfirmation: true,
        requestTimeoutMs: 120000,
        systemPrompt: DEFAULT_SYSTEM_PROMPT
    };

    const examples = [
        {
            title: '先理解表格结构',
            text: '读取这个 Excel 的所有 sheet、表头、前 20 行数据，并生成 HTML 预览。'
        },
        {
            title: '跨境商品表清洗',
            text: '检查商品表里的 SKU、国家、价格、币种和库存字段，找出缺失项、价格格式不一致和重复 SKU，不直接修改文件。'
        },
        {
            title: '批量改价',
            text: '把 Sheet1 中 US 站点的价格统一上调 8%，保留两位小数，生成一个新的输出文件，并给出修改记录。'
        },
        {
            title: '生成本地预览',
            text: '把当前表格转换成可预览的 html，同时检查公式、空行、异常单元格和字段命名问题。'
        }
    ];

    let settings = { ...defaultSettings };
    let state = {
        layer: 'work',
        file: null,
        fileDataUrl: '',
        fileMeta: null,
        instruction: '',
        plan: null,
        result: null,
        logs: [],
        busy: false,
        bridgeStatus: 'unknown',
        assistant: null
    };

    const byId = (id) => document.getElementById(id);

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function safeJsonParse(value, fallback) {
        try {
            return JSON.parse(value);
        } catch (error) {
            return fallback;
        }
    }

    function compareVersion(left = '0.0.0', right = '0.0.0') {
        const a = String(left).split('.').map((part) => Number(part) || 0);
        const b = String(right).split('.').map((part) => Number(part) || 0);
        for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
            const diff = (a[index] || 0) - (b[index] || 0);
            if (diff) return diff;
        }
        return 0;
    }

    function isFrontendCompatible(minVersion) {
        return !minVersion || compareVersion(FRONTEND_VERSION, minVersion) >= 0;
    }

    function loadSettings() {
        settings = {
            ...defaultSettings,
            ...safeJsonParse(localStorage.getItem(SETTINGS_KEY) || '{}', {})
        };
        const lastPlan = safeJsonParse(localStorage.getItem(LAST_PLAN_KEY) || 'null', null);
        if (lastPlan && Array.isArray(lastPlan.commands)) {
            state.plan = lastPlan;
        }
    }

    function saveSettingsFromForm() {
        settings = {
            apiBaseUrl: byId('officecli-api-base').value.trim(),
            apiKey: byId('officecli-api-key').value.trim(),
            model: byId('officecli-model').value.trim() || defaultSettings.model,
            bridgeUrl: byId('officecli-bridge-url').value.trim() || defaultSettings.bridgeUrl,
            assistantProtocol: byId('officecli-assistant-protocol')?.value.trim() || settings.assistantProtocol || defaultSettings.assistantProtocol,
            cliCommand: byId('officecli-cli-command').value.trim() || defaultSettings.cliCommand,
            workspaceDir: byId('officecli-workspace-dir').value.trim() || defaultSettings.workspaceDir,
            dryRun: byId('officecli-dry-run').checked,
            requireConfirmation: byId('officecli-require-confirm').checked,
            requestTimeoutMs: Number(byId('officecli-timeout-ms').value) || defaultSettings.requestTimeoutMs,
            systemPrompt: byId('officecli-system-prompt').value.trim() || DEFAULT_SYSTEM_PROMPT
        };
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        toast('OfficeCLI 设置已保存');
    }

    function resetSettings() {
        settings = { ...defaultSettings };
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        render();
        toast('已恢复默认设置');
    }

    function addLog(message, type = 'info') {
        const stamp = new Date().toLocaleTimeString();
        state.logs.unshift({ stamp, message, type });
        renderLogs();
    }

    function toast(message) {
        const existing = document.querySelector('.officecli-toast');
        if (existing) existing.remove();
        const node = document.createElement('div');
        node.className = 'officecli-toast';
        node.textContent = message;
        document.body.appendChild(node);
        setTimeout(() => node.remove(), 2400);
    }

    function readAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function commandCount(plan) {
        return Array.isArray(plan?.commands) ? plan.commands.length : 0;
    }

    function planWrites(plan) {
        if (!plan) return false;
        if (plan.safety?.writesFile) return true;
        return (plan.commands || []).some((command) => command.mutates === true);
    }

    function normalizePlan(rawPlan) {
        const plan = rawPlan && typeof rawPlan === 'object' ? rawPlan : {};
        const commands = Array.isArray(plan.commands) ? plan.commands : [];
        return {
            goal: String(plan.goal || state.instruction || 'OfficeCLI Excel 任务'),
            file: plan.file || '$file',
            summary: String(plan.summary || '已生成 OfficeCLI 命令计划。'),
            commands: commands.map((command, index) => ({
                id: String(command.id || `cmd_${index + 1}`),
                title: String(command.title || command.op || `步骤 ${index + 1}`),
                op: String(command.op || 'officecli.command'),
                argv: Array.isArray(command.argv) ? command.argv.map((item) => String(item)) : [],
                mutates: Boolean(command.mutates),
                explain: String(command.explain || '')
            })).filter((command) => command.argv.length),
            safety: {
                writesFile: Boolean(plan.safety?.writesFile || commands.some((command) => command.mutates)),
                requiresConfirmation: plan.safety?.requiresConfirmation !== false
            },
            expectedOutputs: Array.isArray(plan.expectedOutputs) ? plan.expectedOutputs : ['logs', 'htmlPreview'],
            notes: Array.isArray(plan.notes) ? plan.notes.map((item) => String(item)) : []
        };
    }

    function extractJson(text) {
        const raw = String(text || '').trim();
        if (!raw) throw new Error('模型返回为空');
        const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
        const source = fenced ? fenced[1].trim() : raw;
        try {
            return JSON.parse(source);
        } catch (firstError) {
            const first = source.indexOf('{');
            const last = source.lastIndexOf('}');
            if (first >= 0 && last > first) {
                return JSON.parse(source.slice(first, last + 1));
            }
            throw firstError;
        }
    }

    function buildUserPrompt() {
        const meta = state.fileMeta || {};
        return [
            '请根据下面信息生成 OfficeCLI Excel 命令计划。',
            '',
            `用户任务：${state.instruction || '读取表格结构并生成预览。'}`,
            `当前文件：${meta.name || '$file'}`,
            `文件类型：${meta.type || 'unknown'}`,
            `文件大小：${meta.size ? `${Math.round(meta.size / 1024)} KB` : 'unknown'}`,
            '',
            '要求：',
            '1. 只输出 JSON。',
            '2. commands[].argv 必须是参数数组，不要写 shell 字符串。',
            '3. 对当前文件统一使用 $file 占位符。',
            '4. 如果需要写入，尽量生成新文件或输出副本。',
            '5. 计划中必须包含解释性 title / explain，方便前端展示给用户确认。'
        ].join('\n');
    }

    async function callPlannerModel() {
        if (!settings.apiBaseUrl || !settings.apiKey) {
            throw new Error('请先在设置层填写大模型 API Base URL 和 API Key');
        }
        const url = settings.apiBaseUrl.replace(/\/+$/, '') + '/chat/completions';
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), settings.requestTimeoutMs);
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${settings.apiKey}`
                },
                body: JSON.stringify({
                    model: settings.model,
                    temperature: 0.1,
                    messages: [
                        { role: 'system', content: settings.systemPrompt || DEFAULT_SYSTEM_PROMPT },
                        { role: 'user', content: buildUserPrompt() }
                    ]
                }),
                signal: controller.signal
            });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`模型规划失败：${response.status} ${text.slice(0, 160)}`);
            }
            const data = await response.json();
            const content = data?.choices?.[0]?.message?.content || '';
            return normalizePlan(extractJson(content));
        } finally {
            clearTimeout(timer);
        }
    }

    function createLocalReadPlan() {
        return normalizePlan({
            goal: state.instruction || '读取工作簿结构',
            file: '$file',
            summary: '未配置模型时生成的只读示例计划。配置模型后可按自然语言生成真实操作计划。',
            commands: [
                {
                    id: 'view_json',
                    title: '读取工作簿结构',
                    op: 'workbook.view',
                    argv: ['view', '$file', '--format', 'json'],
                    mutates: false,
                    explain: '查看 sheet、表头和基础结构，帮助模型理解表格。'
                },
                {
                    id: 'validate',
                    title: '校验表格',
                    op: 'workbook.validate',
                    argv: ['validate', '$file'],
                    mutates: false,
                    explain: '检查文件结构、异常单元格和潜在格式问题。'
                },
                {
                    id: 'html_preview',
                    title: '生成 HTML 预览',
                    op: 'workbook.viewHtml',
                    argv: ['view', '$file', '--format', 'html'],
                    mutates: false,
                    explain: '返回浏览器可展示的表格预览。'
                }
            ],
            safety: { writesFile: false, requiresConfirmation: true },
            expectedOutputs: ['logs', 'htmlPreview'],
            notes: ['这是兜底计划：它只展示 OfficeCLI 结构，不代表已理解用户的复杂修改目标。']
        });
    }

    async function generatePlan() {
        if (state.busy) return;
        state.instruction = byId('officecli-instruction').value.trim();
        if (!state.instruction) {
            toast('先写一个表格操作目标');
            return;
        }
        state.busy = true;
        state.result = null;
        renderBusy('正在让模型生成 OfficeCLI 命令计划...');
        addLog('开始规划 OfficeCLI 命令', 'info');
        try {
            const plan = settings.apiBaseUrl && settings.apiKey ? await callPlannerModel() : createLocalReadPlan();
            state.plan = plan;
            localStorage.setItem(LAST_PLAN_KEY, JSON.stringify(plan));
            addLog(`命令计划生成完成：${commandCount(plan)} 个步骤`, 'success');
            render();
        } catch (error) {
            addLog(error.message, 'error');
            toast(error.message);
            render();
        } finally {
            state.busy = false;
            render();
        }
    }

    async function executePlan() {
        if (state.busy) return;
        if (!state.plan || !commandCount(state.plan)) {
            toast('请先生成命令计划');
            return;
        }
        if (!state.file && !byId('officecli-file-path').value.trim()) {
            toast('请上传文件或填写本地文件路径');
            return;
        }
        let confirmedAt = '';
        if (settings.requireConfirmation && planWrites(state.plan)) {
            const ok = window.confirm('这个 OfficeCLI 计划包含写入动作。确认交给本地桥执行吗？');
            if (!ok) return;
            confirmedAt = new Date().toISOString();
        }
        state.busy = true;
        state.result = null;
        renderBusy(settings.dryRun ? '正在执行 Dry Run...' : '正在交给本地 OfficeCLI 执行...');
        addLog(settings.dryRun ? 'Dry Run：仅检查命令，不写入文件' : '发送到 OfficeCLI 本地桥', 'info');
        try {
            const body = {
                tool: 'officecli',
                kind: 'excel',
                action: 'execute',
                file: {
                    name: state.fileMeta?.name || '',
                    type: state.fileMeta?.type || '',
                    size: state.fileMeta?.size || 0,
                    dataUrl: state.fileDataUrl || '',
                    path: byId('officecli-file-path').value.trim()
                },
                plan: state.plan,
                options: {
                    dryRun: settings.dryRun,
                    requireConfirmation: settings.requireConfirmation,
                    confirmedAt,
                    frontendVersion: FRONTEND_VERSION,
                    cliCommand: settings.cliCommand,
                    workspaceDir: settings.workspaceDir || undefined,
                    returnHtml: true,
                    validate: true
                }
            };
            const result = await postBridge(body);
            state.result = result;
            addLog(result.success === false ? 'OfficeCLI 执行失败' : 'OfficeCLI 执行完成', result.success === false ? 'error' : 'success');
            render();
        } catch (error) {
            addLog(error.message, 'error');
            toast(error.message);
            render();
        } finally {
            state.busy = false;
            render();
        }
    }

    async function postBridge(body) {
        if (!settings.bridgeUrl) {
            throw new Error('请先填写 OfficeCLI 本地桥地址');
        }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), settings.requestTimeoutMs);
        try {
            const response = await fetch(settings.bridgeUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: controller.signal
            });
            const text = await response.text();
            const data = safeJsonParse(text, { success: false, raw: text });
            if (!response.ok) {
                throw new Error(data.message || `本地桥请求失败：${response.status}`);
            }
            return data;
        } finally {
            clearTimeout(timer);
        }
    }

    async function checkBridge() {
        if (!settings.bridgeUrl) {
            state.bridgeStatus = 'missing';
            state.assistant = null;
            renderBridgeStatus();
            renderAssistantStatus();
            return;
        }
        state.bridgeStatus = 'checking';
        renderBridgeStatus();
        renderAssistantStatus();
        try {
            const data = await findAssistantHealth();
            state.bridgeStatus = data ? 'online' : 'offline';
            state.assistant = data || null;
            if (data?.bridgeUrl && data.bridgeUrl !== settings.bridgeUrl) {
                settings.bridgeUrl = data.bridgeUrl;
                localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
            }
        } catch (error) {
            state.bridgeStatus = 'offline';
            state.assistant = null;
        }
        renderBridgeStatus();
        renderAssistantStatus();
    }

    async function fetchHealth(healthUrl) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 1200);
        try {
            const response = await fetch(healthUrl, { method: 'GET', signal: controller.signal });
            if (!response.ok) return null;
            return await response.json().catch(() => null);
        } catch (error) {
            return null;
        } finally {
            clearTimeout(timer);
        }
    }

    async function findAssistantHealth() {
        const urls = [];
        const configuredHealth = settings.bridgeUrl.replace(/\/officecli\/?$/, '/health');
        urls.push(configuredHealth);
        for (let port = 8765; port < 8785; port += 1) {
            urls.push(`http://127.0.0.1:${port}/health`);
        }
        const uniqueUrls = Array.from(new Set(urls));
        let compatible = null;
        for (const url of uniqueUrls) {
            const data = await fetchHealth(url);
            if (!data) continue;
            if (data.service === 'wally-office-assistant') return data;
            if (!compatible && data.success) {
                const bridgeUrl = data.bridgeUrl || url.replace(/\/health$/, '/officecli');
                compatible = { ...data, bridgeUrl };
            }
        }
        return compatible;
    }

    function launchAssistant() {
        const protocol = settings.assistantProtocol || defaultSettings.assistantProtocol;
        try {
            window.location.href = protocol;
            toast('正在尝试启动桌面助手...');
            setTimeout(checkBridge, 3000);
        } catch (error) {
            toast('无法启动桌面助手，请先安装 Wally Office Assistant');
        }
    }

    async function callAssistantControl(pathname) {
        const baseUrl = settings.bridgeUrl.replace(/\/officecli\/?$/, '');
        const response = await fetch(`${baseUrl}${pathname}`, { method: 'POST' });
        if (!response.ok) throw new Error(`Assistant control failed: ${response.status}`);
        return response.json();
    }

    function renderBusy(message) {
        const node = byId('officecli-busy-text');
        if (node) node.textContent = message;
    }

    function switchLayer(layer) {
        state.layer = layer;
        render();
    }

    function insertExample(index) {
        const item = examples[index];
        if (!item) return;
        const input = byId('officecli-instruction');
        input.value = item.text;
        state.instruction = item.text;
        input.focus();
    }

    async function handleFileChange(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        state.file = file;
        state.fileMeta = { name: file.name, size: file.size, type: file.type };
        state.fileDataUrl = await readAsDataUrl(file);
        addLog(`已载入文件：${file.name}`, 'success');
        renderFileSummary();
    }

    function copyPlan() {
        if (!state.plan) {
            toast('当前没有命令计划');
            return;
        }
        navigator.clipboard.writeText(JSON.stringify(state.plan, null, 2));
        toast('命令计划已复制');
    }

    function clearPlan() {
        state.plan = null;
        state.result = null;
        localStorage.removeItem(LAST_PLAN_KEY);
        addLog('已清空当前命令计划', 'info');
        render();
    }

    function close() {
        const node = byId('officecli-modal');
        if (node) node.remove();
    }

    function render() {
        ensureStyle();
        let modal = byId('officecli-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'officecli-modal';
            modal.className = 'officecli-modal';
            document.body.appendChild(modal);
        }
        modal.innerHTML = `
            <div class="officecli-dialog">
                <header class="officecli-header">
                    <div>
                        <h2><span class="material-symbols-outlined">dataset</span> Office 表格</h2>
                        <p>LLM 生成 OfficeCLI 命令计划，本地桥执行 Excel / CSV 读写、校验和 HTML 预览。</p>
                    </div>
                    <button class="officecli-icon-btn" id="officecli-close" aria-label="关闭">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </header>
                <nav class="officecli-tabs">
                    <button class="${state.layer === 'work' ? 'active' : ''}" id="officecli-work-tab">
                        <span class="material-symbols-outlined">terminal</span> 使用层
                    </button>
                    <button class="${state.layer === 'settings' ? 'active' : ''}" id="officecli-settings-tab">
                        <span class="material-symbols-outlined">tune</span> 设置层
                    </button>
                </nav>
                ${state.layer === 'work' ? renderWorkLayer() : renderSettingsLayer()}
            </div>
        `;
        bindCommon();
        if (state.layer === 'work') bindWorkLayer();
        if (state.layer === 'settings') bindSettingsLayer();
        renderLogs();
        renderBridgeStatus();
        renderFileSummary();
    }

    function renderWorkLayer() {
        return `
            <section class="officecli-body officecli-work">
                <div class="officecli-left">
                    <div class="officecli-panel">
                        <div class="officecli-panel-title">
                            <span class="material-symbols-outlined">description</span>
                            <b>1. 表格文件</b>
                        </div>
                        <div class="officecli-upload-row">
                            <label class="officecli-file-pick">
                                <span class="material-symbols-outlined">upload_file</span>
                                上传 Excel / CSV
                                <input id="officecli-file" type="file" accept=".xlsx,.xls,.csv,.xlsm">
                            </label>
                            <div id="officecli-file-summary" class="officecli-file-summary"></div>
                        </div>
                        <label class="officecli-field">
                            <span>或填写本地文件路径（本地桥可直接读取）</span>
                            <input id="officecli-file-path" type="text" placeholder="D:\\work\\products.xlsx">
                        </label>
                    </div>

                    <div class="officecli-panel">
                        <div class="officecli-panel-title">
                            <span class="material-symbols-outlined">psychology</span>
                            <b>2. 自然语言任务</b>
                        </div>
                        <textarea id="officecli-instruction" class="officecli-task-input" placeholder="例如：把 US 站点价格上调 8%，输出新文件，并生成修改前后差异预览。">${escapeHtml(state.instruction)}</textarea>
                        <div class="officecli-example-grid">
                            ${examples.map((item, index) => `
                                <button type="button" data-example="${index}">
                                    <b>${escapeHtml(item.title)}</b>
                                    <span>${escapeHtml(item.text)}</span>
                                </button>
                            `).join('')}
                        </div>
                        <div class="officecli-actions">
                            <button class="officecli-primary" id="officecli-generate" ${state.busy ? 'disabled' : ''}>
                                <span class="material-symbols-outlined">auto_awesome</span>
                                生成 OfficeCLI 计划
                            </button>
                            <button class="officecli-secondary" id="officecli-execute" ${state.busy ? 'disabled' : ''}>
                                <span class="material-symbols-outlined">play_arrow</span>
                                执行计划
                            </button>
                            <button class="officecli-secondary" id="officecli-copy-plan">
                                <span class="material-symbols-outlined">content_copy</span>
                                复制 JSON
                            </button>
                            <button class="officecli-ghost" id="officecli-clear-plan">
                                <span class="material-symbols-outlined">delete</span>
                                清空
                            </button>
                        </div>
                        <div id="officecli-busy-text" class="officecli-busy">${state.busy ? '处理中...' : ''}</div>
                    </div>
                </div>

                <div class="officecli-right">
                    <div class="officecli-status-row">
                        <div class="officecli-status-card">
                            <span>本地桥</span>
                            <b id="officecli-bridge-status">检测中</b>
                        </div>
                        <div class="officecli-status-card">
                            <span>模式</span>
                            <b>${settings.dryRun ? 'Dry Run' : '真实执行'}</b>
                        </div>
                        <div class="officecli-status-card">
                            <span>命令数</span>
                            <b>${commandCount(state.plan)}</b>
                        </div>
                    </div>
                    <div class="officecli-panel officecli-plan-panel">
                        <div class="officecli-panel-title">
                            <span class="material-symbols-outlined">account_tree</span>
                            <b>命令计划</b>
                        </div>
                        ${renderPlan()}
                    </div>
                    <div class="officecli-panel officecli-result-panel">
                        <div class="officecli-panel-title">
                            <span class="material-symbols-outlined">preview</span>
                            <b>执行结果 / HTML 预览</b>
                        </div>
                        ${renderResult()}
                    </div>
                    <div class="officecli-panel officecli-log-panel">
                        <div class="officecli-panel-title">
                            <span class="material-symbols-outlined">receipt_long</span>
                            <b>运行日志</b>
                        </div>
                        <div id="officecli-logs" class="officecli-logs"></div>
                    </div>
                </div>
            </section>
        `;
    }

    function renderSettingsLayer() {
        return `
            <section class="officecli-body officecli-settings">
                ${renderAssistantPanel()}
                <div class="officecli-settings-grid">
                    <div class="officecli-panel">
                        <div class="officecli-panel-title">
                            <span class="material-symbols-outlined">smart_toy</span>
                            <b>模型规划器</b>
                        </div>
                        <label class="officecli-field">
                            <span>API Base URL</span>
                            <input id="officecli-api-base" type="text" value="${escapeHtml(settings.apiBaseUrl)}" placeholder="https://api.openai.com/v1">
                        </label>
                        <label class="officecli-field">
                            <span>API Key</span>
                            <input id="officecli-api-key" type="password" value="${escapeHtml(settings.apiKey)}" placeholder="sk-...">
                        </label>
                        <label class="officecli-field">
                            <span>模型名称</span>
                            <input id="officecli-model" type="text" value="${escapeHtml(settings.model)}" placeholder="gpt-4.1-mini">
                        </label>
                        <p class="officecli-help">这里的大模型只负责把任务翻译成 OfficeCLI 命令计划；表格文件读写由本地桥处理。</p>
                    </div>

                    <div class="officecli-panel">
                        <div class="officecli-panel-title">
                            <span class="material-symbols-outlined">dns</span>
                            <b>OfficeCLI 本地桥</b>
                        </div>
                        <label class="officecli-field">
                            <span>桥接地址</span>
                            <input id="officecli-bridge-url" type="text" value="${escapeHtml(settings.bridgeUrl)}">
                        </label>
                        <label class="officecli-field">
                            <span>OfficeCLI 命令</span>
                            <input id="officecli-assistant-protocol" type="hidden" value="${escapeHtml(settings.assistantProtocol || defaultSettings.assistantProtocol)}">
                            <input id="officecli-cli-command" type="text" value="${escapeHtml(settings.cliCommand)}" placeholder="officecli">
                        </label>
                        <label class="officecli-field">
                            <span>工作目录</span>
                            <input id="officecli-workspace-dir" type="text" value="${escapeHtml(settings.workspaceDir)}" placeholder="留空则由桌面助手自动管理">
                        </label>
                        <div class="officecli-switches">
                            <label><input id="officecli-dry-run" type="checkbox" ${settings.dryRun ? 'checked' : ''}> 默认 Dry Run</label>
                            <label><input id="officecli-require-confirm" type="checkbox" ${settings.requireConfirmation ? 'checked' : ''}> 写入前二次确认</label>
                        </div>
                        <label class="officecli-field">
                            <span>请求超时（毫秒）</span>
                            <input id="officecli-timeout-ms" type="number" min="10000" step="1000" value="${escapeHtml(settings.requestTimeoutMs)}">
                        </label>
                    </div>
                </div>

                <div class="officecli-panel officecli-prompt-panel">
                    <div class="officecli-panel-title">
                        <span class="material-symbols-outlined">integration_instructions</span>
                        <b>OfficeCLI Skill 提示词</b>
                    </div>
                    <textarea id="officecli-system-prompt" class="officecli-system-prompt">${escapeHtml(settings.systemPrompt)}</textarea>
                    <div class="officecli-actions">
                        <button class="officecli-primary" id="officecli-save-settings">
                            <span class="material-symbols-outlined">save</span>
                            保存设置
                        </button>
                        <button class="officecli-secondary" id="officecli-check-bridge">
                            <span class="material-symbols-outlined">wifi_tethering</span>
                            检测本地桥
                        </button>
                        <button class="officecli-ghost" id="officecli-reset-settings">
                            <span class="material-symbols-outlined">restart_alt</span>
                            恢复默认
                        </button>
                    </div>
                </div>
            </section>
        `;
    }

    function renderAssistantPanel() {
        const assistant = state.assistant || {};
        const officeCli = assistant.officeCli || {};
        const isOnline = state.bridgeStatus === 'online';
        const compatible = isFrontendCompatible(assistant.minFrontendVersion);
        return `
            <div class="officecli-panel officecli-assistant-panel">
                <div class="officecli-assistant-main">
                    <div>
                        <div class="officecli-panel-title">
                            <span class="material-symbols-outlined">desktop_windows</span>
                            <b>Wally Office Assistant</b>
                        </div>
                        <p class="officecli-help">安装一次桌面助手后，网页会自动连接本机 OfficeCLI 服务，普通用户不需要手动打开命令行。</p>
                    </div>
                    <div class="officecli-assistant-badge ${isOnline ? 'online' : 'offline'}">
                        ${isOnline ? '已连接' : '未连接'}
                    </div>
                </div>
                <div class="officecli-assistant-grid">
                    <div>
                        <span>桥接地址</span>
                        <b>${escapeHtml(assistant.bridgeUrl || settings.bridgeUrl || '-')}</b>
                    </div>
                    <div>
                        <span>工作目录</span>
                        <b>${escapeHtml(assistant.workspace || settings.workspaceDir || '-')}</b>
                    </div>
                    <div>
                        <span>OfficeCLI</span>
                        <b class="${officeCli.available ? 'ok' : 'bad'}">${officeCli.available ? '可用' : '未检测到'}</b>
                    </div>
                    <div>
                        <span>版本</span>
                        <b>${escapeHtml(assistant.version || '-')}</b>
                    </div>
                    <div>
                        <span>兼容性</span>
                        <b class="${compatible ? 'ok' : 'bad'}">${compatible ? `兼容前端 ${FRONTEND_VERSION}` : `需更新前端到 ${escapeHtml(assistant.minFrontendVersion)}`}</b>
                    </div>
                </div>
                <div class="officecli-actions">
                    <button class="officecli-primary" id="officecli-launch-assistant">
                        <span class="material-symbols-outlined">rocket_launch</span>
                        启动助手
                    </button>
                    <button class="officecli-secondary" id="officecli-check-assistant">
                        <span class="material-symbols-outlined">sync</span>
                        重新检测
                    </button>
                    <button class="officecli-secondary" id="officecli-open-workspace" ${isOnline ? '' : 'disabled'}>
                        <span class="material-symbols-outlined">folder_open</span>
                        工作目录
                    </button>
                    <button class="officecli-secondary" id="officecli-open-log" ${isOnline ? '' : 'disabled'}>
                        <span class="material-symbols-outlined">article</span>
                        日志
                    </button>
                    <a class="officecli-download-link" href="desktop-assistant/README.md" target="_blank" rel="noreferrer">
                        <span class="material-symbols-outlined">download</span>
                        查看安装说明
                    </a>
                </div>
            </div>
        `;
    }

    function renderPlan() {
        if (!state.plan) {
            return `
                <div class="officecli-empty">
                    <span class="material-symbols-outlined">route</span>
                    <b>等待模型生成命令计划</b>
                    <p>OfficeCLI 的重点是先让模型学会“怎么操作文件”，再由本地工具真正执行。</p>
                </div>
            `;
        }
        return `
            <div class="officecli-plan-head">
                <div>
                    <b>${escapeHtml(state.plan.goal)}</b>
                    <p>${escapeHtml(state.plan.summary)}</p>
                </div>
                <span class="${planWrites(state.plan) ? 'warn' : 'safe'}">${planWrites(state.plan) ? '写入计划' : '只读计划'}</span>
            </div>
            <div class="officecli-command-list">
                ${state.plan.commands.map((command, index) => `
                    <article class="officecli-command ${command.mutates ? 'mutates' : ''}">
                        <div class="officecli-command-index">${index + 1}</div>
                        <div>
                            <h4>${escapeHtml(command.title)}</h4>
                            <p>${escapeHtml(command.explain || command.op)}</p>
                            <code>${escapeHtml([settings.cliCommand || 'officecli', ...command.argv].join(' '))}</code>
                        </div>
                    </article>
                `).join('')}
            </div>
            ${state.plan.notes?.length ? `
                <div class="officecli-notes">
                    ${state.plan.notes.map((note) => `<p>${escapeHtml(note)}</p>`).join('')}
                </div>
            ` : ''}
        `;
    }

    function renderResult() {
        if (!state.result) {
            return `
                <div class="officecli-empty small">
                    <span class="material-symbols-outlined">web_asset</span>
                    <b>还没有执行结果</b>
                    <p>执行后这里展示 OfficeCLI stdout、产物路径、校验结果或 HTML 预览。</p>
                </div>
            `;
        }
        const html = state.result.html || state.result.previewHtml || '';
        const artifacts = Array.isArray(state.result.artifacts) ? state.result.artifacts : [];
        const logs = Array.isArray(state.result.logs) ? state.result.logs : [];
        return `
            ${html ? `<iframe class="officecli-preview-frame" srcdoc="${escapeHtml(html)}"></iframe>` : ''}
            ${artifacts.length ? `
                <div class="officecli-artifacts">
                    <b>输出文件</b>
                    ${artifacts.map((item) => `<p>${escapeHtml(typeof item === 'string' ? item : item.path || item.name || JSON.stringify(item))}</p>`).join('')}
                </div>
            ` : ''}
            <pre class="officecli-result-json">${escapeHtml(JSON.stringify({
                success: state.result.success,
                message: state.result.message,
                logs: logs.slice(-8)
            }, null, 2))}</pre>
        `;
    }

    function renderLogs() {
        const node = byId('officecli-logs');
        if (!node) return;
        node.innerHTML = state.logs.length ? state.logs.map((log) => `
            <div class="${escapeHtml(log.type)}">
                <span>${escapeHtml(log.stamp)}</span>
                <p>${escapeHtml(log.message)}</p>
            </div>
        `).join('') : '<p class="officecli-muted">暂无运行日志。</p>';
    }

    function renderBridgeStatus() {
        const node = byId('officecli-bridge-status');
        if (!node) return;
        const map = {
            unknown: '未检测',
            checking: '检测中',
            online: '在线',
            offline: '离线',
            missing: '未配置'
        };
        node.textContent = map[state.bridgeStatus] || '未检测';
        node.className = `bridge-${state.bridgeStatus}`;
    }

    function renderAssistantStatus() {
        const panel = document.querySelector('.officecli-assistant-panel');
        if (!panel || state.layer !== 'settings') return;
        render();
    }

    function renderFileSummary() {
        const node = byId('officecli-file-summary');
        if (!node) return;
        if (!state.fileMeta) {
            node.innerHTML = '<span>未上传文件</span>';
            return;
        }
        node.innerHTML = `
            <b>${escapeHtml(state.fileMeta.name)}</b>
            <span>${Math.max(1, Math.round(state.fileMeta.size / 1024))} KB</span>
        `;
    }

    function bindCommon() {
        byId('officecli-close')?.addEventListener('click', close);
        byId('officecli-work-tab')?.addEventListener('click', () => switchLayer('work'));
        byId('officecli-settings-tab')?.addEventListener('click', () => switchLayer('settings'));
    }

    function bindWorkLayer() {
        byId('officecli-file')?.addEventListener('change', handleFileChange);
        byId('officecli-generate')?.addEventListener('click', generatePlan);
        byId('officecli-execute')?.addEventListener('click', executePlan);
        byId('officecli-copy-plan')?.addEventListener('click', copyPlan);
        byId('officecli-clear-plan')?.addEventListener('click', clearPlan);
        byId('officecli-instruction')?.addEventListener('input', (event) => {
            state.instruction = event.target.value;
        });
        document.querySelectorAll('[data-example]').forEach((button) => {
            button.addEventListener('click', () => insertExample(Number(button.dataset.example)));
        });
    }

    function bindSettingsLayer() {
        byId('officecli-save-settings')?.addEventListener('click', saveSettingsFromForm);
        byId('officecli-reset-settings')?.addEventListener('click', resetSettings);
        byId('officecli-launch-assistant')?.addEventListener('click', launchAssistant);
        byId('officecli-check-assistant')?.addEventListener('click', checkBridge);
        byId('officecli-open-workspace')?.addEventListener('click', async () => {
            try {
                const result = await callAssistantControl('/control/open-workspace');
                toast(result.success ? '已打开工作目录' : result.message);
            } catch (error) {
                toast('无法打开工作目录，请先启动桌面助手');
            }
        });
        byId('officecli-open-log')?.addEventListener('click', async () => {
            try {
                const result = await callAssistantControl('/control/open-log');
                toast(result.success ? '已打开日志' : result.message);
            } catch (error) {
                toast('无法打开日志，请先启动桌面助手');
            }
        });
        byId('officecli-check-bridge')?.addEventListener('click', () => {
            saveSettingsFromForm();
            checkBridge();
        });
    }

    function ensureStyle() {
        if (byId('officecli-style')) return;
        const style = document.createElement('style');
        style.id = 'officecli-style';
        style.textContent = `
            .officecli-modal {
                position: fixed;
                inset: 0;
                z-index: 12000;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(15, 23, 42, .42);
                backdrop-filter: blur(16px);
                color: #172033;
                font-family: "Google Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            }
            .officecli-dialog {
                width: min(1440px, calc(100vw - 32px));
                height: min(900px, calc(100vh - 32px));
                display: flex;
                flex-direction: column;
                overflow: hidden;
                border: 1px solid rgba(148, 163, 184, .35);
                border-radius: 8px;
                background: #f8fafc;
                box-shadow: 0 26px 80px rgba(15, 23, 42, .28);
            }
            .officecli-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 18px;
                padding: 18px 22px;
                background: #ffffff;
                border-bottom: 1px solid #e2e8f0;
            }
            .officecli-header h2 {
                display: flex;
                align-items: center;
                gap: 10px;
                margin: 0;
                font-size: 20px;
                font-weight: 700;
                color: #0f172a;
            }
            .officecli-header p {
                margin: 4px 0 0;
                color: #64748b;
                font-size: 13px;
            }
            .officecli-icon-btn {
                width: 36px;
                height: 36px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                background: #fff;
                color: #334155;
                cursor: pointer;
            }
            .officecli-tabs {
                display: flex;
                gap: 8px;
                padding: 12px 22px 0;
                background: #fff;
            }
            .officecli-tabs button {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 10px 14px;
                border: 0;
                border-bottom: 2px solid transparent;
                background: transparent;
                color: #64748b;
                cursor: pointer;
                font-weight: 700;
            }
            .officecli-tabs button.active {
                border-bottom-color: #2563eb;
                color: #1d4ed8;
            }
            .officecli-body {
                flex: 1;
                overflow: auto;
                padding: 18px 22px 22px;
            }
            .officecli-work {
                display: grid;
                grid-template-columns: minmax(360px, 440px) minmax(0, 1fr);
                gap: 16px;
            }
            .officecli-left,
            .officecli-right {
                display: flex;
                min-width: 0;
                flex-direction: column;
                gap: 14px;
            }
            .officecli-panel {
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                background: #fff;
                padding: 14px;
            }
            .officecli-panel-title {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 12px;
                color: #0f172a;
            }
            .officecli-panel-title b {
                font-size: 14px;
            }
            .officecli-upload-row {
                display: flex;
                gap: 12px;
                align-items: stretch;
            }
            .officecli-file-pick {
                min-width: 150px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                padding: 12px;
                border: 1px dashed #94a3b8;
                border-radius: 8px;
                background: #f8fafc;
                color: #1d4ed8;
                cursor: pointer;
                font-weight: 700;
            }
            .officecli-file-pick input {
                display: none;
            }
            .officecli-file-summary {
                flex: 1;
                min-width: 0;
                display: flex;
                flex-direction: column;
                justify-content: center;
                gap: 4px;
                padding: 10px 12px;
                border-radius: 8px;
                background: #f1f5f9;
                color: #64748b;
                font-size: 12px;
            }
            .officecli-file-summary b {
                overflow: hidden;
                color: #0f172a;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .officecli-field {
                display: flex;
                flex-direction: column;
                gap: 7px;
                margin-top: 12px;
                color: #475569;
                font-size: 12px;
                font-weight: 700;
            }
            .officecli-field input,
            .officecli-task-input,
            .officecli-system-prompt {
                width: 100%;
                border: 1px solid #cbd5e1;
                border-radius: 8px;
                background: #fff;
                color: #0f172a;
                outline: none;
                font: inherit;
            }
            .officecli-field input {
                height: 40px;
                padding: 0 12px;
            }
            .officecli-field input:focus,
            .officecli-task-input:focus,
            .officecli-system-prompt:focus {
                border-color: #2563eb;
                box-shadow: 0 0 0 3px rgba(37, 99, 235, .12);
            }
            .officecli-task-input {
                min-height: 132px;
                resize: vertical;
                padding: 12px;
                line-height: 1.55;
            }
            .officecli-example-grid {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 8px;
                margin-top: 10px;
            }
            .officecli-example-grid button {
                min-height: 88px;
                padding: 10px;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                background: #f8fafc;
                color: #334155;
                text-align: left;
                cursor: pointer;
            }
            .officecli-example-grid b,
            .officecli-example-grid span {
                display: block;
            }
            .officecli-example-grid b {
                margin-bottom: 5px;
                color: #0f172a;
                font-size: 13px;
            }
            .officecli-example-grid span {
                color: #64748b;
                font-size: 12px;
                line-height: 1.4;
            }
            .officecli-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-top: 12px;
            }
            .officecli-actions button,
            .officecli-primary,
            .officecli-secondary,
            .officecli-ghost {
                min-height: 38px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 7px;
                padding: 8px 12px;
                border-radius: 8px;
                font-weight: 700;
                cursor: pointer;
            }
            .officecli-primary {
                border: 1px solid #2563eb;
                background: #2563eb;
                color: #fff;
            }
            .officecli-secondary {
                border: 1px solid #cbd5e1;
                background: #fff;
                color: #1e293b;
            }
            .officecli-ghost {
                border: 1px solid transparent;
                background: transparent;
                color: #64748b;
            }
            .officecli-actions button:disabled {
                cursor: not-allowed;
                opacity: .58;
            }
            .officecli-busy {
                min-height: 18px;
                margin-top: 8px;
                color: #2563eb;
                font-size: 12px;
            }
            .officecli-status-row {
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                gap: 10px;
            }
            .officecli-status-card {
                min-height: 68px;
                display: flex;
                flex-direction: column;
                justify-content: center;
                gap: 4px;
                padding: 12px;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                background: #fff;
            }
            .officecli-status-card span {
                color: #64748b;
                font-size: 12px;
            }
            .officecli-status-card b {
                color: #0f172a;
                font-size: 18px;
            }
            .bridge-online { color: #16a34a !important; }
            .bridge-offline { color: #dc2626 !important; }
            .bridge-checking { color: #2563eb !important; }
            .officecli-plan-panel,
            .officecli-result-panel {
                min-height: 260px;
            }
            .officecli-plan-head {
                display: flex;
                justify-content: space-between;
                gap: 12px;
                padding: 12px;
                border-radius: 8px;
                background: #f8fafc;
            }
            .officecli-plan-head b {
                color: #0f172a;
            }
            .officecli-plan-head p {
                margin: 6px 0 0;
                color: #64748b;
                font-size: 12px;
            }
            .officecli-plan-head span {
                height: 26px;
                white-space: nowrap;
                border-radius: 999px;
                padding: 4px 9px;
                font-size: 12px;
                font-weight: 700;
            }
            .officecli-plan-head .safe {
                background: #dcfce7;
                color: #15803d;
            }
            .officecli-plan-head .warn {
                background: #fef3c7;
                color: #b45309;
            }
            .officecli-command-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
                margin-top: 10px;
            }
            .officecli-command {
                display: grid;
                grid-template-columns: 32px minmax(0, 1fr);
                gap: 10px;
                padding: 10px;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                background: #fff;
            }
            .officecli-command.mutates {
                border-color: #f59e0b;
                background: #fffbeb;
            }
            .officecli-command-index {
                width: 28px;
                height: 28px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                border-radius: 8px;
                background: #e0e7ff;
                color: #1d4ed8;
                font-weight: 800;
            }
            .officecli-command h4 {
                margin: 0;
                color: #0f172a;
                font-size: 13px;
            }
            .officecli-command p {
                margin: 4px 0 7px;
                color: #64748b;
                font-size: 12px;
            }
            .officecli-command code {
                display: block;
                overflow: auto;
                padding: 7px 8px;
                border-radius: 6px;
                background: #0f172a;
                color: #dbeafe;
                font-size: 12px;
                white-space: nowrap;
            }
            .officecli-notes {
                margin-top: 10px;
                padding: 10px;
                border-radius: 8px;
                background: #fefce8;
                color: #854d0e;
                font-size: 12px;
            }
            .officecli-notes p {
                margin: 0 0 5px;
            }
            .officecli-empty {
                min-height: 190px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 8px;
                color: #64748b;
                text-align: center;
            }
            .officecli-empty.small {
                min-height: 155px;
            }
            .officecli-empty .material-symbols-outlined {
                font-size: 42px;
                color: #94a3b8;
            }
            .officecli-empty b {
                color: #334155;
            }
            .officecli-empty p {
                max-width: 420px;
                margin: 0;
                font-size: 12px;
                line-height: 1.5;
            }
            .officecli-preview-frame {
                width: 100%;
                min-height: 280px;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                background: #fff;
            }
            .officecli-artifacts {
                margin-top: 10px;
                padding: 10px;
                border-radius: 8px;
                background: #f0fdf4;
                color: #166534;
                font-size: 12px;
            }
            .officecli-artifacts p {
                margin: 6px 0 0;
                overflow-wrap: anywhere;
            }
            .officecli-result-json {
                max-height: 220px;
                overflow: auto;
                margin: 10px 0 0;
                padding: 10px;
                border-radius: 8px;
                background: #0f172a;
                color: #e2e8f0;
                font-size: 12px;
                line-height: 1.5;
            }
            .officecli-log-panel {
                min-height: 170px;
            }
            .officecli-logs {
                max-height: 180px;
                overflow: auto;
                display: flex;
                flex-direction: column;
                gap: 7px;
            }
            .officecli-logs div {
                display: grid;
                grid-template-columns: 82px minmax(0, 1fr);
                gap: 8px;
                align-items: start;
                padding: 8px;
                border-radius: 8px;
                background: #f8fafc;
                font-size: 12px;
            }
            .officecli-logs span {
                color: #94a3b8;
            }
            .officecli-logs p {
                margin: 0;
                color: #475569;
            }
            .officecli-logs .success p { color: #15803d; }
            .officecli-logs .error p { color: #dc2626; }
            .officecli-muted {
                margin: 0;
                color: #94a3b8;
                font-size: 12px;
            }
            .officecli-settings-grid {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 14px;
            }
            .officecli-help {
                margin: 12px 0 0;
                color: #64748b;
                font-size: 12px;
                line-height: 1.5;
            }
            .officecli-assistant-panel {
                margin-bottom: 14px;
            }
            .officecli-assistant-main {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 16px;
            }
            .officecli-assistant-badge {
                min-width: 82px;
                text-align: center;
                border-radius: 999px;
                padding: 6px 10px;
                font-size: 12px;
                font-weight: 800;
            }
            .officecli-assistant-badge.online {
                background: #dcfce7;
                color: #15803d;
            }
            .officecli-assistant-badge.offline {
                background: #fee2e2;
                color: #b91c1c;
            }
            .officecli-assistant-grid {
                display: grid;
                grid-template-columns: repeat(4, minmax(0, 1fr));
                gap: 8px;
                margin-top: 12px;
            }
            .officecli-assistant-grid div {
                min-height: 66px;
                padding: 10px;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                background: #f8fafc;
            }
            .officecli-assistant-grid span {
                display: block;
                color: #64748b;
                font-size: 12px;
            }
            .officecli-assistant-grid b {
                display: block;
                overflow: hidden;
                margin-top: 6px;
                color: #0f172a;
                font-size: 13px;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .officecli-assistant-grid b.ok {
                color: #15803d;
            }
            .officecli-assistant-grid b.bad {
                color: #dc2626;
            }
            .officecli-download-link {
                min-height: 38px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 7px;
                padding: 8px 12px;
                border: 1px solid #cbd5e1;
                border-radius: 8px;
                background: #fff;
                color: #1e293b;
                text-decoration: none;
                font-weight: 700;
            }
            .officecli-switches {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 8px;
                margin-top: 12px;
            }
            .officecli-switches label {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 10px;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                background: #f8fafc;
                color: #334155;
                font-size: 12px;
                font-weight: 700;
            }
            .officecli-prompt-panel {
                margin-top: 14px;
            }
            .officecli-system-prompt {
                min-height: 250px;
                resize: vertical;
                padding: 12px;
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
                font-size: 12px;
                line-height: 1.55;
            }
            .officecli-toast {
                position: fixed;
                left: 50%;
                bottom: 28px;
                z-index: 13000;
                transform: translateX(-50%);
                padding: 11px 16px;
                border-radius: 8px;
                background: #0f172a;
                color: #fff;
                box-shadow: 0 14px 36px rgba(15, 23, 42, .3);
                font-size: 13px;
            }
            @media (max-width: 1040px) {
                .officecli-work,
                .officecli-settings-grid {
                    grid-template-columns: 1fr;
                }
                .officecli-dialog {
                    height: calc(100vh - 20px);
                    width: calc(100vw - 20px);
                }
            }
            @media (max-width: 720px) {
                .officecli-body {
                    padding: 14px;
                }
                .officecli-header {
                    padding: 14px;
                }
                .officecli-tabs {
                    padding: 10px 14px 0;
                }
                .officecli-status-row,
                .officecli-example-grid,
                .officecli-switches,
                .officecli-assistant-grid {
                    grid-template-columns: 1fr;
                }
                .officecli-upload-row {
                    flex-direction: column;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function open() {
        loadSettings();
        state.layer = 'work';
        state.logs = state.logs.length ? state.logs : [{ stamp: new Date().toLocaleTimeString(), message: 'OfficeCLI 表格工具已打开', type: 'info' }];
        render();
        setTimeout(checkBridge, 150);
    }

    window.openOfficeExcelTool = open;
    window.VeoOfficeExcelTool = {
        open,
        close,
        generatePlan,
        executePlan,
        getState: () => ({ ...state, settings: { ...settings, apiKey: settings.apiKey ? '***' : '' } })
    };
})(window, document);

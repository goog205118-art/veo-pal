(function (window, document) {
    'use strict';

    const SETTINGS_KEY = 'veoOfficeCliExcelToolSettings';
    const LAST_PLAN_KEY = 'veoOfficeCliExcelLastPlan';
    const FRONTEND_VERSION = '0.1.4';
    const SETTINGS_SCHEMA_VERSION = 5;
    const ASSISTANT_RELEASE_URL = 'https://github.com/goog205118-art/veo-pal/releases/latest';
    const ASSISTANT_SETUP_URL = 'https://github.com/goog205118-art/veo-pal/releases/latest/download/WallyOfficeAssistantSetup-0.1.0.exe';
    const MATERIAL_MAX_FILES = 8;
    const MATERIAL_TEXT_LIMIT = 6000;

    const DEFAULT_SYSTEM_PROMPT = [
        '你是 OfficeCLI Excel 操作规划器。',
        '你的目标不是直接改表格，而是把用户的自然语言需求转成 OfficeCLI 本地命令计划，让一个不懂表格操作的 LLM 也能通过本地工具读写 Excel / CSV 文件。',
        '必须只输出 JSON，不要输出 Markdown。',
        '命令计划必须使用 argv 数组，不允许输出 shell 字符串。',
        'argv 不要包含 officecli 本体，只写 officecli 后面的参数。',
        '使用 $file 作为当前上传、选择或即将创建的表格文件占位符。',
        '$file 必须作为单独 argv 参数出现，禁止 translated_$file、updated_$file 或任何把 $file 拼进路径/文件名的写法。',
        '严格使用 OfficeCLI v1 语法：',
        '- 新建空表格：["create","$file"]',
        '- 读取表格文本：["view","$file","text","--max-lines","20","--json"]',
        '- 生成 HTML 预览：["view","$file","html"]',
        '- 校验文件：["validate","$file"]',
        '- 读取单元格/范围：["get","$file","/Sheet1/A1","--json"] 或 ["get","$file","/Sheet1/A1:C10","--json"]',
        '- 查询行：["query","$file","Sheet1!row[SKU=ABC]","--json"]',
        '- 修改单元格：["set","$file","/Sheet1/A1","--prop","value=新内容"]',
        '- 批量修改：["batch","$file","--commands","[{\\"command\\":\\"set\\",\\"path\\":\\"/Sheet1/A1\\",\\"props\\":{\\"value\\":\\"Done\\"}}]","--json"]',
        '禁止使用旧/不存在语法：--format、--html、get range、set range、--sheet、--values、__SHEET_NAME__、__TRANSLATED_VALUES__、--output。',
        '建议流程：先用 view text --json / get / query 理解文件，再用 set / add / remove / batch 修改，最后 validate 和 view html 预览。',
        '如果没有上传表格，必须先生成 create 计划：第一条命令为 ["create","$file"]，再用 set / batch 写入从用户需求和材料中提取出的表头与数据，最后 validate 和 view html。',
        '如果用户任务需要真实 sheet 名、表头或行号但当前信息不足，先生成只读读取计划，不要编造 sheet 名、列名、范围或占位符。',
        'JSON 结构：',
        '{"goal":"","file":"$file","summary":"","commands":[{"id":"inspect","title":"读取表格前 20 行","op":"workbook.viewText","argv":["view","$file","text","--max-lines","20","--json"],"mutates":false,"explain":""}],"safety":{"writesFile":false,"requiresConfirmation":true},"expectedOutputs":["htmlPreview","logs"],"notes":[]}',
        '可用能力参考：create, view text/html/issues/stats, get <path>, query <selector>, set <path> --prop key=value, add/remove/move/swap, batch, validate, watch。',
        '注意：OfficeCLI 默认直接修改传入文件；本地桥传入的是工作区副本，不会直接覆盖用户原文件。'
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
        requireConfirmation: false,
        enableMultimodalMaterials: false,
        requestTimeoutMs: 120000,
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
        schemaVersion: SETTINGS_SCHEMA_VERSION
    };

    let settings = { ...defaultSettings };
    let state = {
        layer: 'work',
        file: null,
        fileDataUrl: '',
        fileMeta: null,
        filePath: '',
        materials: [],
        instruction: '',
        generatedWorkbookName: '',
        plan: null,
        result: null,
        logs: [],
        busy: false,
        bridgeStatus: 'unknown',
        assistant: null,
        progress: { percent: 0, label: '待开始' }
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

    function makeGeneratedWorkbookName() {
        if (state.generatedWorkbookName) return state.generatedWorkbookName;
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        state.generatedWorkbookName = `office-generated-${stamp}.xlsx`;
        return state.generatedWorkbookName;
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

    function normalizeManualCliCommand(value) {
        const text = String(value || '').trim();
        return text && text !== defaultSettings.cliCommand ? text : '';
    }

    function getManualCliCommand() {
        const input = byId('officecli-cli-command');
        return normalizeManualCliCommand(input ? input.value : settings.cliCommand);
    }

    function getDetectedCliCommand() {
        return state.assistant?.officeCli?.command || state.assistant?.cliCommand || '';
    }

    function getConfiguredCliCommand() {
        return getManualCliCommand();
    }

    function isUnsafeWorkspaceDir(value) {
        const text = String(value || '').trim();
        if (!text) return false;
        const normalized = text.replace(/\//g, '\\').toLowerCase();
        const isAbsolute = /^[a-z]:\\/.test(normalized) || normalized.startsWith('\\\\');
        if (!isAbsolute) return true;
        return /^[a-z]:\\windows(\\|$)/.test(normalized) || normalized.includes('\\windows\\system32');
    }

    function cleanWorkspaceDir(value) {
        const text = String(value || '').trim();
        return isUnsafeWorkspaceDir(text) ? '' : text;
    }

    function loadSettings() {
        const stored = safeJsonParse(localStorage.getItem(SETTINGS_KEY) || '{}', {});
        const needsCreatePrompt = stored.systemPrompt && !/没有上传表格|create 计划|\["create","\$file"\]/i.test(stored.systemPrompt);
        const shouldRefreshPrompt = !stored.systemPrompt || /--format|--html|get range|set range|__SHEET_NAME__|__TRANSLATED_VALUES__/i.test(stored.systemPrompt);
        const shouldMigrateTrustedWriteDefault = Number(stored.schemaVersion || 0) < SETTINGS_SCHEMA_VERSION;
        const workspaceDir = cleanWorkspaceDir(stored.workspaceDir);
        const migratedPrompt = shouldRefreshPrompt
            ? DEFAULT_SYSTEM_PROMPT
            : (needsCreatePrompt ? `${stored.systemPrompt}\n\n补充规则：如果没有上传表格，必须先生成 create 计划：第一条命令为 ["create","$file"]，再用 set / batch 写入从用户需求和材料中提取出的表头与数据，最后 validate 和 view html。` : stored.systemPrompt);
        settings = {
            ...defaultSettings,
            ...stored,
            schemaVersion: SETTINGS_SCHEMA_VERSION,
            workspaceDir,
            requireConfirmation: shouldMigrateTrustedWriteDefault ? false : Boolean(stored.requireConfirmation),
            enableMultimodalMaterials: Boolean(stored.enableMultimodalMaterials),
            systemPrompt: migratedPrompt
        };
        const lastPlan = safeJsonParse(localStorage.getItem(LAST_PLAN_KEY) || 'null', null);
        if (lastPlan && Array.isArray(lastPlan.commands)) {
            state.plan = normalizePlan(lastPlan);
        }
        if (shouldRefreshPrompt || needsCreatePrompt || shouldMigrateTrustedWriteDefault || workspaceDir !== stored.workspaceDir) {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        }
    }

    function saveSettingsFromForm(showToast = true) {
        settings = {
            apiBaseUrl: byId('officecli-api-base').value.trim(),
            apiKey: byId('officecli-api-key').value.trim(),
            model: byId('officecli-model').value.trim() || defaultSettings.model,
            bridgeUrl: byId('officecli-bridge-url').value.trim() || defaultSettings.bridgeUrl,
            assistantProtocol: byId('officecli-assistant-protocol')?.value.trim() || settings.assistantProtocol || defaultSettings.assistantProtocol,
            cliCommand: normalizeManualCliCommand(byId('officecli-cli-command')?.value),
            workspaceDir: cleanWorkspaceDir(byId('officecli-workspace-dir').value) || defaultSettings.workspaceDir,
            dryRun: byId('officecli-dry-run').checked,
            requireConfirmation: byId('officecli-require-confirm').checked,
            enableMultimodalMaterials: Boolean(byId('officecli-enable-materials')?.checked),
            requestTimeoutMs: Number(byId('officecli-timeout-ms').value) || defaultSettings.requestTimeoutMs,
            systemPrompt: byId('officecli-system-prompt').value.trim() || DEFAULT_SYSTEM_PROMPT,
            schemaVersion: SETTINGS_SCHEMA_VERSION
        };
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        if (showToast) toast('OfficeCLI 设置已保存');
    }

    function resetSettings() {
        settings = { ...defaultSettings };
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        render();
        toast('已恢复默认设置');
    }

    function useAutoCliDetection() {
        const input = byId('officecli-cli-command');
        if (input) input.value = '';
        saveSettingsFromForm(false);
        settings.cliCommand = '';
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        toast('已切换为自动检测 OfficeCLI');
        checkBridge();
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

    function makeId(prefix = 'id') {
        if (window.crypto?.randomUUID) return `${prefix}_${window.crypto.randomUUID()}`;
        return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    }

    function isTextLikeMaterial(file) {
        const name = String(file?.name || '').toLowerCase();
        const type = String(file?.type || '').toLowerCase();
        return type.startsWith('text/')
            || /(\.txt|\.md|\.csv|\.json|\.html|\.htm|\.xml|\.log)$/i.test(name)
            || ['application/json', 'application/xml'].includes(type);
    }

    function isWorkbookFile(file) {
        const name = String(file?.name || '').toLowerCase();
        const type = String(file?.type || '').toLowerCase();
        return /\.(xlsx|xls|csv|xlsm)$/i.test(name)
            || /spreadsheet|excel|csv/.test(type);
    }

    async function readMaterialFile(file) {
        const isImage = String(file.type || '').startsWith('image/');
        const isText = isTextLikeMaterial(file);
        const material = {
            id: makeId('material'),
            name: file.name || 'material',
            size: file.size || 0,
            type: file.type || '',
            kind: isImage ? 'image' : (isText ? 'text' : 'file'),
            dataUrl: '',
            text: ''
        };
        if (isImage) {
            material.dataUrl = await readAsDataUrl(file);
        } else if (isText) {
            material.text = compactText(await file.text(), MATERIAL_TEXT_LIMIT);
        }
        return material;
    }

    async function addMaterialFiles(files) {
        const list = Array.from(files || []);
        if (!list.length) return;
        const remaining = Math.max(0, MATERIAL_MAX_FILES - state.materials.length);
        if (!remaining) {
            toast(`最多上传 ${MATERIAL_MAX_FILES} 个补充材料`);
            return;
        }
        const selected = list.slice(0, remaining);
        const materials = await Promise.all(selected.map(readMaterialFile));
        state.materials = [...state.materials, ...materials];
        if (list.length > remaining) {
            toast(`已添加 ${remaining} 个材料，最多支持 ${MATERIAL_MAX_FILES} 个`);
        } else {
            toast(`已添加 ${materials.length} 个材料`);
        }
        addLog(`已添加模型补充材料：${materials.map((item) => item.name).join('、')}`, 'success');
        render();
    }

    function removeMaterial(id) {
        state.materials = state.materials.filter((item) => item.id !== id);
        render();
    }

    function clearMaterials() {
        state.materials = [];
        render();
        toast('已清空补充材料');
    }

    async function handleComposerFiles(files) {
        const list = Array.from(files || []);
        if (!list.length) return;
        const workbook = list.find(isWorkbookFile);
        if (workbook) {
            await setSelectedWorkbook({
                file: workbook,
                fileMeta: { name: workbook.name, size: workbook.size, type: workbook.type },
                fileDataUrl: await readAsDataUrl(workbook),
                filePath: workbook.path || ''
            });
        }
        const materialFiles = list.filter((file) => file !== workbook);
        if (materialFiles.length) {
            if (!settings.enableMultimodalMaterials) {
                toast('请先在设置层开启“图片 / 材料理解”');
                return;
            }
            await addMaterialFiles(materialFiles);
        }
    }

    function hasDesktopAssistant() {
        return Boolean(window.wallyAssistant);
    }

    function getFileDisplayName(pathValue) {
        const value = String(pathValue || '').trim();
        if (!value) return '';
        const parts = value.split(/[\\/]/);
        return parts[parts.length - 1] || value;
    }

    function getParentDirectory(targetPath) {
        const value = String(targetPath || '').trim();
        if (!value) return '';
        const normalized = value.replace(/[\\/]+$/, '');
        const parts = normalized.split(/[\\/]/);
        if (parts.length <= 1) return '';
        parts.pop();
        return parts.join('\\');
    }

    async function pickWorkbookFile() {
        if (hasDesktopAssistant() && window.wallyAssistant.pickFile) {
            const picked = await window.wallyAssistant.pickFile({
                title: '选择 Excel / CSV 文件',
                filters: [
                    { name: 'Excel/CSV', extensions: ['xlsx', 'xls', 'csv', 'xlsm'] },
                    { name: 'All Files', extensions: ['*'] }
                ]
            });
            if (!picked) return null;
            return {
                file: null,
                fileMeta: {
                    name: picked.name || getFileDisplayName(picked.path),
                    size: picked.size || 0,
                    type: ''
                },
                fileDataUrl: '',
                filePath: picked.path || ''
            };
        }

        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.xlsx,.xls,.csv,.xlsm';
            input.onchange = async () => {
                const file = input.files && input.files[0];
                if (!file) {
                    resolve(null);
                    return;
                }
                resolve({
                    file,
                    fileMeta: { name: file.name, size: file.size, type: file.type },
                    fileDataUrl: await readAsDataUrl(file),
                    filePath: ''
                });
            };
            input.click();
        });
    }

    async function setSelectedWorkbook(selection) {
        if (!selection) return;
        state.file = selection.file || null;
        state.fileMeta = selection.fileMeta || null;
        state.fileDataUrl = selection.fileDataUrl || '';
        state.filePath = selection.filePath || '';
        state.generatedWorkbookName = '';
        if (state.fileMeta?.name || state.filePath) {
            addLog(`已选择文件：${state.fileMeta?.name || getFileDisplayName(state.filePath)}`, 'success');
        }
        renderFileSummary();
        render();
    }

    async function pickMaterialFiles() {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;
            input.accept = 'image/*,.txt,.md,.csv,.json,.html,.htm,.xml,.log';
            input.onchange = () => resolve(input.files || []);
            input.click();
        });
    }

    async function pickWorkspaceDirectory() {
        if (hasDesktopAssistant() && window.wallyAssistant.pickDirectory) {
            const picked = await window.wallyAssistant.pickDirectory({ title: '选择工作目录' });
            return picked?.path || '';
        }
        toast('网页不能直接选择电脑目录，已自动使用本地桥默认工作目录');
        return '';
    }

    async function openTargetPath(targetPath) {
        const resolved = String(targetPath || '').trim();
        if (!resolved) return false;
        if (hasDesktopAssistant() && window.wallyAssistant.openPath) {
            const errorMessage = await window.wallyAssistant.openPath(resolved);
            if (errorMessage) {
                throw new Error(errorMessage);
            }
            return true;
        }
        const baseUrl = settings.bridgeUrl.replace(/\/officecli\/?$/, '');
        if (!baseUrl) return false;
        const response = await fetch(`${baseUrl}/control/open-path`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: resolved })
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || data?.success === false) {
            throw new Error(data?.message || `无法打开路径：${resolved}`);
        }
        return true;
    }

    function commandCount(plan) {
        return Array.isArray(plan?.commands) ? plan.commands.length : 0;
    }

    function planWrites(plan) {
        if (!plan) return false;
        if (plan.safety?.writesFile) return true;
        return (plan.commands || []).some((command) => command.mutates === true);
    }

    function isReadOnlyPlan(plan) {
        return Boolean(plan && commandCount(plan) && !planWrites(plan));
    }

    function compactText(value, maxLength = 16000) {
        const text = String(value == null ? '' : value).trim();
        if (text.length <= maxLength) return text;
        return `${text.slice(0, maxLength)}\n...内容过长，已截断...`;
    }

    function getActiveMaterials() {
        return settings.enableMultimodalMaterials ? state.materials : [];
    }

    function buildMaterialPromptLines() {
        const materials = getActiveMaterials();
        if (!materials.length) return [];
        const lines = [
            '',
            '补充材料：',
            '这些材料只用于模型识别文字、理解商品/票据/截图内容，并把识别结果映射到表格任务；真正改表仍必须通过 OfficeCLI 命令计划完成。'
        ];
        materials.forEach((material, index) => {
            const label = `材料 ${index + 1}：${material.name || '未命名材料'}，类型 ${material.type || material.kind || 'unknown'}，大小 ${material.size ? `${Math.round(material.size / 1024)} KB` : 'unknown'}`;
            if (material.kind === 'image') {
                lines.push(`${label}。此材料已作为图片随请求发送，请识别其中的文字、版式、商品信息和关键字段。`);
            } else if (material.kind === 'text') {
                lines.push(`${label}。文本内容：\n${compactText(material.text, MATERIAL_TEXT_LIMIT) || '空文本'}`);
            } else {
                lines.push(`${label}。该类型当前只提供文件信息；如果任务需要正文内容，请改用图片截图或文本文件。`);
            }
        });
        return lines;
    }

    function normalizeOfficeCliArgv(argv) {
        const args = Array.isArray(argv) ? argv.map((item) => String(item)) : [];
        if (!args.length) return args;
        if (args[0] === 'view') {
            const htmlFlagIndex = args.indexOf('--html');
            if (htmlFlagIndex >= 0) {
                return ['view', args[1], 'html', ...args.slice(2).filter((arg) => arg !== '--html')].filter(Boolean);
            }
            const formatIndex = args.indexOf('--format');
            if (formatIndex >= 0) {
                const mode = String(args[formatIndex + 1] || '').toLowerCase();
                const rest = args.filter((_, index) => index !== formatIndex && index !== formatIndex + 1);
                if (mode === 'json') {
                    return ['view', rest[1] || '$file', 'text', '--max-lines', '20', '--json'];
                }
                if (mode === 'html') {
                    return ['view', rest[1] || '$file', 'html'];
                }
                if (['text', 'outline', 'stats', 'issues', 'annotated'].includes(mode)) {
                    return ['view', rest[1] || '$file', mode, ...rest.slice(2)];
                }
            }
        }
        return args;
    }

    function findPlanIssue(plan) {
        const commands = Array.isArray(plan?.commands) ? plan.commands : [];
        const invalidFlags = new Set(['--format', '--html', '--sheet', '--values', '--output']);
        for (const command of commands) {
            const argv = Array.isArray(command.argv) ? command.argv.map((arg) => String(arg)) : [];
            if (!argv.length) continue;
            const badPlaceholder = argv.find((arg) => (arg.includes('$file') && arg !== '$file') || /__[^_\s]+(?:_[^_\s]+)*__/i.test(arg));
            if (badPlaceholder) {
                return `命令“${command.title || command.id || argv[0]}”包含未解析占位符：${badPlaceholder}。请先生成读取计划，拿到真实 sheet / 表头后再生成写入计划。`;
            }
            if ((argv[0] === 'get' || argv[0] === 'set') && ['range', 'sheet', 'workbook'].includes(String(argv[1] || '').toLowerCase())) {
                return `命令“${command.title || command.id || argv[0]}”使用了 OfficeCLI 不支持的旧语法：${argv.slice(0, 3).join(' ')}。正确格式应为 ${argv[0]} $file /Sheet1/A1 --json 或 set $file /Sheet1/A1 --prop value=...。`;
            }
            const badFlag = argv.find((arg) => invalidFlags.has(arg));
            if (badFlag) {
                return `命令“${command.title || command.id || argv[0]}”包含 OfficeCLI 不支持的参数：${badFlag}。请重新生成计划。`;
            }
        }
        return '';
    }

    function normalizePlan(rawPlan) {
        const plan = rawPlan && typeof rawPlan === 'object' ? rawPlan : {};
        const commands = Array.isArray(plan.commands) ? plan.commands : [];
        const normalized = {
            goal: String(plan.goal || state.instruction || 'OfficeCLI Excel 任务'),
            file: plan.file || '$file',
            summary: String(plan.summary || '已生成 OfficeCLI 命令计划。'),
            commands: commands.map((command, index) => ({
                id: String(command.id || `cmd_${index + 1}`),
                title: String(command.title || command.op || `步骤 ${index + 1}`),
                op: String(command.op || 'officecli.command'),
                argv: normalizeOfficeCliArgv(command.argv),
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
        const issue = findPlanIssue(normalized);
        if (issue && !normalized.notes.includes(issue)) normalized.notes.unshift(issue);
        return normalized;
    }

    function hasWorkbookInput() {
        return Boolean(state.file || state.filePath);
    }

    function isCreateCommand(command) {
        const argv = normalizeOfficeCliArgv(command?.argv || []);
        return String(argv[0] || '').toLowerCase() === 'create';
    }

    function ensureCreatePlanForNoWorkbook(plan) {
        const normalized = normalizePlan(plan);
        if (hasWorkbookInput() || normalized.commands.some(isCreateCommand)) return normalized;
        makeGeneratedWorkbookName();
        normalized.commands.unshift({
            id: 'create_workbook',
            title: 'Create Excel workbook',
            op: 'workbook.create',
            argv: ['create', '$file'],
            mutates: true,
            explain: 'Create a new xlsx workbook before writing extracted material data.'
        });
        normalized.safety = {
            ...(normalized.safety || {}),
            writesFile: true,
            requiresConfirmation: normalized.safety?.requiresConfirmation !== false
        };
        normalized.expectedOutputs = Array.from(new Set([...(normalized.expectedOutputs || []), 'logs', 'htmlPreview']));
        normalized.notes = Array.isArray(normalized.notes) ? normalized.notes : [];
        if (!normalized.notes.includes('No workbook was uploaded, so create $file was inserted as the first step.')) {
            normalized.notes.unshift('No workbook was uploaded, so create $file was inserted as the first step.');
        }
        return normalized;
    }

    function extractJson(text) {
        const raw = String(text || '').trim();
        if (!raw) throw new Error('模型返回为空');
        const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
        const source = fenced ? fenced[1].trim() : raw;
        const parseSource = (value) => JSON.parse(String(value).replace(/,\s*([}\]])/g, '$1'));
        try {
            return parseSource(source);
        } catch (firstError) {
            const first = source.indexOf('{');
            const last = source.lastIndexOf('}');
            if (first >= 0 && last > first) {
                return parseSource(source.slice(first, last + 1));
            }
            throw firstError;
        }
    }

    async function repairPlannerJsonContent(content, userPrompt, signal) {
        const url = buildChatCompletionsUrl(settings.apiBaseUrl);
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${settings.apiKey}`
            },
            body: JSON.stringify({
                model: settings.model,
                temperature: 0,
                messages: [
                    { role: 'system', content: 'Rewrite invalid OfficeCLI plan output into one strict JSON object only. Do not add Markdown. Keep argv as JSON arrays of strings.' },
                    { role: 'user', content: `User task:\n${userPrompt}\n\nInvalid output:\n${String(content || '').slice(0, 24000)}` }
                ]
            }),
            signal
        });
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Planner JSON repair failed: ${response.status} ${text.trim().slice(0, 160)}`);
        }
        const data = await readJsonResponse(response);
        return data?.choices?.[0]?.message?.content || '';
    }

    function buildChatCompletionsUrl(apiBaseUrl) {
        const raw = String(apiBaseUrl || '').trim();
        if (!raw) return '';
        let url;
        try {
            url = new URL(raw);
        } catch (error) {
            throw new Error('API Base URL 格式不正确，请填写类似 https://yunwu.ai/v1 的地址');
        }
        url.hash = '';
        url.search = '';
        url.pathname = url.pathname.replace(/\/+$/, '');
        if (/\/chat\/completions$/i.test(url.pathname)) {
            return url.toString();
        }
        if (/\/v\d+$/i.test(url.pathname)) {
            url.pathname += '/chat/completions';
            return url.toString();
        }
        url.pathname += '/v1/chat/completions';
        return url.toString();
    }

    async function readJsonResponse(response) {
        const contentType = response.headers.get('content-type') || '';
        const text = await response.text();
        const preview = text.trim().slice(0, 180);
        if (/text\/html/i.test(contentType) || /^<!doctype html/i.test(preview) || /^<html[\s>]/i.test(preview)) {
            throw new Error('模型接口返回了网页 HTML，请把 API Base URL 改成 OpenAI 兼容地址，例如 https://yunwu.ai/v1');
        }
        try {
            return JSON.parse(text);
        } catch (error) {
            throw new Error(`模型接口没有返回合法 JSON，请检查 API Base URL / 模型名称。返回片段：${preview || '空响应'}`);
        }
    }

    function buildUserPrompt() {
        const meta = state.fileMeta || {};
        const hasWorkbook = Boolean(state.fileMeta?.name || state.filePath);
        return [
            '请根据下面信息生成 OfficeCLI Excel 命令计划。',
            '',
            `用户任务：${state.instruction || '读取表格结构并生成预览。'}`,
            `当前文件：${hasWorkbook ? (meta.name || state.filePath || '$file') : '未上传，需要新建表格'}`,
            `文件类型：${hasWorkbook ? (meta.type || 'unknown') : 'new xlsx'}`,
            `文件大小：${hasWorkbook && meta.size ? `${Math.round(meta.size / 1024)} KB` : 'unknown'}`,
            ...buildMaterialPromptLines(),
            '',
            '要求：',
            '1. 只输出 JSON。',
            '2. commands[].argv 必须是参数数组，不要写 shell 字符串。',
            '3. 对当前文件统一使用 $file 占位符。',
            hasWorkbook
                ? '4. 如果需要写入，尽量生成新文件或输出副本。'
                : '4. 当前没有上传表格，必须第一步执行 ["create","$file"] 创建新 xlsx，再用 set / batch 写入表头和数据。',
            '5. 如果补充材料里有图片或文字内容，请优先提取其中的 SKU、价格、国家、条款、商品参数、地址、数量等可落表字段。',
            '6. 如果已有表格但还不知道真实 sheet 名、列名或行号，先生成读取计划，不要编造写入位置；如果是新建表格，可以直接使用 Sheet1/A1 等默认路径。',
            '7. 计划中必须包含解释性 title / explain，方便前端展示给用户确认。',
            '8. 最后加入 validate 和 ["view","$file","html"] 方便预览和导出。'
        ].join('\n');
    }

    function resultTextForPlanning(result) {
        if (!result) return '';
        const lines = [];
        lines.push(`执行状态：${result.success === false ? '失败' : '成功'}`);
        if (result.message) lines.push(`消息：${result.message}`);
        if (result.filePath) lines.push(`当前工作区文件：${result.filePath}`);
        if (result.workspace) lines.push(`工作目录：${result.workspace}`);
        if (Array.isArray(result.artifacts) && result.artifacts.length) {
            lines.push(`输出文件：${result.artifacts.map((item) => (typeof item === 'string' ? item : item.path || item.name || JSON.stringify(item))).join('；')}`);
        }
        if (Array.isArray(result.logs) && result.logs.length) {
            lines.push('');
            lines.push('OfficeCLI 日志 / stdout：');
            lines.push(result.logs.join('\n'));
        }
        if (Array.isArray(result.commands) && result.commands.length) {
            lines.push('');
            lines.push('命令执行明细：');
            result.commands.forEach((command, index) => {
                lines.push(`--- command ${index + 1}: ${command.title || command.id || ''} ---`);
                if (command.stdout) lines.push(`stdout:\n${command.stdout}`);
                if (command.stderr) lines.push(`stderr:\n${command.stderr}`);
            });
        }
        return compactText(lines.join('\n'), 20000);
    }

    function buildFollowupPrompt(previousResult) {
        const meta = state.fileMeta || {};
        const previousPlan = state.plan ? JSON.stringify(state.plan, null, 2) : '{}';
        const executionText = resultTextForPlanning(previousResult);
        return [
            '请基于 OfficeCLI 已经读取到的表格结果，继续生成下一阶段 OfficeCLI Excel 命令计划。',
            '',
            `用户原始任务：${state.instruction || '根据读取结果继续完成表格任务。'}`,
            `当前文件：${meta.name || previousResult?.filePath || '$file'}`,
            `文件类型：${meta.type || 'unknown'}`,
            ...buildMaterialPromptLines(),
            '',
            '上一阶段命令计划：',
            compactText(previousPlan, 6000),
            '',
            '上一阶段执行结果：',
            executionText || '没有可用执行结果。',
            '',
            '后续计划要求：',
            '1. 只输出 JSON，不要 Markdown。',
            '2. commands[].argv 必须是参数数组，argv 不要包含 officecli 本体。',
            '3. 继续使用 $file 占位符，不要把 $file 拼进新文件名。',
            '4. 如果读取结果已经包含真实 sheet 名、表头、列号和行号，请直接生成 set / batch / validate / view html 等写入计划。',
            '5. 如果仍然无法确定全部行范围，先生成更充分的读取计划，例如 ["view","$file","text","--max-lines","200","--json"] 或 get 具体范围，不要编造不存在的行号。',
            '6. 对“把某列全部替换为某值”这类任务，优先用真实 sheet 名和真实列号生成范围 set 或 batch set；不要只停留在读取结构。',
            '7. 写入计划必须把 mutates 设置为 true，并将 safety.writesFile 设置为 true。',
            '8. 最后附加 validate 和 ["view","$file","html"] 方便前端展示修改结果。'
        ].join('\n');
    }

    async function callPlannerModel(userPrompt = buildUserPrompt()) {
        if (!settings.apiBaseUrl || !settings.apiKey) {
            throw new Error('请先在设置层填写大模型 API Base URL 和 API Key');
        }
        const imageMaterials = getActiveMaterials().filter((material) => material.kind === 'image' && material.dataUrl);
        const userContent = imageMaterials.length
            ? [
                { type: 'text', text: userPrompt },
                ...imageMaterials.map((material) => ({
                    type: 'image_url',
                    image_url: {
                        url: material.dataUrl,
                        detail: 'high'
                    }
                }))
            ]
            : userPrompt;
        const url = buildChatCompletionsUrl(settings.apiBaseUrl);
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
                        { role: 'user', content: userContent }
                    ]
                }),
                signal: controller.signal
            });
            if (!response.ok) {
                const text = await response.text();
                const preview = text.trim().slice(0, 160);
                if (/^<!doctype html/i.test(preview) || /^<html[\s>]/i.test(preview)) {
                    throw new Error(`模型规划失败：接口返回网页 HTML。请把 API Base URL 改成 https://yunwu.ai/v1 后再试。`);
                }
                throw new Error(`模型规划失败：${response.status} ${preview}`);
            }
            const data = await readJsonResponse(response);
            const content = data?.choices?.[0]?.message?.content || '';
            try {
                return normalizePlan(extractJson(content));
            } catch (parseError) {
                addLog(`模型返回的计划 JSON 不合法，正在自动修复：${parseError.message}`, 'info');
                const repaired = await repairPlannerJsonContent(content, userPrompt, controller.signal);
                return normalizePlan(extractJson(repaired));
            }
        } finally {
            clearTimeout(timer);
        }
    }
    function createLocalReadPlan() {
        if (!state.file && !state.filePath) {
            return normalizePlan({
                goal: state.instruction || '根据需求新建表格',
                file: '$file',
                summary: '未配置模型时生成的新建空表兜底计划。配置多模态模型后可根据材料自动填充真实内容。',
                commands: [
                    {
                        id: 'create_workbook',
                        title: '新建 Excel 表格',
                        op: 'workbook.create',
                        argv: ['create', '$file'],
                        mutates: true,
                        explain: '在本地桥工作区创建一个新的 xlsx 文件。'
                    },
                    {
                        id: 'html_preview',
                        title: '生成 HTML 预览',
                        op: 'workbook.viewHtml',
                        argv: ['view', '$file', 'html'],
                        mutates: false,
                        explain: '返回浏览器可展示的表格预览。'
                    }
                ],
                safety: { writesFile: true, requiresConfirmation: true },
                expectedOutputs: ['logs', 'htmlPreview'],
                notes: ['这是兜底计划：未配置模型时无法从材料中提取字段。']
            });
        }
        return normalizePlan({
            goal: state.instruction || '读取工作簿结构',
            file: '$file',
            summary: '未配置模型时生成的只读示例计划。配置模型后可按自然语言生成真实操作计划。',
            commands: [
                {
                    id: 'view_json',
                    title: '读取表格前 20 行',
                    op: 'workbook.view',
                    argv: ['view', '$file', 'text', '--max-lines', '20', '--json'],
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
                    argv: ['view', '$file', 'html'],
                    mutates: false,
                    explain: '返回浏览器可展示的表格预览。'
                }
            ],
            safety: { writesFile: false, requiresConfirmation: true },
            expectedOutputs: ['logs', 'htmlPreview'],
            notes: ['这是兜底计划：它只展示 OfficeCLI 结构，不代表已理解用户的复杂修改目标。']
        });
    }

    async function generatePlan(autoExecute = false) {
        if (state.busy) return;
        state.instruction = byId('officecli-instruction').value.trim();
        if (!state.instruction) {
            toast('先写一个表格操作目标');
            return;
        }
        state.busy = true;
        state.result = null;
        let createdPlan = null;
        setProgress(12, '生成命令计划');
        renderBusy(autoExecute ? '正在生成并执行 OfficeCLI 任务...' : '正在让模型生成 OfficeCLI 命令计划...');
        addLog('开始规划 OfficeCLI 命令', 'info');
        try {
            const plan = ensureCreatePlanForNoWorkbook(settings.apiBaseUrl && settings.apiKey ? await callPlannerModel() : createLocalReadPlan());
            createdPlan = plan;
            state.plan = plan;
            localStorage.setItem(LAST_PLAN_KEY, JSON.stringify(plan));
            setProgress(autoExecute ? 35 : 100, autoExecute ? '计划完成，准备执行' : '计划生成完成');
            addLog(`命令计划生成完成：${commandCount(plan)} 个步骤`, 'success');
            render();
        } catch (error) {
            setProgress(100, '计划生成失败');
            addLog(error.message, 'error');
            toast(error.message);
            render();
        } finally {
            state.busy = false;
            render();
        }
        if (autoExecute && createdPlan) {
            await executePlan({ autoFollowup: true });
        }
    }

    async function executePlan(options = {}) {
        const autoFollowup = Boolean(options.autoFollowup);
        const followupDepth = Number(options.followupDepth) || 0;
        const maxFollowupDepth = 2;
        if (state.busy) return;
        if (!state.plan || !commandCount(state.plan)) {
            toast('请先生成命令计划');
            return;
        }
        state.plan = ensureCreatePlanForNoWorkbook(state.plan);
        localStorage.setItem(LAST_PLAN_KEY, JSON.stringify(state.plan));
        const hasWorkbookInput = Boolean(state.file || state.filePath);
        const canCreateWorkbook = state.plan.commands.some((command) => String(command.argv?.[0] || '').toLowerCase() === 'create');
        if (!hasWorkbookInput && !canCreateWorkbook) {
            toast('未上传表格时，命令计划必须先创建新表格');
            return;
        }
        const planIssue = findPlanIssue(state.plan);
        if (planIssue) {
            toast('命令计划需要重新生成');
            addLog(planIssue, 'error');
            return;
        }
        const executedPlan = state.plan;
        if (!settings.dryRun) {
            await checkBridge();
            if (!state.assistant?.officeCli?.available) {
                const message = state.assistant?.officeCli?.error || '未检测到 OfficeCLI。请先安装 OfficeCLI，点击重新检测；仍失败时再到设置层高级路径指定完整命令。';
                toast(message);
                addLog(message, 'error');
                return;
            }
        }
        let confirmedAt = '';
        if (settings.requireConfirmation && planWrites(state.plan)) {
            const ok = window.confirm('这个 OfficeCLI 计划包含写入动作。确认交给本地桥执行吗？');
            if (!ok) return;
            confirmedAt = new Date().toISOString();
        }
        state.busy = true;
        state.result = null;
        setProgress(settings.dryRun ? 45 : 52, settings.dryRun ? 'Dry Run 检查中' : '本地桥执行中');
        renderBusy(settings.dryRun ? '正在执行 Dry Run...' : '正在交给本地 OfficeCLI 执行...');
        addLog(settings.dryRun ? 'Dry Run：仅检查命令，不写入文件' : '发送到 OfficeCLI 本地桥', 'info');
        try {
            const generatedWorkbookPath = !hasWorkbookInput && canCreateWorkbook ? makeGeneratedWorkbookName() : '';
            const body = {
                tool: 'officecli',
                kind: 'excel',
                action: 'execute',
                file: {
                    name: state.fileMeta?.name || generatedWorkbookPath,
                    type: state.fileMeta?.type || (generatedWorkbookPath ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : ''),
                    size: state.fileMeta?.size || 0,
                    dataUrl: state.fileDataUrl || '',
                    path: state.filePath || generatedWorkbookPath
                },
                plan: state.plan,
                options: {
                    dryRun: settings.dryRun,
                    requireConfirmation: settings.requireConfirmation,
                    confirmedAt,
                    frontendVersion: FRONTEND_VERSION,
                    cliCommand: normalizeManualCliCommand(settings.cliCommand),
                    workspaceDir: cleanWorkspaceDir(settings.workspaceDir) || undefined,
                    returnHtml: true,
                    validate: true
                }
            };
            const result = await postBridge(body);
            state.result = result;
            setProgress(result.success === false ? 100 : 82, result.success === false ? '执行失败' : '整理执行结果');
            addLog(result.success === false ? 'OfficeCLI 执行失败' : 'OfficeCLI 执行完成', result.success === false ? 'error' : 'success');
            if (
                autoFollowup &&
                result.success !== false &&
                isReadOnlyPlan(executedPlan) &&
                settings.apiBaseUrl &&
                settings.apiKey &&
                followupDepth < maxFollowupDepth
            ) {
                setProgress(88, '生成后续计划');
                addLog('读取完成，正在自动生成下一段写入计划', 'info');
                const nextPlan = await callPlannerModel(buildFollowupPrompt(result));
                state.plan = nextPlan;
                localStorage.setItem(LAST_PLAN_KEY, JSON.stringify(nextPlan));
                addLog(`后续计划生成完成：${commandCount(nextPlan)} 个步骤`, planWrites(nextPlan) ? 'success' : 'info');
                render();
                state.busy = false;
                await executePlan({ autoFollowup: true, followupDepth: followupDepth + 1 });
                return;
            }
            if (autoFollowup && result.success !== false && isReadOnlyPlan(executedPlan) && followupDepth >= maxFollowupDepth) {
                addLog('自动读取轮次已达到上限，请补充更明确的修改目标后再试', 'error');
            }
            if (result.success !== false) setProgress(100, '执行完成');
            render();
        } catch (error) {
            setProgress(100, '执行失败');
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
            if (data?.service === 'wally-office-assistant') {
                const cliCommand = getConfiguredCliCommand();
                const recheck = await callAssistantControl('/control/recheck-officecli', cliCommand ? { cliCommand } : {}, data.bridgeUrl).catch(() => null);
                if (recheck?.officeCli) {
                    data.officeCli = recheck.officeCli;
                    data.cliCommand = recheck.cliCommand || cliCommand || data.cliCommand;
                }
            }
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

    async function callAssistantControl(pathname, body = null, bridgeUrl = '') {
        const baseUrl = (bridgeUrl || settings.bridgeUrl).replace(/\/officecli\/?$/, '');
        const response = await fetch(`${baseUrl}${pathname}`, {
            method: 'POST',
            headers: body ? { 'Content-Type': 'application/json' } : undefined,
            body: body ? JSON.stringify(body) : undefined
        });
        if (!response.ok) throw new Error(`Assistant control failed: ${response.status}`);
        return response.json();
    }

    function renderBusy(message) {
        const node = byId('officecli-busy-text');
        if (node) node.textContent = message;
    }

    function clampProgress(value) {
        return Math.max(0, Math.min(100, Number(value) || 0));
    }

    function getProgress() {
        const progress = state.progress || {};
        return {
            percent: clampProgress(progress.percent),
            label: progress.label || (state.busy ? '处理中' : '待开始')
        };
    }

    function setProgress(percent, label) {
        state.progress = { percent: clampProgress(percent), label: label || '' };
        renderLogProgress();
    }

    function renderLogProgress() {
        const progress = getProgress();
        const fill = byId('officecli-log-progress-fill');
        const text = byId('officecli-log-progress-text');
        if (fill) fill.style.width = `${progress.percent}%`;
        if (text) text.textContent = `${progress.label} ${progress.percent}%`;
    }

    function switchLayer(layer) {
        state.layer = layer;
        render();
    }

    async function handleFileChange(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        await setSelectedWorkbook({
            file,
            fileMeta: { name: file.name, size: file.size, type: file.type },
            fileDataUrl: await readAsDataUrl(file),
            filePath: file.path || ''
        });
    }

    async function handlePickFile() {
        const selection = await pickWorkbookFile();
        await setSelectedWorkbook(selection);
    }

    async function handleDropFiles(files) {
        const file = files && files[0];
        if (!file) return;
        await setSelectedWorkbook({
            file,
            fileMeta: { name: file.name, size: file.size, type: file.type },
            fileDataUrl: await readAsDataUrl(file),
            filePath: file.path || ''
        });
    }

    async function handleRunModify() {
        settings.dryRun = false;
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        await generatePlan(true);
    }

    async function handlePickWorkspaceDirectory() {
        const selected = await pickWorkspaceDirectory();
        if (!selected) return;
        const input = byId('officecli-workspace-dir');
        if (input) input.value = selected;
        settings.workspaceDir = selected;
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        toast('已选择工作目录');
        render();
    }

    function handleResetWorkspaceDirectory() {
        const input = byId('officecli-workspace-dir');
        if (input) input.value = '';
        settings.workspaceDir = '';
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        toast('已切换为本地桥默认工作目录');
        render();
    }

    async function handleOpenResultFile() {
        const filePath = state.result?.filePath || state.filePath || '';
        const artifact = Array.isArray(state.result?.artifacts)
            ? state.result.artifacts.find((item) => typeof item === 'string' ? item : item?.path)
            : null;
        const target = filePath || (typeof artifact === 'string' ? artifact : artifact?.path || '');
        if (!target) {
            toast('没有可打开的文件');
            return;
        }
        try {
            await openTargetPath(target);
        } catch (error) {
            toast(error.message);
        }
    }

    async function handleOpenResultFolder() {
        const filePath = state.result?.filePath || state.filePath || '';
        const workspace = state.result?.workspace || settings.workspaceDir || '';
        const target = workspace || getParentDirectory(filePath);
        if (!target) {
            toast('没有可打开的文件夹');
            return;
        }
        try {
            await openTargetPath(target);
        } catch (error) {
            toast(error.message);
        }
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
                            <b>1. 选择表格文件</b>
                        </div>
                        <div class="officecli-upload-row">
                            <button class="officecli-primary officecli-file-button" id="officecli-pick-file" ${state.busy ? 'disabled' : ''}>
                                <span class="material-symbols-outlined">upload_file</span>
                                选择文件
                            </button>
                            <div id="officecli-file-summary" class="officecli-file-summary" tabindex="0" role="button" aria-label="重新选择文件"></div>
                        </div>
                        <div id="officecli-dropzone" class="officecli-dropzone" tabindex="0">
                            <span class="material-symbols-outlined">cloud_upload</span>
                            <b>拖拽 Excel / CSV 到这里</b>
                            <p>也可以点上面的选择文件按钮</p>
                        </div>
                    </div>

                    <div class="officecli-panel">
                        <div class="officecli-panel-title">
                            <span class="material-symbols-outlined">psychology</span>
                            <b>2. 输入需求 / 拖入材料</b>
                        </div>
                        <div id="officecli-composer" class="officecli-composer" tabindex="0">
                            <textarea id="officecli-instruction" class="officecli-task-input" placeholder="输入需求，或直接把 Excel、产品图、截图、文本材料拖到这里。例如：根据这些图片和资料生成商品报价表。">${escapeHtml(state.instruction)}</textarea>
                            ${settings.enableMultimodalMaterials ? renderMaterialAttachments() : `
                                <p class="officecli-composer-hint">如需拖入图片/材料，请先在设置层开启“图片 / 材料理解”。</p>
                            `}
                            <div class="officecli-composer-bar">
                                <span>${state.fileMeta?.name ? `表格：${escapeHtml(state.fileMeta.name)}` : '未上传表格时，可根据材料和需求新建表格'}</span>
                                <button class="officecli-secondary" id="officecli-pick-materials" type="button" ${!settings.enableMultimodalMaterials || state.busy ? 'disabled' : ''}>
                                    <span class="material-symbols-outlined">attach_file</span>
                                    添加材料
                                </button>
                            </div>
                        </div>
                        <div class="officecli-actions">
                            <button class="officecli-primary" id="officecli-run-modify" ${state.busy ? 'disabled' : ''}>
                                <span class="material-symbols-outlined">auto_awesome</span>
                                一键修改
                            </button>
                        </div>
                        <div id="officecli-busy-text" class="officecli-busy">${state.busy ? '处理中...' : ''}</div>
                    </div>
                </div>

                <div class="officecli-right">
                    <div class="officecli-panel officecli-result-panel">
                        <div class="officecli-panel-title">
                            <span class="material-symbols-outlined">preview</span>
                            <b>执行结果 / HTML 预览</b>
                        </div>
                        ${renderResult()}
                    </div>
                    <details class="officecli-panel officecli-plan-panel officecli-plan-details">
                        <summary>
                            <span class="material-symbols-outlined">account_tree</span>
                            <b>命令计划</b>
                            <span class="officecli-plan-summary">${renderPlanSummary()}</span>
                        </summary>
                        ${renderPlan()}
                    </details>
                    <details class="officecli-panel officecli-log-panel officecli-log-details">
                        <summary>
                            <span class="material-symbols-outlined">receipt_long</span>
                            <b>运行日志</b>
                            <span class="officecli-log-progress" aria-hidden="true">
                                <i id="officecli-log-progress-fill" style="width:${getProgress().percent}%"></i>
                            </span>
                            <span id="officecli-log-progress-text" class="officecli-log-progress-text">${escapeHtml(getProgress().label)} ${getProgress().percent}%</span>
                            <span id="officecli-log-summary" class="officecli-log-summary">收纳</span>
                        </summary>
                        <div id="officecli-logs" class="officecli-logs"></div>
                    </details>
                </div>
            </section>
        `;
    }

    function renderSettingsLayer() {
        const manualCliCommand = normalizeManualCliCommand(settings.cliCommand);
        const detectedCliCommand = getDetectedCliCommand();
        const officeCli = state.assistant?.officeCli || {};
        const capabilities = officeCli.capabilities || {};
        const cliDetectLabel = officeCli.available
            ? '已自动定位 OfficeCLI'
            : (state.bridgeStatus === 'online' ? '等待重新检测或安装 OfficeCLI' : '先启动桌面助手后自动检测');
        const cliDetectDetail = detectedCliCommand || (manualCliCommand ? `手动指定：${manualCliCommand}` : '无需填写路径，桌面助手会扫描常见安装位置、内置资源和系统 PATH');
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
                        <div class="officecli-switches single">
                            <label><input id="officecli-enable-materials" type="checkbox" ${settings.enableMultimodalMaterials ? 'checked' : ''}> 启用图片 / 材料理解</label>
                        </div>
                        <p class="officecli-help">仅在当前模型支持图片理解时开启。开启后，使用层可上传产品图、截图或文本材料，模型会先提取内容再生成 OfficeCLI 命令计划。</p>
                        <p class="officecli-help">这里的大模型只负责把任务翻译成 OfficeCLI 命令计划；表格文件读写由本地桥处理。填写 https://yunwu.ai 这类根域名时，前端会自动调用 /v1/chat/completions。</p>
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
                        <input id="officecli-assistant-protocol" type="hidden" value="${escapeHtml(settings.assistantProtocol || defaultSettings.assistantProtocol)}">
                        <div class="officecli-field">
                            <span>OfficeCLI 自动检测</span>
                            <div class="officecli-cli-detect">
                                <div>
                                    <b class="${officeCli.available ? 'ok' : 'bad'}">${escapeHtml(cliDetectLabel)}</b>
                                    <p>${escapeHtml(cliDetectDetail)}</p>
                                    <small>表格读取：${capabilities.csvRead ? '已通过' : '未通过或等待检测'}</small>
                                </div>
                                <button class="officecli-secondary" id="officecli-auto-detect-cli" type="button">
                                    <span class="material-symbols-outlined">manage_search</span>
                                    自动检测
                                </button>
                            </div>
                        </div>
                        <details class="officecli-advanced-cli" ${manualCliCommand ? 'open' : ''}>
                            <summary>高级：手动指定 OfficeCLI 路径</summary>
                            <label class="officecli-field">
                                <span>命令路径</span>
                                <input id="officecli-cli-command" type="text" value="${escapeHtml(manualCliCommand)}" placeholder="仅自动检测失败时填写，例如 C:\\Program Files\\OfficeCLI\\officecli.exe">
                            </label>
                            <div class="officecli-path-row">
                                <button class="officecli-ghost" id="officecli-clear-cli-command" type="button">
                                    <span class="material-symbols-outlined">restart_alt</span>
                                    清除手动路径
                                </button>
                            </div>
                            <p class="officecli-help">普通用户通常不需要填写这里；留空时会自动查找 OfficeCLI 安装目录、桌面助手内置目录和系统 PATH。</p>
                        </details>
                        <label class="officecli-field">
                            <span>工作目录</span>
                            <input id="officecli-workspace-dir" type="hidden" value="${escapeHtml(settings.workspaceDir)}">
                            <div class="officecli-workspace-auto">
                                <div>
                                    <b>${escapeHtml(state.assistant?.workspace || settings.workspaceDir || '自动使用本地桥默认目录')}</b>
                                    <span>${settings.workspaceDir ? '已指定自定义目录' : '无需手动填写路径；执行时自动使用桌面助手工作区'}</span>
                                </div>
                            </div>
                            <div class="officecli-path-row">
                                <button class="officecli-secondary" id="officecli-pick-workspace-dir" type="button">
                                    <span class="material-symbols-outlined">folder_open</span>
                                    更改目录
                                </button>
                                <button class="officecli-ghost" id="officecli-reset-workspace-dir" type="button">
                                    <span class="material-symbols-outlined">restart_alt</span>
                                    使用默认目录
                                </button>
                            </div>
                        </label>
                        <div class="officecli-switches">
                            <label><input id="officecli-dry-run" type="checkbox" ${settings.dryRun ? 'checked' : ''}> 默认 Dry Run</label>
                            <label><input id="officecli-require-confirm" type="checkbox" ${settings.requireConfirmation ? 'checked' : ''}> 写入前弹窗确认</label>
                        </div>
                        <p class="officecli-help">默认信任本机 OfficeCLI 写入任务，不再重复弹出系统确认框。需要更谨慎时，可重新开启“写入前弹窗确认”。</p>
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
        const capabilities = officeCli.capabilities || {};
        const isOnline = state.bridgeStatus === 'online';
        const compatible = isFrontendCompatible(assistant.minFrontendVersion);
        const officeCliHint = officeCli.available
            ? `可用 ${officeCli.version || ''}`.trim()
            : `未检测到：${officeCli.error || '请先自动检测，必要时再填写高级路径'}`;
        const csvReadHint = capabilities.csvRead
            ? 'CSV / Excel 读取已通过'
            : (officeCli.checks ? 'CSV 读取未通过' : '等待检测');
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
                        <b class="${officeCli.available ? 'ok' : 'bad'}">${escapeHtml(officeCliHint)}</b>
                    </div>
                    <div>
                        <span>表格读取</span>
                        <b class="${capabilities.csvRead ? 'ok' : 'bad'}">${escapeHtml(csvReadHint)}</b>
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
                    <a class="officecli-download-link primary" href="${ASSISTANT_SETUP_URL}" target="_blank" rel="noreferrer">
                        <span class="material-symbols-outlined">download</span>
                        下载桌面助手
                    </a>
                    <a class="officecli-download-link" href="desktop-assistant/README.md" target="_blank" rel="noreferrer">
                        <span class="material-symbols-outlined">description</span>
                        查看安装说明
                    </a>
                    <a class="officecli-download-link" href="${ASSISTANT_RELEASE_URL}" target="_blank" rel="noreferrer">
                        <span class="material-symbols-outlined">open_in_new</span>
                        Release 页面
                    </a>
                </div>
                ${!isOnline ? `
                    <p class="officecli-help officecli-warning">未检测到桌面助手：先下载安装 Wally Office Assistant，保持助手运行，然后点击“重新检测”。</p>
                ` : ''}
                ${isOnline && !officeCli.available ? `
                    <p class="officecli-help officecli-warning">本地桥已连接，但真正执行表格的 OfficeCLI 引擎没有检测到。先点击“重新检测”；仍失败时，再到设置层的高级路径里指定完整 exe / cmd。</p>
                ` : ''}
            </div>
        `;
    }

    function renderMaterialAttachments() {
        const materials = state.materials || [];
        return `
            ${materials.length ? `
                <div class="officecli-material-list">
                    ${materials.map((material) => `
                        <article class="officecli-material-item">
                            ${material.kind === 'image' && material.dataUrl ? `
                                <img src="${escapeHtml(material.dataUrl)}" alt="">
                            ` : `
                                <span class="material-symbols-outlined">${material.kind === 'text' ? 'article' : 'draft'}</span>
                            `}
                            <div>
                                <b>${escapeHtml(material.name)}</b>
                                <small>${escapeHtml(material.kind === 'image' ? '图片理解' : (material.kind === 'text' ? '文本提取' : '仅文件信息'))} · ${Math.max(1, Math.round((material.size || 0) / 1024))} KB</small>
                            </div>
                            <button class="officecli-icon-btn small" type="button" data-remove-material="${escapeHtml(material.id)}" aria-label="移除材料" ${state.busy ? 'disabled' : ''}>
                                <span class="material-symbols-outlined">close</span>
                            </button>
                        </article>
                    `).join('')}
                    <button class="officecli-ghost officecli-clear-chip" id="officecli-clear-materials" type="button" ${state.busy ? 'disabled' : ''}>
                        <span class="material-symbols-outlined">delete_sweep</span>
                        清空材料
                    </button>
                </div>
            ` : '<p class="officecli-composer-hint">可拖入产品图、截图、文本材料；拖入 Excel / CSV 会自动作为表格文件。</p>'}
        `;
    }

    function renderPlanSummary() {
        if (!state.plan || !commandCount(state.plan)) return '等待计划';
        const commands = Array.isArray(state.plan.commands) ? state.plan.commands : [];
        const labels = commands
            .slice(0, 3)
            .map((command) => command.title || command.op || command.id || '步骤')
            .join(' / ');
        const suffix = commands.length > 3 ? ' ...' : '';
        return `${commands.length} 步 · ${labels}${suffix}`;
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
                            <code>${escapeHtml([getDetectedCliCommand() || getManualCliCommand() || 'officecli', ...command.argv].join(' '))}</code>
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
                    <p>完成修改后，这里会优先显示 HTML 预览、导出文件与可回看日志。</p>
                </div>
            `;
        }
        const html = state.result.html || state.result.previewHtml || '';
        const artifacts = Array.isArray(state.result.artifacts) ? state.result.artifacts : [];
        const logs = Array.isArray(state.result.logs) ? state.result.logs : [];
        const filePath = state.result.filePath || state.filePath || '';
        const workspace = state.result.workspace || settings.workspaceDir || '';
        const resultFile = artifacts.find((item) => typeof item === 'string' ? item : item?.path);
        const openFilePath = filePath || (typeof resultFile === 'string' ? resultFile : resultFile?.path || '');
        const canOpenFile = Boolean(openFilePath);
        const canOpenFolder = Boolean(workspace || openFilePath);
        return `
            <div class="officecli-result-head">
                <div class="officecli-result-summary">
                    <b>${escapeHtml(state.result.success === false ? '执行失败' : '执行完成')}</b>
                    <p>${escapeHtml(state.result.message || '')}</p>
                </div>
                <div class="officecli-result-actions">
                    ${canOpenFile ? `
                        <button class="officecli-secondary" id="officecli-open-result-file">
                            <span class="material-symbols-outlined">open_in_new</span>
                            打开文件
                        </button>
                    ` : ''}
                    ${canOpenFolder ? `
                        <button class="officecli-secondary" id="officecli-open-result-folder">
                            <span class="material-symbols-outlined">folder_open</span>
                            打开文件夹
                        </button>
                    ` : ''}
                </div>
            </div>
            ${html ? `<iframe class="officecli-preview-frame" srcdoc="${escapeHtml(html)}"></iframe>` : `
                <div class="officecli-empty small">
                    <span class="material-symbols-outlined">preview_off</span>
                    <b>暂无 HTML 预览</b>
                    <p>这次执行没有返回可预览内容，但文件结果和日志仍然可用。</p>
                </div>
            `}
            <details class="officecli-result-details">
                <summary>
                    <span class="material-symbols-outlined">data_object</span>
                    <b>运行详情</b>
                </summary>
                <pre class="officecli-result-json">${escapeHtml(JSON.stringify({
                    success: state.result.success,
                    message: state.result.message,
                    filePath,
                    workspace,
                    logs: logs.slice(-8)
                }, null, 2))}</pre>
            </details>
        `;
    }

    function renderLogs() {
        const node = byId('officecli-logs');
        if (!node) return;
        const summary = byId('officecli-log-summary');
        if (summary) {
            summary.textContent = state.logs.length ? `${state.logs.length} 条` : '收纳';
        }
        const items = state.logs.slice(0, 6);
        node.innerHTML = items.length ? items.map((log) => `
            <div class="${escapeHtml(log.type)}">
                <span>${escapeHtml(log.stamp)}</span>
                <p>${escapeHtml(log.message)}</p>
            </div>
        `).join('') : '<p class="officecli-muted">暂无运行日志。</p>';
        renderLogProgress();
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
        byId('officecli-pick-file')?.addEventListener('click', handlePickFile);
        byId('officecli-run-modify')?.addEventListener('click', handleRunModify);
        byId('officecli-instruction')?.addEventListener('input', (event) => {
            state.instruction = event.target.value;
        });
        const composer = byId('officecli-composer');
        if (composer) {
            composer.addEventListener('dragover', (event) => {
                event.preventDefault();
                composer.classList.add('dragging');
            });
            composer.addEventListener('dragleave', () => {
                composer.classList.remove('dragging');
            });
            composer.addEventListener('drop', async (event) => {
                event.preventDefault();
                composer.classList.remove('dragging');
                await handleComposerFiles(event.dataTransfer?.files);
            });
        }
        byId('officecli-pick-materials')?.addEventListener('click', async () => {
            const files = await pickMaterialFiles();
            await addMaterialFiles(files);
        });
        byId('officecli-clear-materials')?.addEventListener('click', clearMaterials);
        document.querySelectorAll('[data-remove-material]').forEach((button) => {
            button.addEventListener('click', () => removeMaterial(button.dataset.removeMaterial));
        });
        byId('officecli-open-result-file')?.addEventListener('click', handleOpenResultFile);
        byId('officecli-open-result-folder')?.addEventListener('click', handleOpenResultFolder);
        const dropzone = byId('officecli-dropzone');
        if (dropzone) {
            dropzone.addEventListener('click', handlePickFile);
            dropzone.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handlePickFile();
                }
            });
            dropzone.addEventListener('dragover', (event) => {
                event.preventDefault();
                dropzone.classList.add('dragging');
            });
            dropzone.addEventListener('dragleave', () => {
                dropzone.classList.remove('dragging');
            });
            dropzone.addEventListener('drop', async (event) => {
                event.preventDefault();
                dropzone.classList.remove('dragging');
                const files = event.dataTransfer?.files;
                if (files && files.length) {
                    await handleDropFiles(files);
                }
            });
        }
        byId('officecli-file-summary')?.addEventListener('click', handlePickFile);
        byId('officecli-file-summary')?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handlePickFile();
            }
        });
    }

    function bindSettingsLayer() {
        byId('officecli-save-settings')?.addEventListener('click', saveSettingsFromForm);
        byId('officecli-reset-settings')?.addEventListener('click', resetSettings);
        byId('officecli-launch-assistant')?.addEventListener('click', launchAssistant);
        byId('officecli-pick-workspace-dir')?.addEventListener('click', handlePickWorkspaceDirectory);
        byId('officecli-reset-workspace-dir')?.addEventListener('click', handleResetWorkspaceDirectory);
        byId('officecli-auto-detect-cli')?.addEventListener('click', () => {
            useAutoCliDetection();
        });
        byId('officecli-clear-cli-command')?.addEventListener('click', () => {
            useAutoCliDetection();
        });
        byId('officecli-check-assistant')?.addEventListener('click', () => {
            saveSettingsFromForm();
            checkBridge();
        });
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
                cursor: pointer;
            }
            .officecli-file-summary b {
                overflow: hidden;
                color: #0f172a;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .officecli-path-row {
                display: flex;
                gap: 8px;
                align-items: center;
            }
            .officecli-path-row input {
                flex: 1;
                min-width: 0;
            }
            .officecli-workspace-auto {
                display: flex;
                align-items: center;
                min-height: 54px;
                padding: 10px 12px;
                border: 1px solid #dbeafe;
                border-radius: 8px;
                background: #eff6ff;
                color: #1e3a8a;
            }
            .officecli-workspace-auto b,
            .officecli-workspace-auto span {
                display: block;
            }
            .officecli-workspace-auto b {
                max-width: 100%;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                font-size: 13px;
            }
            .officecli-workspace-auto span {
                margin-top: 4px;
                color: #64748b;
                font-size: 12px;
                font-weight: 600;
            }
            .officecli-dropzone {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 6px;
                min-height: 108px;
                margin-top: 12px;
                border: 1px dashed #cbd5e1;
                border-radius: 8px;
                background: #f8fafc;
                color: #475569;
                text-align: center;
                cursor: pointer;
                transition: border-color .18s ease, background .18s ease, transform .18s ease;
            }
            .officecli-dropzone.dragging {
                border-color: #2563eb;
                background: #eff6ff;
                transform: translateY(-1px);
            }
            .officecli-dropzone .material-symbols-outlined {
                font-size: 24px;
                color: #2563eb;
            }
            .officecli-dropzone b {
                color: #0f172a;
                font-size: 13px;
            }
            .officecli-dropzone p {
                margin: 0;
                font-size: 12px;
            }
            .officecli-composer {
                margin-top: 10px;
                border: 1px solid #cbd5e1;
                border-radius: 8px;
                background: #fff;
                transition: border-color .18s ease, box-shadow .18s ease, background .18s ease;
            }
            .officecli-composer.dragging {
                border-color: #2563eb;
                background: #eff6ff;
                box-shadow: 0 0 0 3px rgba(37, 99, 235, .12);
            }
            .officecli-composer .officecli-task-input {
                min-height: 132px;
                border: 0;
                box-shadow: none;
            }
            .officecli-composer .officecli-task-input:focus {
                box-shadow: none;
            }
            .officecli-composer-hint {
                margin: 0 12px 10px;
                color: #94a3b8;
                font-size: 12px;
                line-height: 1.4;
            }
            .officecli-composer-bar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding: 10px 12px;
                border-top: 1px solid #e2e8f0;
            }
            .officecli-composer-bar span {
                min-width: 0;
                overflow: hidden;
                color: #64748b;
                font-size: 12px;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .officecli-material-list {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 8px;
                padding: 0 12px 10px;
            }
            .officecli-material-item {
                display: grid;
                grid-template-columns: 44px minmax(0, 1fr) 30px;
                gap: 10px;
                align-items: center;
                min-height: 56px;
                padding: 8px;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                background: #f8fafc;
            }
            .officecli-material-item img,
            .officecli-material-item > .material-symbols-outlined {
                width: 44px;
                height: 44px;
                border-radius: 8px;
                background: #eef2ff;
                color: #4f46e5;
            }
            .officecli-material-item img {
                object-fit: cover;
            }
            .officecli-material-item > .material-symbols-outlined {
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .officecli-material-item b,
            .officecli-material-item small {
                display: block;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .officecli-material-item b {
                color: #0f172a;
                font-size: 12px;
            }
            .officecli-material-item small {
                margin-top: 4px;
                color: #64748b;
                font-size: 11px;
            }
            .officecli-icon-btn.small {
                width: 30px;
                height: 30px;
                color: #64748b;
            }
            .officecli-clear-chip {
                min-height: 56px;
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
            .officecli-inline-check {
                display: inline-flex;
                align-items: center;
                gap: 7px;
                min-height: 36px;
                padding: 0 10px;
                border: 1px solid #fed7aa;
                border-radius: 8px;
                background: #fff7ed;
                color: #c2410c;
                font-size: 12px;
                font-weight: 800;
                white-space: nowrap;
            }
            .officecli-inline-check input {
                width: 14px;
                height: 14px;
                accent-color: #ea580c;
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
            .officecli-result-panel {
                min-height: 220px;
            }
            .officecli-plan-panel[open] {
                min-height: 220px;
            }
            .officecli-plan-details {
                padding: 10px 12px;
            }
            .officecli-plan-details[open] {
                padding: 14px;
            }
            .officecli-plan-details:not([open]) {
                min-height: 0;
            }
            .officecli-plan-details > summary,
            .officecli-result-details > summary {
                display: flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
                list-style: none;
                color: #0f172a;
                font-weight: 600;
                font-size: 13px;
            }
            .officecli-plan-details:not([open]) > summary {
                min-height: 24px;
            }
            .officecli-plan-details > summary::-webkit-details-marker,
            .officecli-result-details > summary::-webkit-details-marker {
                display: none;
            }
            .officecli-log-details > summary {
                display: flex;
                align-items: center;
                gap: 8px;
                list-style: none;
                cursor: pointer;
                color: #0f172a;
                font-weight: 600;
                font-size: 13px;
            }
            .officecli-log-progress {
                flex: 1 1 180px;
                max-width: 390px;
                height: 8px;
                margin-left: auto;
                overflow: hidden;
                border-radius: 999px;
                background: #e2e8f0;
            }
            .officecli-log-progress i {
                display: block;
                width: 0;
                height: 100%;
                border-radius: inherit;
                background: linear-gradient(90deg, #2563eb, #22c55e);
                transition: width .25s ease;
            }
            .officecli-log-progress-text {
                min-width: 104px;
                color: #64748b;
                font-size: 11px;
                font-weight: 700;
                text-align: right;
                white-space: nowrap;
            }
            .officecli-log-summary {
                border-radius: 999px;
                padding: 2px 8px;
                background: #e2e8f0;
                color: #475569;
                font-size: 11px;
                font-weight: 700;
            }
            .officecli-plan-summary {
                min-width: 0;
                margin-left: auto;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                color: #64748b;
                font-size: 12px;
                font-weight: 600;
            }
            .officecli-result-head {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 12px;
                margin-bottom: 12px;
            }
            .officecli-result-summary b {
                display: block;
                color: #0f172a;
                font-size: 14px;
            }
            .officecli-result-summary p {
                margin: 5px 0 0;
                color: #64748b;
                font-size: 12px;
                line-height: 1.45;
            }
            .officecli-result-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                justify-content: flex-end;
            }
            .officecli-plan-head {
                display: flex;
                justify-content: space-between;
                gap: 12px;
                padding: 10px 11px;
                border-radius: 8px;
                background: #f8fafc;
            }
            .officecli-plan-head b {
                color: #0f172a;
                font-size: 13px;
            }
            .officecli-plan-head p {
                margin: 5px 0 0;
                color: #64748b;
                font-size: 12px;
                line-height: 1.4;
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
                gap: 7px;
                margin-top: 8px;
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
            .officecli-result-details {
                margin-top: 10px;
                padding-top: 10px;
                border-top: 1px solid #e2e8f0;
            }
            .officecli-followup-callout {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                margin-bottom: 10px;
                padding: 12px;
                border: 1px solid #bfdbfe;
                border-radius: 8px;
                background: #eff6ff;
                color: #1e3a8a;
            }
            .officecli-followup-callout b {
                display: block;
                margin-bottom: 4px;
                color: #1d4ed8;
                font-size: 13px;
            }
            .officecli-followup-callout p {
                margin: 0;
                color: #475569;
                font-size: 12px;
                line-height: 1.45;
            }
            .officecli-followup-callout button {
                flex: 0 0 auto;
            }
            .officecli-artifacts {
                margin-top: 10px;
                padding: 10px;
                border-radius: 8px;
                background: #f0fdf4;
                color: #166534;
                font-size: 12px;
            }
            .officecli-artifacts.dry-run {
                background: #fff7ed;
                color: #c2410c;
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
                min-height: auto;
            }
            .officecli-logs {
                max-height: 140px;
                overflow: auto;
                display: flex;
                flex-direction: column;
                gap: 7px;
                margin-top: 10px;
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
            .officecli-warning {
                padding: 10px 12px;
                border: 1px solid #fed7aa;
                border-radius: 8px;
                background: #fff7ed;
                color: #c2410c;
            }
            .officecli-cli-detect {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 12px;
                padding: 12px;
                border: 1px solid #dbe4f0;
                border-radius: 8px;
                background: #f8fafc;
            }
            .officecli-cli-detect b {
                display: block;
                margin: 0 0 6px;
                font-size: 13px;
            }
            .officecli-cli-detect p {
                margin: 0 0 6px;
                color: #475569;
                font-size: 12px;
                line-height: 1.45;
                overflow-wrap: anywhere;
            }
            .officecli-cli-detect small {
                color: #94a3b8;
                font-size: 11px;
            }
            .officecli-advanced-cli {
                margin-top: 10px;
                border: 1px dashed #cbd5e1;
                border-radius: 8px;
                padding: 10px 12px;
                background: #fff;
            }
            .officecli-advanced-cli > summary {
                cursor: pointer;
                color: #0f172a;
                font-size: 12px;
                font-weight: 800;
            }
            .officecli-advanced-cli[open] > summary {
                margin-bottom: 10px;
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
            .officecli-download-link.primary {
                border-color: #16a34a;
                background: #16a34a;
                color: #fff;
            }
            .officecli-switches {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 8px;
                margin-top: 12px;
            }
            .officecli-switches.single {
                grid-template-columns: 1fr;
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
                .officecli-material-list,
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

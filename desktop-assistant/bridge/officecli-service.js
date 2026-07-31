import http from 'node:http';
import { spawn } from 'node:child_process';
import { access, mkdir, readFile, writeFile, appendFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const MAX_BODY_BYTES = 80 * 1024 * 1024;
const MAX_HISTORY_ITEMS = 100;
const DEFAULT_PORT = 8765;
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_WORKSPACE = path.join(os.homedir(), 'WallyOffice', 'workspace');
const PROTOCOL_VERSION = '1.0.0';
const MIN_FRONTEND_VERSION = '0.1.0';
const SERVICE_DIR = path.dirname(fileURLToPath(import.meta.url));
const ASSISTANT_DIR = path.resolve(SERVICE_DIR, '..');
const ALLOWED_COMMANDS = new Set([
    'create',
    'view',
    'get',
    'query',
    'set',
    'add',
    'remove',
    'move',
    'swap',
    'validate',
    'batch',
    'watch',
    'help'
]);

function isUnsafeWorkspacePath(targetPath) {
    const normalized = path.resolve(String(targetPath || '')).replace(/\//g, '\\').toLowerCase();
    return /^[a-z]:\\windows(\\|$)/.test(normalized) || normalized.includes('\\windows\\system32');
}

function resolveWorkspaceDir(requested, fallback = DEFAULT_WORKSPACE) {
    const raw = String(requested || '').trim();
    const safeFallback = path.resolve(fallback || DEFAULT_WORKSPACE);
    if (!raw || !path.isAbsolute(raw)) return safeFallback;
    const resolved = path.resolve(raw);
    return isUnsafeWorkspacePath(resolved) ? path.resolve(DEFAULT_WORKSPACE) : resolved;
}

function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(JSON.stringify(data, null, 2));
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let size = 0;
        const chunks = [];
        req.on('data', (chunk) => {
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
                reject(new Error('Request body is too large.'));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
}

function safeJsonParse(value, fallback) {
    try {
        return JSON.parse(value || '{}');
    } catch (error) {
        return fallback;
    }
}

function sanitizeName(name) {
    const fallback = `workbook-${crypto.randomUUID()}.xlsx`;
    return String(name || fallback).replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').slice(0, 180) || fallback;
}

function decodeDataUrl(dataUrl) {
    const match = String(dataUrl || '').match(/^data:.*?;base64,(.*)$/);
    if (!match) return null;
    return Buffer.from(match[1], 'base64');
}

function isSafeArg(arg) {
    return !/[\x00-\x1F`]/.test(String(arg));
}

function normalizeOfficeCliArgv(argv) {
    const args = Array.isArray(argv) ? argv.map((item) => String(item)) : [];
    if (!args.length) return args;
    if (args[0] !== 'view') return args;

    const htmlFlagIndex = args.indexOf('--html');
    if (htmlFlagIndex >= 0) {
        return ['view', args[1], 'html', ...args.slice(2).filter((arg) => arg !== '--html')].filter(Boolean);
    }

    const formatIndex = args.indexOf('--format');
    if (formatIndex < 0) return args;

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
    return args;
}

function resolveWorkbookArgv(argv, workbookPath) {
    return normalizeOfficeCliArgv(argv).map((arg) => {
        const value = String(arg);
        if (value === '$file') return workbookPath;
        if (value.includes('$file')) {
            throw new Error(`文件占位符只能作为单独参数使用，不能拼接到路径或文件名中：${value}`);
        }
        if (/__[^_\s]+(?:_[^_\s]+)*__/i.test(value)) {
            throw new Error(`命令计划包含未解析占位符：${value}。请先读取表格结构，拿到真实 sheet / 表头 / 单元格路径后再执行写入。`);
        }
        return value;
    });
}

function hasFileInput(file = {}) {
    return Boolean(file.path || file.dataUrl);
}

function isCreateWorkbookCommand(command = {}) {
    const argv = normalizeOfficeCliArgv(command.argv || []);
    return String(argv[0] || '').toLowerCase() === 'create';
}

function makeGeneratedWorkbookPath(workspace, plan = {}) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const goalName = String(plan.goal || 'generated-workbook').trim() || 'generated-workbook';
    const base = sanitizeName(`${goalName}-${stamp}.xlsx`).replace(/\.(xls|xlsx|xlsm|csv)$/i, '.xlsx');
    return path.join(workspace, base);
}

function resolveCreateWorkbookPath(command = {}, workspace, fallbackPath) {
    const argv = normalizeOfficeCliArgv(command.argv || []);
    const requested = String(argv[1] || '').trim();
    if (!requested || requested === '$file') return fallbackPath;
    return path.join(workspace, sanitizeName(path.basename(requested)));
}

function validateArgv(argv) {
    if (!Array.isArray(argv) || !argv.length) {
        throw new Error('OfficeCLI argv is empty.');
    }
    const command = String(argv[0]);
    if (!ALLOWED_COMMANDS.has(command)) {
        throw new Error(`OfficeCLI command is not allowed: ${command}`);
    }
    if ((command === 'get' || command === 'set') && ['range', 'sheet', 'workbook'].includes(String(argv[1] || '').toLowerCase())) {
        throw new Error(`OfficeCLI 语法不正确：${argv.slice(0, 3).join(' ')}。请使用 ${command} <file> <path>，例如 ${command} 表格.xlsx /Sheet1/A1。`);
    }
    const invalidFlag = argv.find((arg) => ['--format', '--html', '--sheet', '--values', '--output'].includes(arg));
    if (invalidFlag) {
        throw new Error(`OfficeCLI 参数不支持：${invalidFlag}。view 应使用 view <file> text/html/issues/stats，JSON 输出使用全局 --json。`);
    }
    argv.forEach((arg) => {
        if (!isSafeArg(arg)) {
            throw new Error(`Unsafe command argument: ${arg}`);
        }
    });
}

function isPortFree(host, port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', () => resolve(false));
        server.once('listening', () => {
            server.close(() => resolve(true));
        });
        server.listen(port, host);
    });
}

async function findPort(host, preferredPort) {
    for (let port = preferredPort; port < preferredPort + 20; port += 1) {
        if (await isPortFree(host, port)) return port;
    }
    throw new Error(`No free local port found from ${preferredPort} to ${preferredPort + 19}.`);
}

function runProcess(command, argv, cwd, timeoutMs) {
    return new Promise((resolve) => {
        const startedAt = Date.now();
        const child = spawn(command, argv, {
            cwd,
            shell: false,
            windowsHide: true
        });
        let stdout = '';
        let stderr = '';
        const timer = setTimeout(() => {
            child.kill('SIGTERM');
        }, timeoutMs);
        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString();
        });
        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString();
        });
        child.on('error', (error) => {
            clearTimeout(timer);
            resolve({
                success: false,
                code: -1,
                stdout,
                stderr: stderr || error.message,
                durationMs: Date.now() - startedAt
            });
        });
        child.on('close', (code) => {
            clearTimeout(timer);
            resolve({
                success: code === 0,
                code,
                stdout,
                stderr,
                durationMs: Date.now() - startedAt
            });
        });
    });
}

function formatOfficeCliError(result, command) {
    const raw = String(result.stderr || result.stdout || '').trim();
    if (/ENOENT|not found|not recognized|找不到|无法将|不是内部或外部命令/i.test(raw)) {
        return `未找到 OfficeCLI 命令：${command}。请安装 OfficeCLI，或在网页设置层填写完整的 officecli.exe / officecli.cmd 路径。`;
    }
    if (result.code === -1 && raw) {
        return `OfficeCLI 启动失败：${raw}`;
    }
    return raw || `OfficeCLI 不可用。请安装 OfficeCLI，或在设置层填写完整命令路径。`;
}

async function pathExists(candidate) {
    if (!candidate || candidate === 'officecli') return false;
    try {
        await access(candidate);
        return true;
    } catch (error) {
        return false;
    }
}

function isPathLikeCommand(command) {
    const value = String(command || '');
    return path.isAbsolute(value) || /[\\/]/.test(value);
}

function getOfficeCliCandidates(preferredCommand) {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    return Array.from(new Set([
        preferredCommand,
        process.env.OFFICECLI_BIN,
        path.join(localAppData, 'OfficeCLI', 'officecli.exe'),
        path.join(programFiles, 'OfficeCLI', 'officecli.exe'),
        path.join(programFilesX86, 'OfficeCLI', 'officecli.exe'),
        path.join(ASSISTANT_DIR, 'resources', 'officecli', 'officecli.exe'),
        path.join(ASSISTANT_DIR, 'resources', 'officecli', 'officecli.cmd'),
        path.join(process.resourcesPath || '', 'officecli', 'officecli.exe'),
        path.join(process.resourcesPath || '', 'officecli', 'officecli.cmd'),
        path.join(os.homedir(), '.local', 'bin', 'officecli'),
        'officecli'
    ].filter(Boolean)));
}

function compactProbeMessage(result) {
    return String(result.stdout || result.stderr || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 260);
}

function makeProbeCheck(name, result, success = result.success) {
    return {
        name,
        success: Boolean(success),
        message: compactProbeMessage(result) || (success ? 'OK' : `Exit code ${result.code}`),
        durationMs: result.durationMs || 0
    };
}

function looksLikeSpreadsheetViewOutput(result) {
    const output = String(result.stdout || '').trim();
    if (!result.success || !output) return false;
    if (/officecli_detect|sku|price/i.test(output)) return true;
    if (/"sheets"\s*:|Sheet1|rows/i.test(output)) return true;
    if ((output.startsWith('{') && output.endsWith('}')) || (output.startsWith('[') && output.endsWith(']'))) return true;
    return output.length > 12;
}

async function runSpreadsheetProbe(command, workspace) {
    await mkdir(workspace, { recursive: true });
    const probeFile = path.join(workspace, `.officecli-detect-${crypto.randomUUID()}.xlsx`);
    let createResult = null;
    let viewResult = null;
    try {
        createResult = await runProcess(command, ['create', probeFile], workspace, 15000);
        if (!createResult.success) {
            return { result: createResult, readable: false, created: false };
        }
        viewResult = await runProcess(command, ['view', probeFile, 'text', '--max-lines', '5', '--json'], workspace, 15000);
        return {
            result: viewResult,
            createResult,
            readable: looksLikeSpreadsheetViewOutput(viewResult),
            created: true
        };
    } finally {
        await unlink(probeFile).catch(() => {});
    }
}

async function probeOfficeCliCandidate(command, workspace) {
    const checks = [];
    const versionResult = await runProcess(command, ['--version'], workspace, 8000);
    checks.push(makeProbeCheck('version', versionResult));

    const helpResult = await runProcess(command, ['--help'], workspace, 8000);
    checks.push(makeProbeCheck('help', helpResult));

    const viewHelpResult = await runProcess(command, ['view', '--help'], workspace, 8000);
    checks.push(makeProbeCheck('viewHelp', viewHelpResult));

    const spreadsheetProbe = await runSpreadsheetProbe(command, workspace);
    if (spreadsheetProbe.createResult) {
        checks.push(makeProbeCheck('xlsxCreate', spreadsheetProbe.createResult));
    }
    checks.push(makeProbeCheck('xlsxView', spreadsheetProbe.result, spreadsheetProbe.readable));

    const capabilities = {
        version: versionResult.success,
        help: helpResult.success,
        viewHelp: viewHelpResult.success,
        spreadsheetRead: spreadsheetProbe.readable,
        xlsxRead: spreadsheetProbe.readable,
        csvRead: spreadsheetProbe.readable,
        excelCsv: spreadsheetProbe.readable
    };
    const success = capabilities.spreadsheetRead && (capabilities.version || capabilities.help || capabilities.viewHelp);
    const fallbackResult = spreadsheetProbe.result.success ? spreadsheetProbe.result : (versionResult.success ? versionResult : spreadsheetProbe.result);

    return {
        command,
        result: {
            ...fallbackResult,
            success,
            stdout: versionResult.stdout || helpResult.stdout || spreadsheetProbe.result.stdout,
            stderr: success ? '' : (spreadsheetProbe.result.stderr || versionResult.stderr || helpResult.stderr || 'OfficeCLI spreadsheet capability check failed.')
        },
        checks,
        capabilities,
        version: String(versionResult.stdout || versionResult.stderr || '').trim()
    };
}

async function detectOfficeCliCommand(preferredCommand, workspace) {
    let lastDetection = null;
    for (const candidate of getOfficeCliCandidates(preferredCommand)) {
        if (isPathLikeCommand(candidate) && !(await pathExists(candidate))) continue;
        const detection = await probeOfficeCliCandidate(candidate, workspace);
        lastDetection = detection;
        if (detection.result.success) {
            return detection;
        }
    }
    return lastDetection || {
        command: preferredCommand || 'officecli',
        result: {
            success: false,
            code: -1,
            stdout: '',
            stderr: 'OfficeCLI is not available.',
            durationMs: 0
        },
        checks: [],
        capabilities: {
            version: false,
            help: false,
            viewHelp: false,
            spreadsheetRead: false,
            xlsxRead: false,
            csvRead: false,
            excelCsv: false
        },
        version: ''
    };
}

function detectHtml(text) {
    const value = String(text || '').trim();
    if (/<!doctype html/i.test(value) || /<html[\s>]/i.test(value) || /<table[\s>]/i.test(value)) {
        return value;
    }
    return '';
}

async function maybeReadHtmlArtifact(stdout, workspace) {
    const direct = detectHtml(stdout);
    if (direct) return direct;
    const match = String(stdout || '').match(/([A-Za-z]:\\[^\r\n"]+\.html|[^\s"'<>]+\.html)/i);
    if (!match) return '';
    const candidate = path.isAbsolute(match[1]) ? match[1] : path.join(workspace, match[1]);
    try {
        return await readFile(candidate, 'utf8');
    } catch (error) {
        return '';
    }
}

function commandFailureMessage(command, argv, commandResult) {
    const detail = String(commandResult.stderr || commandResult.stdout || '').trim();
    const prefix = `Command failed: ${command.title || command.id || argv[0]}`;
    if (!detail) return prefix;
    return `${prefix}。${detail.slice(0, 800)}`;
}

function isValidationCommand(command = {}, argv = []) {
    return String(argv[0] || command.argv?.[0] || command.op || '').toLowerCase() === 'validate';
}

function commandMutates(command = {}) {
    const argv = Array.isArray(command.argv) ? command.argv : [];
    const op = String(command.op || argv[0] || '').toLowerCase();
    return Boolean(command.mutates) || /^(set|add|remove|move|swap|batch|create)/.test(op);
}

function planWrites(plan = {}) {
    const commands = Array.isArray(plan.commands) ? plan.commands : [];
    return Boolean(plan.safety?.writesFile || commands.some(commandMutates));
}

function stripLargeFileData(payload = {}, workbookPath = '') {
    const clean = {
        ...payload,
        file: {
            ...(payload.file || {}),
            path: workbookPath || payload.file?.path || ''
        }
    };
    delete clean.file.dataUrl;
    return clean;
}

export class OfficeCliService {
    constructor(options = {}) {
        this.host = options.host || DEFAULT_HOST;
        this.preferredPort = Number(options.port || process.env.OFFICECLI_BRIDGE_PORT || DEFAULT_PORT);
        this.port = this.preferredPort;
        this.cliCommand = options.cliCommand || process.env.OFFICECLI_BIN || 'officecli';
        this.workspace = resolveWorkspaceDir(options.workspace || process.env.OFFICECLI_WORKSPACE);
        this.version = options.version || '0.1.0';
        this.appName = options.appName || 'Wally Office Assistant';
        this.server = null;
        this.startedAt = null;
        this.recentLogs = [];
        this.lastOfficeCliStatus = null;
        this.openPath = typeof options.openPath === 'function' ? options.openPath : null;
        this.confirmExecution = typeof options.confirmExecution === 'function' ? options.confirmExecution : null;
        this.onStatusChange = typeof options.onStatusChange === 'function' ? options.onStatusChange : null;
    }

    get bridgeUrl() {
        return `http://${this.host}:${this.port}/officecli`;
    }

    get healthUrl() {
        return `http://${this.host}:${this.port}/health`;
    }

    get logsDir() {
        return path.join(this.workspace, 'logs');
    }

    get logFile() {
        return path.join(this.logsDir, 'assistant.log');
    }

    get historyDir() {
        return path.join(this.workspace, 'history');
    }

    get historyFile() {
        return path.join(this.historyDir, 'tasks.json');
    }

    async start() {
        await mkdir(this.workspace, { recursive: true });
        await mkdir(this.logsDir, { recursive: true });
        await mkdir(this.historyDir, { recursive: true });
        this.port = await findPort(this.host, this.preferredPort);
        this.server = http.createServer((req, res) => this.handleRequest(req, res));
        await new Promise((resolve, reject) => {
            this.server.once('error', reject);
            this.server.listen(this.port, this.host, resolve);
        });
        this.startedAt = new Date();
        await this.log(`Service started at ${this.bridgeUrl}`);
        await this.refreshOfficeCliStatus();
        this.emitStatus();
        return this.getStatus();
    }

    async stop() {
        if (!this.server) return;
        await new Promise((resolve) => this.server.close(resolve));
        this.server = null;
        await this.log('Service stopped.');
        this.emitStatus();
    }

    async restart() {
        await this.stop();
        return this.start();
    }

    async log(message, level = 'info') {
        const item = {
            time: new Date().toISOString(),
            level,
            message
        };
        this.recentLogs.unshift(item);
        this.recentLogs = this.recentLogs.slice(0, 200);
        await appendFile(this.logFile, `${item.time} [${level}] ${message}\n`, 'utf8').catch(() => {});
    }

    async readHistory() {
        try {
            const data = JSON.parse(await readFile(this.historyFile, 'utf8'));
            return Array.isArray(data.tasks) ? data.tasks : [];
        } catch (error) {
            return [];
        }
    }

    async writeHistory(tasks) {
        await mkdir(this.historyDir, { recursive: true });
        const safeTasks = tasks.slice(0, MAX_HISTORY_ITEMS);
        await writeFile(this.historyFile, JSON.stringify({ version: 1, tasks: safeTasks }, null, 2), 'utf8');
    }

    async recordTask(record) {
        const tasks = await this.readHistory();
        tasks.unshift(record);
        await this.writeHistory(tasks);
    }

    async refreshOfficeCliStatus(cliCommand = '') {
        const detection = await detectOfficeCliCommand(cliCommand || this.cliCommand, this.workspace);
        const result = detection.result;
        if (result.success) {
            this.cliCommand = detection.command;
        }
        this.lastOfficeCliStatus = {
            available: result.success,
            command: detection.command,
            version: result.success ? (detection.version || result.stdout || result.stderr || '').trim() : '',
            error: result.success ? '' : formatOfficeCliError(result, detection.command),
            checks: detection.checks || [],
            capabilities: detection.capabilities || {
                version: false,
                help: false,
                viewHelp: false,
                spreadsheetRead: false,
                xlsxRead: false,
                csvRead: false,
                excelCsv: false
            },
            testedAt: new Date().toISOString()
        };
        return this.lastOfficeCliStatus;
    }

    getStatus() {
        return {
            success: true,
            service: 'wally-office-assistant',
            appName: this.appName,
            version: this.version,
            bridgeUrl: this.bridgeUrl,
            healthUrl: this.healthUrl,
            host: this.host,
            port: this.port,
            preferredPort: this.preferredPort,
            portChanged: this.port !== this.preferredPort,
            workspace: this.workspace,
            logFile: this.logFile,
            historyFile: this.historyFile,
            cliCommand: this.cliCommand,
            officeCli: this.lastOfficeCliStatus,
            startedAt: this.startedAt ? this.startedAt.toISOString() : null,
            protocol: 'wally-office://start',
            protocolVersion: PROTOCOL_VERSION,
            minFrontendVersion: MIN_FRONTEND_VERSION,
            productization: {
                installerReady: true,
                autoStartSupported: true,
                historySupported: true,
                retrySupported: true,
                confirmationSupported: true,
                compatibilityCheckSupported: true
            }
        };
    }

    emitStatus() {
        if (this.onStatusChange) this.onStatusChange(this.getStatus());
    }

    async handleRequest(req, res) {
        if (req.method === 'OPTIONS') {
            sendJson(res, 200, { success: true });
            return;
        }
        try {
            const url = new URL(req.url, `http://${this.host}:${this.port}`);
            if (req.method === 'GET' && url.pathname === '/health') {
                sendJson(res, 200, this.getStatus());
                return;
            }
            if (req.method === 'GET' && url.pathname === '/logs') {
                sendJson(res, 200, { success: true, logs: this.recentLogs, logFile: this.logFile });
                return;
            }
            if (req.method === 'GET' && url.pathname === '/history') {
                sendJson(res, 200, { success: true, tasks: await this.readHistory(), historyFile: this.historyFile });
                return;
            }
            if (req.method === 'POST' && url.pathname === '/officecli') {
                const payload = JSON.parse(await readBody(req));
                const result = await this.executeOfficeCli(payload);
                sendJson(res, result.success === false ? 500 : 200, result);
                return;
            }
            if (req.method === 'POST' && url.pathname === '/control/recheck-officecli') {
                const payload = safeJsonParse(await readBody(req), {});
                const officeCli = await this.refreshOfficeCliStatus(payload.cliCommand || '');
                sendJson(res, 200, { success: true, officeCli, cliCommand: this.cliCommand });
                return;
            }
            if (req.method === 'POST' && url.pathname === '/control/open-workspace') {
                sendJson(res, 200, await this.openLocalPath(this.workspace));
                return;
            }
            if (req.method === 'POST' && url.pathname === '/control/open-log') {
                sendJson(res, 200, await this.openLocalPath(this.logFile));
                return;
            }
            if (req.method === 'POST' && url.pathname === '/control/open-path') {
                const payload = safeJsonParse(await readBody(req), {});
                sendJson(res, 200, await this.openLocalPath(payload.path || ''));
                return;
            }
            if (req.method === 'POST' && url.pathname === '/control/retry-task') {
                const payload = JSON.parse(await readBody(req));
                sendJson(res, 200, await this.retryTask(payload.taskId));
                return;
            }
            sendJson(res, 404, { success: false, message: 'Not found.' });
        } catch (error) {
            await this.log(error.message, 'error');
            sendJson(res, 500, { success: false, message: error.message });
        }
    }

    async openLocalPath(targetPath) {
        if (!this.openPath) {
            return {
                success: false,
                message: 'Open path is only available in the desktop assistant.',
                path: targetPath
            };
        }
        const errorMessage = await this.openPath(targetPath);
        if (errorMessage) {
            return { success: false, message: errorMessage, path: targetPath };
        }
        return { success: true, path: targetPath };
    }

    async retryTask(taskId) {
        const tasks = await this.readHistory();
        const task = tasks.find((item) => item.id === taskId);
        if (!task || !task.payload) {
            return { success: false, message: 'Task was not found or cannot be retried.' };
        }
        await this.log(`Retry task ${taskId}`);
        return this.executeOfficeCli(task.payload, { retryOf: taskId });
    }

    async prepareFile(file = {}, workspace) {
        await mkdir(workspace, { recursive: true });
        if (file.path) {
            return String(file.path);
        }
        const buffer = decodeDataUrl(file.dataUrl);
        if (!buffer) {
            throw new Error('No executable spreadsheet file was received. Upload a file or provide a local file path.');
        }
        const target = path.join(workspace, sanitizeName(file.name));
        await writeFile(target, buffer);
        return target;
    }

    async executeOfficeCli(payload, meta = {}) {
        const taskId = crypto.randomUUID();
        const startedAt = new Date();
        const options = payload.options || {};
        const plan = payload.plan || {};
        const commands = Array.isArray(plan.commands) ? plan.commands : [];
        const workspace = resolveWorkspaceDir(options.workspaceDir, this.workspace);
        const cliCommand = options.cliCommand || this.cliCommand;
        const timeoutMs = Number(options.timeoutMs || 120000);
        const logs = [];
        const commandResults = [];
        const warnings = [];
        let workbookPath = '';
        let html = '';
        let resultForHistory = null;

        try {
            if (!commands.length) {
                throw new Error('No OfficeCLI commands to execute.');
            }
            if (!options.dryRun && options.requireConfirmation && planWrites(plan)) {
                if (this.confirmExecution) {
                    const approved = await this.confirmExecution(plan, {
                        commandCount: commands.length,
                        workspace,
                        retryOf: meta.retryOf || ''
                    });
                    if (!approved) {
                        throw new Error('Write execution was cancelled by user.');
                    }
                } else if (!options.confirmedAt) {
                    throw new Error('Write execution requires user confirmation.');
                }
            }
            if (!options.dryRun) {
                this.cliCommand = cliCommand;
                const officeCliStatus = await this.refreshOfficeCliStatus();
                if (!officeCliStatus.available) {
                    throw new Error(officeCliStatus.error || 'OfficeCLI is not available.');
                }
            }

            if (hasFileInput(payload.file || {})) {
                workbookPath = await this.prepareFile(payload.file || {}, workspace);
            } else if (commands.some(isCreateWorkbookCommand)) {
                const createCommand = commands.find(isCreateWorkbookCommand);
                workbookPath = resolveCreateWorkbookPath(createCommand, workspace, makeGeneratedWorkbookPath(workspace, plan));
            } else {
                throw new Error('No executable spreadsheet file was received. Upload a file, provide a local file path, or start the plan with create $file.');
            }
            await this.log(`${options.dryRun ? 'Dry run' : 'Execute'} plan "${plan.goal || 'OfficeCLI task'}" with ${commands.length} command(s).`);

            for (const command of commands) {
                const argv = resolveWorkbookArgv(command.argv || [], workbookPath);
                validateArgv(argv);
                const commandLog = `[plan] ${command.title || command.id || command.op}: ${cliCommand} ${argv.join(' ')}`;
                logs.push(commandLog);
                await this.log(commandLog);

                if (options.dryRun) {
                    commandResults.push({
                        id: command.id,
                        success: true,
                        dryRun: true,
                        argv
                    });
                    continue;
                }

                const commandResult = await runProcess(cliCommand, argv, workspace, timeoutMs);
                commandResults.push({
                    id: command.id,
                    title: command.title,
                    argv,
                    ...commandResult
                });
                if (commandResult.stdout) logs.push(commandResult.stdout.trim());
                if (commandResult.stderr) logs.push(`[stderr] ${commandResult.stderr.trim()}`);
                if (!html) html = await maybeReadHtmlArtifact(commandResult.stdout, workspace);
                if (!commandResult.success) {
                    const message = commandFailureMessage(command, argv, commandResult);
                    if (isValidationCommand(command, argv)) {
                        const warning = `Validation warning: ${message}`;
                        warnings.push(warning);
                        logs.push(`[warning] ${warning}`);
                        await this.log(warning, 'warn');
                        continue;
                    }
                    await this.log(message, 'error');
                    resultForHistory = {
                        success: false,
                        message,
                        filePath: workbookPath,
                        workspace,
                        logFile: this.logFile,
                        warnings,
                        logs,
                        commands: commandResults,
                        html
                    };
                    return { taskId, ...resultForHistory };
                }
            }

            if (!options.dryRun && options.returnHtml && !html) {
                const previewArgv = ['view', workbookPath, 'html'];
                const previewResult = await runProcess(cliCommand, previewArgv, workspace, timeoutMs);
                commandResults.push({
                    id: '__html_preview',
                    title: '生成 HTML 预览',
                    argv: previewArgv,
                    ...previewResult
                });
                if (previewResult.stdout) logs.push(previewResult.stdout.trim());
                if (previewResult.stderr) logs.push(`[stderr] ${previewResult.stderr.trim()}`);
                html = await maybeReadHtmlArtifact(previewResult.stdout, workspace);
                if (!previewResult.success) {
                    const warning = commandFailureMessage({ title: '生成 HTML 预览' }, previewArgv, previewResult);
                    warnings.push(warning);
                    logs.push(`[warning] ${warning}`);
                    await this.log(warning, 'warn');
                }
            }

            resultForHistory = {
                success: true,
                message: warnings.length
                    ? 'OfficeCLI execution completed with validation warnings.'
                    : (options.dryRun ? 'Dry Run completed. No file was changed.' : 'OfficeCLI execution completed.'),
                filePath: workbookPath,
                workspace,
                logFile: this.logFile,
                artifacts: options.dryRun ? [] : [workbookPath],
                dryRun: Boolean(options.dryRun),
                warnings,
                logs,
                commands: commandResults,
                html
            };
            return { taskId, ...resultForHistory };
        } catch (error) {
            await this.log(error.message, 'error');
            resultForHistory = {
                success: false,
                message: error.message,
                filePath: workbookPath,
                workspace,
                logFile: this.logFile,
                warnings,
                logs,
                commands: commandResults,
                html
            };
            return { taskId, ...resultForHistory };
        } finally {
            await this.recordTask({
                id: taskId,
                retryOf: meta.retryOf || '',
                goal: String(plan.goal || 'OfficeCLI task'),
                dryRun: Boolean(options.dryRun),
                writesFile: planWrites(plan),
                success: Boolean(resultForHistory?.success),
                message: resultForHistory?.message || '',
                commandCount: commands.length,
                filePath: workbookPath,
                workspace,
                logFile: this.logFile,
                startedAt: startedAt.toISOString(),
                finishedAt: new Date().toISOString(),
                durationMs: Date.now() - startedAt.getTime(),
                payload: stripLargeFileData(payload, workbookPath)
            });
        }
    }
}

export async function startOfficeCliService(options = {}) {
    const service = new OfficeCliService(options);
    await service.start();
    return service;
}

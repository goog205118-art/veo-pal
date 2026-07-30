import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import net from 'node:net';

const MAX_BODY_BYTES = 80 * 1024 * 1024;
const MAX_HISTORY_ITEMS = 100;
const DEFAULT_PORT = 8765;
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_WORKSPACE = path.join(os.homedir(), 'WallyOffice', 'workspace');
const PROTOCOL_VERSION = '1.0.0';
const MIN_FRONTEND_VERSION = '0.1.0';
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
    return !/[;&|`$<>]/.test(String(arg));
}

function validateArgv(argv) {
    if (!Array.isArray(argv) || !argv.length) {
        throw new Error('OfficeCLI argv is empty.');
    }
    const command = String(argv[0]);
    if (!ALLOWED_COMMANDS.has(command)) {
        throw new Error(`OfficeCLI command is not allowed: ${command}`);
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
        this.workspace = path.resolve(options.workspace || process.env.OFFICECLI_WORKSPACE || DEFAULT_WORKSPACE);
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

    async refreshOfficeCliStatus() {
        const result = await runProcess(this.cliCommand, ['--version'], this.workspace, 8000);
        this.lastOfficeCliStatus = {
            available: result.success,
            command: this.cliCommand,
            version: result.success ? (result.stdout || result.stderr || '').trim() : '',
            error: result.success ? '' : formatOfficeCliError(result, this.cliCommand)
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
                sendJson(res, 200, { success: true, officeCli: await this.refreshOfficeCliStatus() });
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
        const workspace = path.resolve(options.workspaceDir || this.workspace);
        const cliCommand = options.cliCommand || this.cliCommand;
        const timeoutMs = Number(options.timeoutMs || 120000);
        const logs = [];
        const commandResults = [];
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

            workbookPath = await this.prepareFile(payload.file || {}, workspace);
            await this.log(`${options.dryRun ? 'Dry run' : 'Execute'} plan "${plan.goal || 'OfficeCLI task'}" with ${commands.length} command(s).`);

            for (const command of commands) {
                const argv = (command.argv || []).map((arg) => String(arg).replaceAll('$file', workbookPath));
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
                    await this.log(`Command failed: ${command.title || command.id || argv[0]}`, 'error');
                    resultForHistory = {
                        success: false,
                        message: `Command failed: ${command.title || command.id || argv[0]}`,
                        filePath: workbookPath,
                        workspace,
                        logFile: this.logFile,
                        logs,
                        commands: commandResults,
                        html
                    };
                    return { taskId, ...resultForHistory };
                }
            }

            resultForHistory = {
                success: true,
                message: options.dryRun ? 'Dry Run completed. No file was changed.' : 'OfficeCLI execution completed.',
                filePath: workbookPath,
                workspace,
                logFile: this.logFile,
                artifacts: options.dryRun ? [] : [workbookPath],
                dryRun: Boolean(options.dryRun),
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

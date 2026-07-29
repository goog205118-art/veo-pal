import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const PORT = Number(process.env.OFFICECLI_BRIDGE_PORT || 8765);
const DEFAULT_CLI = process.env.OFFICECLI_BIN || 'officecli';
const DEFAULT_WORKSPACE = process.env.OFFICECLI_WORKSPACE || path.join(os.homedir(), 'officecli-workspace');
const MAX_BODY_BYTES = 80 * 1024 * 1024;
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
                reject(new Error('请求体过大'));
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
    const value = String(arg);
    return !/[;&|`$<>]/.test(value);
}

function validateArgv(argv) {
    if (!Array.isArray(argv) || !argv.length) {
        throw new Error('命令 argv 为空');
    }
    const command = String(argv[0]);
    if (!ALLOWED_COMMANDS.has(command)) {
        throw new Error(`不允许的 OfficeCLI 命令：${command}`);
    }
    argv.forEach((arg) => {
        if (!isSafeArg(arg)) {
            throw new Error(`命令参数包含不安全字符：${arg}`);
        }
    });
}

async function prepareFile(file, workspace) {
    await mkdir(workspace, { recursive: true });
    if (file?.path) {
        return String(file.path);
    }
    const buffer = decodeDataUrl(file?.dataUrl);
    if (!buffer) {
        throw new Error('没有收到可执行的表格文件。请上传文件或传入本地路径。');
    }
    const target = path.join(workspace, sanitizeName(file.name));
    await writeFile(target, buffer);
    return target;
}

function runCommand(cliCommand, argv, cwd, timeoutMs) {
    return new Promise((resolve) => {
        const startedAt = Date.now();
        const child = spawn(cliCommand, argv, {
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

async function executeOfficeCli(payload) {
    const options = payload.options || {};
    const plan = payload.plan || {};
    const commands = Array.isArray(plan.commands) ? plan.commands : [];
    const workspace = path.resolve(options.workspaceDir || DEFAULT_WORKSPACE);
    const cliCommand = options.cliCommand || DEFAULT_CLI;
    const timeoutMs = Number(options.timeoutMs || 120000);
    const workbookPath = await prepareFile(payload.file || {}, workspace);
    const logs = [];
    const commandResults = [];
    let html = '';

    if (!commands.length) {
        throw new Error('没有可执行的 OfficeCLI 命令');
    }

    for (const command of commands) {
        const argv = command.argv.map((arg) => String(arg).replaceAll('$file', workbookPath));
        validateArgv(argv);
        logs.push(`[plan] ${command.title || command.id || command.op}: ${cliCommand} ${argv.join(' ')}`);
        if (options.dryRun) {
            commandResults.push({
                id: command.id,
                success: true,
                dryRun: true,
                argv
            });
            continue;
        }
        const result = await runCommand(cliCommand, argv, workspace, timeoutMs);
        commandResults.push({
            id: command.id,
            title: command.title,
            argv,
            ...result
        });
        if (result.stdout) logs.push(result.stdout.trim());
        if (result.stderr) logs.push(`[stderr] ${result.stderr.trim()}`);
        if (!html) html = await maybeReadHtmlArtifact(result.stdout, workspace);
        if (!result.success) {
            return {
                success: false,
                message: `命令执行失败：${command.title || command.id || argv[0]}`,
                filePath: workbookPath,
                logs,
                commands: commandResults,
                html
            };
        }
    }

    return {
        success: true,
        message: options.dryRun ? 'Dry Run 完成，未改写文件。' : 'OfficeCLI 执行完成。',
        filePath: workbookPath,
        workspace,
        artifacts: [workbookPath],
        logs,
        commands: commandResults,
        html
    };
}

const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
        sendJson(res, 200, { success: true });
        return;
    }
    if (req.method === 'GET' && req.url === '/health') {
        sendJson(res, 200, {
            success: true,
            service: 'officecli-bridge',
            cliCommand: DEFAULT_CLI,
            workspace: DEFAULT_WORKSPACE
        });
        return;
    }
    if (req.method !== 'POST' || !req.url.startsWith('/officecli')) {
        sendJson(res, 404, { success: false, message: 'Not found' });
        return;
    }
    try {
        const payload = JSON.parse(await readBody(req));
        const result = await executeOfficeCli(payload);
        sendJson(res, result.success === false ? 500 : 200, result);
    } catch (error) {
        sendJson(res, 500, {
            success: false,
            message: error.message
        });
    }
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`OfficeCLI bridge listening on http://127.0.0.1:${PORT}/officecli`);
});

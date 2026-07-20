function buildImgGenHeaders() {
    return window.VeoApi.authHeaders({ includeImageAuth: true });
}

async function parseImgGenHttpResponse(response, fallbackStatus = 'accepted') {
    return window.VeoApi.parseResponse(response, fallbackStatus);
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

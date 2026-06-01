// ==========================================
// 🗄️ IndexedDB 数据库封装 & Blob 内存优化核心
// ==========================================
const DB_NAME = 'VeoInfinityDB';
let db;
const blobUrlCache = new Map(); 
const TASK_SAVE_BATCH_WINDOW = 100;
const taskSaveBuffer = new Map();
const taskSaveResolvers = new Map();
const taskSaveRejectors = new Map();
let taskSaveFlushTimer = null;

function initDB() {
    return new Promise((resolve, reject) => {
        // 🌟 数据库无损升级至版本 4，接入 Flow 工作区表
        const request = indexedDB.open(DB_NAME, 4); 
        
        request.onupgradeneeded = (e) => {
            let database = e.target.result;
            
            // 1. 原卡片工作区
            if (!database.objectStoreNames.contains('tasks')) {
                database.createObjectStore('tasks', { keyPath: 'id' });
            }
            // 2. 账单中心
            if (!database.objectStoreNames.contains('billing')) {
                database.createObjectStore('billing', { keyPath: 'id' });
            }
            // 3. 🚀 新增：节点工作区数据表 (保存整个画布的拓扑结构)
            if (!database.objectStoreNames.contains('flow_workspaces')) {
                database.createObjectStore('flow_workspaces', { keyPath: 'id' });
            }
            // 4. 🚀 新增：全局素材共享库 (打通双工作区的核心)
            if (!database.objectStoreNames.contains('material_store')) {
                const materialStore = database.createObjectStore('material_store', { keyPath: 'id' });
                materialStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
        
        request.onsuccess = (e) => { db = e.target.result; resolve(db); };
        request.onerror = (e) => reject(e);
    });
}

// 🌟 新增：记账中心 API
async function addBillingRecord(record) {
    return new Promise((resolve) => {
        const tx = db.transaction('billing', 'readwrite');
        tx.objectStore('billing').put({ ...record, timestamp: Date.now() });
        tx.oncomplete = () => resolve();
    });
}

async function getBillingStats() {
    return new Promise((resolve) => {
        const tx = db.transaction('billing', 'readonly');
        const request = tx.objectStore('billing').getAll();
        request.onsuccess = () => {
            const records = request.result || [];
            let totalCost = 0, imageCount = 0, videoCount = 0;
            records.forEach(r => {
                totalCost += (r && r.cost != null ? r.cost : (r && r.amount ? r.amount : 0));
                if (r.type === 'image') imageCount++;
                if (r.type === 'video') videoCount++;
            });
            resolve({ totalCost: totalCost.toFixed(3), imageCount, videoCount, records });
        };
    });
}

// === 以下为原有逻辑，保持不变 ===
function getBlobUrl(id, blobData) {
    if (!blobData) return '';
    if (typeof blobData === 'string') return blobData; 
    if (blobUrlCache.has(id)) return blobUrlCache.get(id);
    const url = URL.createObjectURL(blobData);
    blobUrlCache.set(id, url);
    return url;
}

function readBlobAsDataUrl(blob) {
    return new Promise((resolve) => {
        try {
            const reader = new FileReader();
            reader.onerror = () => resolve(null);
            reader.onloadend = () => resolve(reader.result || null);
            reader.readAsDataURL(blob);
        } catch (err) {
            resolve(null);
        }
    });
}

async function downscaleImageBlobIfNeeded(blob, options = {}) {
    if (!blob || typeof blob === 'string') return blob;
    const type = String(blob.type || '').toLowerCase();
    if (!type.startsWith('image/')) return blob;

    const maxBytes = Number.isFinite(options.maxBytes) ? options.maxBytes : (8 * 1024 * 1024);
    const maxEdge = Number.isFinite(options.maxEdge) ? options.maxEdge : 2048;
    const maxPixels = Number.isFinite(options.maxPixels) ? options.maxPixels : (4096 * 4096);
    const needDownscale = blob.size > maxBytes;
    if (!needDownscale) return blob;

    return new Promise((resolve) => {
        let objectUrl = '';
        try {
            objectUrl = URL.createObjectURL(blob);
            const img = new Image();
            img.onerror = () => {
                if (objectUrl) URL.revokeObjectURL(objectUrl);
                resolve(blob);
            };
            img.onload = () => {
                try {
                    const srcW = Math.max(1, img.naturalWidth || img.width || 1);
                    const srcH = Math.max(1, img.naturalHeight || img.height || 1);
                    let scale = 1;
                    if (srcW > maxEdge || srcH > maxEdge) scale = Math.min(scale, maxEdge / Math.max(srcW, srcH));
                    if ((srcW * srcH) > maxPixels) scale = Math.min(scale, Math.sqrt(maxPixels / (srcW * srcH)));
                    const dstW = Math.max(1, Math.floor(srcW * scale));
                    const dstH = Math.max(1, Math.floor(srcH * scale));

                    if (scale >= 0.999) {
                        if (objectUrl) URL.revokeObjectURL(objectUrl);
                        resolve(blob);
                        return;
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = dstW;
                    canvas.height = dstH;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        if (objectUrl) URL.revokeObjectURL(objectUrl);
                        resolve(blob);
                        return;
                    }
                    ctx.drawImage(img, 0, 0, dstW, dstH);
                    const outType = type === 'image/png' ? 'image/png' : 'image/jpeg';
                    const quality = outType === 'image/png' ? undefined : 0.9;
                    canvas.toBlob((nextBlob) => {
                        if (objectUrl) URL.revokeObjectURL(objectUrl);
                        resolve(nextBlob || blob);
                    }, outType, quality);
                } catch (err) {
                    if (objectUrl) URL.revokeObjectURL(objectUrl);
                    resolve(blob);
                }
            };
            img.src = objectUrl;
        } catch (err) {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            resolve(blob);
        }
    });
}

async function compressImageToBlob(file, maxWidth = 1024) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ratio = Math.min(maxWidth / img.width, 1);
                canvas.width = img.width * ratio;
                canvas.height = img.height * ratio;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.85);
            };
        };
    });
}

async function blobToBase64(blob, options = {}) {
    if (!blob) return null;
    if (typeof blob === 'string') return Promise.resolve(blob);
    const mode = options && options.mode ? String(options.mode) : 'generic';
    const sourceBlob = mode === 'network'
        ? await downscaleImageBlobIfNeeded(blob, options)
        : blob;
    return readBlobAsDataUrl(sourceBlob);
}

function resolveTaskSave(taskId) {
    const list = taskSaveResolvers.get(taskId);
    if (Array.isArray(list)) {
        list.forEach((resolve) => {
            try { resolve(); } catch (err) {}
        });
    }
    taskSaveResolvers.delete(taskId);
    taskSaveRejectors.delete(taskId);
}

function rejectTaskSave(taskId, error) {
    const list = taskSaveRejectors.get(taskId);
    if (Array.isArray(list)) {
        list.forEach((reject) => {
            try { reject(error); } catch (err) {}
        });
    }
    taskSaveResolvers.delete(taskId);
    taskSaveRejectors.delete(taskId);
}

function flushTaskSaveQueue() {
    taskSaveFlushTimer = null;
    const entries = Array.from(taskSaveBuffer.values());
    taskSaveBuffer.clear();
    if (entries.length === 0) return Promise.resolve();

    return new Promise((resolve, reject) => {
        try {
            const tx = db.transaction('tasks', 'readwrite');
            const store = tx.objectStore('tasks');
            entries.forEach((task) => {
                if (task && task.id) store.put(task);
            });
            tx.oncomplete = () => {
                entries.forEach((task) => task && task.id && resolveTaskSave(task.id));
                resolve();
            };
            tx.onerror = (event) => {
                const err = event && event.target ? event.target.error : new Error('save queue transaction failed');
                entries.forEach((task) => task && task.id && rejectTaskSave(task.id, err));
                reject(err);
            };
        } catch (err) {
            entries.forEach((task) => task && task.id && rejectTaskSave(task.id, err));
            reject(err);
        }
    });
}

function enqueueTaskSave(task) {
    if (!task || !task.id) return Promise.resolve();
    return new Promise((resolve, reject) => {
        taskSaveBuffer.set(task.id, task);
        if (!taskSaveResolvers.has(task.id)) taskSaveResolvers.set(task.id, []);
        if (!taskSaveRejectors.has(task.id)) taskSaveRejectors.set(task.id, []);
        taskSaveResolvers.get(task.id).push(resolve);
        taskSaveRejectors.get(task.id).push(reject);

        if (!taskSaveFlushTimer) {
            taskSaveFlushTimer = setTimeout(() => {
                flushTaskSaveQueue().catch(() => {});
            }, TASK_SAVE_BATCH_WINDOW);
        }
    });
}

async function getAllTasksDB() {
    return new Promise((resolve) => {
        const tx = db.transaction('tasks', 'readonly');
        const request = tx.objectStore('tasks').getAll();
        request.onsuccess = () => {
            const dbRows = Array.isArray(request.result) ? request.result : [];
            const merged = new Map();
            dbRows.forEach((row) => {
                if (row && row.id) merged.set(row.id, row);
            });
            taskSaveBuffer.forEach((pendingTask, taskId) => {
                if (pendingTask && taskId) merged.set(taskId, pendingTask);
            });
            resolve(Array.from(merged.values()).sort((a, b) => (b?.timestamp || 0) - (a?.timestamp || 0)));
        };
    });
}

async function saveTaskDB(task) {
    return enqueueTaskSave(task);
}

async function saveTaskBatchDB(tasks) {
    if (!Array.isArray(tasks) || tasks.length === 0) return;
    await Promise.all(tasks.map((task) => enqueueTaskSave(task)));
}

async function getTaskDB(id) {
    if (id && taskSaveBuffer.has(id)) return taskSaveBuffer.get(id);
    return new Promise((resolve) => {
        const tx = db.transaction('tasks', 'readonly');
        const request = tx.objectStore('tasks').get(id);
        request.onsuccess = () => resolve(request.result);
    });
}

async function deleteTaskDB(id) {
    if (id && taskSaveBuffer.has(id)) taskSaveBuffer.delete(id);
    return new Promise((resolve) => {
        const tx = db.transaction('tasks', 'readwrite');
        tx.objectStore('tasks').delete(id);
        tx.oncomplete = () => {
            for (let [key, url] of blobUrlCache.entries()) {
                if (key.toString().startsWith(id)) {
                    URL.revokeObjectURL(url);
                    blobUrlCache.delete(key);
                }
            }
            resolve();
        };
    });
}

window.addEventListener('beforeunload', () => {
    if (taskSaveBuffer.size > 0) {
        try { flushTaskSaveQueue(); } catch (err) {}
    }
});

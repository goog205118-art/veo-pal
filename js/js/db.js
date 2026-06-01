// ==========================================
// Veo Studio - IndexedDB Layer V2 (no feature change)
// ==========================================

(function initDbV2(global) {
    'use strict';

    var DB_NAME = 'VeoInfinityDB';
    var DB_VERSION = 4;
    var db;
    var blobUrlCache = new Map();
    var TASK_SAVE_BATCH_WINDOW = 100;
    var taskSaveBuffer = new Map();
    var taskSaveResolvers = new Map();
    var taskSaveRejectors = new Map();
    var taskSaveFlushTimer = null;

    var STORE_TASKS = 'tasks';
    var STORE_BILLING = 'billing';
    var STORE_FLOW = 'flow_workspaces';
    var STORE_MATERIAL = 'material_store';

    function isDbReady() {
        return !!db;
    }

    function safeSortByTimestampDesc(list) {
        if (!Array.isArray(list)) return [];
        return list.slice().sort(function (a, b) {
            var ta = a && a.timestamp ? a.timestamp : 0;
            var tb = b && b.timestamp ? b.timestamp : 0;
            return tb - ta;
        });
    }

    function runTx(storeName, mode, executor) {
        return new Promise(function (resolve, reject) {
            if (!isDbReady()) {
                reject(new Error('DB not initialized'));
                return;
            }

            try {
                var tx = db.transaction(storeName, mode);
                var store = tx.objectStore(storeName);
                executor(store, tx, resolve, reject);
                tx.onerror = function (event) {
                    reject(event && event.target ? event.target.error : new Error('transaction failed'));
                };
            } catch (err) {
                reject(err);
            }
        });
    }

    function initDB() {
        return new Promise(function (resolve, reject) {
            try {
                var request = indexedDB.open(DB_NAME, DB_VERSION);

                request.onupgradeneeded = function (event) {
                    var database = event.target.result;

                    if (!database.objectStoreNames.contains(STORE_TASKS)) {
                        database.createObjectStore(STORE_TASKS, { keyPath: 'id' });
                    }

                    if (!database.objectStoreNames.contains(STORE_BILLING)) {
                        database.createObjectStore(STORE_BILLING, { keyPath: 'id' });
                    }

                    if (!database.objectStoreNames.contains(STORE_FLOW)) {
                        database.createObjectStore(STORE_FLOW, { keyPath: 'id' });
                    }

                    if (!database.objectStoreNames.contains(STORE_MATERIAL)) {
                        var materialStore = database.createObjectStore(STORE_MATERIAL, { keyPath: 'id' });
                        materialStore.createIndex('timestamp', 'timestamp', { unique: false });
                    }
                };

                request.onsuccess = function (event) {
                    db = event.target.result;
                    global.db = db;
                    resolve(db);
                };

                request.onerror = function (event) {
                    reject(event && event.target ? event.target.error : new Error('open DB failed'));
                };
            } catch (err) {
                reject(err);
            }
        });
    }

    async function addBillingRecord(record) {
        var safeRecord = Object.assign({}, record || {}, { timestamp: Date.now() });
        return runTx(STORE_BILLING, 'readwrite', function (store, tx, resolve) {
            store.put(safeRecord);
            tx.oncomplete = function () { resolve(); };
        });
    }

    async function getBillingStats() {
        return runTx(STORE_BILLING, 'readonly', function (store, tx, resolve) {
            var request = store.getAll();
            request.onsuccess = function () {
                var records = request.result || [];
                var totalCost = 0;
                var imageCount = 0;
                var videoCount = 0;

                records.forEach(function (item) {
                    totalCost += Number(item && item.cost ? item.cost : 0);
                    if (item && item.type === 'image') imageCount += 1;
                    if (item && item.type === 'video') videoCount += 1;
                });

                resolve({
                    totalCost: totalCost.toFixed(3),
                    imageCount: imageCount,
                    videoCount: videoCount,
                    records: records
                });
            };
            tx.oncomplete = function () {
                // handled in request.onsuccess
            };
        });
    }

    function getBlobUrl(id, blobData) {
        if (!blobData) return '';
        if (typeof blobData === 'string') return blobData;

        var cacheKey = String(id || 'blob_' + Date.now());
        if (blobUrlCache.has(cacheKey)) {
            return blobUrlCache.get(cacheKey);
        }

        try {
            var url = URL.createObjectURL(blobData);
            blobUrlCache.set(cacheKey, url);
            return url;
        } catch (err) {
            console.error('[getBlobUrl] createObjectURL failed', err);
            return '';
        }
    }

    function compressImageToBlob(file, maxWidth) {
        var targetMaxWidth = Number(maxWidth || 1024);

        return new Promise(function (resolve) {
            if (!file) {
                resolve(null);
                return;
            }

            var reader = new FileReader();
            reader.onerror = function () { resolve(null); };

            reader.onload = function (event) {
                var img = new Image();
                img.onerror = function () { resolve(null); };
                img.onload = function () {
                    try {
                        var canvas = document.createElement('canvas');
                        var ratio = Math.min(targetMaxWidth / img.width, 1);
                        canvas.width = Math.max(1, Math.floor(img.width * ratio));
                        canvas.height = Math.max(1, Math.floor(img.height * ratio));

                        var ctx = canvas.getContext('2d');
                        if (!ctx) {
                            resolve(null);
                            return;
                        }

                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        canvas.toBlob(function (blob) {
                            resolve(blob || null);
                        }, 'image/jpeg', 0.85);
                    } catch (err) {
                        console.error('[compressImageToBlob] failed', err);
                        resolve(null);
                    }
                };

                img.src = event && event.target ? event.target.result : '';
            };

            reader.readAsDataURL(file);
        });
    }

    function readBlobAsDataUrl(blob) {
        return new Promise(function (resolve) {
            try {
                var reader = new FileReader();
                reader.onerror = function () { resolve(null); };
                reader.onloadend = function () { resolve(reader.result || null); };
                reader.readAsDataURL(blob);
            } catch (err) {
                resolve(null);
            }
        });
    }

    function downscaleImageBlobIfNeeded(blob, options) {
        options = options || {};
        if (!blob || typeof blob === 'string') return Promise.resolve(blob);
        var type = String(blob.type || '').toLowerCase();
        if (type.indexOf('image/') !== 0) return Promise.resolve(blob);

        var maxBytes = Number.isFinite(options.maxBytes) ? options.maxBytes : (8 * 1024 * 1024);
        var maxEdge = Number.isFinite(options.maxEdge) ? options.maxEdge : 2048;
        var maxPixels = Number.isFinite(options.maxPixels) ? options.maxPixels : (4096 * 4096);
        if (!(blob.size > maxBytes)) return Promise.resolve(blob);

        return new Promise(function (resolve) {
            var objectUrl = '';
            try {
                objectUrl = URL.createObjectURL(blob);
                var img = new Image();
                img.onerror = function () {
                    if (objectUrl) URL.revokeObjectURL(objectUrl);
                    resolve(blob);
                };
                img.onload = function () {
                    try {
                        var srcW = Math.max(1, img.naturalWidth || img.width || 1);
                        var srcH = Math.max(1, img.naturalHeight || img.height || 1);
                        var scale = 1;
                        if (srcW > maxEdge || srcH > maxEdge) scale = Math.min(scale, maxEdge / Math.max(srcW, srcH));
                        if ((srcW * srcH) > maxPixels) scale = Math.min(scale, Math.sqrt(maxPixels / (srcW * srcH)));
                        if (scale >= 0.999) {
                            if (objectUrl) URL.revokeObjectURL(objectUrl);
                            resolve(blob);
                            return;
                        }
                        var dstW = Math.max(1, Math.floor(srcW * scale));
                        var dstH = Math.max(1, Math.floor(srcH * scale));
                        var canvas = document.createElement('canvas');
                        canvas.width = dstW;
                        canvas.height = dstH;
                        var ctx = canvas.getContext('2d');
                        if (!ctx) {
                            if (objectUrl) URL.revokeObjectURL(objectUrl);
                            resolve(blob);
                            return;
                        }
                        ctx.drawImage(img, 0, 0, dstW, dstH);
                        var outType = type === 'image/png' ? 'image/png' : 'image/jpeg';
                        var quality = outType === 'image/png' ? undefined : 0.9;
                        canvas.toBlob(function (nextBlob) {
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

    function blobToBase64(blob, options) {
        options = options || {};
        if (!blob) return Promise.resolve(null);
        if (typeof blob === 'string') return Promise.resolve(blob);
        var mode = options && options.mode ? String(options.mode) : 'generic';
        return Promise.resolve().then(function () {
            if (mode === 'network') return downscaleImageBlobIfNeeded(blob, options);
            return blob;
        }).then(function (nextBlob) {
            return readBlobAsDataUrl(nextBlob);
        });
    }

    function resolveTaskSave(taskId) {
        var list = taskSaveResolvers.get(taskId);
        if (Array.isArray(list)) {
            list.forEach(function (cb) { try { cb(); } catch (err) {} });
        }
        taskSaveResolvers.delete(taskId);
        taskSaveRejectors.delete(taskId);
    }

    function rejectTaskSave(taskId, error) {
        var list = taskSaveRejectors.get(taskId);
        if (Array.isArray(list)) {
            list.forEach(function (cb) { try { cb(error); } catch (err) {} });
        }
        taskSaveResolvers.delete(taskId);
        taskSaveRejectors.delete(taskId);
    }

    function flushTaskSaveQueue() {
        taskSaveFlushTimer = null;
        var entries = Array.from(taskSaveBuffer.values());
        taskSaveBuffer.clear();
        if (entries.length === 0) return Promise.resolve();
        return new Promise(function (resolve, reject) {
            try {
                var tx = db.transaction(STORE_TASKS, 'readwrite');
                var store = tx.objectStore(STORE_TASKS);
                entries.forEach(function (task) {
                    if (task && task.id) store.put(task);
                });
                tx.oncomplete = function () {
                    entries.forEach(function (task) {
                        if (task && task.id) resolveTaskSave(task.id);
                    });
                    resolve();
                };
                tx.onerror = function (event) {
                    var err = event && event.target ? event.target.error : new Error('save queue transaction failed');
                    entries.forEach(function (task) {
                        if (task && task.id) rejectTaskSave(task.id, err);
                    });
                    reject(err);
                };
            } catch (err) {
                entries.forEach(function (task) {
                    if (task && task.id) rejectTaskSave(task.id, err);
                });
                reject(err);
            }
        });
    }

    function enqueueTaskSave(task) {
        if (!task || !task.id) return Promise.resolve();
        return new Promise(function (resolve, reject) {
            taskSaveBuffer.set(task.id, task);
            if (!taskSaveResolvers.has(task.id)) taskSaveResolvers.set(task.id, []);
            if (!taskSaveRejectors.has(task.id)) taskSaveRejectors.set(task.id, []);
            taskSaveResolvers.get(task.id).push(resolve);
            taskSaveRejectors.get(task.id).push(reject);
            if (!taskSaveFlushTimer) {
                taskSaveFlushTimer = setTimeout(function () {
                    flushTaskSaveQueue().catch(function () {});
                }, TASK_SAVE_BATCH_WINDOW);
            }
        });
    }

    async function getAllTasksDB() {
        return runTx(STORE_TASKS, 'readonly', function (store, tx, resolve) {
            var request = store.getAll();
            request.onsuccess = function () {
                resolve(safeSortByTimestampDesc(request.result));
            };
            tx.oncomplete = function () {
                // handled above
            };
        });
    }

    async function saveTaskDB(task) {
        return enqueueTaskSave(task);
    }

    async function saveTaskBatchDB(tasks) {
        if (!Array.isArray(tasks) || tasks.length === 0) return;
        await Promise.all(tasks.map(function (task) { return enqueueTaskSave(task); }));
    }

    async function getTaskDB(id) {
        return runTx(STORE_TASKS, 'readonly', function (store, tx, resolve) {
            var request = store.get(id);
            request.onsuccess = function () {
                resolve(request.result || null);
            };
            tx.oncomplete = function () {
                // handled above
            };
        });
    }

    async function deleteTaskDB(id) {
        if (id && taskSaveBuffer.has(id)) taskSaveBuffer.delete(id);
        return runTx(STORE_TASKS, 'readwrite', function (store, tx, resolve) {
            store.delete(id);
            tx.oncomplete = function () {
                blobUrlCache.forEach(function (url, key) {
                    if (String(key).indexOf(String(id)) === 0) {
                        try {
                            URL.revokeObjectURL(url);
                        } catch (err) {
                            // ignore revoke error
                        }
                        blobUrlCache.delete(key);
                    }
                });
                resolve();
            };
        });
    }

    // V2 repositories for future decoupling.
    var VeoDB = {
        getDB: function () { return db; },
        init: initDB,
        taskRepo: {
            getAll: getAllTasksDB,
            save: saveTaskDB,
            getById: getTaskDB,
            remove: deleteTaskDB
        },
        billingRepo: {
            add: addBillingRecord,
            stats: getBillingStats
        },
        flowRepo: {
            saveWorkspace: function (workspace) {
                return runTx(STORE_FLOW, 'readwrite', function (store, tx, resolve) {
                    store.put(workspace);
                    tx.oncomplete = function () { resolve(); };
                });
            },
            getWorkspace: function (id) {
                return runTx(STORE_FLOW, 'readonly', function (store, tx, resolve) {
                    var request = store.get(id);
                    request.onsuccess = function () {
                        resolve(request.result || null);
                    };
                });
            }
        },
        media: {
            toBase64: blobToBase64,
            getBlobUrl: getBlobUrl,
            compressImageToBlob: compressImageToBlob
        }
    };

    // Compatibility exports (existing code depends on these globals).
    global.DB_NAME = DB_NAME;
    global.db = db;
    global.initDB = initDB;
    global.addBillingRecord = addBillingRecord;
    global.getBillingStats = getBillingStats;
    global.getBlobUrl = getBlobUrl;
    global.compressImageToBlob = compressImageToBlob;
    global.blobToBase64 = blobToBase64;
    global.getAllTasksDB = getAllTasksDB;
    global.saveTaskDB = saveTaskDB;
    global.saveTaskBatchDB = saveTaskBatchDB;
    global.getTaskDB = getTaskDB;
    global.deleteTaskDB = deleteTaskDB;
    global.VeoDB = VeoDB;

    window.addEventListener('beforeunload', function () {
        if (taskSaveBuffer.size > 0) {
            try { flushTaskSaveQueue(); } catch (err) {}
        }
    });
})(window);


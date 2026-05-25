// ==========================================
// Veo Studio - IndexedDB Layer V2 (no feature change)
// ==========================================

(function initDbV2(global) {
    'use strict';

    var DB_NAME = 'VeoInfinityDB';
    var DB_VERSION = 4;
    var db;
    var blobUrlCache = new Map();

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

    function blobToBase64(blob) {
        if (!blob) return Promise.resolve(null);
        if (typeof blob === 'string') return Promise.resolve(blob);

        return new Promise(function (resolve) {
            try {
                var reader = new FileReader();
                reader.onerror = function () { resolve(null); };
                reader.onloadend = function () { resolve(reader.result); };
                reader.readAsDataURL(blob);
            } catch (err) {
                resolve(null);
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
        return runTx(STORE_TASKS, 'readwrite', function (store, tx, resolve) {
            store.put(task);
            tx.oncomplete = function () { resolve(); };
        });
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
    global.getTaskDB = getTaskDB;
    global.deleteTaskDB = deleteTaskDB;
    global.VeoDB = VeoDB;
})(window);


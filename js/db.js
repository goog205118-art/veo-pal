// ==========================================
// 🗄️ IndexedDB 数据库封装 & Blob 内存优化核心
// ==========================================
const DB_NAME = 'VeoInfinityDB';
let db;
const blobUrlCache = new Map(); 

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
                totalCost += (r.cost || 0);
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

function blobToBase64(blob) {
    if (!blob) return null;
    if (typeof blob === 'string') return Promise.resolve(blob);
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
    });
}

async function getAllTasksDB() {
    return new Promise((resolve) => {
        const tx = db.transaction('tasks', 'readonly');
        const request = tx.objectStore('tasks').getAll();
        request.onsuccess = () => resolve(request.result.sort((a,b) => b.timestamp - a.timestamp));
    });
}

async function saveTaskDB(task) {
    return new Promise((resolve) => {
        const tx = db.transaction('tasks', 'readwrite');
        tx.objectStore('tasks').put(task);
        tx.oncomplete = () => resolve();
    });
}

async function getTaskDB(id) {
    return new Promise((resolve) => {
        const tx = db.transaction('tasks', 'readonly');
        const request = tx.objectStore('tasks').get(id);
        request.onsuccess = () => resolve(request.result);
    });
}

async function deleteTaskDB(id) {
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

(function (window) {
    'use strict';

    const GROUPS = [
        { key: 'today', label: '今天', limitMs: 86400000 },
        { key: 'yesterday', label: '昨天', limitMs: 86400000 * 2 },
        { key: 'week', label: '本周', limitMs: 86400000 * 7 },
        { key: 'older', label: '更早', limitMs: Infinity }
    ];

    function notify(message, type = 'info') {
        if (typeof window.showToast === 'function') window.showToast(message, type);
    }

    function toggleDrawer() {
        const drawer = document.getElementById('material-drawer');
        if (drawer) drawer.classList.toggle('open');
    }

    function openDrawer() {
        const drawer = document.getElementById('material-drawer');
        if (drawer) drawer.classList.add('open');
    }

    function materialTasks(tasks) {
        return Array.isArray(tasks) ? tasks.filter((task) => task && task.type === 'local_image') : [];
    }

    function groupMaterials(materials) {
        const now = Date.now();
        const groups = GROUPS.map((group) => ({ ...group, items: [] }));
        materials.forEach((material) => {
            const diff = now - (Number(material.timestamp) || now);
            const group = groups.find((item) => diff < item.limitMs) || groups[groups.length - 1];
            group.items.push(material);
        });
        return groups;
    }

    function materialItemHtml(material) {
        return `
                <div class="material-item" draggable="true" ondragstart="event.dataTransfer.setData('application/json', JSON.stringify({taskId: '${material.id}', type: 'local'}))" ondblclick="openLightbox(this.querySelector('img').src)" data-tip="按住拖拽复用 | 双击放大">
                    <img src="${window.getBlobUrl(material.id, material.src)}" loading="lazy">
                    <button class="delete-btn material-symbols-outlined" onclick="deleteMaterial(event, '${material.id}')" data-tip="彻底删除素材">close</button>
                </div>
            `;
    }

    async function render() {
        const grid = document.getElementById('material-grid');
        if (!grid) return;
        const tasks = await window.getAllTasksDB();
        const materials = materialTasks(tasks);

        if (materials.length === 0) {
            grid.innerHTML = `<div style="grid-column: span 2; text-align: center; padding: 40px 0; color: var(--text-sub); font-size: 12px;">仓库空空如也</div>`;
            return;
        }

        let html = '';
        groupMaterials(materials).forEach((group) => {
            if (group.items.length === 0) return;
            html += `<div style="grid-column: span 2; font-size: 12px; font-weight: 600; color: var(--text-sub); margin-top: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 4px;">${group.label} (${group.items.length})</div>`;
            html += group.items.map(materialItemHtml).join('');
        });
        grid.innerHTML = html;
    }

    async function deduplicate(event) {
        const btn = event && event.currentTarget;
        const originalHTML = btn ? btn.innerHTML : '';
        if (btn) {
            btn.innerHTML = `<svg class="spinner" viewBox="0 0 50 50" style="width:16px;height:16px;stroke:currentColor;margin-right:6px;"><circle cx="25" cy="25" r="20"></circle></svg> 扫描中...`;
            btn.style.pointerEvents = 'none';
        }

        try {
            const tasks = await window.getAllTasksDB();
            const materials = materialTasks(tasks);
            const seenSignatures = new Set();
            let removedCount = 0;

            for (const material of materials) {
                if (!material.src) continue;
                const signature = await window.VeoMedia.buildBlobSignature(material.src);
                if (!signature) continue;

                if (seenSignatures.has(signature)) {
                    await window.deleteTaskDB(material.id);
                    removedCount++;
                } else {
                    seenSignatures.add(signature);
                }
            }

            if (removedCount > 0) {
                await render();
                notify(`✨ 清理完毕：已成功剔除 ${removedCount} 张完全重复的素材！`, 'success');
            } else {
                notify('🌟 您的素材库很干净，没有发现重复图片。', 'info');
            }
        } catch (err) {
            console.error('去重引擎故障:', err);
            notify('去重扫描失败', 'error');
        } finally {
            if (btn) {
                btn.innerHTML = originalHTML;
                btn.style.pointerEvents = 'auto';
            }
        }
    }

    async function clearAll() {
        if (!window.confirm('🚨 危险操作！\n确定要清空整个素材库吗？\n(这绝对安全：它只清空侧边栏图库，不会影响您画布上已经垫进去、正在使用的卡片图片！)')) return;
        const tasks = await window.getAllTasksDB();
        const materials = materialTasks(tasks);
        await Promise.all(materials.map((material) => window.deleteTaskDB(material.id)));
        await render();
        notify('🗑️ 素材库已全部清空，空间已释放。', 'success');
    }

    async function deleteOne(event, id) {
        if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
        if (!window.confirm('🗑️ 确定要从素材库彻底销毁这张图片吗？')) return;
        await window.deleteTaskDB(id);
        await render();
        notify('已销毁素材', 'success');
    }

    window.VeoMaterials = {
        clearAll,
        deduplicate,
        deleteOne,
        openDrawer,
        render,
        toggleDrawer
    };
})(window);

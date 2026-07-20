// ==========================================
// Billing UI and estimate helpers
// ==========================================
(function () {
    function getEl(id) {
        return document.getElementById(id);
    }

    function getSelectedBatch() {
        const batchSelect = getEl('batch-select');
        const value = batchSelect ? parseInt(batchSelect.value, 10) : 1;
        return Number.isFinite(value) && value > 0 ? value : 1;
    }

    function getVideoUnitCost(modelValue) {
        const normalized = String(modelValue || '').toLowerCase();
        if (normalized.includes('4k')) return 0.50;
        if (normalized.includes('lite')) return 0.20;
        return 0.35;
    }

    async function updateTopBar() {
        if (typeof getBillingStats !== 'function') return null;
        const stats = await getBillingStats();
        const txtEl = getEl('top-bill-text');
        if (txtEl) txtEl.innerText = `￥${stats.totalCost}`;
        return stats;
    }

    async function openModal() {
        if (typeof getBillingStats !== 'function') return null;
        const stats = await getBillingStats();
        const totalEl = getEl('bill-total');
        const videoCountEl = getEl('bill-video-count');
        const imageCountEl = getEl('bill-image-count');
        if (totalEl) totalEl.innerText = '￥' + stats.totalCost;
        if (videoCountEl) videoCountEl.innerText = stats.videoCount;
        if (imageCountEl) imageCountEl.innerText = stats.imageCount;

        const modal = getEl('billing-modal');
        if (modal) {
            modal.style.display = 'flex';
            modal.offsetHeight;
            modal.classList.add('show');
        }
        return stats;
    }

    function closeModal() {
        const modal = getEl('billing-modal');
        if (!modal) return;
        modal.classList.remove('show');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }

    function updateEstimatedCost() {
        const store = typeof globalStore !== 'undefined' ? globalStore : window.globalStore;
        const state = store && typeof store.getState === 'function'
            ? store.getState()
            : {};
        const unitCost = getVideoUnitCost(state.model);
        const total = (unitCost * getSelectedBatch()).toFixed(2);

        const btn = getEl('generate-btn');
        if (btn) btn.setAttribute('data-tip', `发送至服务器生成 | 预估消耗: ￥${total}`);
        return total;
    }

    function updateBatchCount(select) {
        const batchText = getEl('batch-text');
        if (batchText && select && select.options && select.selectedIndex >= 0) {
            batchText.innerText = select.options[select.selectedIndex].text;
        }
        return updateEstimatedCost();
    }

    window.VeoBilling = {
        updateTopBar,
        openModal,
        closeModal,
        updateEstimatedCost,
        updateBatchCount,
        getVideoUnitCost
    };
})();

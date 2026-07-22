// Balance and local usage billing UI.
// Manual balance refresh is cooldown-limited; successful generations can refresh silently.
(function (window) {
    'use strict';

    const BALANCE_ACCOUNT_ID = String(window.VEO_BALANCE_ACCOUNT_ID || '338769');
    const BALANCE_SCALE = Number(window.VEO_BALANCE_SCALE || 1000000) || 1000000;
    const BALANCE_COOLDOWN_MS = Number(window.VEO_BALANCE_COOLDOWN_MS || 30000) || 30000;
    const BALANCE_CACHE_KEY = `veo_balance_cache_${BALANCE_ACCOUNT_ID}`;

    const balanceState = {
        loading: false,
        activeRequest: null,
        nextManualAt: 0,
        last: loadCachedBalance(),
        error: ''
    };
    let cooldownTimer = null;

    function byId(id) {
        return document.getElementById(id);
    }

    function toFiniteNumber(value, fallback = 0) {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    }

    function showToastSafe(message, type = 'info') {
        if (typeof window.showToast === 'function') window.showToast(message, type);
    }

    function formatMoney(value) {
        const n = toFiniteNumber(value, 0);
        return `￥${n.toFixed(4)}`;
    }

    function formatBalanceValue(value) {
        const n = Number(value);
        if (!Number.isFinite(n)) return '--';
        return n.toFixed(2);
    }

    function normalizeResponsePayload(payload) {
        if (Array.isArray(payload)) {
            const first = payload[0];
            return first && typeof first === 'object' && first.json ? first.json : first;
        }
        if (payload && typeof payload === 'object' && payload.json) return payload.json;
        return payload;
    }

    function extractBalance(payload) {
        const normalized = normalizeResponsePayload(payload);
        const root = normalized && typeof normalized === 'object' ? normalized : {};
        if (root.ok === false || root.success === false) {
            throw new Error(root.message || '余额查询失败');
        }
        const data = root.data && typeof root.data === 'object' ? root.data : root;
        const quota = Number(data.quota ?? data.remaining_quota ?? data.remainingQuota);
        const rawBalance = data.balance_display ?? data.balance_text ?? data.balance;
        let balance = Number(rawBalance);
        if (!Number.isFinite(balance) && Number.isFinite(quota)) {
            const scale = Number(data.scale || data.balanceScale || data.balance_scale || BALANCE_SCALE) || BALANCE_SCALE;
            balance = quota / scale;
        }
        if (!Number.isFinite(balance)) throw new Error('余额响应缺少 quota');
        return {
            id: data.id || root.accountId || root.account_id || BALANCE_ACCOUNT_ID,
            quota: Number.isFinite(quota) ? quota : Math.round(balance * BALANCE_SCALE),
            balance,
            balanceDisplay: formatBalanceValue(balance),
            scale: Number(data.scale || data.balanceScale || data.balance_scale || BALANCE_SCALE) || BALANCE_SCALE,
            updatedAt: data.updated_at || data.updatedAt || Date.now(),
            raw: normalized
        };
    }

    function loadCachedBalance() {
        try {
            const raw = window.localStorage && localStorage.getItem(BALANCE_CACHE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed && Number.isFinite(Number(parsed.balance)) ? parsed : null;
        } catch (err) {
            return null;
        }
    }

    function saveCachedBalance(record) {
        try {
            if (window.localStorage && record) {
                localStorage.setItem(BALANCE_CACHE_KEY, JSON.stringify({
                    id: record.id,
                    quota: record.quota,
                    balance: record.balance,
                    balanceDisplay: record.balanceDisplay,
                    scale: record.scale,
                    updatedAt: record.updatedAt || Date.now()
                }));
            }
        } catch (err) {}
    }

    function getManualRemainMs() {
        return Math.max(0, balanceState.nextManualAt - Date.now());
    }

    function scheduleCooldownTick() {
        if (cooldownTimer) return;
        const tick = () => {
            cooldownTimer = null;
            renderTopBarBalance();
            if (getManualRemainMs() > 0) {
                cooldownTimer = window.setTimeout(tick, 500);
            }
        };
        cooldownTimer = window.setTimeout(tick, 500);
    }

    function renderTopBarBalance() {
        const textEl = byId('top-bill-text');
        const button = byId('billing-top-btn');
        const last = balanceState.last;
        const remainMs = getManualRemainMs();
        const remainSec = Math.ceil(remainMs / 1000);
        if (textEl) {
            textEl.textContent = balanceState.loading
                ? '余额刷新中'
                : `余额 ${last ? last.balanceDisplay : '--'}`;
        }
        if (button) {
            const locked = balanceState.loading || remainMs > 0;
            button.disabled = locked;
            button.style.pointerEvents = locked ? 'none' : '';
            button.setAttribute('aria-busy', balanceState.loading ? 'true' : 'false');
            button.setAttribute('data-tip', balanceState.loading
                ? '正在刷新余额'
                : (remainMs > 0 ? `余额刷新冷却中，${remainSec}s 后可再次点击` : '点击刷新账户余额'));
        }
        if (remainMs > 0) scheduleCooldownTick();
    }

    async function renderLocalUsageStats() {
        if (typeof window.getBillingStats !== 'function') return null;
        try {
            const stats = await window.getBillingStats();
            const videoCountEl = byId('bill-video-count');
            const imageCountEl = byId('bill-image-count');
            if (videoCountEl) videoCountEl.textContent = stats.videoCount || 0;
            if (imageCountEl) imageCountEl.textContent = stats.imageCount || 0;
            return stats;
        } catch (err) {
            return null;
        }
    }

    function renderModalBalance() {
        const totalEl = byId('bill-total');
        if (!totalEl) return;
        const last = balanceState.last;
        totalEl.textContent = last ? last.balanceDisplay : '--';

        const card = totalEl.parentElement;
        if (card) {
            const label = Array.from(card.children).find((el) => el !== totalEl && String(el.textContent || '').trim());
            if (label) label.textContent = '当前剩余余额';
        }
        const modal = byId('billing-modal');
        const desc = modal ? modal.querySelector('p') : null;
        if (desc) desc.textContent = '点击钱包按钮手动刷新余额；生成成功后会自动同步一次。';
    }

    async function updateTopBar() {
        renderTopBarBalance();
        renderModalBalance();
        await renderLocalUsageStats();
    }

    function buildBalancePayload() {
        const payload = {
            action: 'balance',
            accountId: BALANCE_ACCOUNT_ID,
            account_id: BALANCE_ACCOUNT_ID,
            balanceScale: BALANCE_SCALE,
            balance_scale: BALANCE_SCALE,
            requestId: `balance_${Date.now()}`
        };
        const runtimeToken = String(window.VEO_BALANCE_SYSTEM_KEY || window.VEO_BALANCE_TOKEN || '').trim();
        if (runtimeToken) {
            payload.systemKey = runtimeToken;
            payload.token = runtimeToken;
        }
        return payload;
    }

    async function refreshBalance(options = {}) {
        const manual = options.manual === true;
        const force = options.force === true;
        const silent = options.silent === true;

        if (manual && !force) {
            const remainMs = getManualRemainMs();
            if (remainMs > 0) {
                showToastSafe(`余额刷新冷却中，请 ${Math.ceil(remainMs / 1000)}s 后再试`, 'warning');
                renderTopBarBalance();
                return balanceState.last;
            }
            balanceState.nextManualAt = Date.now() + BALANCE_COOLDOWN_MS;
            renderTopBarBalance();
        }
        if (balanceState.activeRequest) return balanceState.activeRequest;

        balanceState.loading = true;
        balanceState.error = '';
        renderTopBarBalance();

        balanceState.activeRequest = window.VeoApi.balanceQuery(buildBalancePayload())
            .then(async (response) => {
                if (response.status === 401 || response.status === 403) {
                    if (typeof window.handleAuthError === 'function') window.handleAuthError();
                    throw new Error('余额接口鉴权失败');
                }
                const data = await window.VeoApi.parseResponse(response, 'balance');
                if (!response.ok) {
                    const message = data && data.message ? data.message : `余额接口异常: ${response.status}`;
                    throw new Error(message);
                }
                const record = extractBalance(data);
                balanceState.last = record;
                saveCachedBalance(record);
                renderTopBarBalance();
                renderModalBalance();
                if (!silent) showToastSafe(`余额已刷新：${record.balanceDisplay}`, 'success');
                return record;
            })
            .catch((err) => {
                balanceState.error = err && err.message ? err.message : String(err || '余额查询失败');
                if (!silent) showToastSafe(balanceState.error, 'error');
                renderTopBarBalance();
                throw err;
            })
            .finally(() => {
                balanceState.loading = false;
                balanceState.activeRequest = null;
                renderTopBarBalance();
            });

        return balanceState.activeRequest;
    }

    function refreshBalanceAfterUsage() {
        return refreshBalance({ force: true, silent: true }).catch((err) => {
            console.warn('[billing] balance refresh after usage failed:', err);
            return balanceState.last;
        });
    }

    async function openModal() {
        const modal = byId('billing-modal');
        await renderLocalUsageStats();
        renderModalBalance();
        if (modal) {
            modal.style.display = 'flex';
            modal.offsetHeight;
            modal.classList.add('show');
        }
        return refreshBalance({ manual: true }).catch(() => balanceState.last);
    }

    function closeModal() {
        const modal = byId('billing-modal');
        if (!modal) return;
        modal.classList.remove('show');
        window.setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }

    function updateEstimatedCost() {
        const button = byId('generate-btn');
        if (!button) return;
        const state = window.globalStore && typeof window.globalStore.getState === 'function'
            ? window.globalStore.getState()
            : {};
        const model = state.model || 'veo3.1';
        const batchSelect = byId('batch-select');
        const batchCount = Math.max(1, parseInt(batchSelect ? batchSelect.value : '1', 10) || 1);
        const unitCost = typeof window.getVideoUnitCost === 'function'
            ? window.getVideoUnitCost(model)
            : (window.VeoVideoModels && typeof window.VeoVideoModels.getVideoUnitCost === 'function'
                ? window.VeoVideoModels.getVideoUnitCost(model)
                : 0.35);
        button.setAttribute('data-tip', `发送至服务器生成 | 预估: ${formatMoney(unitCost * batchCount)}`);
    }

    function updateBatchCount(select) {
        const selected = select || byId('batch-select');
        const count = Math.max(1, parseInt(selected ? selected.value : '1', 10) || 1);
        const textEl = byId('batch-text');
        if (textEl) textEl.textContent = count === 1 ? '单次 (x1)' : `并行 (x${count})`;
        updateEstimatedCost();
    }

    window.VeoBilling = {
        state: balanceState,
        closeModal,
        extractBalance,
        openModal,
        refreshBalance,
        refreshBalanceAfterUsage,
        updateBatchCount,
        updateEstimatedCost,
        updateTopBar
    };

    renderTopBarBalance();
})(window);

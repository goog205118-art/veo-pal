// Shared DOM, text escaping, object URL, and lightweight morph helpers.
(function (window) {
    'use strict';

    function cssEscapeSafe(id) {
        if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(id);
        return String(id).replace(/([!"#$%&'()*+,./:;<=>?@[\]^`{|}~\\])/g, '\\$1');
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function escapeAttr(value) {
        return escapeHtml(value);
    }

    function sanitizeAspectRatioCss(value, fallback = '1/1') {
        const text = String(value || '').trim();
        const match = text.match(/^(\d{1,4})\s*:\s*(\d{1,4})$/);
        if (!match) return fallback;
        const w = Math.max(1, Math.min(4096, parseInt(match[1], 10)));
        const h = Math.max(1, Math.min(4096, parseInt(match[2], 10)));
        return `${w}/${h}`;
    }

    function toFiniteNumber(value, fallback = 0) {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    }

    function revokeBlobPrefixSafe(prefix) {
        if (!prefix || typeof window.revokeBlobUrlsByPrefix !== 'function') return;
        try { window.revokeBlobUrlsByPrefix(prefix); } catch (err) {}
    }

    function revokeBlobKeySafe(key) {
        if (!key) return;
        if (typeof window.revokeBlobUrl === 'function') {
            try { window.revokeBlobUrl(key); return; } catch (err) {}
        }
        revokeBlobPrefixSafe(key);
    }

    function snapshotCardState(cardEl) {
        const state = { focusSelector: '', selectionStart: null, selectionEnd: null, videos: [] };
        if (!cardEl) return state;
        const activeEl = document.activeElement;
        if (activeEl && cardEl.contains(activeEl)) {
            if (activeEl.id) state.focusSelector = `#${cssEscapeSafe(activeEl.id)}`;
            else if (activeEl.name) state.focusSelector = `[name="${String(activeEl.name).replace(/"/g, '\\"')}"]`;
            else if (activeEl.className && typeof activeEl.className === 'string') {
                const oneClass = activeEl.className.split(/\s+/).find(Boolean);
                if (oneClass) state.focusSelector = `.${cssEscapeSafe(oneClass)}`;
            }
            if (typeof activeEl.selectionStart === 'number') state.selectionStart = activeEl.selectionStart;
            if (typeof activeEl.selectionEnd === 'number') state.selectionEnd = activeEl.selectionEnd;
        }
        const videos = cardEl.querySelectorAll('video');
        videos.forEach((video, idx) => {
            state.videos.push({
                key: video.currentSrc || video.getAttribute('src') || `video_${idx}`,
                currentTime: Number.isFinite(video.currentTime) ? video.currentTime : 0,
                paused: video.paused
            });
        });
        return state;
    }

    function restoreCardState(cardEl, state) {
        if (!cardEl || !state) return;
        if (Array.isArray(state.videos) && state.videos.length > 0) {
            const videos = cardEl.querySelectorAll('video');
            videos.forEach((video, idx) => {
                const key = video.currentSrc || video.getAttribute('src') || `video_${idx}`;
                const hit = state.videos.find((v) => v.key === key) || state.videos[idx];
                if (!hit) return;
                try {
                    if (Number.isFinite(hit.currentTime) && hit.currentTime > 0) video.currentTime = hit.currentTime;
                    if (!hit.paused) video.play().catch(() => {});
                } catch (err) {}
            });
        }
        if (state.focusSelector) {
            const target = cardEl.querySelector(state.focusSelector);
            if (target && typeof target.focus === 'function') {
                target.focus({ preventScroll: true });
                if (typeof state.selectionStart === 'number' && typeof state.selectionEnd === 'number' && typeof target.setSelectionRange === 'function') {
                    try { target.setSelectionRange(state.selectionStart, state.selectionEnd); } catch (err) {}
                }
            }
        }
    }

    function patchElementAttributes(fromEl, toEl) {
        const fromAttrs = fromEl.getAttributeNames ? fromEl.getAttributeNames() : [];
        const toAttrs = toEl.getAttributeNames ? toEl.getAttributeNames() : [];
        fromAttrs.forEach((name) => {
            if (!toEl.hasAttribute(name)) fromEl.removeAttribute(name);
        });
        toAttrs.forEach((name) => {
            const nextVal = toEl.getAttribute(name);
            if (fromEl.getAttribute(name) !== nextVal) fromEl.setAttribute(name, nextVal);
        });
    }

    function syncFormControlState(fromEl, toEl) {
        if (!fromEl || !toEl || fromEl.nodeType !== Node.ELEMENT_NODE || toEl.nodeType !== Node.ELEMENT_NODE) return;
        const tag = fromEl.tagName;
        if (tag === 'INPUT') {
            const type = (fromEl.getAttribute('type') || '').toLowerCase();
            if (type === 'checkbox' || type === 'radio') {
                if (fromEl.checked !== toEl.checked) fromEl.checked = toEl.checked;
            } else if (fromEl.value !== toEl.value) {
                fromEl.value = toEl.value;
            }
            if (fromEl.disabled !== toEl.disabled) fromEl.disabled = toEl.disabled;
            return;
        }
        if (tag === 'TEXTAREA') {
            if (fromEl.value !== toEl.value) fromEl.value = toEl.value;
            if (fromEl.disabled !== toEl.disabled) fromEl.disabled = toEl.disabled;
            return;
        }
        if (tag === 'SELECT') {
            if (fromEl.disabled !== toEl.disabled) fromEl.disabled = toEl.disabled;
            const nextValue = toEl.value;
            if (fromEl.value !== nextValue) fromEl.value = nextValue;
            if (fromEl.selectedIndex !== toEl.selectedIndex) fromEl.selectedIndex = toEl.selectedIndex;
            return;
        }
        if (tag === 'OPTION') {
            if (fromEl.selected !== toEl.selected) fromEl.selected = toEl.selected;
            if (fromEl.defaultSelected !== toEl.defaultSelected) fromEl.defaultSelected = toEl.defaultSelected;
        }
    }

    function canReuseNode(fromNode, toNode) {
        if (!fromNode || !toNode) return false;
        if (fromNode.nodeType !== toNode.nodeType) return false;
        if (fromNode.nodeType === Node.TEXT_NODE) return true;
        if (fromNode.nodeType === Node.ELEMENT_NODE) return fromNode.tagName === toNode.tagName;
        return false;
    }

    function morphNodeLite(fromNode, toNode) {
        if (!canReuseNode(fromNode, toNode)) {
            fromNode.replaceWith(toNode.cloneNode(true));
            return;
        }
        if (fromNode.nodeType === Node.TEXT_NODE) {
            if (fromNode.nodeValue !== toNode.nodeValue) fromNode.nodeValue = toNode.nodeValue;
            return;
        }
        patchElementAttributes(fromNode, toNode);
        morphChildrenLite(fromNode, toNode);
        syncFormControlState(fromNode, toNode);
    }

    function morphChildrenLite(fromParent, toParent) {
        const fromChildren = Array.from(fromParent.childNodes);
        const toChildren = Array.from(toParent.childNodes);
        const byId = new Map();
        fromChildren.forEach((child) => {
            if (child.nodeType === Node.ELEMENT_NODE && child.id) byId.set(child.id, child);
        });
        const used = new Set();
        const nextOrdered = [];
        let cursor = 0;

        toChildren.forEach((nextChild) => {
            let matched = null;
            if (nextChild.nodeType === Node.ELEMENT_NODE && nextChild.id && byId.has(nextChild.id)) {
                matched = byId.get(nextChild.id);
            } else {
                while (cursor < fromChildren.length && used.has(fromChildren[cursor])) cursor++;
                const candidate = fromChildren[cursor];
                if (canReuseNode(candidate, nextChild)) matched = candidate;
                cursor++;
            }
            if (matched) {
                used.add(matched);
                morphNodeLite(matched, nextChild);
                nextOrdered.push(matched);
            } else {
                nextOrdered.push(nextChild.cloneNode(true));
            }
        });

        fromChildren.forEach((child) => {
            if (!used.has(child) && child.parentNode === fromParent) child.remove();
        });
        fromParent.replaceChildren(...nextOrdered);
    }

    function morphCardDOM(cardEl, nextHtml) {
        if (!cardEl) return;
        const state = snapshotCardState(cardEl);
        const shell = document.createElement('div');
        shell.innerHTML = nextHtml;
        morphChildrenLite(cardEl, shell);
        restoreCardState(cardEl, state);
    }

    const api = {
        cssEscapeSafe,
        escapeHtml,
        escapeAttr,
        sanitizeAspectRatioCss,
        toFiniteNumber,
        revokeBlobPrefixSafe,
        revokeBlobKeySafe,
        snapshotCardState,
        restoreCardState,
        patchElementAttributes,
        syncFormControlState,
        canReuseNode,
        morphNodeLite,
        morphChildrenLite,
        morphCardDOM
    };

    window.VeoDom = api;
    Object.keys(api).forEach((key) => {
        window[key] = api[key];
    });
})(window);

// ==========================================
// Veo Studio - Core Store V2 (no feature change)
// ==========================================

(function initStoreV2(global) {
    'use strict';

    function isObject(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }

    function deepClone(value) {
        try {
            if (typeof structuredClone === 'function') {
                return structuredClone(value);
            }
        } catch (err) {
            // fallback below
        }

        if (Array.isArray(value)) {
            return value.map(deepClone);
        }

        if (isObject(value)) {
            var out = {};
            Object.keys(value).forEach(function (k) {
                out[k] = deepClone(value[k]);
            });
            return out;
        }

        return value;
    }

    // ------------------------------------------
    // Event Bus (compatible with previous API)
    // ------------------------------------------
    function EventBus() {
        this.listeners = Object.create(null);
    }

    EventBus.prototype.on = function on(event, callback) {
        if (typeof event !== 'string' || !event || typeof callback !== 'function') {
            return function noop() {};
        }

        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }

        this.listeners[event].push(callback);

        var self = this;
        return function unsubscribe() {
            self.off(event, callback);
        };
    };

    EventBus.prototype.off = function off(event, callback) {
        var queue = this.listeners[event];
        if (!queue || queue.length === 0) return;

        if (typeof callback !== 'function') {
            delete this.listeners[event];
            return;
        }

        this.listeners[event] = queue.filter(function (fn) {
            return fn !== callback;
        });

        if (this.listeners[event].length === 0) {
            delete this.listeners[event];
        }
    };

    EventBus.prototype.once = function once(event, callback) {
        if (typeof callback !== 'function') {
            return function noop() {};
        }

        var self = this;
        function wrapper(payload) {
            self.off(event, wrapper);
            callback(payload);
        }

        return this.on(event, wrapper);
    };

    EventBus.prototype.emit = function emit(event, data) {
        var queue = this.listeners[event];
        if (!queue || queue.length === 0) return;

        queue.slice().forEach(function (callback) {
            try {
                callback(data);
            } catch (err) {
                console.error('[EventBus emit error]', event, err);
            }
        });
    };

    EventBus.prototype.clear = function clear(event) {
        if (event) {
            delete this.listeners[event];
            return;
        }
        this.listeners = Object.create(null);
    };

    // ------------------------------------------
    // Store (single source of truth)
    // ------------------------------------------
    function VeoStore() {
        this.state = {
            model: 'veo3.1',
            aspectRatio: '9:16',
            enhancePrompt: true,
            enableUpsample: false,
            autoRetry: false,
            currentMode: 'ref',
            firstFrame: null,
            lastFrame: null,
            references: []
        };

        this._mutations = {
            SET_MODEL: function (state, payload) {
                state.model = payload && payload.value;
                global.sysBus.emit('UI:UPDATE_MODEL_TEXT', payload && payload.text);
            },

            SET_RATIO: function (state, payload) {
                state.aspectRatio = payload && payload.value;
                global.sysBus.emit('UI:UPDATE_RATIO', {
                    value: payload && payload.value,
                    text: payload && payload.text
                });
            },

            SET_ENHANCE: function (state, payload) {
                var raw = payload && payload.value;
                state.enhancePrompt = raw === true || raw === 'true';
                global.sysBus.emit('UI:UPDATE_ENHANCE_TEXT', payload && payload.text);
            },

            SET_MODE: function (state, payload) {
                state.currentMode = payload;
                global.sysBus.emit('UI:SWITCH_MODE', payload);
            },

            SET_UPSAMPLE: function (state, payload) {
                state.enableUpsample = payload === true;
            },

            SET_AUTO_RETRY: function (state, payload) {
                state.autoRetry = payload === true;
            },

            SET_FIRST_FRAME: function (state, payload) {
                state.firstFrame = payload || null;
            },

            SET_LAST_FRAME: function (state, payload) {
                state.lastFrame = payload || null;
            },

            SET_REFERENCES: function (state, payload) {
                state.references = Array.isArray(payload) ? payload.slice() : [];
            },

            ADD_REFERENCE: function (state, payload) {
                if (!payload) return;
                if (!Array.isArray(state.references)) state.references = [];
                if (state.references.length >= 3) return;
                state.references.push(payload);
            },

            REMOVE_REFERENCE_AT: function (state, payload) {
                if (!Array.isArray(state.references)) state.references = [];
                var index = Number(payload);
                if (!Number.isInteger(index) || index < 0 || index >= state.references.length) return;
                state.references.splice(index, 1);
            },

            HYDRATE_MEDIA_STATE: function (state, payload) {
                var data = isObject(payload) ? payload : {};
                state.firstFrame = data.firstFrame || null;
                state.lastFrame = data.lastFrame || null;
                state.references = Array.isArray(data.references) ? data.references.slice() : [];
            },

            PATCH_STATE: function (state, payload) {
                if (!isObject(payload)) return;
                Object.keys(payload).forEach(function (k) {
                    state[k] = payload[k];
                });
            },

            RESET_MEDIA: function (state) {
                state.firstFrame = null;
                state.lastFrame = null;
                state.references = [];
            }
        };
    }

    VeoStore.prototype.dispatch = function dispatch(action, payload) {
        try {
            var mutation = this._mutations[action];
            if (!mutation) {
                console.warn('[Store] unknown action:', action);
                return false;
            }
            mutation(this.state, payload);
            return true;
        } catch (err) {
            console.error('[Store] dispatch failed:', action, err);
            return false;
        }
    };

    // Keep backward compatibility: return live reference.
    VeoStore.prototype.getState = function getState() {
        return this.state;
    };

    VeoStore.prototype.getSnapshot = function getSnapshot() {
        return deepClone(this.state);
    };

    VeoStore.prototype.setState = function setState(nextState) {
        if (!isObject(nextState)) return false;
        this.state = Object.assign({}, this.state, nextState);
        return true;
    };

    var sysBus = new EventBus();
    var globalStore = new VeoStore();

    global.EventBus = EventBus;
    global.sysBus = sysBus;
    global.VeoStore = VeoStore;
    global.globalStore = globalStore;
})(window);

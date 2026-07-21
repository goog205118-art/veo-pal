// Lightweight event bus and shared video console state.
class EventBus {
    constructor() {
        this.listeners = Object.create(null);
    }

    on(event, callback) {
        if (!event || typeof callback !== 'function') return () => {};
        if (!this.listeners[event]) this.listeners[event] = new Set();
        this.listeners[event].add(callback);
        return () => this.off(event, callback);
    }

    once(event, callback) {
        if (!event || typeof callback !== 'function') return () => {};
        const unsubscribe = this.on(event, (data) => {
            unsubscribe();
            callback(data);
        });
        return unsubscribe;
    }

    off(event, callback) {
        const listeners = this.listeners[event];
        if (!listeners) return false;
        const removed = listeners.delete(callback);
        if (listeners.size === 0) delete this.listeners[event];
        return removed;
    }

    emit(event, data) {
        const listeners = this.listeners[event];
        if (!listeners || listeners.size === 0) return false;
        Array.from(listeners).forEach((callback) => {
            try {
                callback(data);
            } catch (error) {
                console.error('[EventBus] listener failed:', event, error);
            }
        });
        return true;
    }

    clear(event = '') {
        if (event) {
            delete this.listeners[event];
            return;
        }
        this.listeners = Object.create(null);
    }
}

const DEFAULT_VIDEO_STATE = {
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

function toBoolean(value) {
    return value === true || value === 'true';
}

const sysBus = new EventBus();

class VeoStore {
    constructor(initialState = {}) {
        this.state = {
            ...DEFAULT_VIDEO_STATE,
            ...initialState
        };
        this.actions = {
            SET_MODEL: (payload = {}) => {
                this.state.model = payload.value || DEFAULT_VIDEO_STATE.model;
                sysBus.emit('UI:UPDATE_MODEL_TEXT', payload.text || this.state.model);
            },
            SET_RATIO: (payload = {}) => {
                this.state.aspectRatio = payload.value || DEFAULT_VIDEO_STATE.aspectRatio;
                sysBus.emit('UI:UPDATE_RATIO', {
                    value: this.state.aspectRatio,
                    text: payload.text || this.state.aspectRatio
                });
            },
            SET_ENHANCE: (payload = {}) => {
                this.state.enhancePrompt = toBoolean(payload.value);
                sysBus.emit('UI:UPDATE_ENHANCE_TEXT', payload.text || (this.state.enhancePrompt ? 'On' : 'Off'));
            },
            SET_UPSAMPLE: (payload = {}) => {
                this.state.enableUpsample = toBoolean(payload.value);
                sysBus.emit('UI:UPDATE_UPSAMPLE_TEXT', payload.text || (this.state.enableUpsample ? 'On' : 'Off'));
            },
            SET_AUTO_RETRY: (payload = {}) => {
                this.state.autoRetry = toBoolean(payload.value);
                sysBus.emit('UI:UPDATE_AUTO_RETRY_TEXT', payload.text || (this.state.autoRetry ? 'On' : 'Off'));
            },
            SET_MODE: (payload) => {
                this.state.currentMode = payload === 'frame' ? 'frame' : 'ref';
                sysBus.emit('UI:SWITCH_MODE', this.state.currentMode);
            },
            SET_FRAME: (payload = {}) => {
                const key = payload.key === 'lastFrame' ? 'lastFrame' : 'firstFrame';
                this.state[key] = payload.value || null;
            },
            CLEAR_FRAME: (payload = {}) => {
                const key = payload.key === 'lastFrame' ? 'lastFrame' : 'firstFrame';
                this.state[key] = null;
            },
            SET_REFERENCES: (payload = {}) => {
                this.state.references = Array.isArray(payload.value) ? payload.value : [];
            },
            CLEAR_REFERENCES: () => {
                this.state.references = [];
            }
        };
    }

    dispatch(action, payload) {
        const handler = this.actions[action];
        if (typeof handler !== 'function') {
            console.warn('[VeoStore] unknown action:', action);
            return false;
        }
        handler(payload);
        sysBus.emit('STORE:CHANGED', {
            action,
            payload,
            state: this.state
        });
        return true;
    }

    setState(patch = {}, action = 'SET_STATE') {
        if (!patch || typeof patch !== 'object') return this.state;
        Object.assign(this.state, patch);
        sysBus.emit('STORE:CHANGED', {
            action,
            payload: patch,
            state: this.state
        });
        return this.state;
    }

    getState() {
        return this.state;
    }
}

const globalStore = new VeoStore();
window.sysBus = sysBus;
window.globalStore = globalStore;

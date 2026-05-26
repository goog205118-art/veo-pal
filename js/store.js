// ==========================================
// 🧠 Veo Studio 中枢神经 (EventBus & State Machine)
// ==========================================

// 1. 广播站：EventBus (发布-订阅中心)
class EventBus {
    constructor() { this.listeners = {}; }
    
    // 订阅频道
    on(event, callback) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    }
    
    // 广播消息
    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }
}
const sysBus = new EventBus();

// 2. 数据金库：Store (状态机)
class VeoStore {
    constructor() {
        // 唯一的全局真实数据源 (Single Source of Truth)
        this.state = {
            model: 'veo_3_1_fast',
            aspectRatio: '9:16',
            enhancePrompt: true,
            enableUpsample: false,
            autoRetry: false,
            currentMode: 'ref', // ref 或 frame
            firstFrame: null,
            lastFrame: null,
            references: []
        };
    }

    // 唯一允许修改数据的方法
    dispatch(action, payload) {
        switch (action) {
            case 'SET_MODEL':
                this.state.model = payload.value;
                sysBus.emit('UI:UPDATE_MODEL_TEXT', payload.text);
                sysBus.emit('SYSTEM:MODEL_CHANGED', payload.value);
                break;
                
            case 'SET_RATIO':
                this.state.aspectRatio = payload.value;
                sysBus.emit('UI:UPDATE_RATIO', { value: payload.value, text: payload.text });
                break;
                
            case 'SET_ENHANCE':
                this.state.enhancePrompt = payload.value === 'true';
                sysBus.emit('UI:UPDATE_ENHANCE_TEXT', payload.text);
                break;

            case 'SET_MODE':
                this.state.currentMode = payload;
                sysBus.emit('UI:SWITCH_MODE', payload);
                break;
        }
    }

    // 获取当前状态
    getState() { return this.state; }
}
const globalStore = new VeoStore();

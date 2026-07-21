# Veo Studio / My AI Station

Veo Studio 是一个面向个人 AIGC 生产的轻量工作台。前端采用静态 HTML、CSS 和经典全局 JavaScript 组织，浏览器本地通过 IndexedDB 保存画布任务、素材和账单记录；后端通过 Wally/n8n webhook 代理承接图片生成、视频生成、轮询和鉴权。

当前测试分支已经围绕高频生产路径完成减负：保留 GPT Image 2 生图、Veo 3.1 视频、无限画布任务卡片、素材库、账单中心和 `.veo` 工程导入导出；旧 apimart 官方通道、旧节点工作流分区、大型流程节点 UI 已移除。

## 当前能力

- 无限画布：任务卡片、拖拽、缩放、框选、多选工具条、小地图和可见性裁剪。
- 图像生成：GPT Image 2 统一生图链路，支持参考图、比例、蒙版、同步结果和异步轮询。
- 视频生成：Veo 3.1 普通 / 4K，支持参考图模式和首尾帧模式。
- 本地数据：IndexedDB 保存任务、素材库、Blob 缓存和生成账单。
- 工程文件：`.veo` 导入导出，导出时会过滤退役节点。
- 后端接口：`window.VeoApi` 命名端点注册表对接 n8n webhook。
- 模型接口：`window.VeoModelRegistry` 集中维护图像路由、视频质量档位和计费元数据。

## 项目入口

- `index.html`：主工作台入口。
- `studio.html`：主工作台镜像入口。
- `launch-c.html`：深色展示入口。
- `launch-c-light.html`：浅色展示入口。
- `js/index.html`：保留的子目录入口，脚本路径使用 `../js/...`。

## 核心目录

- `css/style.css`：主工作台布局、画布、卡片、控制台、素材库和账单样式。
- `js/app.js`：旧 inline handler 兼容层和模块 hook 串联层。
- `js/app-bootstrap.js`：启动流程、DB 初始化、首屏渲染和全局事件绑定。
- `js/api-client.js`：统一封装 n8n/webhook 请求。
- `js/model-registry.js`：集中注册图像路由、视频模型、质量档位和计费元数据。
- `js/migration-guards.js`：集中维护旧工程退役节点过滤规则。
- `js/db.js`：IndexedDB、Blob 本地缓存、任务保存队列和旧数据迁移保护。
- `js/canvas-*.js`：无限画布相机、布局、渲染、选择、裁剪、小地图和交互。
- `js/image-config.js`：生图快捷提示词、参考图意图、预览上限和点击冷却配置。
- `js/image-*.js`：GPT Image 2 生图状态、请求、参考图、预览、蒙版、提交和轮询。
- `js/video-*.js`：Veo 模型定义、视频控制台、任务提交、轮询和视频卡片 UI。
- `js/workspace-*.js`：`.veo` 工程导入导出、拖拽和剪贴板输入。
- `js/material-library.js`：全局素材库。
- `js/billing.js`：生成账单统计。
- `js/dynamic-timer.js`：任务卡片运行秒表的轻量 DOM 更新。

## 后端对接

前端统一通过 `window.VeoApi` 调用 Wally/n8n 代理层，默认配置在 `js/api-client.js`：

```js
videoSubmit: 'https://api.wallyai.top/webhook/proxy-submit'
videoPoll: 'https://api.wallyai.top/webhook/proxy-poll'
imageUnified: 'https://api.wallyai.top/webhook/proxy-image-unified'
```

入口 HTML 可以覆盖生图接口：

```js
window.VEO_IMAGE_UNIFIED_WEBHOOK = window.VEO_IMAGE_UNIFIED_WEBHOOK || '';
window.VEO_IMAGE_POLL_WEBHOOK = window.VEO_IMAGE_POLL_WEBHOOK || '';
window.VEO_WEBHOOK_AUTH = window.VEO_WEBHOOK_AUTH || '';
```

新增或替换后端接口时，优先在 `js/api-client.js` 的命名端点中注册，再让业务模块调用 `postEndpoint(...)`。新增或下线模型时，优先改 `js/model-registry.js`，再检查 UI、payload、轮询解析和账单。

## 本地运行

项目当前没有 `package.json`，也没有 npm 构建链路。可以直接打开 `index.html`，如果浏览器安全策略影响 Blob、fetch 或文件操作，建议在仓库根目录启动静态服务：

```bash
python -m http.server 8080
```

然后访问：

```text
http://localhost:8080/index.html
```

提交前建议做基础检查：

```powershell
Get-ChildItem js -Filter *.js | Sort-Object Name | ForEach-Object { node --check $_.FullName }
git diff --check
```

## 当前验证状态

2026-07-21 收尾验收已完成基础自动化检查：全量 JS 语法检查、`git diff --check`、模型注册表烟测、迁移保护烟测、生图配置烟测、旧通道残留扫描和 Chrome 页面烟测均通过。

受本地沙箱网络限制，Google Fonts、Tailwind CDN 和 Ionicons CDN 在自动化环境中会被拦截；真实登录、真实图片/视频提交仍需要使用 n8n 密钥做人工联调。

## 开发文档

完整架构说明见 [DEVELOPMENT.md](DEVELOPMENT.md)，里面包含：

- HTML 脚本加载顺序和全局模块约定；
- n8n/webhook 接口层说明；
- 模型注册表和新增模型流程；
- IndexedDB 表结构和迁移保护；
- 图片、视频、画布、工程文件、素材库、账单模块职责；
- 已删除功能和不要回引的旧逻辑；
- 方案 C 收尾验收口径；
- 下一阶段重构路线。

## 下一步开发方向

1. 继续缩小 `js/app.js`，让它逐步变成纯兼容和 wiring 层。
2. 强化 `js/store.js`，补齐更清晰的事件、action 和错误隔离能力。
3. 继续把模型接口集中到 `js/model-registry.js` 和 `js/api-client.js`，减少业务模块里的散落配置。
4. 新增模型时同步考虑 UI、payload、轮询、失败兜底和账单链路。
5. 保留旧 `.veo` 文件迁移保护和退役节点过滤，避免历史工程污染新画布。

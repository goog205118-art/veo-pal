# Veo Studio 开发文档

这是一个面向个人 AIGC 生产的轻量工作台前端项目。前端采用静态 HTML、CSS 和经典全局脚本组织，浏览器本地使用 IndexedDB 保存画布任务、素材和账单记录；后端通过 n8n/webhook 服务承接视频生成、图像生成、轮询和鉴权代理。

当前版本已经完成一轮减负：前端保留主工作台、GPT Image 2 生图链路、Veo 3.1 视频链路、素材库、账单、无限画布和 .veo 工程导入导出；已移除旧的 apimart 官方通道入口、旧节点工作流分区和大型流程节点 UI。

## 项目定位

- 主入口是 `index.html` / `studio.html`，提供登录门禁、无限画布、生图卡片、视频控制台、素材库和账单中心。
- 视觉入口是 `launch-c.html` 和 `launch-c-light.html`，用于展示型首页和进入主工作台。
- 后端默认通过 `https://api.wallyai.top/webhook/...` 代理到 n8n 工作流。
- 项目没有 npm 构建链路，直接以静态文件方式运行。修改时要注意 HTML 中的 `<script>` 加载顺序。

## 目录结构

```text
.
├── index.html              # 主工作台入口
├── studio.html             # 主工作台镜像入口
├── launch-c.html           # 深色展示入口
├── launch-c-light.html     # 浅色展示入口
├── css/
│   ├── style.css           # 主工作台样式
│   ├── launch-c.css        # 深色展示入口样式
│   └── launch-c-light.css  # 浅色展示入口样式
├── js/
│   ├── app.js              # 主工作台胶水层和旧全局函数兼容
│   ├── app-bootstrap.js    # 启动流程、DB 初始化、首屏渲染
│   ├── api-client.js       # n8n/webhook 请求封装
│   ├── db.js               # IndexedDB、本地 Blob 缓存、任务保存队列
│   ├── store.js            # 视频控制台的轻量状态和事件总线
│   ├── canvas-*.js         # 画布相机、选择、布局、渲染、交互
│   ├── image-*.js          # GPT Image 2 生图状态、UI、请求、轮询
│   ├── video-*.js          # Veo 3.1 视频模型、控制台、任务提交和轮询
│   ├── workspace-*.js      # .veo 导入导出、剪贴板和拖拽输入
│   ├── material-library.js # 全局素材库
│   ├── billing.js          # 账单统计 UI
│   └── launch-c.js         # 展示入口动效
└── ARCH_REFACTOR_NOTES.md  # 历史重构记录
```

## 入口和加载顺序

`index.html`、`studio.html` 和 `js/index.html` 都使用同一组脚本。它们不是 ES module，也不是打包产物，而是按顺序挂载全局对象和全局函数。

关键加载阶段：

1. `db.js`、`store.js`、`api-client.js` 先加载，提供 IndexedDB、`globalStore`、`sysBus` 和 `window.VeoApi`。
2. `dom-utils.js`、`task-cache.js`、`media-utils.js`、`image-core.js` 加载通用工具和生图基础规则。
3. `material-library.js`、`video-models.js`、`billing.js`、`video-console.js`、`video-tasks.js` 加载素材、账单和视频链路。
4. `image-api-utils.js` 到 `image-submit.js` 加载生图解析、状态、蒙版、UI、请求和提交链路。
5. `app-shell.js` 加载登录、主题、toast、弹窗和 lightbox。
6. `canvas-*.js`、`workspace-*.js`、`task-*.js`、`selection-toolbar.js` 加载画布、导入导出和任务操作。
7. `app.js` 统一配置各模块 hooks，并保留旧 inline handler 所需的全局函数。
8. `app-bootstrap.js` 在 DOM ready 后初始化 DB、渲染画布、恢复轮询和绑定全局事件。

开发时如果新增模块，优先保持这个顺序：基础能力先于业务模块，业务模块先于 `app.js`，启动逻辑放在 `app-bootstrap.js` 之后。

## 后端与 n8n 对接

后端请求集中在 `js/api-client.js`：

```js
videoSubmit: 'https://api.wallyai.top/webhook/proxy-submit'
videoPoll: 'https://api.wallyai.top/webhook/proxy-poll'
imageUnified: 'https://api.wallyai.top/webhook/proxy-image-unified'
```

入口 HTML 支持覆盖图像接口：

```js
window.VEO_IMAGE_UNIFIED_WEBHOOK = window.VEO_IMAGE_UNIFIED_WEBHOOK || '';
window.VEO_IMAGE_POLL_WEBHOOK = window.VEO_IMAGE_POLL_WEBHOOK || '';
window.VEO_WEBHOOK_AUTH = window.VEO_WEBHOOK_AUTH || '';
```

鉴权逻辑：

- 登录表单输入的 n8n API Key 会写入 `sessionStorage.veo_admin_pwd`。
- 如果选择记住设备，会额外写入 `localStorage.veo_admin_pwd_saved`。
- 视频和图像请求都会带 `Content-Type: application/json`。
- 如果存在登录密钥，请求头会带 `wally123`。
- 图像请求可额外带 `Authorization: window.VEO_WEBHOOK_AUTH`。

## 数据层

本地数据库在 `js/db.js`，数据库名为 `VeoInfinityDB`，当前版本号为 5。

对象仓库：

- `tasks`：画布任务、视频任务、生图任务、本地图片节点。
- `billing`：视频和图像生成的账单记录。
- `material_store`：全局素材库，带 `timestamp` 索引。

迁移保护：

- `flow_workspaces` 在升级时会被删除，这是旧工作流分区的清理逻辑。
- `RETIRED_NODE_TYPES` 保留在 `app.js`，用于过滤旧工程里的 `frame`、`note`、`tool_generator`、`tool_cropper` 等退役节点。

任务保存使用 100ms 批量缓冲，避免拖拽、输入和轮询频繁写库造成卡顿。读任务时会合并尚未落库的缓冲数据。

## 画布系统

画布是项目的核心交互层，入口 DOM 是：

- `#canvas-viewport`
- `#canvas-board`
- `#selection-marquee`

主要模块：

- `canvas-camera.js`：坐标转换、缩放、平移、惯性、动态网格。
- `canvas-selection.js`：选中集合、框选、卡片切换选择。
- `canvas-layout.js`：卡片位置归一化、自动排版、聚焦选中卡片。
- `viewport-culling.js`：大画布卡片可见性裁剪。
- `minimap.js`：小地图绘制和跳转。
- `canvas-context-menu.js`：右键菜单、复用图片、复制、删除、聚焦。
- `canvas-cards.js`：卡片尺寸、同步指纹和局部刷新判断。
- `canvas-renderer.js`：卡片 HTML 分发、画布 reconciliation、恢复轮询。
- `canvas-interactions.js`：鼠标、滚轮、键盘、拖拽和 Alt 复制。
- `selection-toolbar.js`：多选工具条。

`app.js` 会把这些模块通过 `configure({ hooks })` 串起来。新增画布行为时，优先把纯逻辑放进对应 `canvas-*` 模块，再在 `app.js` 添加 hook 连接。

## 图像生成链路

当前生图链路统一到 GPT Image 2 路由，旧通道已经从 UI、默认状态、请求和计费元数据中移除。

核心流程：

1. `task-actions.js` 创建 `tool_image_gen` 任务卡片。
2. `image-normalize.js` 归一化任务状态、尺寸、比例、参考图上限和预览历史。
3. `image-ui.js` 渲染生图卡片主界面。
4. `image-reference-ui.js` 渲染参考图、提示词 chip、比例和小工具区。
5. `image-preview-ui.js` 渲染 pending、success、failed 预览流。
6. `image-mask-editor.js` 管理局部重绘蒙版。
7. `image-request.js` 构造统一 payload，并调用 `window.VeoApi.imageSubmit(...)`。
8. `image-submit.js` 处理点击生成、冷却、失败重试、直接返回图片和异步任务 ID。
9. `image-tasks.js` 处理异步轮询、结果写回、计费和超时失败。
10. `image-core.js` 处理尺寸规则、usage 提取和费用计算。

生图请求既支持同步返回图片 URL/base64，也支持返回任务 ID 后继续轮询。轮询接口默认可回退到 unified endpoint，但 n8n 需要支持 `action=poll`。

## 视频生成链路

视频控制台支持两种输入模式：

- `ref`：参考图驱动。
- `frame`：首尾帧驱动。

模型定义在 `js/video-models.js`：

- `veo3.1`
- `veo3.1-components`
- `veo3.1-4k`
- `veo3.1-components-4k`

核心流程：

1. `video-console.js` 管理控制台 UI、参考图、首尾帧、模式切换和复用任务。
2. `store.js` 保存当前控制台状态，并通过 `sysBus` 推送 UI 更新。
3. `video-tasks.js` 构造 payload，调用 `window.VeoApi.videoSubmit(...)`。
4. 返回任务 ID 后写入 `tasks`，并由 `canvas-renderer.js` 渲染视频任务卡片。
5. `video-tasks.js` 使用 `window.VeoApi.videoPoll(...)` 轮询状态。
6. 成功后写入 `videoUrl`，并按 `video-models.js` 中的单价写入账单。

## UI 与样式

- 主样式在 `css/style.css`，包含登录门禁、顶栏、无限画布、浮动视频控制台、生图卡片、蒙版编辑器、素材库、账单、帮助弹窗和响应式规则。
- 展示入口使用 `css/launch-c.css` 和 `css/launch-c-light.css`，动效在 `js/launch-c.js`。
- 主工作台依赖外部 CDN：Tailwind CDN、Google Fonts、Material Symbols 和 Ionicons。
- 当前 UI 已经去掉大型工作流分区，保留高频生产路径：新建生图、排版、素材库、导入导出、账单、帮助、视频控制台。

## 工程文件导入导出

`.veo` 工程由 `js/workspace-io.js` 处理：

- 导出时会把 Blob 转成 data URL，并过滤退役节点。
- 导入时会把 data URL 解回 Blob，再合并到当前画布。
- 导入导出只处理前端任务数据，不包含 n8n 工作流配置。

## 本地开发

这是静态项目，可以直接打开 `index.html`。如果浏览器安全策略影响本地 Blob、fetch 或文件操作，建议在仓库根目录启动一个简单静态服务：

```bash
python -m http.server 8080
```

然后访问：

```text
http://localhost:8080/index.html
```

没有 `package.json`，也没有 npm build/test 命令。提交前建议做语法检查：

```powershell
Get-ChildItem js -Filter *.js | Sort-Object Name | ForEach-Object { node --check $_.FullName }
git diff --check
```

如果改了 HTML 脚本顺序，还要手动打开 `index.html` 或 `studio.html` 验证：

- 登录门禁可输入密钥进入。
- 双击空白画布可新建生图卡片。
- 生图卡片可输入 prompt、添加参考图、切换比例和提交。
- 视频控制台可切换参考图/首尾帧模式。
- 旧 `.veo` 文件导入后不会显示退役节点。

## 开发约定

- 不要在业务模块里直接散落新的 webhook 地址，统一走 `window.VeoApi`。
- 不要把旧 apimart 官方通道、旧节点工作流分区、旧 frame/cropper 节点重新接回主 UI。
- 需要保留迁移保护：`flow_workspaces` 删除逻辑和 `RETIRED_NODE_TYPES` 过滤逻辑不要随手移除。
- 新增模块尽量暴露为 `window.VeoXxx`，并提供 `configure({ hooks })`，让 `app.js` 做连接，不让模块互相硬耦合太深。
- 涉及 IndexedDB 的字段变更，要同步考虑旧任务兼容和 `.veo` 导入导出。
- 涉及生成请求时，要同时检查提交 payload、轮询解析、失败兜底、账单记录和 UI 状态。

## 下一步开发路线

优先级建议：

1. 继续减小 `app.js`，把剩余兼容函数逐步迁移到清晰模块，但保持旧 inline handler 可用。
2. 整理 `store.js`，补齐 `off`、`once`、错误隔离和更多视频控制台 action。
3. 把生图轮询、预览保护和计费再拆细，让模型接口扩展更容易。
4. 做一次 HTML 中文编码和重复入口核对，确保 `index.html`、`studio.html`、`js/index.html` 内容一致且展示正常。
5. 如果后续要引入更多模型，先定义统一模型注册表，再从 UI、payload、轮询、计费四处接入。
6. 如果前端复杂度继续上升，再考虑迁移到 Vite/ESM；当前阶段先保持静态部署简单。

## 当前收尾状态

- apimart 官方通道入口：已删除。
- 旧节点工作流分区：已删除。
- 旧工作流 IndexedDB 表：升级时删除。
- 旧节点数据：通过退役类型过滤，避免历史工程导入后污染画布。
- 主工作台能力：保留 GPT Image 2 生图、Veo 3.1 视频、无限画布、素材库、账单和 .veo 工程文件。

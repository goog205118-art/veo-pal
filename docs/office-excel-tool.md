# Office 表格：OfficeCLI 本地表格操作工具

## 定位

`Office 表格` 已重建为 **LLM 规划器 + OfficeCLI 本地执行桥**。

它的目标不是做一个纯规则模板工具，而是对齐 `iOfficeAI/OfficeCLI` 的核心思路：

> 让任意一个原本不具备本地 Office 文件理解和操作能力的 LLM，通过 OfficeCLI 的技能体系，获得读取、查询、修改、校验、预览 Excel / CSV 文件的能力。

原有顶部 `表格` 工具保持不变。新的 `Office 表格` 是第二个使用层，聚焦本地 OfficeCLI 技能执行。

## 当前架构

```mermaid
flowchart LR
    A["用户上传 Excel / CSV 或填写本地路径"] --> B["前端 Office 表格使用层"]
    B --> C["大模型规划器"]
    C --> D["OfficeCLI 命令计划 JSON"]
    D --> E["本地 OfficeCLI Bridge"]
    E --> F["officecli 本地命令"]
    F --> G["日志 / 校验 / HTML 预览 / 输出文件"]
    G --> B
```

## 使用层能力

- 上传 `xlsx / xls / csv / xlsm`
- 输入自然语言任务
- 调用 OpenAI-compatible 大模型生成 OfficeCLI 命令计划
- 命令计划以 JSON 展示，包含：
  - `goal`
  - `summary`
  - `commands[].argv`
  - `commands[].op`
  - `commands[].mutates`
  - `safety`
  - `notes`
- 支持复制命令计划
- 支持 Dry Run
- 支持写入前二次确认
- 展示本地桥状态
- 展示执行日志、产物路径、HTML 预览
- 桌面助手自动检测和一键唤起
- 桌面助手任务历史、失败重试和版本兼容信息

## 设置层能力

- 大模型 `API Base URL`
- 大模型 `API Key`
- 模型名称
- OfficeCLI 本地桥地址
- OfficeCLI 命令名称或路径
- 本地工作目录
- 默认 Dry Run
- 写入前二次确认
- 请求超时
- OfficeCLI Skill 系统提示词

## 命令计划格式

前端要求模型只输出 JSON，不输出 Markdown。

```json
{
  "goal": "把 US 站点价格上调 8%",
  "file": "$file",
  "summary": "先读取表格结构，再修改价格，最后校验并生成 HTML 预览。",
  "commands": [
    {
      "id": "inspect",
      "title": "读取工作簿结构",
      "op": "workbook.view",
      "argv": ["view", "$file", "--format", "json"],
      "mutates": false,
      "explain": "先查看 sheet、表头和基础结构。"
    },
    {
      "id": "validate",
      "title": "校验表格",
      "op": "workbook.validate",
      "argv": ["validate", "$file"],
      "mutates": false,
      "explain": "检查异常单元格、格式和公式问题。"
    },
    {
      "id": "preview",
      "title": "生成 HTML 预览",
      "op": "workbook.viewHtml",
      "argv": ["view", "$file", "--format", "html"],
      "mutates": false,
      "explain": "返回可在前端展示的 HTML。"
    }
  ],
  "safety": {
    "writesFile": false,
    "requiresConfirmation": true
  },
  "expectedOutputs": ["logs", "htmlPreview"],
  "notes": []
}
```

`argv` 里不能包含 `officecli` 本体，只写 `officecli` 后面的参数。当前文件统一用 `$file` 占位符，本地桥执行时会替换为真实路径。

## 本地桥

文件：`tools/officecli-bridge.mjs`

当前本地桥已经升级为可被桌面助手复用的服务层。普通用户推荐使用：

```text
desktop-assistant/dist/WallyOfficeAssistantOffline-0.1.0.zip
```

普通用户流程：

```text
解压 zip -> 双击 install.cmd -> 打开网页 Office 表格 -> 点击启动助手或等待自动检测
```

开发者仍然可以用下面命令直接启动本地桥。

启动示例：

```bash
node tools/officecli-bridge.mjs
```

默认地址：

```text
http://127.0.0.1:8765/officecli
```

健康检查：

```text
http://127.0.0.1:8765/health
```

环境变量：

```bash
OFFICECLI_BRIDGE_PORT=8765
OFFICECLI_BIN=officecli
OFFICECLI_WORKSPACE=C:\Users\HSUSZ-B\officecli-workspace
```

桥接层职责：

- 接收前端传来的文件或本地文件路径
- 保存上传文件到本地工作目录
- 校验命令必须是 `argv` 数组
- 限制可执行 OfficeCLI 子命令
- 替换 `$file` 为真实文件路径
- 执行 `officecli`
- 返回 stdout、stderr、产物路径和 HTML 预览

## 安全策略

- 前端默认 `Dry Run`
- 写入型命令需要用户二次确认
- 本地桥不执行 shell 字符串，只执行 `spawn(cliCommand, argv, { shell:false })`
- 本地桥限制 OfficeCLI 子命令白名单
- 模型不得输出 `&&`、管道、重定向等 shell 控制字符

## 下一步建议

1. 本机安装并确认 `officecli` 命令可用。
2. 普通用户解压离线包并双击 `install.cmd`，开发者可启动 `tools/officecli-bridge.mjs`。
3. 前端 `Office 表格 -> 设置层` 会自动检测桌面助手。
4. 未连接时点击 `启动助手`，通过 `wally-office://start` 唤起本机助手。
5. 先保持 Dry Run，确认命令计划正确。
6. 关闭 Dry Run，再执行真实写入任务。
7. 如果后续放进 n8n，可让 n8n 作为 Bridge 的上游调度层，前端结构无需大改。

## 桌面助手三阶段状态

第一阶段 MVP 已落地：Electron 托盘程序、内置 bridge、`/health`、`/officecli`、工作目录、日志、前端自动检测。

第二阶段已落地：`wally-office://start` 协议、端口占用自动切换、OfficeCLI 可用性检测、一键打开日志、一键打开工作目录、前端显示助手版本。

第三阶段已具备产品化底座：Windows 打包配置、离线安装包、双击安装入口、图标、开机自启开关、自动更新检查、任务历史、失败重试、执行确认校验、权限摘要、版本兼容信息。OfficeCLI 一键修复和正式发布流水线仍建议作为后续增强。

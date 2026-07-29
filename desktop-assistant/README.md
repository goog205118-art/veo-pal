# Wally Office Assistant

Wally Office Assistant 是 `Office 表格` 的桌面助手。

它把原来需要手动执行的本地桥：

```bash
node tools/officecli-bridge.mjs
```

包装成普通用户可以理解的小程序：

```text
打开桌面助手 -> 网页自动检测 -> 上传或选择表格
-> 大模型生成 OfficeCLI 命令计划 -> 桌面助手在本机执行
```

## 用户流程

1. 安装并打开 Wally Office Assistant。
2. 打开网页项目，进入 `Office 表格 -> 设置层`。
3. 页面显示 `已连接` 后，上传 Excel / CSV。
4. 输入表格处理任务，让大模型生成 OfficeCLI 命令计划。
5. 先执行 Dry Run，确认不会误改文件。
6. 关闭 Dry Run，再执行真实写入。

## 已完成能力

- Electron 桌面程序
- 托盘常驻
- 内置 OfficeCLI bridge 服务
- 默认监听 `127.0.0.1:8765`
- 端口被占用时自动切换到 `8766-8784`
- `/health` 健康检查
- `/officecli` 执行接口
- `/logs` 最近日志接口
- 工作目录管理
- 日志文件
- OfficeCLI 可用性检测
- `wally-office://start` 协议唤起
- 前端自动扫描本机助手端口
- 前端可一键打开工作目录和日志
- Windows 安装包与便携包打包配置
- 安装包图标 `resources/icon.ico`
- 正式安装后开机自启能力
- 状态页可开启 / 关闭开机自启
- 任务历史文件 `history/tasks.json`
- 失败任务可从状态页单次重试
- 执行层校验写入确认标记
- 状态页显示协议版本和前端兼容要求
- 状态页显示本地权限摘要
- 正式安装包环境支持自动更新检查

## 目录

```text
desktop-assistant/
├─ package.json
├─ electron-main.js
├─ preload.js
├─ bridge/
│  └─ officecli-service.js
├─ ui/
│  └─ status.html
├─ resources/
│  ├─ .gitkeep
│  └─ icon.ico
└─ README.md
```

## 开发启动

第一次进入目录后安装依赖：

```bash
npm install
```

启动桌面助手：

```bash
npm start
```

只启动本地桥，不打开 Electron：

```bash
npm run bridge
```

语法检查：

```bash
npm run check
```

打包 Windows 安装包：

```bash
npm run dist:win
```

在网络受限环境生成离线安装包：

```bash
npm run dist:offline
```

成功后会生成：

```text
dist/WallyOfficeAssistantOffline-0.1.0.zip
```

这个 zip 内含应用本体、`install.cmd`、`uninstall.cmd`、`start-assistant.cmd`、`install.ps1`、`uninstall.ps1` 和 `README.txt`。普通用户解压后双击 `install.cmd` 即可安装到当前用户目录，并注册 `wally-office://start` 与开机自启。

更推荐给普通用户的方式：

```text
解压 zip -> 双击 install.cmd -> 打开网页 -> 点击启动助手
```

离线包还会附带：

```text
install.cmd          双击安装
uninstall.cmd        双击卸载
start-assistant.cmd  手动启动助手
```

## 网页连接地址

默认桥接地址：

```text
http://127.0.0.1:8765/officecli
```

健康检查：

```text
http://127.0.0.1:8765/health
```

如果 `8765` 被占用，助手会自动使用后续端口，并在 `/health` 返回真实 `bridgeUrl`。前端检测到后会自动更新。

## 安全策略

- 默认 Dry Run
- 写入前二次确认
- 本地服务只监听 `127.0.0.1`
- 不执行 shell 字符串
- 只接收 OfficeCLI `argv` 数组
- 限制 OfficeCLI 子命令白名单
- 运行日志写入工作目录
- 默认输出到工作目录，降低覆盖原文件风险

## 产品化状态

当前已经具备 Windows 打包配置，正式发给不同电脑使用时可输出：

```text
WallyOfficeAssistantSetup-0.1.0.exe
WallyOfficeAssistantPortable-0.1.0.exe
WallyOfficeAssistantOffline-0.1.0.zip
```

已落地：

- 桌面快捷方式
- 开始菜单入口
- `wally-office://start` 协议注册
- 开机自启开关
- 任务历史
- 失败重试
- 执行确认
- 权限提示
- 版本兼容信息
- 自动更新检查

待继续增强：

- OfficeCLI 缺失时的一键安装或修复引导
- 正式生产仓库的发布流水线
- 更完整的任务详情页

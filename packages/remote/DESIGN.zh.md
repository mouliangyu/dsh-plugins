# dsh-remote 设计

[English](DESIGN.md) | 中文

## 目标

远端 DSH 是顶层 authority。它的 Workspace 与 root Session 进入和本地 Host 相同的浏览器对象模型与 UI。它不是 subagent、面向模型的 SSH tool，也不是独立管理应用。

## 组件

`ctx.authorityRegistry` 保存 provider 注册和已连接的官方 `IApiClient`。Core 只理解 provider id 与生命周期状态。SSH provider 拥有启动、转发、重连策略与健康详情。

`ctx.connection.routeApi()` 向所有浏览器插件发布一个 authority-aware API client。本地连接控制器保留原始本地 client，用于自身的 stream generation。这样模型选择、命令、设置与交互插件不会绕过 authority 路由。

`AuthorityApiRouter` 聚合本地及已连接远端的 `session.list`、`session.search` 与 `workspace.list`。包含 Session 或 Workspace id 的请求发送到该 id 所属 authority。浏览器用 `@authority/<authority>/<remote-id>` 避免 id 冲突；每条远端连接上的请求与响应 envelope 保留原始 id。

`RemoteAuthorityStreams` 为每个已连接 authority 打开官方 `events.mux` 与 `events.host` 下行。它为 frame id 增加 namespace，再把 frame 交给共享 Session 与 Workspace manager。审批和提问保留自己的 `rpcId`，使浏览器响应返回原始 authority。

Core runtime 与 Workspace UI 直接渲染聚合后的 manager。`dsh-remote` 只贡献 provider 与设置 UI；远端 Workspace 行增加 authority 标签，目录操作在调用共享 Workspace runtime 前选择 authority。

## SSH transport

只有配置端口尚未监听时，本地 Host 才会在远端 loopback 启动官方 Web profile：

```sh
nohup dsh --profile web --host 127.0.0.1 --port "$port" ... &
```

OpenSSH `-L` forward 把该端口暴露到随机本地 loopback 端口。插件的同源 HTTP prefix 原样 pipe 官方请求与响应 body。WebSocket bridge 保留官方文本与二进制 opcode；官方事件 envelope 继续使用文本 frame。Host、Origin 与 Fetch-Metadata header 会重写，以满足远端 Web Host 的 loopback 信任检查。

SSH 断开不会终止远端 DSH process。重连可以复用仍在监听的 process，只重建 forward 与浏览器 client。远端 persistence 始终权威；本地不保存 transcript、last session id、replay watermark 或项目 registry。

## Workspace 创建

Bundle 禁用自适应本地目录选择器，并组合官方 browse backend 与浏览器 UI。该交互既可列出本地 Host，也可列出选中的远端 authority。随后 `workspace.create` 路由到同一 authority，由其官方 Workspace registry 持久化记录。

## 失败行为

未知 authority、重复 provider 与重复 API-router 注册都会明确失败。聚合列表操作在某个 authority 不可用时保留其他成功结果，只有全部调用失败才报错。Provider 状态变化会从路由中移除失效远端 client；何时重连或报告 degraded health 由 provider 决定。

## 安全

连接使用明确的 OpenSSH alias 与 `BatchMode=yes`。插件不保存密码或私钥。远端 DSH 监听 loopback，本地 Web 应用只能通过 SSH 与本地同源 proxy 访问它。插件不增加远端认证协议或公开 listener。

## 已考虑的替代方案

- **Subagent provider**：拒绝，因为远端 session 是拥有独立 Workspace 与 transcript 的顶层 root session。
- **自定义远端 daemon 与 JSON-RPC**：拒绝，因为官方 DSH 已提供 Workspace persistence、root-session recovery、HTTP RPC 与实时事件下行。
- **逐项 capability proxy**：拒绝，因为这会重复 filesystem、process、terminal、LSP、interaction 与 persistence 行为。
- **独立远端 UI 与 registry**：拒绝，因为这会分叉普通 Workspace 与 Session 行为，并阻止现有客户端插件操作远端 session。
- **只在本地 runtime 内路由**：拒绝，因为直接读取 `connection.api` 的插件仍会调用错误 Host。

## 验证

单元测试覆盖 authority 生命周期、API-router 注册、id namespace 与 WebSocket opcode 保留。浏览器验证覆盖 SSH 连接、Workspace 聚合、远端目录浏览、远端 session 创建与恢复、远端模型加载、实时用户与 assistant frame、运行状态、取消控件和完成后的 conversation 渲染。

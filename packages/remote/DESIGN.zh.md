# Agent Note: 远端项目使用持久化 DSH host

Status: implemented

[English](DESIGN.md) | 中文

## 问题

SSH command tool 无法把远端项目提供为顶层交互式 session。一次性 process 会在 SSH 断开时丢失 live agent state；本地 filesystem 和 subprocess proxies 则会重复实现 DSH capabilities，并把同一执行环境拆到两台机器。

## 决策

`dsh-remote` 将本地管理与远端执行分开。包根是 Remote Host service，`/host` 是它的明确 alias。`/local` export 从用户 OpenSSH config 和递归 `Include` 文件发现明确的 aliases，保存选中的 SSH 连接记录、运行 SSH stdio bridges，并通过 SSE 提供项目和 root-session 管理；package manifest 贡献 browser bundle。通配 host rules 仍只由 OpenSSH 处理。Remote Host service 在持久化远端 DSH daemon 内运行，拥有配置的项目根目录、root sessions、agent handles 和基于持久化的回放。

daemon 监听用户私有 Unix socket。`dsh-remote-host connect` 在 stdio 与该 socket 之间复制数据，因此 SSH process 是可替换 transport，而不是 session owner。可用时由 `systemd --user` 或 `launchd` 保持 daemon 运行；两者都不可用时，detached process 提供跨越 SSH 断连的能力，但不提供重启监督。

“安装或更新远端 Host”是明确的连接级安装边界。本地 Host 打包其已安装的插件版本、通过 SSH 传输 tarball、在远端用户 home 下安装 `remoteDshPackage` 配置的精确官方 `@deepseek-ai/dsh` release 和专用 profile、渲染有效 `cordis.yml`，然后重启 daemon。插件从该官方 runtime closure 解析 DSH imports。插件与 DSH 版本相互独立；DSH package specifier 必须指向一个精确官方 release，避免 registry tag 或 range 造成安装漂移。该操作要求非交互式 SSH 认证和已有 Node.js/npm，但不要求手工登录远端或执行特权安装。普通连接尝试不会安装软件。

运行中的 daemon 在已安装 profile 外拥有带版本的 JSON 项目 registry。`remote/projects/create` 按序执行项目变更、创建所选目录，并原子替换只有 owner 可访问的 registry 文件。Host 安装和升级不修改该文件。因此项目操作可以改变项目状态，而不上传 packages、改变 composition 或重启 daemon。

远端 persistence 是项目 sessions 和 events 的权威来源。本地 settings 只保存 connection id、SSH host 和 socket path；不保存 last session id、transcript 或 replay watermark。browser subscription 提供 `fromSeq`；daemon 在读取持久化后缀前注册 live listener，使并发事件排在已持久化前缀之后到达。

## 已考虑的替代方案

- **面向模型的 SSH command tool**：拒绝，因为彼此独立的 commands 不构成持久交互式 project session。
- **Subagent provider**：拒绝，因为远端工作是拥有独立 transcript 的 root session，而不是本地 session 的 child result。
- **本地 capability proxies**：拒绝，因为 filesystem、PTY、LSP、approval 和 process policy 属于远端 DSH 执行环境。
- **一次性 stdio host**：拒绝，因为其生命周期仍由 SSH connection 拥有。
- **远端 host 的公开 WebSocket 端口**：拒绝，因为 SSH 和私有 Unix socket 已能提供 transport 与 access control，无需增加监听端口。
- **仅从 registry 安装远端插件**：拒绝，因为本地开发 build 可能尚未发布，并且 transport 两端必须运行相同插件版本。
- **为每个项目安装或重启 Host**：拒绝，因为 Host lifecycle 属于 SSH 连接，而项目是由运行中 Host 管理的 durable records。

## 结果

本地 browser 通过插件自有 HTTP 和 SSE endpoints 与本地 DSH Host 通信；本地 Host 通过 SSH stdio 和按换行分隔的 JSON-RPC 与远端 daemon 通信。远端 root-session identity 保持在本地 session persistence domain 之外，避免复制 transcript 和产生 identifier collision。多条已保存连接和 session subscribers 相互独立；选中的 UI rows 不限制执行。

普通 conversation renderer 假设每个 session 都属于本地 API Host。因此管理 UI 直接渲染远端持久化事件。复用普通 renderer 需要可插拔的 client session backend，不能把远端事件插入本地 persistence。daemon 重启可以 durable recovery，但不能保留被中断的 live process。Approval/question responders 和 direct PTY attachment 需要额外双向协议 methods。

SSH config discovery 只读取 aliases，不会连接列出的机器。Host verification、最终 option resolution 和 authentication 仍由 OpenSSH 负责。bootstrap 操作使用 `BatchMode=yes`；密码提示和首次 host confirmation 会明确失败，而不会阻塞本地 Host。detached fallback 可以跨越普通 SSH 断连，但不能替代操作系统 service manager 提供的重启、记账和清理保证。

## 验证

Package tests 覆盖并发 event subscribers、durable replay ordering、递归 SSH-config discovery、不透明 bootstrap value transfer、supervisor branches、真实已安装插件 artifact 的打包、项目 registry 写入、重复项拒绝和 registry recovery。browser workflow 覆盖 discovered-host selection、连接级 Host 安装、项目创建、项目选择和 root-session 创建。

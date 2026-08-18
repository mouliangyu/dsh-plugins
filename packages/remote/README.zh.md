# dsh-remote

[English](README.md) | 中文

`dsh-remote` 通过 SSH 把 Web 应用连接到官方 DSH 实例。远端 authority 直接显示在普通 Workspace 树中，其 root session 使用普通 conversation renderer、模型选择、审批与提问 responder、取消操作和实时事件流。

## 安装

```sh
dsh plugin --profile web add dsh-remote
dsh plugin --profile web install
dsh --profile web
```

本地开发时，把 `dsh-remote` 替换为 `link:/absolute/path/to/dsh-plugins/packages/remote`。

该插件要求 DSH 的 core client runtime 与 Workspace UI 提供 `ctx.authorityRegistry`、`ctx.connection.routeApi()`、多 authority API 路由和 authority-aware Workspace 选择。通用行为由 core 承担；本包只提供 SSH provider。

## 连接

打开“设置”，进入“远程”，然后添加连接。表单从 `~/.ssh/config` 及递归 `Include` 文件发现明确 alias，但不会探测这些主机。选择 alias、设置稳定的 authority id，并填写远端 DSH Web 端口。认证与最终选项解析仍由 OpenSSH 负责，包括 `ProxyJump`、`IdentityFile` 和 `ssh-agent`。

远端必须已经提供官方 `dsh` 命令。连接时，如果配置端口尚未监听，插件会在远端 loopback 启动 `dsh --profile web`，用 `nohup` 脱离 SSH 生命周期，再打开 SSH 本地转发。远端无需安装插件、自定义 daemon、Unix socket 或第二套项目 registry，也无需手工编辑 profile。

本地 settings 只保存 authority id、SSH host alias 和远端端口。远端 DSH 拥有自己的 Workspace registry、session log、标题、模型选择、权限与恢复状态。

## 使用

已连接的远端 Workspace 合并进普通 Workspace 树，并显示 authority 标签。“添加工作区”菜单同时提供本地 Host 与所有 ready 的远端 authority。插件组合官方 browse directory picker，因此本地与远端目录都使用同一个页面内浏览器。

所有 unary RPC 使用官方 DSH HTTP envelope，`events.mux` 与 `events.host` 使用官方 WebSocket 文本 frame。本地 proxy 只改变 URL 和访问 SSH 转发后 loopback Host 所需的浏览器信任 header。Session 与 Workspace id 只在共享浏览器对象模型中增加 namespace，在线路上会恢复原始值。

Provider 自行管理 SSH 生命周期、重连与健康状态。断开连接只关闭本地 forward；脱离 SSH 的远端 DSH process 与持久会话仍可在下次连接时恢复。点击“重新连接”时，会额外重启插件记录在 `~/.dsh/remote-web.pid` 中的远端 Web process，再重新建立 SSH forward；只有命令行确认为 DSH Web process 的 PID 才会被终止，PID 文件不安全或端口被其他进程占用时会明确失败。

## 配置

```yaml
- id: dsh-remote-local
  name: dsh-remote
  config:
    sshConnectTimeoutSeconds: 10
    autoConnect: true
```

连接记录通过“设置”页面编辑，并存储在 `dsh-remote` settings namespace。

## 限制

- Bundle 为本地和远端 Workspace 创建统一使用官方 browse directory picker；安装后会替代本地平台原生选择器。
- 远端访问继承 OpenSSH 的 host-key 与认证行为。`BatchMode=yes` 会让密码提示和未解决的首次确认明确失败。
- 远端 Web Host 只监听远端 loopback。配置中存在一个远端端口，但不会暴露到 SSH 连接之外。
- 不能同时注册多个顶层 API router；authority 路由必须组合在唯一的 `connection.routeApi()` 注册中。

## 模型体验

远端 prompt 是远端 DSH 上的普通 root-session prompt。模型可见内容、tools、token usage、compaction 与 KV cache 行为和直接使用该远端 DSH Web 应用完全一致。

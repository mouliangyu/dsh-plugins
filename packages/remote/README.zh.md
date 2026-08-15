# dsh-remote

[English](README.md) | 中文

`dsh-remote` 是包含两个运行时角色的 bundle。本地 Web Host 插件保存 SSH 连接记录、打开 SSH stdio bridge，并提供“远程”设置页面。远端 Host service 拥有项目根目录、持久化 root sessions、live agent handles 和基于持久化的回放。

## 本地安装

```sh
dsh plugin --profile web add link:/absolute/path/to/dsh-plugins/packages/remote
dsh web
```

包发布后，可以用 registry spec `dsh-remote` 替换本地 link。

打开“设置”，然后进入“远程”。添加连接表单从 `~/.ssh/config` 及其 `Include` 文件发现明确的 `Host` alias；通配规则仍只由 OpenSSH 处理，不会作为可选主机展示。每条连接只保存 id、所选 alias 和远端 Unix socket 路径。认证继续由 OpenSSH config、`ssh-agent` 或其他 SSH credential provider 管理；DSH settings 不保存密码或私钥。项目、会话、transcript 和 sequence state 均以远端 host 为准。

在保存的连接上使用“安装或更新远端 Host”。本地 Host 会打包正在运行的 `dsh-remote` 插件，通过 SSH 传输，在远端用户 home 下安装 `remoteDshPackage` 选择的精确官方 DSH release 和专用 profile，并启动或重启 daemon。插件只声明官方 DSH 安装中缺少的运行依赖，其 DSH service imports 会从官方 runtime closure 解析。插件与 DSH 版本相互独立；`remoteDshPackage` 默认使用已发布的 `@deepseek-ai/dsh@0.1.0-rc.6`，并拒绝 tag 或 range，避免重复安装时发生版本漂移。这个连接级操作要求非交互式 SSH 认证，并要求远端已安装 Node.js 和 npm；无需手动 SSH 登录或 root 权限。`sshConnectTimeoutSeconds` 和 `bootstrapTimeoutMs` 分别配置连接与安装期限。

连接成功后，“新建项目”调用正在运行的 daemon。daemon 创建目录、把项目写入远端 JSON registry，并立即向所有 clients 提供该项目。新增项目不会安装 packages、重写 profile 或重启 daemon。

本地 Host 通过 `/dsh-remote/api` 提供管理命令，通过 `/dsh-remote/events` 提供 SSE。一个 SSH process 可以承载项目和会话请求以及多个并发 event subscribers。关闭浏览器或 SSH bridge 不会取消远端工作。

## 手工配置远端 host

```yaml
- id: remote-host
  name: 'dsh-remote/host'
  config:
    socketPath: /run/user/1000/dsh-remote.sock
    projectsFile: /home/user/.dsh/remote-projects.json
```

页面管理的安装会在 base profile 上生成该条目，并提供 session persistence、agent loop、模型路由、文件系统、终端、LSP、审批和提问 providers。`projectsFile` 在存在后是权威来源；可选 `projects` array 只在首次启动时为其提供初始值。安装器在持久化 user manager 可用时使用 `systemd --user`，在 macOS 上使用 `launchd`，否则使用带 PID 文件的 detached process。手工部署可以在其他用户服务中运行 `dsh-remote-host /path/to/cordis.yml`。socket 和项目 registry 只有 owner 可访问，无需远端 TCP 端口。

## 协议

daemon 接受 `remote/hello`、`remote/projects/create`、`remote/sessions/list`、`remote/sessions/create`、`remote/sessions/resume`、`remote/sessions/prompt`、`remote/sessions/cancel` 与 `remote/events/subscribe`。项目创建按序执行，并原子替换带版本的 registry 文件。订阅在读取 `SessionPersistence.readFrom(sessionId, fromSeq)` 前注册 live listener，然后按序发送持久化后缀和期间缓冲的实时事件。

## 模型体验

### 远端 root session

#### 模型所见

远端模型将每个 `remote/sessions/prompt` 输入作为持久化 root session 中的 `user/message` 接收，并使用远端项目配置的 prompt、tools、filesystem、shell、terminal、LSP 和 interaction providers。

#### Token 影响

Prompt 内容进入远端 session history，并保留到配置的 compaction provider 将其移除。

#### KV Cache 影响

除普通 session history 行为外无额外影响。

## 已知限制与后续工作

- “远程”设置页面直接渲染持久化事件；复用普通 conversation renderer 需要可插拔的 client session backend。
- Approval/question responder requests 与 direct PTY attachment 需要额外的双向协议 methods。
- detached-process fallback 可以跨越普通 SSH 断连，但不具备 `systemd --user` 或 `launchd` 提供的重启和进程管理保证。

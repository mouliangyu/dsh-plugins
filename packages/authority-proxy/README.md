# dsh-authority-proxy

在同一页面管理多台 dsh：每台远端通过 SSH 隧道接入，远端各自的会话 / 项目 / 模型参与同一浏览器对象模型，并支持跨主机委托。

Manage several dsh hosts from one page: every remote is reached over an SSH tunnel started and
watched by this plugin, and their sessions / workspaces / models join the same client object model.

## 组成（一个包，两个半边）

- `lib/index.js`（host）：`/authority/<id>/**` 前缀代理、聚合 `session/list`、admin API、跨主机 pinned/archived 并集、目录选择器
- `lib/supervisor.js`（host）：SSH 隧道 + 远端 `dsh web` 托管（自动启动、抓 token、看护重连、端口冲突自动换、重启远端）
- `lib/client.js`（client）：设置面板（「多 Host」）、侧栏来源标记、每台 authority 挂载一个官方 connection

## 安装

在 profile 的 `cordis.patch.yml` 里加一行：

```yaml
- insert:
    - id: authority-proxy
      name: 'dsh-authority-proxy'
      config:
        authorities:
          - id: <别名>
            ssh: { host: <~/.ssh/config 里的别名>, localPort: 3081, remotePort: 3080 }
            remote:
              dsh: '/path/to/dsh'      # 可选：远端环境里 dsh 不在 PATH 时填写
              home: '~/.dsh'           # 可选
              logFile: '~/.dsh/authority-web.log'   # 可选，用于抓启动 token
```

也可以在面板「设置 → 多 Host」里直接添加（会写入本机 store，无需改 YAML）。

## 依赖

- 本机：`ssh`（免密），Node 与 `ws`
- 远端：可执行的 `dsh`（插件会用 `--profile <name> --host 127.0.0.1 --port <port> --no-open` 启动它）

## 说明

官方 dsh 包零改动：全部通过公开扩展点实现（`webServer.register/registerUpgrade`、`connection/request` 瀑布、
`webserver/index-inject`、`slots.inject`、客户端 `installConnection`、官方 primitives）。
升级 dsh 时，少量版本绑定的契约（endpoint 名、follow 帧形状、token 行格式等）需要按版本重取。

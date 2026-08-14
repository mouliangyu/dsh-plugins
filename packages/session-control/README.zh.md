# dsh-session-control

[English](README.md) | 中文

面向模型的 DeepSeek Harness 会话与顶层项目管理插件。Cordis 插件 id 为
`session_control`，Web 设置页中的名称为 **Session & Workspace Control**。

默认允许全局访问。可以在 **设置 > 插件 > 插件配置 > Session & Workspace
Control** 中关闭，使所有操作仅限调用者当前所在的项目。

## 工具约定

| 工具 | 功能 |
|---|---|
| `session_create` | 在当前或指定项目中创建关联会话，并提交初始任务。 |
| `session_list` | 列出可访问的会话、所属项目、标题和实时状态。 |
| `session_send` | 必要时恢复已持久化的会话，并发送后续任务。 |
| `session_stop` | 停止目标会话当前运行，保留已排队输入。 |
| `session_archive` | 可选功能；仅在明确启用后归档已完成的目标会话。 |
| `workspace_list` | 列出可访问的顶层项目、路径、状态和会话数量。 |
| `workspace_create` | 将现有目录注册为 DSH 顶层项目。 |
| `workspace_rename` | 修改项目显示名称，不移动目录。 |
| `workspace_remove` | 仅移除 DSH 项目注册，保留文件和会话日志。 |
| `workspace_sessions` | 列出指定项目中的会话。 |

新会话是普通的 DSH 项目会话，会直接出现在现有 Web 侧边栏中，并沿用
DSH 的实时状态、标题与持久化行为。

## 安装

包内已经包含 Host 和 Web 客户端构建产物。通过 `link:` 安装后，依赖和
bundle 层会记录在 profile 中，因此重启 DSH 后仍然有效。

```sh
cd deepseek-harness
pnpm dsh plugin --profile web add link:/absolute/path/to/dsh-plugins/packages/session-control
pnpm dsh web
```

`cordis.patch.yml` 声明了插件 bundle，安装时不需要现场构建源码。

## 开发

在仓库根目录运行：

```sh
pnpm install
pnpm run check
pnpm --filter dsh-session-control pack --pack-destination ./artifacts
```

源码结构与 DSH 的 Host/Web 混合包一致：`src/index.ts` 是 Host 入口，
`src/client/index.tsx` 是 Web 入口，`src/invariant.ts` 是 invariant 配套入口。
类型声明生成到 `lib/types/`，发布 bundle 为 `lib/index.js`、
`lib/invariant.js` 和 `lib/client.js`。

目前上游已发布的客户端包依赖闭包不完整，因此这个外部仓库使用精简的
DSH 编译期类型声明并提交经过验证的 bundle。运行时 DSH 包由当前 profile
以 peer dependency 的形式提供。

## 安全模型

全局访问默认开启。Web 开关会持久化写入
`session-control.allowGlobalAccess`，并立即生效。关闭后，所有目标会话和
项目必须属于调用者当前项目，同时禁止创建新的项目注册。

归档默认关闭，因为它会改变用户可见的历史记录。部署方只有在同时具备
用户确认策略时，才应启用 `allowArchive: true`。

## 当前限制

- 远程执行属于独立插件，不在本插件中实现。
- 不删除会话日志。
- 会话标题由 DSH 正常标题流程生成，刚创建时可能显示为 `untitled`。
- 当前面向上游 developer preview，生产使用前需要与安装的 DSH 版本做兼容性验证。

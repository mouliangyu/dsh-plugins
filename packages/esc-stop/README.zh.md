# dsh-esc-stop

在 DeepSeek Harness Web 输入框里按 **Esc** 停止正在生成的回合——与点击
**停止生成** 按钮完全等价。

## 行为

- **运行中按 Esc**：停止当前回合。停止动作走输入框自己的「停止生成」按钮，
  即官方 cancel 路径，不另起炉灶。
- **先关 UI 再停止**：slash/mention 菜单与 overlay 保留内建 Esc 行为；菜单开着时
  第一次 Esc 只关菜单，再按一次才停止。
- **IME 安全**：中文/日文输入法组合期间按 Esc 不拦截。
- **不劫持组合键**：带 Ctrl / Meta / Alt 的 Esc 一律放行。
- **审批面板优先**：有审批/提问面板挂起时，Esc 交给面板。
- **作用域限定在会话视图内**：焦点在会话消息区或输入栏时 Esc 才生效，
  不会误伤设置页、侧边栏或其他会话。
- **只停能停的**：如果没有可用的停止按钮，按 Esc 不做任何事。

## 安装

```sh
dsh plugin --profile web add dsh-esc-stop
dsh plugin --profile web install
dsh --profile web
```

本仓库本地开发：

```sh
dsh plugin --profile web add link:/绝对路径/dsh-plugins/packages/esc-stop
dsh --profile web
```

装完重启 web profile 并刷新页面。

## 原理

浏览器 bundle 把隐藏锚点挂进每个存活会话的 `conversation.input.left` 槽，
然后监听 document 上的 `keydown`。Esc 通过全部守卫（见「行为」）后，
点击输入框里的停止按钮——即用户本来会点的那个元素。

纯客户端插件，host 半为空壳。

## 兼容性

面向官方 DeepSeek Harness Web GUI（`@deepseek-ai/dsh` `0.1.0-rc.6` 及以后）。
停止按钮按本地化 `aria-label`（`input.stop`，内置 zh/en 文案）匹配；
自定义 locale 改名时需要扩展标签列表。

## License

MIT

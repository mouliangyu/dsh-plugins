# dsh-skill-stabilizer

[English](README.md) | 中文

`dsh-skill-stabilizer` 让 DeepSeek Harness 中的 skill 稳定生效：以插件形式、在任何公版 DSH 上，重构 skill 目录到达模型的方式。

## 问题

内建的 `dsh-tool-skill` 目录以一次性 user-role 消息交给模型：digest 驱动、只在 compaction 后重发、触发规则很软（"如果任务明显匹配，就调用 skill 工具"）。实际使用中模型经常在关键时刻不去查这份目录——一个从未被查阅的 skill，本质上是它没有被呈现好。

## 这个插件做什么

1. **注入稳定的目录段**。目录由 `system-prompt/assemble` 瀑布**每步重新渲染**，位置固定在 system prompt 中，不会沉入消息历史，也不会被 compaction 丢弃。
2. **抑制内建 digest 消息**。每步过滤掉内建的目录消息（按 `skill-catalog` source kind），模型只看到一份权威目录。设 `suppressBuiltinCatalog: false` 可保留内建消息。
3. **强制触发规则**。目录段明确：匹配 skill 描述即必须使用，跳过明显匹配要说明原因——Codex 强度的规则，而非可选提醒。
4. **成本可控**。`catalogMaxBytes`（默认 20000）在目录超预算时等份缩短描述；skill 名字绝不截断或丢弃。真实目录只有几 KB，每步持续注入远低于 1M token 上下文的 2%。

`skill` 加载工具本身仍用内建的那个；本插件只替换目录的呈现方式。

## 安装

```sh
dsh plugin --profile web add dsh-skill-stabilizer
dsh plugin --profile web install
dsh --profile web
```

本地开发时，把 `dsh-skill-stabilizer` 换成
`link:/绝对路径/dsh-plugins/packages/skill-stabilizer`。

### 加载顺序约束

内建目录与本插件的过滤都在同一个 `agent/pre-step` 瀑布上，而瀑布按注册顺序执行。**必须把 `dsh-skill-stabilizer` 加载在 `dsh-tool-skill` 之后**，过滤才能看到完整消息列表。preset 默认先挂 `dsh-tool-skill`，之后追加本插件天然满足顺序。

## 配置

```yaml
plugins:
  dsh-skill-stabilizer:
    catalogMaxBytes: 20000           # 默认；超预算时缩短描述
    catalogDescriptionMaxLength: 500  # 单项描述上限
    suppressBuiltinCatalog: true      # 过滤内建 digest 消息
```

## 兼容性

面向 `@deepseek-ai/dsh-*` `0.1.0-rc.6` 及以后；用到的扩展点（`system-prompt/assemble`、`agent/pre-step`、`ctx.skills.snapshot`）都是稳定的公开契约。

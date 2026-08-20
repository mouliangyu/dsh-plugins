# dsh-skill-stabilizer

English | [中文](README.zh.md)

`dsh-skill-stabilizer` makes skills reliably adoptable in DeepSeek Harness by
reworking how the skill catalog reaches the model — as a plugin, on any stock
DSH build.

## Problem

The built-in `dsh-tool-skill` catalog is delivered to the model as a one-shot
user-role message: digest-driven, re-sent only after compaction, with a soft
trigger rule ("if the task clearly matches, call the skill tool"). In practice
the model frequently fails to consult the catalog at the moment it matters —
a skill that is never consulted is a skill that wasn't presented well enough.

## What this plugin does

1. **Injects a stable catalog section.** The catalog is rendered by the
   `system-prompt/assemble` waterfall on **every step**, at a fixed position
   in the system prompt, so it never sinks into message history and is never
   dropped by compaction.
2. **Suppresses the built-in digest message.** The built-in catalog message is
   filtered out of every step (its `skill-catalog` source kind), so the model
   sees exactly one authoritative catalog. Set `suppressBuiltinCatalog: false`
   to keep the built-in message instead.
3. **Enforces mandatory trigger rules.** The section says matching a skill's
   description obligates its use, and skipping an obvious match requires an
   explanation — Codex-strength rules rather than an optional reminder.
   Loading a skill also obligates **re-consulting it at every later decision
   point the skill governs** (entry path, mismatch handling, tool or
   environment choice), so a loaded skill stays authoritative instead of
   decaying into background context.
4. **Bounded cost.** `catalogMaxBytes` (default 20000) shortens descriptions
   equally when the catalog overflows; skill names are never truncated or
   dropped. Real-world catalogs are a few KB, so sustained per-step injection
   stays well under 2% of a 1M-token context window.

The `skill` loader tool itself remains the built-in one; this plugin only
replaces the catalog's presentation.

## Install

```sh
dsh plugin --profile web add dsh-skill-stabilizer
dsh plugin --profile web install
dsh --profile web
```

For local development, replace `dsh-skill-stabilizer` with
`link:/absolute/path/to/dsh-plugins/packages/skill-stabilizer`.

### Ordering constraint

The built-in catalog is published on the same `agent/pre-step` waterfall this
plugin filters, and waterfall listeners run in registration order. Load
`dsh-skill-stabilizer` **after** `dsh-tool-skill` so the filter sees the
complete message list. Presets mount `dsh-tool-skill` first, so adding this
plugin afterwards satisfies the ordering by default.

## Configuration

```yaml
plugins:
  dsh-skill-stabilizer:
    catalogMaxBytes: 20000          # default; shorten descriptions to fit
    catalogDescriptionMaxLength: 500 # per-entry description cap
    suppressBuiltinCatalog: true     # filter the built-in digest message
```

## Compatibility

Targets `@deepseek-ai/dsh-*` `0.1.0-rc.6` and later; the extension points used
(`system-prompt/assemble`, `agent/pre-step`, `ctx.skills.snapshot`) are stable
public contracts.

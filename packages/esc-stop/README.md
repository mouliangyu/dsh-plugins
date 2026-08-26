# dsh-esc-stop

Press **Esc** to stop the running generation in the DeepSeek Harness web GUI
composer — exactly the same action as the **Stop** button ("停止生成" /
"Stop generating").

## Behavior

- **Esc while a turn is in flight** stops that turn. The stop goes through the
  composer's own Stop button, so the official cancel path runs untouched.
- **First Esc closes open UI first.** Slash/mention menus and overlays keep
  their built-in Escape handling; press Esc again to stop.
- **IME safe.** Escape during Chinese/Japanese IME composition is left alone.
- **No chord hijacking.** Esc with Ctrl / Meta / Alt is never intercepted.
- **Approval panels keep Esc.** While an approval/question panel is pending,
  Escape is left to it.
- **Scoped to the conversation view.** Esc only acts while focus is inside the
  session's message area or composer, so it never interferes with settings,
  sidebars, or other sessions.
- **Stops only what can be stopped.** If no enabled Stop button is rendered,
  Esc does nothing.

## Install

```sh
dsh plugin --profile web add dsh-esc-stop
dsh plugin --profile web install
dsh --profile web
```

For local development from this repo:

```sh
dsh plugin --profile web add link:/absolute/path/to/dsh-plugins/packages/esc-stop
dsh --profile web
```

Restart the web profile after installing and refresh the page.

## How it works

The browser bundle mounts a hidden anchor into the `conversation.input.left`
slot of each live session, then listens for `keydown` on the document. When
Escape passes every guard (see Behavior), it clicks the composer's Stop
button — the same element the user would click.

The plugin is client-side only; the host half is intentionally empty.

## Compatibility

Targets the official DeepSeek Harness web GUI (`@deepseek-ai/dsh`
`0.1.0-rc.6` and later). The stop button is matched by its localized
`aria-label` (`input.stop` in the bundled zh/en locales); a custom locale
that renames the label would need the label list extended.

## License

MIT

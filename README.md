# DSH Community Plugins

Community-maintained plugins for DeepSeek Harness. Each plugin is an
independent package and can be installed separately, while this repository
shares build conventions, documentation, and compatibility checks.

## Packages

| Package | Purpose |
| --- | --- |
| `session-control` | Global session and workspace management, with a Web settings switch. |
| `dsh-remote` | Official DSH authorities over SSH with top-level Workspace, Session, and live event integration. |
| `client-runtime-remote` | Authority-aware replacement for `@deepseek-ai/dsh-client-runtime`. |
| `ui-workspace-remote` | Unified local and remote replacement for `@deepseek-ai/dsh-client-ui-workspace`. |

The repository is intentionally independent from the upstream
`deepseek-harness` repository. Upstream currently does not accept external PRs;
use GitHub Discussions for proposals and add the `dsh-plugin` topic to make a
plugin discoverable.

## Layout

```text
packages/
  session-control/
  remote/
  client-runtime-remote/
  ui-workspace-remote/
  shared/              # future shared helpers; keep runtime-free where possible
```

Every package should retain a normal DSH package boundary: its own
`package.json`, `dsh.client` declaration when it has a browser face, host and
client build outputs, README, and focused tests.

## Local Development

Install the package directly from its monorepo path:

```sh
pnpm dsh plugin --profile web add \
  link:/absolute/path/to/dsh-plugins/packages/session-control
```

Replace the final path with `packages/remote` to develop `dsh-remote`.

Build one package from its directory, or run `pnpm -r run build` after all
packages have adopted the shared build scripts.

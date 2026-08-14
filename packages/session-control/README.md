# dsh-session-control

English | [中文](README.zh.md)

Model-facing session and top-level project management for DeepSeek Harness. The
Cordis plugin id is `session_control`; the Web settings title is **Session &
Workspace Control**.

Global access is enabled by default. Turn it off in **Settings > Plugins >
Plugin configuration > Session & Workspace Control** to restrict operations to
the caller's current workspace.

## Tool Contract

| Tool              | Action                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------- |
| `session_create`  | Create a related session in the caller's or a selected workspace and queue its initial task. |
| `session_list`    | List all accessible sessions with id, location, title, and live status.                  |
| `session_send`    | Resume a persisted session when needed and queue more work.                              |
| `session_stop`    | Stop a live target session while preserving queued input.                                |
| `session_archive` | Optional. Archive a completed target session after explicit user authorization.          |
| `workspace_list` | List accessible projects with stable ids, paths, status, and session counts. |
| `workspace_create` | Register an existing directory as a top-level DSH project. |
| `workspace_rename` | Change a project's display title without moving its directory. |
| `workspace_remove` | Remove only the DSH project registration; files and session logs are retained. |
| `workspace_sessions` | List sessions belonging to one project. |

`session_list` labels every result with its workspace title or `unassigned`.
Pass a `workspace_id` returned by `workspace_list` to `session_create` to create
the session in another project. Without it, creation uses the caller's current
workspace so the new session has a concrete filesystem identity.

New sessions are ordinary DSH workspace sessions. They appear in the existing
Web sidebar and use its normal live status, title, and persistence behavior.

## Install

This package includes prebuilt Host and Web client bundles. Local `link:`
installation persists across DSH restarts because the profile records the
package dependency and bundle layer.

```sh
cd deepseek-harness
pnpm dsh plugin --profile web add link:/absolute/path/to/dsh-plugins/packages/session-control
pnpm dsh web
```

The package declares its DSH bundle in `cordis.patch.yml`, so installation does
not require a source build.

## Development

From the repository root:

```sh
pnpm install
pnpm run check
pnpm --filter dsh-session-control pack --pack-destination ./artifacts
```

The source layout follows DSH hybrid Host/Web packages: `src/index.ts` is the
Host entry, `src/client/index.tsx` is the Web entry, and `src/invariant.ts` is
the invariant companion. Generated declarations are written under
`lib/types/`; distributable bundles are `lib/index.js`, `lib/invariant.js`, and
`lib/client.js`.

Upstream's published client package dependency closure is currently
incomplete, so this external repository uses narrow compile-time declarations
for DSH services and ships verified bundles. DSH packages remain runtime peer
dependencies supplied by the active profile.

The behavior suite invokes the tools registered by the production `apply()`
entry and covers lifecycle, authorization, project management, cleanup, and
the settings HTTP boundary. See [TESTING.md](TESTING.md) for the release matrix
and manual DSH smoke procedure.

## Safety Model

Global access is enabled by default. The UI switch writes the durable
`session-control.allowGlobalAccess` user setting and takes effect immediately.
Set it to false to require every target session and project to belong to the
caller's current workspace; project creation is disabled in restricted mode.
Archiving is disabled by default because it changes the user's visible history.
Set `allowArchive: true` only together with a user-confirmation policy in the
deployment.

## Current Limitations

- Remote execution belongs to a separate plugin and is not implemented here.
- It does not delete session logs.
- Session titles are produced by the normal DSH title pipeline and may initially appear as `untitled`.
- The package targets the upstream developer preview and must be checked against the installed DSH version before production use.

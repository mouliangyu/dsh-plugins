# Session & Workspace Control

The Cordis plugin id is `session_control`. Its UI title is **Session & Workspace Control**
because it manages both top-level projects and their sessions.

Global access is enabled by default. Turn it off in **Settings > Plugins >
Plugin configuration > Session & Workspace Control** to restrict operations to
the caller's current workspace.

## What It Adds

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

New sessions are regular workspace sessions. They therefore appear in the existing DSH Web sidebar without a custom React UI. The built-in sidebar already renders workspace sessions and their live state.

## Install

This package includes prebuilt host and Web client JavaScript and retains its
TypeScript source for review. Local `link:` installation is persistent across
DSH restarts because the Web profile records the package as a dependency and
bundle layer.

```sh
cd deepseek-harness
pnpm dsh plugin --profile web add link:/absolute/path/to/dsh-plugins/packages/session-control
pnpm dsh web
```

The package declares its own DSH bundle, so a successful `plugin add` activates `cordis.patch.yml` without running a source build.

## Safety Model

Global access is enabled by default. The UI switch writes the durable
`session-control.allowGlobalAccess` user setting and takes effect immediately.
Set it to false to require every target session and project to belong to the
caller's current workspace; project creation is disabled in restricted mode.
Archiving is disabled by default because it changes the user's visible history.
Set `allowArchive: true` only together with a user-confirmation policy in the
deployment.

## Remote Extension Point

This plugin manages the DSH session lifecycle, not execution placement. To run a created child on another host, add a dedicated `ctx.subagents` provider that owns SSH authentication, remote process lifecycle, path mapping, log streaming, and cancellation. Use that provider for remote delegation; keep this plugin responsible for project-level session discovery and UI-visible state.

## Current Limitations

- It does not supply an SSH, container, or workspace-sync implementation.
- It does not delete session logs.
- Session titles are produced by the normal DSH title pipeline and may initially appear as `untitled`.
- The package targets the upstream developer preview and must be checked against the installed DSH version before production use.

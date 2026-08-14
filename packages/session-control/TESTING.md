# Test Design

`dsh-session-control` treats authorization and lifecycle transitions as its
highest-risk behavior. Tests exercise the public plugin entry and the
registered `ToolDefinition` objects instead of exporting implementation-only
helpers.

## Layers

| Layer | Coverage | Command |
|---|---|---|
| Contract | Config defaults, package exports, bundle patch, published files | `pnpm test` |
| Service behavior | Tool registration, session create/send/stop/archive, workspace operations, scope enforcement, cleanup | `pnpm test` |
| HTTP behavior | Settings GET/PUT, live policy changes, same-origin guard, validation and size limit | `pnpm test` |
| Build artifact | TypeScript declarations, Host/Web bundles, JavaScript syntax, npm tarball contents | `pnpm run check` and `npm pack --dry-run --json` |
| DSH smoke | Profile boot, settings endpoint, client bundle discovery | Manual before release |

The service-behavior harness replaces DSH-owned persistence, Agent, settings,
query, Web server, and workspace services with deterministic in-memory
implementations. It does not reimplement plugin decisions: the production
`apply()` function registers the tools and every assertion invokes their real
schemas and execute functions.

## Required Release Matrix

Before tagging a release, run the automated suite on:

| Dimension | Required values |
|---|---|
| Node.js | 22 LTS and the version used by the current DSH release |
| Operating system | macOS and Linux |
| Access mode | Global enabled and caller-workspace restricted |
| Session state | Live running, live idle, cold persisted, unknown |
| Installation | Local `link:` and packed tarball |

Windows is currently best-effort until DSH publishes a supported Windows
runtime contract.

## Manual DSH Smoke

1. Install the package into a clean Web profile.
2. Start DSH and verify `GET /api/session-control/settings` returns JSON.
3. Confirm the settings card toggles global access and survives a restart.
4. Create a session in the caller project and another selected project.
5. Confirm both appear in the normal sidebar with live status.
6. Send a follow-up to a cold session, stop a running session, and verify its
   queued input remains available.
7. With restricted mode enabled, confirm cross-project session and project
   operations are rejected.
8. Remove a project registration and confirm its directory and session logs
   remain on disk.

Archive testing requires a profile that explicitly sets `allowArchive: true`.
Never enable it in a profile containing irreplaceable history.

## Deferred Integration Coverage

The external plugin repository cannot currently install the complete set of
published DSH development packages because an upstream client dependency is
unpublished. Once that dependency closure is available, add a Loader-level
composition test using official DSH services and move the manual profile boot
smoke into CI.

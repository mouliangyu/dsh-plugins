# dsh-remote design

English | [中文](DESIGN.zh.md)

## Goal

A remote DSH is a top-level authority. Its Workspaces and root Sessions participate in the same browser object model and UI as the local Host. It is not a subagent, a model-facing SSH tool, or a separate management application.

## Components

`ctx.authorityRegistry` stores provider registrations and connected official `IApiClient` instances. Core understands only provider ids and lifecycle states. The SSH provider owns startup, forwarding, reconnect policy, and health details.

`ctx.connection.routeApi()` publishes one authority-aware API client to every browser plugin. The local connection controller retains the original local client for its own stream generation. This prevents model selection, commands, settings, and interaction plugins from bypassing authority routing.

`AuthorityApiRouter` aggregates local and connected remote `session.list`, `session.search`, and `workspace.list` results. Requests containing a Session or Workspace id are sent to that id's authority. The browser uses `@authority/<authority>/<remote-id>` ids to avoid collisions; request and response envelopes on each remote connection keep the original ids.

`RemoteAuthorityStreams` opens the official `events.mux` and `events.host` downlinks for every connected authority. It namespaces frame ids and sends the frames to the shared Session and Workspace managers. Approvals and questions retain their `rpcId` to route browser responses back to the originating authority.

The core runtime and Workspace UI render the aggregated managers directly. `dsh-remote` contributes the provider and settings UI; remote Workspace rows add an authority label, and directory operations select an authority before calling the shared Workspace runtime.

For agent-to-agent messages, `dsh-remote` owns both WebSocket peers and the private relay protocol. Its Host provider opens `/api/dsh-remote/session-relay` through the existing forward and registers with the transport-neutral `SessionRelayService` supplied by `dsh-session-control`. Its independent Remote relay-channel entry accepts the socket and registers the Host peer with the Remote session service. Accepted messages use the official `apiProxy.sessions.prompt`, so cold resume, model selection, and agent presets remain DSH responsibilities. [RELAY_DESIGN.md](RELAY_DESIGN.md) defines the detailed split.

## SSH transport

The local Host starts the remote official Web profile on remote loopback only when the configured port is not listening:

```sh
nohup dsh --profile web --host 127.0.0.1 --port "$port" ... &
```

An OpenSSH `-L` forward exposes that port on a random local loopback port. The plugin's same-origin HTTP prefix pipes official request and response bodies unchanged. Its WebSocket bridge preserves official text and binary opcodes; official event envelopes remain text frames. Host, Origin, and Fetch-Metadata headers are rewritten to satisfy the remote Web Host's loopback trust fence.

SSH disconnect does not terminate the remote DSH process. Reconnect explicitly restarts the DSH Web process recorded by the provider and rebuilds the forward and browser clients. Remote persistence remains authoritative; no transcript, last session id, replay watermark, or project registry is stored locally.

## Workspace creation

The bundle disables the adaptive local directory picker and composes the official browse backend and browser surface. This gives one interaction that can list either the local Host or the selected remote authority. `workspace.create` is then routed to the same authority, whose official Workspace registry persists the record.

## Failure behavior

Unknown authorities and duplicate provider or API-router registrations fail explicitly. Aggregate list operations keep successful authorities visible when another authority is unavailable and fail only when every call fails. Provider state changes remove dead remote clients from routing; the provider decides when to reconnect or report degraded health. API connectivity and relay capability are reported independently, so an unavailable relay endpoint does not disconnect the ordinary Remote authority.

## Security

Connections use explicit OpenSSH aliases and `BatchMode=yes`. The plugin stores no password or private key. Remote DSH listens on loopback, and the local Web application reaches it only through SSH and the local same-origin proxy. The plugin does not add a remote authentication protocol or public listener.

## Alternatives considered

- **Subagent provider**: rejected because the remote session is a top-level root session with its own Workspace and transcript.
- **Custom remote daemon and JSON-RPC**: rejected because official DSH already provides Workspace persistence, root-session recovery, HTTP RPC, and live event downlinks.
- **Capability-by-capability proxying**: rejected because it duplicates filesystem, process, terminal, LSP, interaction, and persistence behavior.
- **Separate remote UI and registry**: rejected because it forks ordinary Workspace and Session behavior and prevents existing client plugins from operating on remote sessions.
- **Local-only runtime routing**: rejected because plugins that read `connection.api` directly would still call the wrong Host.

## Verification

Unit tests cover authority lifecycle, API-router registration, id namespacing, and WebSocket opcode preservation. Browser verification covers SSH connection, aggregated Workspaces, remote directory browsing, remote session creation and recovery, remote model loading, live user and assistant frames, running state, cancellation control, and completed conversation rendering.

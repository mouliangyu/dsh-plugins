# Remote session relay

## Goal

Ordinary root sessions exchange complete messages across SSH-connected DSH authorities. Delivery is message-real-time rather than token streaming. The browser does not participate, and closing it does not interrupt the channel.

## Component ownership

| Runtime | Component | Responsibility |
|---|---|---|
| Host DSH | `dsh-session-control` | Session addresses, provider registry, local delivery, reply attribution, and model-facing tools |
| Host DSH | `dsh-remote` local entry | SSH lifecycle, existing local forward, outgoing WebSocket provider, and relay capability status |
| Remote DSH | `dsh-session-control` | The same transport-neutral session operations and official API delivery |
| Remote DSH | `dsh-remote/relay-channel` | Incoming WebSocket upgrade, frame validation, acknowledgements, and provider disposal |
| DSH API gateway | `apiProxy.sessions` | Cold resume, model and preset restoration, admission, and durable user-message creation |

`dsh-session-control` has no WebSocket dependency or route. Its `SessionRelayProvider` interface consists of message delivery and remote session listing. `dsh-remote` implements that interface and owns every wire-level decision.

## Composition

The Host Web profile loads `dsh-session-control` and the complete `dsh-remote` bundle. The Remote Web profile loads `dsh-session-control` and the relay-channel entry from the same `dsh-remote` bundle. An empty remote connection list does not start SSH management, so the Remote process only exposes the incoming transport.

The relay channel requires both entries. Without `dsh-session-control`, no session service exists to receive messages. Without `dsh-remote/relay-channel`, the Remote official API remains usable but reports relay as unavailable.

## Transport

The Host opens `/api/dsh-remote/session-relay` through the existing SSH local forward. No public port, reverse tunnel, Unix socket, additional daemon, or browser connection is introduced. One bidirectional WebSocket carries Host-to-Remote messages, Remote-to-Host messages, acknowledgements, and session listings.

The version-1 frames are `hello`, `ready`, `relay`, `ack`, `list`, `sessions`, and `error`. Both socket peers validate JSON at receipt. The receiver acknowledges a relay only after its local `SessionRelayService` accepts delivery through the official API gateway.

## Address mapping

Tool-visible remote session ids use `@authority/<authority>/<session-id>`. Inside each DSH process, `local` names that process. The Host provider rewrites its local sender to the connection-specific peer id, while the Remote channel maps the target back to `local`. A reply therefore returns through the provider that delivered the original message.

## Failure behavior

SSH/API connectivity and relay capability are separate states. A missing or incompatible relay endpoint leaves the remote authority usable and reports `relayConnected: false` with `relayError`. Sending to that authority then fails explicitly through the relay service.

Socket closure rejects pending acknowledgements and removes the provider. Explicit Remote reconnect rebuilds the SSH forward and relay provider. Unacknowledged frames live only for the provider process lifetime; persisting them across Host process restarts requires a separate durable outbox.

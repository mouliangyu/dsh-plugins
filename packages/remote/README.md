# dsh-remote

English | [中文](README.zh.md)

`dsh-remote` connects the Web application to official DSH instances over SSH. A remote authority appears in the ordinary Workspace tree, and its root sessions use the ordinary conversation renderer, model selector, approval and question responders, cancellation, and live event stream.

## Install

```sh
dsh plugin --profile web add dsh-remote
dsh plugin --profile web install
dsh --profile web
```

For local development, replace `dsh-remote` with `link:/absolute/path/to/dsh-plugins/packages/remote`.

The plugin requires a DSH build whose core client runtime and Workspace UI provide `ctx.authorityRegistry`, `ctx.connection.routeApi()`, multi-authority API routing, and authority-aware Workspace picking. Core owns those generic behaviors; this package only supplies the SSH provider.

## Connect

Open Settings, select Remote, and add a connection. The form discovers explicit aliases from `~/.ssh/config` and recursive `Include` files; it does not probe those hosts. Choose an alias, assign a stable authority id, and set the remote DSH Web port. Authentication and final option resolution remain OpenSSH responsibilities, including `ProxyJump`, `IdentityFile`, and `ssh-agent`.

The remote host must already provide the official `dsh` command. Connecting starts `dsh --profile web` on remote loopback when the configured port is not already listening, detaches it with `nohup`, and opens an SSH local forward. No remote plugin, daemon, Unix socket, project registry, or manual profile edit is installed.

Local settings store only the authority id, SSH host alias, and remote port. The remote DSH owns its Workspace registry, session logs, titles, model selection, permissions, and recovery.

## Use

Connected remote Workspaces are merged into the normal Workspace tree and carry the authority label. The Add Workspace menu offers the local Host and every ready remote authority. The plugin composes the official browse directory picker so local and remote directories use the same in-page browser.

All unary RPCs use the official DSH HTTP envelopes. `events.mux` and `events.host` use the official WebSocket text frames. The local proxy changes only the URL and browser trust headers required to reach the SSH-forwarded loopback Host. Session and Workspace ids are namespaced only inside the shared browser object model and are restored to their original values on the wire.

The provider owns SSH lifecycle, reconnection, and health state. Disconnecting closes the local forward; the detached remote DSH process and its durable sessions remain available for a later connection.

The Reconnect action additionally restarts the remote Web process recorded by `~/.dsh/remote-web.pid`, then recreates the SSH forward. It only stops a PID whose command line is a DSH Web process; an occupied port or an unsafe PID file fails explicitly.

## Configuration

```yaml
- id: dsh-remote-local
  name: dsh-remote
  config:
    sshConnectTimeoutSeconds: 10
    autoConnect: true
```

Connection records are edited through Settings and stored in the `dsh-remote` settings namespace.

## Limitations

- The bundle uses the official browse directory picker for both local and remote Workspace creation; installing it replaces the platform-native local chooser.
- Remote access inherits OpenSSH host-key and authentication behavior. `BatchMode=yes` makes password prompts and unresolved first-use confirmation fail visibly.
- The remote Web Host listens only on remote loopback. A separate remote port is configured, but it is not exposed outside the SSH connection.
- Multiple top-level API routers cannot coexist; authority routing must be composed in the single `connection.routeApi()` registration.

## Model Experience

Remote prompts are ordinary root-session prompts on the remote DSH. Model-visible content, tools, token usage, compaction, and KV cache behavior are identical to using that remote DSH Web application directly.

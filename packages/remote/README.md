# dsh-remote

English | [中文](README.zh.md)

`dsh-remote` is a bundle with two runtime roles. The local Web Host plugin stores SSH connection records, opens SSH stdio bridges, and serves the Remote settings page. The remote Host service owns project roots, durable root sessions, live agent handles, and persistence-backed replay.

## Local installation

```sh
dsh plugin --profile web add link:/absolute/path/to/dsh-plugins/packages/remote
dsh web
```

After the package is published, the registry spec `dsh-remote` replaces the local link.

Open Settings, then Remote. The add-connection form discovers explicit `Host` aliases from `~/.ssh/config` and its `Include` files; wildcard rules remain OpenSSH-only and are not offered as selectable hosts. Each connection stores only an id, the selected alias, and the remote Unix-socket path. Authentication remains in OpenSSH config, `ssh-agent`, or another SSH credential provider; DSH settings never store a password or private key. Project, session, transcript, and sequence state remain authoritative on the remote host.

Use Install or update remote Host on a saved connection. The local Host packs the running `dsh-remote` plugin, transfers it over SSH, installs the exact official DSH release selected by `remoteDshPackage` and a dedicated profile under the remote user's home, and starts or restarts the daemon. The plugin declares only the runtime packages absent from the official DSH installation, while its DSH service imports resolve from the official runtime closure. The plugin and DSH versions are independent; `remoteDshPackage` defaults to the published `@deepseek-ai/dsh@0.1.0-rc.6` release and rejects tags or ranges so repeated installations do not drift. The connection-level action requires non-interactive SSH authentication plus Node.js and npm on the remote host; it requires neither a manual SSH login nor root access. `sshConnectTimeoutSeconds` and `bootstrapTimeoutMs` configure connection and installation deadlines.

After the connection succeeds, New project calls the running daemon. The daemon creates the directory, writes the project to its remote JSON registry, and immediately advertises it to every client. Adding a project does not install packages, rewrite the profile, or restart the daemon.

The local Host exposes `/dsh-remote/api` for management commands and `/dsh-remote/events` for SSE. One SSH process can carry project and session requests plus multiple concurrent event subscribers. Closing the browser or SSH bridge does not cancel remote work.

## Manual remote host configuration

```yaml
- id: remote-host
  name: 'dsh-remote/host'
  config:
    socketPath: /run/user/1000/dsh-remote.sock
    projectsFile: /home/user/.dsh/remote-projects.json
```

The page-managed installation generates this entry over the base profile and supplies session persistence, agent loop, model route, filesystem, terminal, LSP, approval, and question providers. `projectsFile` is authoritative after it exists; an optional `projects` array seeds it on first boot. The installer uses `systemd --user` when a persistent user manager is available, `launchd` on macOS, and otherwise a detached process with a PID file. A manual deployment can run `dsh-remote-host /path/to/cordis.yml` under another user service. The socket and project registry have owner-only permissions; no remote TCP port is required.

## Protocol

The daemon accepts `remote/hello`, `remote/projects/create`, `remote/sessions/list`, `remote/sessions/create`, `remote/sessions/resume`, `remote/sessions/prompt`, `remote/sessions/cancel`, and `remote/events/subscribe`. Project creation is serialized and atomically replaces the versioned registry file. A subscription registers its live listener before reading `SessionPersistence.readFrom(sessionId, fromSeq)`, then emits the durable suffix and buffered live events in sequence order.

## Model Experience

### Remote root session

#### What the model sees

The remote model receives each `remote/sessions/prompt` input as a durable `user/message` in a root session and uses the remote project's configured prompt, tools, filesystem, shell, terminal, LSP, and interaction providers.

#### Token effect

Prompt content enters the remote session history and remains until the configured compaction provider removes it.

#### KV Cache effect

None beyond normal session-history behavior.

## Known Limitations and Deferred Work

- The Remote settings page renders durable events directly; sharing the ordinary conversation renderer requires a pluggable client session backend.
- Approval/question responder requests and direct PTY attachment require additional bidirectional protocol methods.
- The detached-process fallback survives an ordinary SSH disconnect but cannot provide the reboot and process-accounting guarantees of `systemd --user` or `launchd`.

# Agent Note: Remote projects use a persistent DSH host

Status: implemented

English | [中文](DESIGN.zh.md)

## Problem

An SSH command tool cannot provide a remote project as a top-level interactive session. A one-shot process loses live agent state when SSH disconnects, while local filesystem and subprocess proxies would duplicate DSH capabilities and split one execution environment across machines.

## Decision

`dsh-remote` separates local management from remote execution. The package root is the local Web Host plugin, while `/host` is the explicit Remote Host service used by the remote daemon. The `/local` export is retained as an alias; it discovers explicit aliases from the user OpenSSH config and recursive `Include` files, stores selected SSH connection records, runs SSH stdio bridges, and exposes project and root-session management plus SSE. Wildcard host rules remain OpenSSH-only. The Remote Host service runs inside a persistent remote DSH daemon and owns configured project roots, root sessions, agent handles, and persistence-backed replay.

The daemon listens on a user-private Unix socket. `dsh-remote-host connect` copies stdio to that socket, so the SSH process is a replaceable transport rather than the session owner. `systemd --user` or `launchd` keeps the daemon alive when available; a detached process provides SSH-disconnect survival without reboot supervision when neither service manager is usable.

Install or update remote Host is the explicit connection-level installation boundary. The local Host packs its installed plugin version, transfers the tarball through SSH, installs the exact official `@deepseek-ai/dsh` release configured by `remoteDshPackage` and a dedicated profile under the remote user's home, renders the effective `cordis.yml`, and restarts the daemon. The plugin resolves its DSH imports from that official runtime closure. Plugin and DSH versions remain independent; the DSH package specifier must name one exact official release so installation cannot drift with a registry tag or range. This requires non-interactive SSH authentication and an existing Node.js/npm installation, but no manual remote login or privileged install. Ordinary connection attempts never install software.

The running daemon owns a versioned JSON project registry outside its installed profile. `remote/projects/create` serializes project mutations, creates the selected directory, and atomically replaces the owner-only registry file. Host installation and upgrades leave this file untouched. A project action therefore changes project state without uploading packages, changing composition, or restarting the daemon.

Remote persistence is authoritative for project sessions and events. Local settings store connection id, SSH host, and socket path only; they do not store a last session id, transcript, or replay watermark. A browser subscription supplies `fromSeq`, and the daemon registers a live listener before reading the durable suffix so concurrent events arrive after the persisted prefix.

## Alternatives considered

- **Model-facing SSH command tool**: rejected because separate commands do not form a durable interactive project session.
- **Subagent provider**: rejected because remote work is a root session with its own transcript, not a child result in a local session.
- **Local capability proxies**: rejected because filesystem, PTY, LSP, approval, and process policy belong to the remote DSH execution environment.
- **One-shot stdio host**: rejected because its lifetime would still be owned by the SSH connection.
- **Public WebSocket port on the remote host**: rejected because SSH and a private Unix socket provide transport and access control without another listening port.
- **Registry-only remote installation**: rejected because local development builds may not be published and the two transport endpoints must run the same plugin version.
- **Installing or restarting the Host for each project**: rejected because Host lifecycle belongs to the SSH connection, while projects are durable records managed by the running Host.

## Consequences

The local browser communicates with its local DSH Host over plugin-owned HTTP and SSE endpoints; the local Host communicates with the remote daemon over SSH stdio and newline-delimited JSON-RPC. Remote root-session identity stays outside the local session persistence domain, preventing local transcript copies and identifier collisions. Multiple saved connections and session subscribers remain independent; selected UI rows do not constrain execution.

The ordinary conversation renderer assumes every session belongs to the local API Host. The management UI therefore renders remote durable events directly. Sharing the ordinary renderer requires a pluggable client session backend rather than inserting remote events into local persistence. A daemon restart preserves durable recovery but cannot preserve an interrupted live process. Approval/question responders and direct PTY attachment require additional bidirectional protocol methods.

SSH config discovery reads aliases only and never contacts the listed machines. Host verification, final option resolution, and authentication remain OpenSSH responsibilities. The bootstrap action uses `BatchMode=yes`; password prompts and first-use host confirmation fail visibly instead of blocking the local Host. The detached fallback survives an ordinary SSH disconnect but does not replace the reboot, accounting, and cleanup guarantees of an operating-system service manager.

## Verification

Package tests cover concurrent event subscribers, durable replay ordering, recursive SSH-config discovery, opaque bootstrap value transfer, supervisor branches, packing the actual installed plugin artifact, project-registry writes, duplicate rejection, and registry recovery. The browser workflow covers discovered-host selection, connection-level Host installation, project creation, project selection, and root-session creation.

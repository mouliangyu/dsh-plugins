/**
 * Provider boundary for executing an orchestrated session outside the local
 * DSH process. Implement this beside an SSH, Kubernetes, or container plugin.
 */

import type { SessionId } from "@deepseek-ai/dsh-session";

/** A remote task tracked by one local DSH session id. */
export interface RemoteSessionRun {
  /** Local session that owns the visible transcript and lifecycle. */
  readonly sessionId: SessionId;
  /** Provider-owned remote process or job identity. */
  readonly remoteId: string;
  /** Current state projected into the session and Web UI. */
  readonly status: "queued" | "running" | "idle" | "failed" | "stopped";
}

/**
 * Minimal transport contract for a remote session provider.
 *
 * The implementation must append remote output and status changes to the
 * local session event stream. A Web client then observes it through the
 * normal `session/event` feed; it must not poll a second, unrelated store.
 */
export interface RemoteSessionProvider {
  /** Start work for a session after its workspace has been provisioned remotely. */
  start(
    sessionId: SessionId,
    task: string,
    signal: AbortSignal,
  ): Promise<RemoteSessionRun>;
  /** Queue another message for the already-created remote session. */
  send(
    sessionId: SessionId,
    message: string,
    signal: AbortSignal,
  ): Promise<void>;
  /** Stop active remote work while retaining the remote workspace for a later resume. */
  stop(sessionId: SessionId, signal: AbortSignal): Promise<void>;
  /** Return the provider state needed to restore UI visibility after a restart. */
  inspect(
    sessionId: SessionId,
    signal: AbortSignal,
  ): Promise<RemoteSessionRun | undefined>;
}

/** Connected WebSocket adapter for the transport-neutral session relay provider. */

import { randomUUID } from "node:crypto";
import { WebSocket, type RawData } from "ws";
import type { RelaySessionEntry, SessionRelay, SessionRelayProvider } from "dsh-session-control/relay";
import { parseSessionRelayFrame, type SessionRelayFrame } from "./relay-protocol.ts";

interface PendingRequest<T> {
  readonly resolve: (value: T) => void;
  readonly reject: (error: Error) => void;
  readonly timer: NodeJS.Timeout;
}

/** Operations supplied by the DSH process attached to one socket. */
export interface SessionRelaySocketHandlers {
  receive(message: SessionRelay): Promise<void>;
  listSessions(): Promise<readonly RelaySessionEntry[]>;
  closed?(error: Error): void;
}

/** One connected remote peer with request acknowledgement and session listing. */
export class SessionRelaySocketProvider implements SessionRelayProvider {
  private readonly relayRequests = new Map<string, PendingRequest<void>>();
  private readonly listRequests = new Map<string, PendingRequest<readonly RelaySessionEntry[]>>();
  private closed = false;

  constructor(
    readonly authorityId: string,
    private readonly socket: WebSocket,
    private readonly handlers: SessionRelaySocketHandlers,
    private readonly requestTimeoutMs: number,
  ) {
    socket.on("message", (data, isBinary) => {
      if (isBinary) {
        this.fail(new Error("session relay accepts text WebSocket frames only"));
        return;
      }
      void this.handle(data).catch(error => this.fail(asError(error)));
    });
    socket.once("close", () => this.fail(new Error(`session relay authority disconnected: ${authorityId}`)));
    socket.once("error", error => this.fail(error));
  }

  async send(message: SessionRelay): Promise<void> {
    const promise = this.pending(this.relayRequests, message.relayId);
    this.write({ type: "relay", message });
    return promise;
  }

  async listSessions(): Promise<readonly RelaySessionEntry[]> {
    const requestId = randomUUID();
    const promise = this.pending(this.listRequests, requestId);
    this.write({ type: "list", requestId });
    return promise;
  }

  close(): void {
    if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) this.socket.close();
    this.fail(new Error(`session relay authority closed: ${this.authorityId}`));
  }

  private async handle(data: RawData): Promise<void> {
    const frame = parseSessionRelayFrame(data.toString("utf8"));
    switch (frame.type) {
      case "relay":
        try {
          await this.handlers.receive(frame.message);
          this.write({ type: "ack", relayId: frame.message.relayId });
        } catch (error) {
          this.write({ type: "error", relayId: frame.message.relayId, message: asError(error).message });
        }
        return;
      case "ack":
        this.settle(this.relayRequests, frame.relayId, undefined);
        return;
      case "list":
        try {
          this.write({ type: "sessions", requestId: frame.requestId, sessions: await this.handlers.listSessions() });
        } catch (error) {
          this.write({ type: "error", requestId: frame.requestId, message: asError(error).message });
        }
        return;
      case "sessions":
        this.settle(this.listRequests, frame.requestId, frame.sessions);
        return;
      case "error": {
        const error = new Error(`session relay peer rejected request: ${frame.message}`);
        if (frame.relayId !== undefined) this.reject(this.relayRequests, frame.relayId, error);
        if (frame.requestId !== undefined) this.reject(this.listRequests, frame.requestId, error);
        return;
      }
      case "hello":
      case "ready":
        throw new Error(`unexpected ${frame.type} frame after relay handshake`);
    }
  }

  private pending<T>(table: Map<string, PendingRequest<T>>, id: string): Promise<T> {
    if (this.closed || this.socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error(`session relay authority is not connected: ${this.authorityId}`));
    }
    if (table.has(id)) return Promise.reject(new Error(`duplicate session relay request: ${id}`));
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        table.delete(id);
        reject(new Error(`session relay request timed out for authority ${this.authorityId}`));
      }, this.requestTimeoutMs);
      table.set(id, { resolve, reject, timer });
    });
  }

  private settle<T>(table: Map<string, PendingRequest<T>>, id: string, value: T): void {
    const pending = table.get(id);
    if (pending === undefined) return;
    table.delete(id);
    clearTimeout(pending.timer);
    pending.resolve(value);
  }

  private reject<T>(table: Map<string, PendingRequest<T>>, id: string, error: Error): void {
    const pending = table.get(id);
    if (pending === undefined) return;
    table.delete(id);
    clearTimeout(pending.timer);
    pending.reject(error);
  }

  private write(frame: SessionRelayFrame): void {
    if (this.socket.readyState !== WebSocket.OPEN) {
      throw new Error(`session relay authority is not connected: ${this.authorityId}`);
    }
    this.socket.send(JSON.stringify(frame));
  }

  private fail(error: Error): void {
    if (this.closed) return;
    this.closed = true;
    for (const [id] of this.relayRequests) this.reject(this.relayRequests, id, error);
    for (const [id] of this.listRequests) this.reject(this.listRequests, id, error);
    this.handlers.closed?.(error);
  }
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

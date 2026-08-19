/** Host-side WebSocket provider for the session-control relay service. */

import { WebSocket } from "ws";
import {
  type RelaySessionEntry,
  type SessionRelay,
  type SessionRelayProvider,
} from "dsh-session-control/relay";
import { SESSION_RELAY_PATH, SESSION_RELAY_PROTOCOL_VERSION } from "./relay-protocol.ts";
import { SessionRelaySocketProvider } from "./relay-socket.ts";
import type { RemoteApiForward } from "./transparent.js";

/** Options for one forwarded relay connection. */
export interface RemoteSessionRelayOptions {
  readonly authorityId: string;
  readonly peerId: string;
  readonly forward: RemoteApiForward;
  readonly requestTimeoutMs: number;
  receive(message: SessionRelay): Promise<void>;
  listSessions?: () => Promise<readonly RelaySessionEntry[]>;
  closed?(error: Error): void;
}

/** One Host-side remote authority relay provider. */
export class RemoteSessionRelayProvider implements SessionRelayProvider {
  readonly authorityId: string;
  private readonly peerId: string;
  private readonly socketProvider: SessionRelaySocketProvider;
  private readonly socket: WebSocket;

  private constructor(options: RemoteSessionRelayOptions, socket: WebSocket) {
    this.authorityId = options.authorityId;
    this.peerId = options.peerId;
    this.socket = socket;
    this.socketProvider = new SessionRelaySocketProvider(
      options.authorityId,
      socket,
      {
        receive: message => options.receive({
          ...message,
          from: { authorityId: options.authorityId, sessionId: message.from.sessionId },
          to: { authorityId: "local", sessionId: message.to.sessionId },
        }),
        listSessions: options.listSessions ?? (async () => []),
        closed: options.closed,
      },
      options.requestTimeoutMs,
    );
  }

  /** Open and handshake a provider through an existing SSH local forward. */
  static async connect(options: RemoteSessionRelayOptions): Promise<RemoteSessionRelayProvider> {
    const socket = await openRelaySocket(options);
    return new RemoteSessionRelayProvider(options, socket);
  }

  async send(message: SessionRelay): Promise<void> {
    await this.socketProvider.send({
      ...message,
      from: { authorityId: this.peerId, sessionId: message.from.sessionId },
      to: { authorityId: "local", sessionId: message.to.sessionId },
    });
  }

  async listSessions(): Promise<readonly RelaySessionEntry[]> {
    return this.socketProvider.listSessions();
  }

  async close(): Promise<void> {
    this.socketProvider.close();
    if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
      this.socket.close();
    }
  }
}

async function openRelaySocket(options: RemoteSessionRelayOptions): Promise<WebSocket> {
  const socket = new WebSocket(
    `ws://127.0.0.1:${String(options.forward.localPort)}${SESSION_RELAY_PATH}`,
    { headers: { host: `127.0.0.1:${String(options.forward.localPort)}`, origin: `http://127.0.0.1:${String(options.forward.localPort)}` } },
  );
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error(`session relay handshake timed out for ${options.authorityId}`));
    }, options.requestTimeoutMs);
    const fail = (error: Error): void => {
      clearTimeout(timer);
      reject(error);
    };
    socket.once("error", fail);
    socket.once("open", () => {
      socket.send(JSON.stringify({
        type: "hello",
        version: SESSION_RELAY_PROTOCOL_VERSION,
        peerId: options.peerId,
      }));
    });
    socket.once("message", (data, isBinary) => {
      if (isBinary) {
        fail(new Error("session relay handshake must be text"));
        return;
      }
      try {
        const frame = JSON.parse(data.toString("utf8")) as { type?: unknown; version?: unknown };
        if (frame.type !== "ready" || frame.version !== SESSION_RELAY_PROTOCOL_VERSION) {
          fail(new Error("remote session relay rejected the protocol"));
          return;
        }
        clearTimeout(timer);
        socket.removeListener("error", fail);
        resolve();
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)));
      }
    });
  });
  return socket;
}

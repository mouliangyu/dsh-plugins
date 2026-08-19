import { WebSocketServer } from "ws";
import { afterEach, describe, expect, it } from "vitest";
import { SESSION_RELAY_PROTOCOL_VERSION } from "../src/relay-protocol.ts";
import { RemoteSessionRelayProvider } from "../src/session-relay.ts";

describe("RemoteSessionRelayProvider", () => {
  const servers: WebSocketServer[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map(async server => {
      for (const client of server.clients) client.terminate();
      await new Promise<void>(resolve => server.close(() => resolve()));
    }));
  });

  it("handshakes, sends relay frames, lists sessions, and receives replies", async () => {
    const server = new WebSocketServer({ port: 0 });
    servers.push(server);
    await new Promise<void>(resolve => server.once("listening", () => resolve()));
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("test server did not listen");
    const received: unknown[] = [];
    server.on("connection", socket => {
      socket.once("message", data => {
        expect(JSON.parse(data.toString())).toEqual({
          type: "hello",
          version: SESSION_RELAY_PROTOCOL_VERSION,
          peerId: "host:remote-b",
        });
        socket.send(JSON.stringify({ type: "ready", version: SESSION_RELAY_PROTOCOL_VERSION }));
      });
      socket.on("message", data => {
        const frame = JSON.parse(data.toString()) as {
          type: string;
          relayId?: string;
          requestId?: string;
          message?: { relayId?: string };
        };
        if (frame.type === "relay") {
          received.push(frame);
          socket.send(JSON.stringify({ type: "ack", relayId: frame.message?.relayId }));
        }
        if (frame.type === "list") {
          socket.send(JSON.stringify({
            type: "sessions",
            requestId: frame.requestId,
            sessions: [{ sessionId: "remote-session", updatedAt: 1, running: true }],
          }));
        }
      });
    });

    const incoming: unknown[] = [];
    const provider = await RemoteSessionRelayProvider.connect({
      authorityId: "remote-b",
      peerId: "host:remote-b",
      forward: { localPort: address.port } as never,
      requestTimeoutMs: 1000,
      receive: async message => { incoming.push(message); },
    });
    await provider.send({
      relayId: "relay-1",
      from: { authorityId: "local", sessionId: "host-session" },
      to: { authorityId: "remote-b", sessionId: "remote-session" },
      content: "work",
    });
    await expect(provider.listSessions()).resolves.toEqual([
      { sessionId: "remote-session", updatedAt: 1, running: true },
    ]);
    const connection = [...server.clients][0];
    connection?.send(JSON.stringify({
      type: "relay",
      message: {
        relayId: "relay-2",
        from: { authorityId: "local", sessionId: "remote-session" },
        to: { authorityId: "host:remote-b", sessionId: "host-session" },
        content: "answer",
      },
    }));
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(received).toHaveLength(1);
    expect(incoming).toEqual([{
      relayId: "relay-2",
      from: { authorityId: "remote-b", sessionId: "remote-session" },
      to: { authorityId: "local", sessionId: "host-session" },
      content: "answer",
    }]);
    await provider.close();
  });
});

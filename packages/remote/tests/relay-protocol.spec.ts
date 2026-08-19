import { describe, expect, it } from "vitest";
import { parseSessionRelayFrame } from "../src/relay-protocol.ts";

describe("remote relay protocol", () => {
  it("parses a complete relay message at the wire boundary", () => {
    expect(parseSessionRelayFrame(JSON.stringify({
      type: "relay",
      message: {
        relayId: "relay-1",
        from: { authorityId: "local", sessionId: "source" },
        to: { authorityId: "local", sessionId: "target" },
        content: "hello",
      },
    }))).toEqual({
      type: "relay",
      message: {
        relayId: "relay-1",
        from: { authorityId: "local", sessionId: "source" },
        to: { authorityId: "local", sessionId: "target" },
        content: "hello",
      },
    });
  });

  it("rejects invalid remote entries before they reach session-control", () => {
    expect(() => parseSessionRelayFrame(JSON.stringify({
      type: "sessions",
      requestId: "list-1",
      sessions: [{ sessionId: "session-1", updatedAt: "invalid", running: false }],
    }))).toThrow("session relay session entry is invalid");
  });
});

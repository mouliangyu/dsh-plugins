import { describe, expect, it } from "vitest";
import { Config } from "../src/index.ts";

describe("session-control config", () => {
  it("enables global access and keeps archive disabled by default", () => {
    expect(Config({})).toEqual({
      allowGlobalAccess: true,
      allowArchive: false,
      maxManagedSessions: 12,
    });
  });

  it("rejects a non-positive managed-session limit", () => {
    expect(() => Config({ maxManagedSessions: 0 })).toThrow();
  });
});

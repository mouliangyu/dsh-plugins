import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHarness, type TestHarness } from "./harness.ts";

describe("session-control settings route", () => {
  let harness: TestHarness;
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    harness = createHarness();
    const route = harness.routes.find(
      (candidate) => candidate.path === "/api/session-control/settings",
    );
    if (route === undefined) throw new Error("settings route was not registered");
    server = createServer((req, res) => {
      void route.handler(req, res);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("test server did not bind a TCP port");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error === undefined ? resolve() : reject(error))),
    );
  });

  it("reads and durably updates the live global-access setting", async () => {
    const initial = await fetch(`${baseUrl}/api/session-control/settings`);
    expect(initial.status).toBe(200);
    expect(initial.headers.get("cache-control")).toBe("no-store");
    await expect(initial.json()).resolves.toEqual({ allowGlobalAccess: true });

    const updated = await fetch(`${baseUrl}/api/session-control/settings`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "sec-fetch-site": "same-origin",
      },
      body: JSON.stringify({ allowGlobalAccess: false }),
    });
    expect(updated.status).toBe(200);
    await expect(updated.json()).resolves.toEqual({ allowGlobalAccess: false });
    expect(harness.settingsValue.allowGlobalAccess).toBe(false);

    await expect(
      harness.tool("workspace_create").execute({ path: "/blocked" }, {}),
    ).rejects.toThrow(/requires global access/);
  });

  it("rejects cross-origin writes before reading the body", async () => {
    const response = await fetch(`${baseUrl}/api/session-control/settings`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "sec-fetch-site": "cross-site",
      },
      body: JSON.stringify({ allowGlobalAccess: false }),
    });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "cross-origin settings writes are forbidden",
    });
    expect(harness.settingsValue.allowGlobalAccess).toBe(true);
  });

  it("rejects invalid JSON shapes and oversized bodies", async () => {
    const invalid = await fetch(`${baseUrl}/api/session-control/settings`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ allowGlobalAccess: "yes" }),
    });
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toEqual({
      error: "allowGlobalAccess must be boolean",
    });

    const oversized = await fetch(`${baseUrl}/api/session-control/settings`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ allowGlobalAccess: true, padding: "x".repeat(17_000) }),
    });
    expect(oversized.status).toBe(400);
    await expect(oversized.json()).resolves.toEqual({
      error: "request body is too large",
    });
  });

  it("returns method metadata for unsupported requests", async () => {
    const response = await fetch(`${baseUrl}/api/session-control/settings`, {
      method: "POST",
    });
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, PUT");
    await expect(response.json()).resolves.toEqual({ error: "method not allowed" });
  });
});

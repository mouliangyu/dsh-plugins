import { describe, expect, it, vi } from "vitest";
import { createHarness } from "./harness.ts";

describe("session-control tools", () => {
  it("registers the stable tool surface and keeps archive opt-in", () => {
    const normal = createHarness();
    expect([...normal.tools.keys()]).toEqual([
      "session_create",
      "session_list",
      "workspace_list",
      "workspace_create",
      "workspace_rename",
      "workspace_remove",
      "workspace_sessions",
      "session_send",
      "session_stop",
    ]);
    expect(createHarness({ allowArchive: true }).tools.has("session_archive")).toBe(true);
  });

  it("creates a child in the caller workspace with a frozen coordinator message", async () => {
    const harness = createHarness();
    const workspace = harness.addWorkspace({ id: "one", path: "/one", title: "One" });
    const caller = harness.addAgent({ id: "parent", cwd: "/one", agentOptions: { model: "m" } });

    const result = await harness.tool("session_create").execute(
      { task: "  inspect the project  " },
      { agent: caller },
    );

    expect(result).toMatch(/^Created and started session .+\.$/);
    const create = harness.createdOptions[0] as {
      sessionId: string;
      meta: { cwd: string; parentSession: string };
      agentOptions: unknown;
    };
    expect(create.meta).toMatchObject({ cwd: "/one", parentSession: "parent" });
    expect(create.agentOptions).toEqual({ model: "m" });
    expect(workspace.sessionIds).toContain(create.sessionId as never);
    const child = harness.agents.get(create.sessionId)!;
    const message = vi.mocked(child.followup).mock.calls[0]![0] as {
      content: Array<{ text: string }>;
      source: { kind: string; form: string; senderSessionId: string };
    };
    expect(message.content[0]?.text).toBe("inspect the project");
    expect(message.source).toEqual({
      kind: "coordinator",
      form: "relay",
      senderSessionId: "parent",
    });
    expect(Object.isFrozen(message)).toBe(true);
    expect(Object.isFrozen(message.content)).toBe(true);
  });

  it("enforces workspace scope dynamically", async () => {
    const harness = createHarness({ allowGlobalAccess: false });
    harness.addWorkspace({ id: "one", path: "/one", title: "One" });
    harness.addWorkspace({ id: "two", path: "/two", title: "Two" });
    const caller = harness.addAgent({ id: "parent", cwd: "/one" });

    await expect(
      harness.tool("session_create").execute(
        { task: "work", workspace_id: "two" },
        { agent: caller },
      ),
    ).rejects.toThrow(/outside the caller workspace/);
    await expect(
      harness.tool("workspace_create").execute({ path: "/three" }, { agent: caller }),
    ).rejects.toThrow(/requires global access/);

    harness.settingsValue.allowGlobalAccess = true;
    await expect(
      harness.tool("session_create").execute(
        { task: "work", workspace_id: "two" },
        { agent: caller },
      ),
    ).resolves.toMatch(/Created and started/);
  });

  it("disposes a new agent when workspace attachment fails without consuming capacity", async () => {
    const harness = createHarness({ maxManagedSessions: 1 });
    const workspace = harness.addWorkspace({ id: "one", path: "/one", title: "One" });
    const caller = harness.addAgent({ id: "parent", cwd: "/one" });
    vi.mocked(workspace.attachSession).mockRejectedValueOnce(new Error("attach failed"));

    await expect(
      harness.tool("session_create").execute({ task: "first" }, { agent: caller }),
    ).rejects.toThrow("attach failed");
    expect(harness.createdHandles[0]?.dispose).toHaveBeenCalledOnce();
    await expect(
      harness.tool("session_create").execute({ task: "second" }, { agent: caller }),
    ).resolves.toMatch(/Created and started/);
  });

  it("resumes a cold persisted session once and queues coordinator follow-ups", async () => {
    const harness = createHarness();
    const caller = harness.addAgent({ id: "parent", cwd: "/one", agentOptions: { model: "m" } });
    harness.persisted.push({ id: "cold" as never, createdAt: 1 });

    await harness.tool("session_send").execute(
      { session_id: "cold", message: " continue " },
      { agent: caller },
    );
    await harness.tool("session_send").execute(
      { session_id: "cold", message: "again" },
      { agent: caller },
    );

    expect(harness.resumedOptions).toEqual([
      { resumeSessionId: "cold", agentOptions: { model: "m" } },
    ]);
    const target = harness.agents.get("cold")!;
    expect(target.followup).toHaveBeenCalledTimes(2);
  });

  it("stops only another running session and preserves its inbox", async () => {
    const harness = createHarness();
    const caller = harness.addAgent({ id: "parent", cwd: "/one" });
    const target = harness.addAgent({ id: "target", status: "running" });

    await expect(
      harness.tool("session_stop").execute({ session_id: "parent" }, { agent: caller }),
    ).rejects.toThrow(/cannot stop itself/);
    await expect(
      harness.tool("session_stop").execute({ session_id: "target" }, { agent: caller }),
    ).resolves.toBe("Stop requested for session target.");
    expect(target.cancel).toHaveBeenCalledWith({ kind: "user" }, { keepInbox: true });
  });

  it("lists global sessions newest-first with workspace, title, and live status", async () => {
    const harness = createHarness();
    harness.addWorkspace({ id: "one", path: "/one", title: "One", sessionIds: ["old"] });
    const caller = harness.addAgent({ id: "parent", cwd: "/one" });
    harness.addAgent({ id: "new", status: "running" });
    harness.persisted.push(
      { id: "old" as never, createdAt: 1 },
      { id: "new" as never, createdAt: 2 },
    );
    harness.titles.set("old", "Old title");
    harness.titles.set("new", "New title");

    await expect(
      harness.tool("session_list").execute({}, { agent: caller }),
    ).resolves.toBe(
      "new [running] [unassigned] - New title\nold [ready] [workspace:One] - Old title",
    );
  });

  it("restricts session listing and mutation to the caller workspace", async () => {
    const harness = createHarness({ allowGlobalAccess: false });
    harness.addWorkspace({ id: "one", path: "/one", title: "One", sessionIds: ["inside"] });
    harness.addWorkspace({ id: "two", path: "/two", title: "Two", sessionIds: ["outside"] });
    const caller = harness.addAgent({ id: "parent", cwd: "/one" });
    harness.titles.set("inside", "Inside");
    harness.titles.set("outside", "Outside");

    await expect(
      harness.tool("session_list").execute({}, { agent: caller }),
    ).resolves.toBe("inside [ready] [workspace:One] - Inside");
    await expect(
      harness.tool("session_send").execute(
        { session_id: "outside", message: "no" },
        { agent: caller },
      ),
    ).rejects.toThrow(/outside the caller workspace/);
  });

  it("manages workspace registration without touching project files", async () => {
    const harness = createHarness();
    const caller = harness.addAgent({ id: "parent", cwd: "/one" });
    const workspace = harness.addWorkspace({ id: "one", path: "/one", title: "One", status: "active" });

    await expect(
      harness.tool("workspace_list").execute({}, { agent: caller }),
    ).resolves.toContain("one [active] [0 sessions] - One - /one");
    await expect(
      harness.tool("workspace_rename").execute(
        { workspace_id: "one", title: " Renamed " },
        { agent: caller },
      ),
    ).resolves.toBe("Renamed workspace one to Renamed.");
    expect(workspace.title).toBe("Renamed");
    await expect(
      harness.tool("workspace_remove").execute({ workspace_id: "one" }, { agent: caller }),
    ).resolves.toContain("Directory and session logs were retained");
    expect(harness.workspaces.has("one")).toBe(false);
  });

  it("archives only completed sessions when explicitly enabled", async () => {
    const harness = createHarness({ allowArchive: true });
    const caller = harness.addAgent({ id: "parent", cwd: "/one" });
    harness.persisted.push({ id: "done" as never, createdAt: 1 });

    await expect(
      harness.tool("session_archive").execute({ session_id: "parent" }, { agent: caller }),
    ).rejects.toThrow(/cannot archive itself/);
    harness.addAgent({ id: "done", status: "running" });
    await expect(
      harness.tool("session_archive").execute({ session_id: "done" }, { agent: caller }),
    ).rejects.toThrow(/stop the target/);
    harness.agents.delete("done");
    await expect(
      harness.tool("session_archive").execute({ session_id: "done" }, { agent: caller }),
    ).resolves.toBe("Archived session done.");
    expect(harness.ctx.workspaceRegistry.archiveSession).toHaveBeenCalledWith("done");
  });

  it("rejects unbound callers and blank model arguments", async () => {
    const harness = createHarness();
    harness.addWorkspace({ id: "one", path: "/one", title: "One" });
    const caller = harness.addAgent({ id: "parent", cwd: "/one" });
    await expect(harness.tool("session_list").execute({}, {})).rejects.toThrow(/agent-bound/);
    await expect(
      harness.tool("session_create").execute({ task: "   " }, { agent: caller }),
    ).rejects.toThrow(/task must not be blank/);
  });
});

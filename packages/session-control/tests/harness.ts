import type { Context } from "@deepseek-ai/cordis";
import type { Agent, AgentHandle } from "@deepseek-ai/dsh-agent";
import type { SessionId } from "@deepseek-ai/dsh-session";
import type { ToolDefinition } from "@deepseek-ai/dsh-tools";
import type { Workspace, WorkspaceId } from "@deepseek-ai/dsh-workspace";
import { vi } from "vitest";
import { apply, type Config } from "../src/index.ts";
import type { SessionRelayService } from "../src/relay.ts";

export interface MutableWorkspace extends Workspace {
  title: string;
  sessionIds: SessionId[];
}

export interface TestHarness {
  readonly ctx: Context;
  readonly tools: Map<string, ToolDefinition>;
  readonly workspaces: Map<string, MutableWorkspace>;
  readonly agents: Map<string, Agent>;
  readonly persisted: Array<{ id: SessionId; createdAt: number }>;
  readonly titles: Map<string, string>;
  readonly createdOptions: unknown[];
  readonly resumedOptions: unknown[];
  readonly createdHandles: AgentHandle[];
  readonly routes: Array<{
    path: string;
    handler: (req: unknown, res: unknown) => Promise<void>;
  }>;
  readonly settingsValue: { allowGlobalAccess: boolean };
  readonly effects: Array<() => unknown>;
  readonly relay: SessionRelayService;
  addWorkspace(options: {
    id: string;
    path: string;
    title: string;
    sessionIds?: string[];
    status?: string;
  }): MutableWorkspace;
  addAgent(options: {
    id: string;
    cwd?: string;
    status?: string;
    agentOptions?: unknown;
    events?: readonly unknown[];
  }): Agent;
  tool(name: string): ToolDefinition;
  dispose(): Promise<void>;
}

export function createHarness(config: Config = {}): TestHarness {
  const tools = new Map<string, ToolDefinition>();
  const workspaces = new Map<string, MutableWorkspace>();
  const agents = new Map<string, Agent>();
  const persisted: Array<{ id: SessionId; createdAt: number }> = [];
  const titles = new Map<string, string>();
  const createdOptions: unknown[] = [];
  const resumedOptions: unknown[] = [];
  const createdHandles: AgentHandle[] = [];
  const routes: TestHarness["routes"] = [];
  const effects: Array<() => unknown> = [];
  const services = new Map<string, unknown>();
  const settingsValue = {
    allowGlobalAccess: config.allowGlobalAccess ?? true,
  };

  const makeHandle = (agent: Agent): AgentHandle => {
    const handle = {
      agent,
      dispose: vi.fn(async () => {
        agents.delete(String(agent.id));
      }),
    };
    createdHandles.push(handle);
    return handle;
  };

  let ctx!: Context;
  const harness: TestHarness = {
    get ctx() {
      return ctx;
    },
    tools,
    workspaces,
    agents,
    persisted,
    titles,
    createdOptions,
    resumedOptions,
    createdHandles,
    routes,
    settingsValue,
    effects,
    get relay() {
      const relay = services.get("sessionRelay");
      if (relay === undefined) throw new Error("missing sessionRelay service");
      return relay as SessionRelayService;
    },
    addWorkspace(options) {
      const workspace = {
        id: options.id as WorkspaceId,
        path: options.path,
        title: options.title,
        sessionIds: (options.sessionIds ?? []) as SessionId[],
        attachSession: vi.fn(async (id: SessionId) => {
          workspace.sessionIds.push(id);
        }),
        setTitle: vi.fn(async (title: string) => {
          workspace.title = title;
        }),
        status: vi.fn(async () => options.status ?? "ready"),
      } satisfies MutableWorkspace;
      workspaces.set(options.id, workspace);
      return workspace;
    },
    addAgent(options) {
      const agent = {
        id: options.id as SessionId,
        options: options.agentOptions ?? { model: "test-model" },
        status: options.status ?? "ready",
        session: {
          header: { cwd: options.cwd },
          events: options.events ?? [],
        },
        followup: vi.fn(),
        cancel: vi.fn(),
      } satisfies Agent;
      agents.set(options.id, agent);
      return agent;
    },
    tool(name) {
      const tool = tools.get(name);
      if (tool === undefined) throw new Error(`missing tool ${name}`);
      return tool;
    },
    async dispose() {
      for (const effect of effects.reverse()) await effect();
    },
  };

  ctx = {
    agents: {
      async create(options: unknown) {
        createdOptions.push(options);
        const value = options as {
          sessionId: SessionId;
          meta: { cwd: string };
          agentOptions: unknown;
        };
        const agent = harness.addAgent({
          id: String(value.sessionId),
          cwd: value.meta.cwd,
          status: "running",
          agentOptions: value.agentOptions,
        });
        return makeHandle(agent);
      },
      async resume(options: unknown) {
        resumedOptions.push(options);
        const value = options as {
          resumeSessionId: SessionId;
          agentOptions: unknown;
        };
        const agent = harness.addAgent({
          id: String(value.resumeSessionId),
          status: "ready",
          agentOptions: value.agentOptions,
        });
        return makeHandle(agent);
      },
      get(id: SessionId) {
        return agents.get(String(id));
      },
    },
    sessionPersistence: {
      async list() {
        return persisted;
      },
      async inspect(id: SessionId) {
        return { events: agents.get(String(id))?.session.events ?? [] };
      },
    },
    apiProxy: {
      sessions: {
        async prompt(request: {
          rpcId: string;
          payload: { sessionId: SessionId; content: ReadonlyArray<{ type: "text"; text: string }> };
        }) {
          const target = agents.get(String(request.payload.sessionId));
          if (target === undefined) {
            return { result: { ok: false as const, error: { message: "unknown session" } } };
          }
          const events = target.session.events as unknown[];
          events.push({
            type: "user/message",
            data: { source: { kind: "user", rpcId: request.rpcId }, content: request.payload.content },
          });
          target.followup({ content: request.payload.content, source: { kind: "user", rpcId: request.rpcId } });
          return { result: { ok: true as const, value: { accepted: true as const } } };
        },
        async list() {
          return {
            result: {
              ok: true as const,
              value: {
                items: [...agents.values()].map(agent => ({
                  sessionId: agent.id,
                  updatedAt: 1,
                  running: agent.status === "running",
                  ...(agent.session.header.cwd === undefined ? {} : { cwd: agent.session.header.cwd }),
                })),
              },
            },
          };
        },
      },
    },
    sessionQuery: {
      async readTitleSnapshots(ids: readonly SessionId[]) {
        return ids.map((id) => {
          const title = titles.get(String(id));
          return title === undefined
            ? { status: "rejected" as const, sessionId: id }
            : {
                status: "fulfilled" as const,
                sessionId: id,
                value: { title: { title } },
              };
        });
      },
    },
    settings: {
      register() {
        return {
          get: () => ({ ...settingsValue }),
          async update(patch: Partial<typeof settingsValue>) {
            Object.assign(settingsValue, patch);
          },
        };
      },
    },
    tools: {
      register(tool: ToolDefinition) {
        tools.set(tool.name, tool);
      },
    },
    webServer: {
      register(route: unknown) {
        routes.push(route as TestHarness["routes"][number]);
        return () => {};
      },
      registerUpgrade() {
        return () => {};
      },
    },
    workspaceRegistry: {
      list: () => [...workspaces.values()],
      get: (id: WorkspaceId) => workspaces.get(String(id)),
      async create(path: string, title?: string) {
        return harness.addWorkspace({
          id: `workspace-${workspaces.size + 1}`,
          path,
          title: title ?? path.split("/").filter(Boolean).at(-1) ?? path,
        });
      },
      async delete(id: WorkspaceId) {
        return workspaces.delete(String(id));
      },
      async resolveByPath(path: string) {
        return [...workspaces.values()].find((workspace) => workspace.path === path);
      },
      archiveSession: vi.fn(async () => {}),
    },
    invariants: {
      register: () => () => {},
    },
    effect(setup: () => unknown) {
      const result = setup();
      if (typeof result === "function") effects.push(result as () => unknown);
    },
    provide(name: string, value: unknown) {
      services.set(name, value);
    },
    get(name: string) {
      return services.get(name);
    },
  } as unknown as Context;

  apply(ctx, config);
  return harness;
}

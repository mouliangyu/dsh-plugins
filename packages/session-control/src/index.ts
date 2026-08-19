/**
 * Model-facing session orchestration tools for DeepSeek Harness.
 *
 * Existing sessions can be managed globally by default. Deployments can
 * restore a caller-workspace authorization boundary through configuration.
 * The plugin does not create remote workers; install a subagent provider
 * separately when a child must run on another host.
 */

import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Agent, AgentHandle } from "@deepseek-ai/dsh-agent";
import type { Context } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import type { SessionId as SessionIdValue } from "@deepseek-ai/dsh-session";
import type {} from "@deepseek-ai/dsh-session-persistence";
import type {} from "@deepseek-ai/dsh-session-query";
import type {
  SettingsNamespace,
  SettingsScope,
} from "@deepseek-ai/dsh-settings";
import type {} from "@deepseek-ai/dsh-settings";
import type {
  ToolDefinition,
  ToolRunContext,
} from "@deepseek-ai/dsh-tools";
import type {} from "@deepseek-ai/dsh-workspace";
import type {
  Workspace,
  WorkspaceId,
} from "@deepseek-ai/dsh-workspace";
import type {} from "@deepseek-ai/dsh-host-webserver";
import {
  LOCAL_AUTHORITY,
  createSessionRelay,
  createSessionRelayService,
  formatSessionAddress,
  latestRelayAddress,
  parseSessionAddress,
} from "./relay.js";

/** Cordis plugin name used by Loader diagnostics. */
export const name = "session_control";

/** Services required by the session-manager tools. */
export const inject = [
  "agents",
  "apiProxy",
  "sessionPersistence",
  "sessionQuery",
  "settings",
  "tools",
  "webServer",
  "workspaceRegistry",
];

/** Deployment-owned bounds for autonomous session orchestration. */
export interface Config {
  /** Manage sessions across every workspace. Defaults to true. */
  allowGlobalAccess?: boolean;
  /** Whether the destructive archive tool is exposed. Defaults to false. */
  allowArchive?: boolean;
  /** Maximum concurrently resident sessions owned by this plugin. Defaults to 12. */
  maxManagedSessions?: number;
}

export const Config: z<Config> = z.object({
  allowGlobalAccess: z.boolean().default(true),
  allowArchive: z.boolean().default(false),
  maxManagedSessions: z.number().step(1).min(1).default(12),
});

interface ResolvedConfig {
  readonly allowGlobalAccess: boolean;
  readonly allowArchive: boolean;
  readonly maxManagedSessions: number;
}

interface CreateArgs {
  readonly task: string;
  readonly workspace_id?: string;
}

interface SessionArgs {
  readonly session_id: string;
}

interface SendArgs extends SessionArgs {
  readonly message: string;
}

interface ReplyArgs {
  readonly message: string;
}

interface WorkspaceIdArgs {
  readonly workspace_id: string;
}

interface WorkspaceCreateArgs {
  readonly path: string;
  readonly title?: string;
}

interface WorkspaceRenameArgs extends WorkspaceIdArgs {
  readonly title: string;
}

const TEXT_OUTPUT = {
  schema: { type: "string" as const },
  render: (_args: unknown, value: string) => [
    { type: "text" as const, text: value },
  ],
};

const SESSION_VISIBILITY =
  "Global access is deployment-configurable. Created sessions remain visible in the normal Web sidebar.";
const SETTINGS_NAMESPACE = "session-control" as SettingsNamespace;
const SETTINGS_ROUTE = "/api/session-control/settings";
const RuntimeSettings = z.object({
  allowGlobalAccess: z.boolean().default(true),
});

type StringParameter = {
  readonly type: "string";
  readonly required?: true;
  readonly description?: string;
};

interface SessionToolOptions<Args> {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, StringParameter>;
  readonly output: typeof TEXT_OUTPUT;
  readonly isConcurrencySafe?: (args: Args) => boolean;
  execute(args: Args, exec: ToolRunContext): Promise<string>;
}

/** Build the small ToolDefinition subset used here without runtime package imports. */
function defineSessionTool<Args>(
  options: SessionToolOptions<Args>,
): ToolDefinition {
  const required = Object.entries(options.parameters)
    .filter(([, value]) => value.required)
    .map(([key]) => key);
  return {
    name: options.name,
    description: options.description,
    parameters: {
      type: "object",
      properties: Object.fromEntries(
        Object.entries(options.parameters).map(([key, value]) => [
          key,
          {
            type: value.type,
            ...(value.description === undefined
              ? {}
              : { description: value.description }),
          },
        ]),
      ),
      ...(required.length === 0 ? {} : { required }),
    },
    output: options.output,
    ...(options.isConcurrencySafe === undefined
      ? {}
      : {
          isConcurrencySafe: (args: unknown) =>
            options.isConcurrencySafe!(args as Args),
        }),
    execute: (args: unknown, exec: ToolRunContext) =>
      options.execute(args as Args, exec),
  };
}

function sessionId(value: string): SessionIdValue {
  return value as SessionIdValue;
}

function workspaceId(value: string): WorkspaceId {
  return value as WorkspaceId;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function createCoordinatorMessage(content: string, senderSessionId: SessionIdValue) {
  return deepFreeze({
    id: randomUUID(),
    role: "user" as const,
    content: [{ type: "text" as const, text: content }],
    source: {
      kind: "coordinator" as const,
      form: "relay" as const,
      senderSessionId,
    },
  });
}

/** Register create, list, send, stop, and optional archive tools. */
export function apply(ctx: Context, config: Config = {}): void {
  const resolved = resolveConfig(config);
  const handles = new Map<SessionIdValue, AgentHandle>();
  const relay = createSessionRelayService(ctx);
  ctx.provide("sessionRelay", relay);
  const settings = ctx.settings.register(SETTINGS_NAMESPACE, RuntimeSettings, {
    base: { allowGlobalAccess: resolved.allowGlobalAccess },
  });
  const globalAccessEnabled = () => settings.get().allowGlobalAccess;

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: "exact",
        path: SETTINGS_ROUTE,
        handler: (req: IncomingMessage, res: ServerResponse) =>
          handleSettingsRequest(req, res, settings),
      }),
    "session_control.settingsRoute",
  );

  ctx.effect(
    () => () =>
      Promise.all([...handles.values()].map((handle) => handle.dispose())),
    "session_control.dispose",
  );

  ctx.tools.register(
    defineSessionTool<CreateArgs>({
      name: "session_create",
      description: `Create and start a related session in the caller's current workspace. ${SESSION_VISIBILITY}`,
      parameters: {
        task: {
          type: "string",
          required: true,
          description: "Standalone task for the new session.",
        },
        workspace_id: {
          type: "string",
          description:
            "Optional workspace id from workspace_list. Defaults to the caller's workspace.",
        },
      },
      output: TEXT_OUTPUT,
      async execute(args: CreateArgs, exec: ToolRunContext): Promise<string> {
        const parent = requireAgent(exec);
        const workspace = await resolveCreationWorkspace(
          ctx,
          parent,
          args.workspace_id,
          globalAccessEnabled(),
        );
        if (handles.size >= resolved.maxManagedSessions) {
          throw new Error(
            `session_control: managed-session limit (${resolved.maxManagedSessions}) reached`,
          );
        }
        const task = nonBlank("task", args.task);
        const childSessionId = sessionId(randomUUID());
        const handle = await ctx.agents.create({
          sessionId: childSessionId,
          meta: {
            version: 0,
            id: childSessionId,
            createdAt: Date.now(),
            cwd: workspace.path,
            parentSession: parent.id,
          },
          agentOptions: parent.options,
        });
        try {
          await workspace.attachSession(childSessionId);
          handle.agent.followup(createCoordinatorMessage(task, parent.id));
          handles.set(childSessionId, handle);
        } catch (error) {
          await handle.dispose();
          throw error;
        }
        return `Created and started session ${String(childSessionId)}.`;
      },
    }),
  );

  ctx.tools.register(
    defineSessionTool<Record<string, never>>({
      name: "session_list",
      description:
        "List accessible persisted sessions across workspaces, including location and live status.",
      parameters: {},
      output: TEXT_OUTPUT,
      isConcurrencySafe: () => true,
      async execute(
        _args: Record<string, never>,
        exec: ToolRunContext,
      ): Promise<string> {
        const caller = requireAgent(exec);
        const entries = globalAccessEnabled()
          ? await globalSessionEntries(ctx)
          : await workspaceSessionEntries(ctx, caller);
        const local = entries.length === 0 ? "" : await formatSessionEntries(ctx, entries);
        const remoteEntries = globalAccessEnabled() ? await relay.listSessions() : [];
        const remote = remoteEntries.map(entry =>
          `${entry.sessionId} [${entry.running ? "running" : "ready"}] [remote]${entry.cwd === undefined ? "" : ` - ${entry.cwd}`}`,
        ).join("\n");
        return [local, remote].filter(Boolean).join("\n") || "(no sessions)";
      },
    }),
  );

  ctx.tools.register(
    defineSessionTool<Record<string, never>>({
      name: "workspace_list",
      description:
        "List accessible DSH workspaces with stable ids, paths, status, and session counts.",
      parameters: {},
      output: TEXT_OUTPUT,
      isConcurrencySafe: () => true,
      async execute(
        _args: Record<string, never>,
        exec: ToolRunContext,
      ): Promise<string> {
        const caller = requireAgent(exec);
        const workspaces = globalAccessEnabled()
          ? ctx.workspaceRegistry.list()
          : [await requireCallerWorkspace(ctx, caller)];
        if (workspaces.length === 0) return "(no workspaces)";
        const statuses = await Promise.all(
          workspaces.map((workspace) => workspace.status()),
        );
        return workspaces
          .map(
            (workspace, index) =>
              `${String(workspace.id)} [${statuses[index]}] [${workspace.sessionIds.length} sessions] - ${workspace.title} - ${workspace.path}`,
          )
          .join("\n");
      },
    }),
  );

  ctx.tools.register(
    defineSessionTool<WorkspaceCreateArgs>({
      name: "workspace_create",
      description:
        "Register an existing directory as a DSH workspace. Requires global access and never creates the directory itself.",
      parameters: {
        path: {
          type: "string",
          required: true,
          description: "Existing directory path to register.",
        },
        title: {
          type: "string",
          description: "Optional display title. Defaults to the directory name.",
        },
      },
      output: TEXT_OUTPUT,
      async execute(args: WorkspaceCreateArgs): Promise<string> {
        requireGlobalAccess(globalAccessEnabled());
        const workspace = await ctx.workspaceRegistry.create(
          nonBlank("path", args.path),
          args.title === undefined ? undefined : nonBlank("title", args.title),
        );
        return `Registered workspace ${String(workspace.id)} - ${workspace.title} - ${workspace.path}`;
      },
    }),
  );

  ctx.tools.register(
    defineSessionTool<WorkspaceRenameArgs>({
      name: "workspace_rename",
      description: "Rename an accessible DSH workspace without moving its directory.",
      parameters: {
        workspace_id: {
          type: "string",
          required: true,
          description: "Workspace id returned by workspace_list.",
        },
        title: {
          type: "string",
          required: true,
          description: "New display title.",
        },
      },
      output: TEXT_OUTPUT,
      async execute(
        args: WorkspaceRenameArgs,
        exec: ToolRunContext,
      ): Promise<string> {
        const workspace = await requireManagedWorkspace(
          ctx,
          requireAgent(exec),
          workspaceId(args.workspace_id),
          globalAccessEnabled(),
        );
        const title = nonBlank("title", args.title);
        await workspace.setTitle(title);
        return `Renamed workspace ${String(workspace.id)} to ${title}.`;
      },
    }),
  );

  ctx.tools.register(
    defineSessionTool<WorkspaceIdArgs>({
      name: "workspace_remove",
      description:
        "Remove an accessible workspace registration. The directory and all session logs are retained.",
      parameters: {
        workspace_id: {
          type: "string",
          required: true,
          description: "Workspace id returned by workspace_list.",
        },
      },
      output: TEXT_OUTPUT,
      async execute(
        args: WorkspaceIdArgs,
        exec: ToolRunContext,
      ): Promise<string> {
        const target = workspaceId(args.workspace_id);
        await requireManagedWorkspace(
          ctx,
          requireAgent(exec),
          target,
          globalAccessEnabled(),
        );
        const removed = await ctx.workspaceRegistry.delete(target);
        return removed
          ? `Removed workspace registration ${String(target)}. Directory and session logs were retained.`
          : `Workspace ${String(target)} was already absent.`;
      },
    }),
  );

  ctx.tools.register(
    defineSessionTool<WorkspaceIdArgs>({
      name: "workspace_sessions",
      description: "List sessions belonging to an accessible workspace.",
      parameters: {
        workspace_id: {
          type: "string",
          required: true,
          description: "Workspace id returned by workspace_list.",
        },
      },
      output: TEXT_OUTPUT,
      isConcurrencySafe: () => true,
      async execute(
        args: WorkspaceIdArgs,
        exec: ToolRunContext,
      ): Promise<string> {
        const workspace = await requireManagedWorkspace(
          ctx,
          requireAgent(exec),
          workspaceId(args.workspace_id),
          globalAccessEnabled(),
        );
        if (workspace.sessionIds.length === 0) return "(no sessions)";
        return formatSessionEntries(
          ctx,
          workspace.sessionIds.map((id) => ({
            id,
            location: `workspace:${workspace.title}`,
          })),
        );
      },
    }),
  );

  ctx.tools.register(
    defineSessionTool<SendArgs>({
      name: "session_send",
      description: `Queue a new task or follow-up in an accessible session. ${SESSION_VISIBILITY}`,
      parameters: {
        session_id: {
          type: "string",
          required: true,
          description: "Session id returned by session_list or session_create.",
        },
        message: {
          type: "string",
          required: true,
          description: "Follow-up work for the target session.",
        },
      },
      output: TEXT_OUTPUT,
      async execute(args: SendArgs, exec: ToolRunContext): Promise<string> {
        const parent = requireAgent(exec);
        const address = parseSessionAddress(nonBlank("session_id", args.session_id));
        if (address.authorityId !== LOCAL_AUTHORITY) {
          requireGlobalAccess(globalAccessEnabled());
          await relay.send(createSessionRelay(
            String(parent.id),
            address,
            nonBlank("message", args.message),
          ));
          return `Queued a follow-up for session ${formatSessionAddress(address)}.`;
        }
        const target = await requireManagedSession(
          ctx,
          parent,
          sessionId(address.sessionId),
          globalAccessEnabled(),
        );
        const handle = await ensureResident(ctx, handles, target, parent);
        handle.agent.followup(
          createCoordinatorMessage(
            nonBlank("message", args.message),
            parent.id,
          ),
        );
        return `Queued a follow-up for session ${String(target)}.`;
      },
    }),
  );

  ctx.tools.register(
    defineSessionTool<ReplyArgs>({
      name: "session_reply",
      description:
        "Reply to the most recent message relayed by another accessible session. The reply is queued durably and can resume a cold session.",
      parameters: {
        message: {
          type: "string",
          required: true,
          description:
            "Text reply for the session that most recently sent a relay message.",
        },
      },
      output: TEXT_OUTPUT,
      async execute(args: ReplyArgs, exec: ToolRunContext): Promise<string> {
        const parent = requireAgent(exec);
        const address = latestRelayAddress(parent);
        if (address.authorityId !== LOCAL_AUTHORITY) {
          requireGlobalAccess(globalAccessEnabled());
          await relay.send(createSessionRelay(
            String(parent.id),
            address,
            nonBlank("message", args.message),
          ));
          return `Queued a reply for session ${formatSessionAddress(address)}.`;
        }
        const target = sessionId(address.sessionId);
        await requireManagedSession(
          ctx,
          parent,
          target,
          globalAccessEnabled(),
        );
        const handle = await ensureResident(ctx, handles, target, parent);
        handle.agent.followup(
          createCoordinatorMessage(nonBlank("message", args.message), parent.id),
        );
        return `Queued a reply for session ${String(target)}.`;
      },
    }),
  );

  ctx.tools.register(
    defineSessionTool<SessionArgs>({
      name: "session_stop",
      description: `Stop the current turn of an accessible live session while preserving its queued messages. ${SESSION_VISIBILITY}`,
      parameters: {
        session_id: {
          type: "string",
          required: true,
          description: "Live session id returned by session_list.",
        },
      },
      output: TEXT_OUTPUT,
      async execute(args: SessionArgs, exec: ToolRunContext): Promise<string> {
        const parent = requireAgent(exec);
        const target = await requireManagedSession(
          ctx,
          parent,
          sessionId(args.session_id),
          globalAccessEnabled(),
        );
        if (target === parent.id)
          throw new Error("session_control: a session cannot stop itself");
        const agent = ctx.agents.get(target);
        if (agent === undefined || agent.status !== "running")
          return `Session ${String(target)} is not running.`;
        agent.cancel({ kind: "user" }, { keepInbox: true });
        return `Stop requested for session ${String(target)}.`;
      },
    }),
  );

  if (resolved.allowArchive) {
    ctx.tools.register(
      defineSessionTool<SessionArgs>({
        name: "session_archive",
        description: `Archive an accessible completed session. Use only after the user explicitly asks to archive it. ${SESSION_VISIBILITY}`,
        parameters: {
          session_id: {
            type: "string",
            required: true,
            description: "Completed session id returned by session_list.",
          },
        },
        output: TEXT_OUTPUT,
        async execute(
          args: SessionArgs,
          exec: ToolRunContext,
        ): Promise<string> {
          const parent = requireAgent(exec);
          const target = await requireManagedSession(
            ctx,
            parent,
            sessionId(args.session_id),
            globalAccessEnabled(),
          );
          if (target === parent.id)
            throw new Error("session_control: a session cannot archive itself");
          const agent = ctx.agents.get(target);
          if (agent?.status === "running")
            throw new Error(
              "session_control: stop the target before archiving it",
            );
          await ctx.workspaceRegistry.archiveSession(target);
          return `Archived session ${String(target)}.`;
        },
      }),
    );
  }
}

function resolveConfig(config: Config): ResolvedConfig {
  const maxManagedSessions = config.maxManagedSessions ?? 12;
  if (!Number.isSafeInteger(maxManagedSessions) || maxManagedSessions < 1) {
    throw new TypeError(
      "session_control: maxManagedSessions must be a positive safe integer",
    );
  }
  return {
    allowGlobalAccess: config.allowGlobalAccess ?? true,
    allowArchive: config.allowArchive ?? false,
    maxManagedSessions,
  };
}

interface SessionEntry {
  readonly id: SessionIdValue;
  readonly location: string;
}

async function formatSessionEntries(
  ctx: Context,
  entries: readonly SessionEntry[],
): Promise<string> {
  const titles = await ctx.sessionQuery.readTitleSnapshots(
    entries.map((entry) => entry.id),
  );
  const locations = new Map(entries.map((entry) => [entry.id, entry.location]));
  return titles
    .map((result) => {
      const id = result.sessionId;
      const live = ctx.agents.get(id);
      const title =
        result.status === "fulfilled"
          ? (result.value.title?.title ?? "untitled")
          : "unavailable title";
      return `${String(id)} [${live?.status ?? "ready"}] [${locations.get(id) ?? "unassigned"}] - ${title}`;
    })
    .join("\n");
}

async function globalSessionEntries(ctx: Context): Promise<SessionEntry[]> {
  const headers = await ctx.sessionPersistence.list();
  const locations = new Map<SessionIdValue, string>();
  for (const workspace of ctx.workspaceRegistry.list()) {
    for (const id of workspace.sessionIds) {
      locations.set(id, `workspace:${workspace.title}`);
    }
  }
  return [...headers]
    .sort((left, right) => right.createdAt - left.createdAt)
    .map((header) => ({
      id: header.id,
      location: locations.get(header.id) ?? "unassigned",
    }));
}

async function workspaceSessionEntries(
  ctx: Context,
  agent: Agent,
): Promise<SessionEntry[]> {
  const workspace = await requireCallerWorkspace(ctx, agent);
  return workspace.sessionIds.map((id) => ({
    id,
    location: `workspace:${workspace.title}`,
  }));
}

function requireGlobalAccess(allowGlobalAccess: boolean): void {
  if (!allowGlobalAccess) {
    throw new Error(
      "session_control: this operation requires global access; enable it in Settings > Plugins",
    );
  }
}

async function requireManagedWorkspace(
  ctx: Context,
  agent: Agent,
  target: WorkspaceId,
  allowGlobalAccess: boolean,
): Promise<Workspace> {
  const workspace = ctx.workspaceRegistry.get(target);
  if (workspace === undefined) {
    throw new Error(`session_control: unknown workspace ${String(target)}`);
  }
  if (allowGlobalAccess) return workspace;
  const callerWorkspace = await requireCallerWorkspace(ctx, agent);
  if (workspace.id !== callerWorkspace.id) {
    throw new Error(
      `session_control: workspace ${String(target)} is outside the caller workspace`,
    );
  }
  return workspace;
}

async function resolveCreationWorkspace(
  ctx: Context,
  agent: Agent,
  requestedId: string | undefined,
  allowGlobalAccess: boolean,
): Promise<Workspace> {
  if (requestedId === undefined) return requireCallerWorkspace(ctx, agent);
  return requireManagedWorkspace(
    ctx,
    agent,
    workspaceId(nonBlank("workspace_id", requestedId)),
    allowGlobalAccess,
  );
}

function sendJson(
  res: ServerResponse,
  status: number,
  value: unknown,
): void {
  res.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(value));
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 16_384) throw new Error("request body is too large");
    chunks.push(buffer);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text.length === 0 ? {} : JSON.parse(text);
}

async function handleSettingsRequest(
  req: IncomingMessage,
  res: ServerResponse,
  settings: SettingsScope<{ allowGlobalAccess: boolean }>,
): Promise<void> {
  if (req.method === "GET") {
    sendJson(res, 200, settings.get());
    return;
  }
  if (req.method !== "PUT") {
    res.setHeader("allow", "GET, PUT");
    sendJson(res, 405, { error: "method not allowed" });
    return;
  }
  const fetchSite = req.headers["sec-fetch-site"];
  if (fetchSite !== undefined && fetchSite !== "same-origin") {
    sendJson(res, 403, { error: "cross-origin settings writes are forbidden" });
    return;
  }
  try {
    const body = await readJsonBody(req);
    if (
      body === null ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      typeof (body as { allowGlobalAccess?: unknown }).allowGlobalAccess !==
        "boolean"
    ) {
      sendJson(res, 400, { error: "allowGlobalAccess must be boolean" });
      return;
    }
    await settings.update({
      allowGlobalAccess: (body as { allowGlobalAccess: boolean })
        .allowGlobalAccess,
    });
    sendJson(res, 200, settings.get());
  } catch (error) {
    sendJson(res, 400, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function requireAgent(exec: ToolRunContext): Agent {
  if (exec.agent === undefined)
    throw new Error(
      "session_control: these tools require an agent-bound caller",
    );
  return exec.agent;
}

function nonBlank(name: string, value: string): string {
  const normalized = value.trim();
  if (normalized.length === 0)
    throw new Error(`session_control: ${name} must not be blank`);
  return normalized;
}

async function requireCallerWorkspace(ctx: Context, agent: Agent) {
  const cwd = agent.session.header.cwd;
  if (cwd === undefined)
    throw new Error("session_control: caller has no workspace directory");
  const workspace = await ctx.workspaceRegistry.resolveByPath(cwd);
  if (workspace === undefined)
    throw new Error(`session_control: no registered workspace owns ${cwd}`);
  return workspace;
}

async function requireWorkspaceSession(
  ctx: Context,
  agent: Agent,
  target: SessionIdValue,
): Promise<SessionIdValue> {
  const workspace = await requireCallerWorkspace(ctx, agent);
  if (!workspace.sessionIds.includes(target)) {
    throw new Error(
      `session_control: session ${String(target)} is outside the caller workspace`,
    );
  }
  return target;
}

async function requireManagedSession(
  ctx: Context,
  agent: Agent,
  target: SessionIdValue,
  allowGlobalAccess: boolean,
): Promise<SessionIdValue> {
  if (!allowGlobalAccess) return requireWorkspaceSession(ctx, agent, target);
  if (ctx.agents.get(target) !== undefined) return target;
  const headers = await ctx.sessionPersistence.list();
  if (!headers.some((header) => header.id === target)) {
    throw new Error(`session_control: unknown session ${String(target)}`);
  }
  return target;
}

async function ensureResident(
  ctx: Context,
  handles: Map<SessionIdValue, AgentHandle>,
  sessionId: SessionIdValue,
  caller: Agent,
): Promise<AgentHandle> {
  const owned = handles.get(sessionId);
  if (owned !== undefined) return owned;
  const existing = ctx.agents.get(sessionId);
  if (existing !== undefined)
    return { agent: existing, dispose: async () => {} };
  const resumed = await ctx.agents.resume({
    resumeSessionId: sessionId,
    agentOptions: caller.options,
  });
  handles.set(sessionId, resumed);
  return resumed;
}

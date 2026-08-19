declare module "@deepseek-ai/dsh-session" {
  export type SessionId = string & { readonly __sessionId: unique symbol };
}

declare module "@deepseek-ai/dsh-agent" {
  import type { SessionId } from "@deepseek-ai/dsh-session";

  export interface Agent {
    readonly id: SessionId;
    readonly options: unknown;
    readonly status: string;
    readonly session: {
      readonly header: { readonly cwd?: string };
      readonly events: readonly unknown[];
    };
    followup(message: unknown): void;
    cancel(reason: unknown, options: { keepInbox: boolean }): void;
  }

  export interface AgentHandle {
    readonly agent: Agent;
    dispose(): Promise<void>;
  }
}

declare module "@deepseek-ai/dsh-workspace" {
  import type { SessionId } from "@deepseek-ai/dsh-session";

  export type WorkspaceId = string & { readonly __workspaceId: unique symbol };

  export interface Workspace {
    readonly id: WorkspaceId;
    readonly path: string;
    readonly title: string;
    readonly sessionIds: readonly SessionId[];
    attachSession(id: SessionId): Promise<void>;
    setTitle(title: string): Promise<void>;
    status(): Promise<string>;
  }
}

declare module "@deepseek-ai/dsh-settings" {
  export type SettingsNamespace = string & {
    readonly __settingsNamespace: unique symbol;
  };

  export interface SettingsScope<T> {
    get(): T;
    update(patch: Partial<T>): Promise<void>;
  }
}

declare module "@deepseek-ai/dsh-tools" {
  import type { Agent } from "@deepseek-ai/dsh-agent";

  export interface ToolRunContext {
    readonly agent?: Agent;
  }

  export interface ToolDefinition {
    readonly name: string;
    readonly description: string;
    readonly parameters: unknown;
    readonly output: unknown;
    readonly isConcurrencySafe?: (args: unknown) => boolean;
    execute(args: unknown, exec: ToolRunContext): Promise<unknown>;
  }
}

declare module "@deepseek-ai/dsh-invariants" {
  export type InvariantInstaller = () => void;
}

declare module "@deepseek-ai/cordis" {
  import type { Agent, AgentHandle } from "@deepseek-ai/dsh-agent";
  import type { SessionId } from "@deepseek-ai/dsh-session";
  import type {
    SettingsNamespace,
    SettingsScope,
  } from "@deepseek-ai/dsh-settings";
  import type { ToolDefinition } from "@deepseek-ai/dsh-tools";
  import type {
    Workspace,
    WorkspaceId,
  } from "@deepseek-ai/dsh-workspace";

  interface SessionHeader {
    readonly id: SessionId;
    readonly createdAt: number;
  }

  interface SessionInspection {
    readonly events: readonly unknown[];
  }

  export interface Context {
    readonly agents: {
      create(options: unknown): Promise<AgentHandle>;
      resume(options: unknown): Promise<AgentHandle>;
      get(id: SessionId): Agent | undefined;
    };
    readonly sessionPersistence: {
      list(): Promise<readonly SessionHeader[]>;
      inspect(id: SessionId): Promise<SessionInspection>;
    };
    readonly apiProxy: {
      readonly sessions: {
        prompt(request: {
          readonly rpcId: string;
          readonly payload: {
            readonly sessionId: SessionId;
            readonly mode: "queue";
            readonly content: ReadonlyArray<{ readonly type: "text"; readonly text: string }>;
          };
        }): Promise<
          | { readonly result: { readonly ok: true; readonly value: { readonly accepted: true } } }
          | { readonly result: { readonly ok: false; readonly error: { readonly message: string } } }
        >;
        list(request: {
          readonly rpcId: string;
          readonly payload: Record<string, never>;
        }): Promise<
          | {
              readonly result: {
                readonly ok: true;
                readonly value: {
                  readonly items: ReadonlyArray<{
                    readonly sessionId: SessionId;
                    readonly updatedAt: number;
                    readonly running: boolean;
                    readonly cwd?: string;
                  }>;
                };
              };
            }
          | { readonly result: { readonly ok: false; readonly error: { readonly message: string } } }
        >;
      };
    };
    readonly sessionQuery: {
      readTitleSnapshots(ids: readonly SessionId[]): Promise<
        ReadonlyArray<
          | {
              readonly status: "fulfilled";
              readonly sessionId: SessionId;
              readonly value: { readonly title?: { readonly title: string } };
            }
          | {
              readonly status: "rejected";
              readonly sessionId: SessionId;
            }
        >
      >;
    };
    readonly settings: {
      register<T>(
        namespace: SettingsNamespace,
        schema: unknown,
        options: { base: Partial<T> },
      ): SettingsScope<T>;
    };
    readonly tools: { register(tool: ToolDefinition): void };
    readonly webServer: {
      register(route: unknown): () => void;
      registerUpgrade(route: unknown): () => void;
    };
    readonly workspaceRegistry: {
      list(): Workspace[];
      get(id: WorkspaceId): Workspace | undefined;
      create(path: string, title?: string): Promise<Workspace>;
      delete(id: WorkspaceId): Promise<boolean>;
      resolveByPath(path: string): Promise<Workspace | undefined>;
      archiveSession(id: SessionId): Promise<void>;
    };
    readonly invariants: {
      register(packageName: string, install: unknown): () => void;
    };
    effect(
      setup: () => void | (() => void) | Promise<unknown>,
      label?: string,
    ): void;
    provide(name: string, value: unknown): void;
    get(name: string): unknown;
  }
}

declare module "@deepseek-ai/dsh-client-runtime/client" {
  export interface ClientContext {
    readonly slots: {
      inject(name: string, setup: () => unknown): void;
      register(options: unknown, component: unknown): unknown;
    };
  }
}

declare module "@deepseek-ai/dsh-client-ui-settings-plugins/client" {}
declare module "@deepseek-ai/dsh-client-ui-slots" {}
declare module "@deepseek-ai/dsh-session-persistence" {}
declare module "@deepseek-ai/dsh-session-query" {}
declare module "@deepseek-ai/dsh-host-webserver" {}

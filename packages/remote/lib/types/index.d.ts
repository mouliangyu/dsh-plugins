/** Persistent remote top-level projects over a private Unix-domain control socket. @module dsh-remote */
import type { Readable, Writable } from 'node:stream';
import { Context, Service } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import { type ContentBlock } from '@deepseek-ai/dsh-llm';
import { type SessionEvent } from '@deepseek-ai/dsh-session';
declare module '@deepseek-ai/cordis' {
    interface Context {
        remoteProjectHost: RemoteProjectHost;
    }
}
/** One configured or persisted remote project. */
export interface RemoteProjectConfig {
    /** Stable identifier selected by local project references. */
    id: string;
    /** Absolute root directory on the remote host. */
    root: string;
}
/** Host process configuration. */
export interface Config {
    /** Absolute private Unix-socket path served by this remote host. */
    socketPath: string;
    /** Initial project roots used when no persistent registry exists. */
    projects?: RemoteProjectConfig[];
    /** Absolute JSON file updated by remote project-management methods. */
    projectsFile?: string;
    /** Model-provider route for sessions created or resumed by the host. */
    provider?: string;
    /** Model identifier for sessions created or resumed by the host. */
    model?: string;
}
/** Serve persistent remote projects and their root sessions through a private Unix socket. */
export declare class RemoteProjectHost extends Service {
    private readonly config;
    static Config: z<Config>;
    private readonly projects;
    private readonly sessions;
    private readonly connections;
    private projectWrites;
    constructor(ctx: Context, config: Config);
    /** Start the private listener; the host, rather than any SSH connection, owns live session handles. */
    [Service.init](): Promise<void>;
    private attach;
    /** Bind one private JSON-RPC stream; its disposer releases subscriptions without stopping the host. */
    private serve;
    private project;
    private addConfiguredProject;
    private loadProjectRegistry;
    private createProject;
    private queueProjectWrite;
    private persistProjects;
    private create;
    private resume;
    private record;
    private prompt;
    private list;
    private persistence;
    private agentOptions;
}
export default RemoteProjectHost;
/** One remote session event delivered after an explicit subscription. */
export interface RemoteSessionEvent {
    projectId: string;
    sessionId: string;
    event: SessionEvent;
}
/** Thin client for an SSH-bridged remote JSON-RPC stream. */
export declare class RemoteProjectClient {
    private readonly transport;
    private readonly eventListeners;
    /** @param input - bytes read from the SSH command's stdout. @param output - bytes written to its stdin. */
    constructor(input: Readable, output: Writable);
    /**
     * Subscribe to realtime events on this transport.
     * @param listener - callback for durable session events.
     * @returns disposer removing this listener.
     */
    onEvent(listener: (event: RemoteSessionEvent) => void): () => void;
    /**
     * Request remote project inventory and protocol version.
     * @returns the handshake result.
     */
    hello(): Promise<unknown>;
    /**
     * List persisted root sessions belonging to one remote project.
     * @param projectId - remote project id.
     * @returns the wire result.
     */
    list(projectId: string): Promise<unknown>;
    /**
     * Create one root session in a remote project.
     * @param projectId - remote project id.
     * @returns the new session result.
     */
    create(projectId: string): Promise<unknown>;
    /**
     * Create one persistent project on the remote host; duplicate ids reject.
     * @param projectId - stable remote project id.
     * @param projectRoot - absolute directory on the remote host.
     * @returns the stored project record.
     */
    createProject(projectId: string, projectRoot: string): Promise<unknown>;
    /**
     * Resume a stored root session on the remote host.
     * @param projectId - remote project id.
     * @param sessionId - stored root session id.
     * @returns the wire result.
     */
    resume(projectId: string, sessionId: string): Promise<unknown>;
    /**
     * Queue a user message on a remote root session.
     * @param projectId - remote project id.
     * @param sessionId - root session id.
     * @param contentBlocks - user message blocks.
     * @returns the durable message receipt.
     */
    prompt(projectId: string, sessionId: string, contentBlocks: ContentBlock[]): Promise<unknown>;
    /**
     * Cancel active work and queued follow-ups on a remote root session.
     * @param projectId - remote project id.
     * @param sessionId - root session id.
     * @returns the wire result.
     */
    cancel(projectId: string, sessionId: string): Promise<unknown>;
    /**
     * Replay and then stream durable session events from a sequence watermark.
     * @param projectId - remote project id.
     * @param sessionId - root session id.
     * @param fromSeq - first sequence to replay.
     * @returns the subscription receipt.
     */
    subscribe(projectId: string, sessionId: string, fromSeq: number): Promise<unknown>;
    /** Close the SSH transport without stopping the remote host or its sessions. */
    close(): void;
}
//# sourceMappingURL=index.d.ts.map
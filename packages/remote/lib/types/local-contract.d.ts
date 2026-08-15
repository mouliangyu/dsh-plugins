/** Browser-safe contracts for the local dsh-remote management surface. */
/** One SSH target saved in local DSH settings. */
export interface RemoteConnectionConfig {
    /** Stable local identifier. */
    id: string;
    /** OpenSSH host alias or hostname. */
    host: string;
    /** Private Unix socket served by dsh-remote-host on the remote machine. */
    socketPath: string;
}
/** Runtime connection row returned to the browser. */
export interface RemoteConnectionView extends RemoteConnectionConfig {
    /** Whether an SSH bridge is currently attached. */
    connected: boolean;
    /** Most recent bridge failure, absent after a successful handshake. */
    error?: string;
}
/** Remote project advertised by a remote daemon. */
export interface RemoteProjectView {
    id: string;
    root: string;
}
/** Minimal durable session header used by the management UI. */
export interface RemoteSessionView {
    id: string;
    cwd?: string;
    title?: string;
    createdAt?: number;
    updatedAt?: number;
}
/** Current local configuration and bridge state. */
export interface RemoteStateView {
    connections: RemoteConnectionView[];
}
/** Explicit OpenSSH Host alias available to the local user. */
export interface SshHostView {
    alias: string;
}
/** JSON action vocabulary accepted by the local Host plugin. */
export type RemoteAction = {
    action: 'discoverHosts';
} | {
    action: 'bootstrapHost';
    connectionId: string;
} | {
    action: 'createProject';
    connectionId: string;
    projectId: string;
    projectRoot: string;
} | {
    action: 'saveConnection';
    connection: RemoteConnectionConfig;
} | {
    action: 'removeConnection';
    connectionId: string;
} | {
    action: 'connect';
    connectionId: string;
} | {
    action: 'disconnect';
    connectionId: string;
} | {
    action: 'projects';
    connectionId: string;
} | {
    action: 'sessions';
    connectionId: string;
    projectId: string;
} | {
    action: 'createSession';
    connectionId: string;
    projectId: string;
} | {
    action: 'resumeSession';
    connectionId: string;
    projectId: string;
    sessionId: string;
} | {
    action: 'prompt';
    connectionId: string;
    projectId: string;
    sessionId: string;
    text: string;
} | {
    action: 'cancel';
    connectionId: string;
    projectId: string;
    sessionId: string;
};
//# sourceMappingURL=local-contract.d.ts.map
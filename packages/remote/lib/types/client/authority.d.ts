/** Browser coordinator for SSH-backed official DSH authorities. */
import type { AuthorityRegistry } from '@deepseek-ai/dsh-client-connection/client';
import type { RemoteConnectionConfig, RemoteStateView, SshHostView } from '../local-contract.ts';
/** Remote connection settings and core authority registrations. */
export declare class RemoteAuthorityCoordinator {
    private readonly registry;
    private snapshot;
    private readonly listeners;
    private readonly providerDisposers;
    private readonly liveConnections;
    private disposed;
    constructor(registry: AuthorityRegistry);
    getSnapshot: () => RemoteStateView;
    subscribe: (listener: () => void) => (() => void);
    start(): Promise<void>;
    refresh(): Promise<void>;
    discoverHosts(): Promise<SshHostView[]>;
    save(connection: RemoteConnectionConfig): Promise<void>;
    remove(connectionId: string): Promise<void>;
    connect(connectionId: string): Promise<void>;
    disconnect(connectionId: string): Promise<void>;
    dispose(): Promise<void>;
    private reconcile;
}
//# sourceMappingURL=authority.d.ts.map
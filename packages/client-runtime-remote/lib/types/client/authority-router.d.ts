/** Authority-aware routing over official DSH API clients. */
import type { HostFrame, IApiClient, MuxFrame, RpcRequest } from '@deepseek-ai/dsh-api-remotes/client';
import type { AuthorityRegistryLike } from './authority-types.ts';
interface AuthorityRef {
    authorityId: string;
    remoteId: string;
}
/** Encode an authority-owned id for the shared local object model. */
export declare function authorityId(authority: string, remoteId: string): string;
/** Decode a shared id into its authority and wire id. */
export declare function parseAuthorityId(value: string): AuthorityRef | undefined;
/** Return the authority label carried by a shared id. */
export declare function authorityOf(value: string): string | undefined;
/** Official API router with local baseline aggregation and remote id isolation. */
export declare class AuthorityApiRouter {
    private readonly local;
    private readonly registry;
    readonly api: IApiClient;
    private directoryAuthority;
    private readonly rpcAuthorities;
    constructor(local: IApiClient, registry: AuthorityRegistryLike);
    setDirectoryAuthority(authority: string | undefined): void;
    transformMux(authority: string, envelope: RpcRequest<MuxFrame>): RpcRequest<MuxFrame>;
    transformHost(authority: string, envelope: RpcRequest<HostFrame>): RpcRequest<HostFrame>;
    private transformEnvelope;
    private connected;
    private call;
    private aggregate;
}
export {};
//# sourceMappingURL=authority-router.d.ts.map
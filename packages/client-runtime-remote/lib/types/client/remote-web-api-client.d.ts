/** Browser carrier for an official DSH API reached through an SSH forward. */
import type { ApiProxy, HostFrame, MuxFrame, RpcRequest } from '@deepseek-ai/dsh-host-apiproxy/api';
import { AbstractApiClient } from '@deepseek-ai/dsh-host-apiproxy/client';
/**
 * Exact official API carrier for one SSH-forwarded remote Web Host.
 * Unary envelopes use fetch and event envelopes use the official WebSocket
 * downlinks; no remote-specific request or event translation occurs here.
 */
export declare class RemoteWebApiClient extends AbstractApiClient {
    private readonly reconnectDelayMs;
    private readonly base;
    /**
     * @param baseUrl - same-origin path of the SSH-forwarded official Web Host.
     * @param reconnectDelayMs - delay before reopening a lost event downlink.
     */
    constructor(baseUrl: string, reconnectDelayMs?: number);
    protected doFetch(input: URL, init?: RequestInit): Promise<Response>;
    protected openMux(_payload: Parameters<ApiProxy['events']['mux']>[0]['payload'], signal: AbortSignal, onOpen?: () => void): AsyncIterable<RpcRequest<MuxFrame>>;
    protected openHost(_payload: Parameters<ApiProxy['events']['host']>[0]['payload'], signal: AbortSignal, onOpen?: () => void): AsyncIterable<RpcRequest<HostFrame>>;
    private readWebSocket;
    private readWebSocketGeneration;
    private resolveRemote;
}
//# sourceMappingURL=remote-web-api-client.d.ts.map
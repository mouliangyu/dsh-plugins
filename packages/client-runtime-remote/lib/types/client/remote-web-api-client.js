/** Browser carrier for an official DSH API reached through an SSH forward. */
import { AbstractApiClient } from '@deepseek-ai/dsh-host-apiproxy/client';
import { hostFrameSchema, muxFrameSchema } from '@deepseek-ai/dsh-host-apiproxy/api/events.schema';
import { serverRequestSchema } from '@deepseek-ai/dsh-host-apiproxy/api/rpc.schema';
/**
 * Exact official API carrier for one SSH-forwarded remote Web Host.
 * Unary envelopes use fetch and event envelopes use the official WebSocket
 * downlinks; no remote-specific request or event translation occurs here.
 */
export class RemoteWebApiClient extends AbstractApiClient {
    reconnectDelayMs;
    base;
    /**
     * @param baseUrl - same-origin path of the SSH-forwarded official Web Host.
     * @param reconnectDelayMs - delay before reopening a lost event downlink.
     */
    constructor(baseUrl, reconnectDelayMs = 750) {
        super();
        this.reconnectDelayMs = reconnectDelayMs;
        this.base = new URL(baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
    }
    doFetch(input, init) {
        return globalThis.fetch(this.resolveRemote(input.pathname + input.search), init);
    }
    openMux(_payload, signal, onOpen) {
        return this.readWebSocket('/api/events.mux', signal, muxFrameSchema, onOpen);
    }
    openHost(_payload, signal, onOpen) {
        return this.readWebSocket('/api/events.host', signal, hostFrameSchema, onOpen);
    }
    async *readWebSocket(path, signal, schema, onOpen) {
        while (!signal.aborted) {
            yield* this.readWebSocketGeneration(path, signal, schema, onOpen);
            if (!signal.aborted)
                await wait(this.reconnectDelayMs, signal);
        }
    }
    async *readWebSocketGeneration(path, signal, schema, onOpen) {
        const url = this.resolveRemote(path);
        url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        const socket = new WebSocket(url);
        const inbox = [];
        let wake;
        const enqueue = (item) => { inbox.push(item); wake?.(); wake = undefined; };
        const handleMessage = (event) => {
            try {
                if (typeof event.data !== 'string')
                    throw new Error('binary WebSocket frame');
                const full = serverRequestSchema.parse(JSON.parse(event.data));
                this.onEnvelope(full);
                enqueue({ kind: 'frame', envelope: { rpcId: full.rpcId, payload: schema.parse(full.payload) } });
            }
            catch (error) {
                console.error('[dsh-remote] dropping malformed official API frame:', error);
            }
        };
        const handleAbort = () => {
            if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)
                socket.close();
        };
        socket.addEventListener('open', () => { onOpen?.(); });
        socket.addEventListener('message', handleMessage);
        socket.addEventListener('close', () => { enqueue({ kind: 'end' }); }, { once: true });
        socket.addEventListener('error', () => { enqueue({ kind: 'end' }); }, { once: true });
        signal.addEventListener('abort', handleAbort, { once: true });
        if (signal.aborted)
            handleAbort();
        try {
            while (true) {
                while (inbox.length > 0) {
                    const item = inbox.shift();
                    if (item.kind === 'end')
                        return;
                    yield item.envelope;
                }
                await new Promise(resolve => { wake = resolve; });
            }
        }
        finally {
            signal.removeEventListener('abort', handleAbort);
            socket.removeEventListener('message', handleMessage);
            handleAbort();
        }
    }
    resolveRemote(path) {
        return new URL(path.replace(/^\//, ''), this.base);
    }
}
async function wait(ms, signal) {
    await new Promise((resolve) => {
        const timer = setTimeout(done, ms);
        signal.addEventListener('abort', done, { once: true });
        function done() { clearTimeout(timer); signal.removeEventListener('abort', done); resolve(); }
    });
}
//# sourceMappingURL=remote-web-api-client.js.map
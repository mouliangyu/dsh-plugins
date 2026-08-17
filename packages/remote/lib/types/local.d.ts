/** Local SSH authority manager and transparent official-API proxy. */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import { WebSocket } from 'ws';
import type { RawData } from 'ws';
import type { RemoteConnectionConfig } from './local-contract.ts';
export type * from './local-contract.ts';
export declare const name = "dsh-remote";
export declare const inject: string[];
/** Local plugin composition defaults. */
export interface LocalConfig {
    connections?: RemoteConnectionConfig[];
    /** OpenSSH connection timeout applied to start and forwarding operations. */
    sshConnectTimeoutSeconds?: number;
    /** Start saved authorities in the background when the plugin loads. */
    autoConnect?: boolean;
}
export declare const Config: z<LocalConfig>;
/** Mount the local connection registry and transparent proxy routes. */
export declare function apply(ctx: Context, config?: LocalConfig): void;
/** Forward one WebSocket message without changing its text/binary opcode. */
export declare function relayWebSocketMessage(target: Pick<WebSocket, 'readyState' | 'send'>, data: RawData, isBinary: boolean): void;
//# sourceMappingURL=local.d.ts.map
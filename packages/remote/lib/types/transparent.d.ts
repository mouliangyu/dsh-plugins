/** SSH transport for an official remote DSH Web/API authority. */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
/** One SSH-forwarded official DSH API endpoint. */
export interface RemoteApiForward {
    readonly localPort: number;
    readonly remotePort: number;
    readonly process: ChildProcessWithoutNullStreams;
    close(): Promise<void>;
}
/** Options for opening a loopback-only SSH port forward. */
export interface RemoteApiForwardOptions {
    /** OpenSSH alias or hostname; authentication remains OpenSSH-owned. */
    host: string;
    /** Official DSH Web/API port on the remote loopback interface. */
    remotePort: number;
    /** Optional local port; an available loopback port is selected when absent. */
    localPort?: number;
    /** SSH connection deadline in seconds. */
    connectTimeoutSeconds?: number;
    /** Injectable process launcher for tests. */
    spawn?: typeof spawn;
}
/**
 * Open `127.0.0.1:<localPort> -> remote loopback:<remotePort>` through OpenSSH.
 * No application payload is decoded or translated by this transport.
 *
 * @param options - SSH alias and official remote API port.
 * @returns the live forward and its loopback port.
 */
export declare function openRemoteApiForward(options: RemoteApiForwardOptions): Promise<RemoteApiForward>;
//# sourceMappingURL=transparent.d.ts.map
/** Package transfer and user-scoped remote-host bootstrap. */
/** Inputs for one remote DSH Host installation or update. */
export interface RemoteBootstrapOptions {
    /** Absolute private socket path for the remote host. */
    socketPath: string;
    /** npm package specifier for the matching DSH CLI release. */
    dshPackage: string;
    /** Packed `dsh-remote` package bytes. */
    remotePackageArchive: Uint8Array;
}
/**
 * Pack the installed remote plugin for transfer to an SSH target.
 * Source checkouts use pnpm so workspace ranges become publishable versions;
 * registry installations use npm and need no workspace rewriting.
 * @returns the package tarball bytes.
 */
export declare function packRemotePlugin(): Promise<Uint8Array>;
/**
 * Create the shell script that installs and starts a user-scoped remote host.
 * All user-controlled values and package bytes are base64 encoded before they
 * cross the shell parser.
 * @param options - package bytes and remote Host configuration.
 * @returns a POSIX shell script suitable for `ssh <host> sh -s`.
 */
export declare function buildRemoteBootstrapScript(options: RemoteBootstrapOptions): string;
//# sourceMappingURL=bootstrap.d.ts.map
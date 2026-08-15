/** OpenSSH host-alias discovery for the local Web plugin. */
/** Options used to locate a user OpenSSH configuration tree. */
export interface SshHostDiscoveryOptions {
    /** Root user config file. */
    configPath?: string;
    /** Directory used for relative Include paths and tilde expansion. */
    sshDirectory?: string;
}
/**
 * List explicit OpenSSH Host aliases without contacting any remote machine.
 * @param options Configuration paths used for discovery; defaults to the user's `~/.ssh` tree.
 * @returns Sorted aliases that can be selected for an SSH connection.
 */
export declare function discoverSshHostAliases(options?: SshHostDiscoveryOptions): Promise<string[]>;
//# sourceMappingURL=ssh-config.d.ts.map
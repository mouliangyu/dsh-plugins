/** Copy for the dsh-remote settings page. */
export declare const en: {
    readonly nav: "Remote";
    readonly title: "Remote connections";
    readonly add: "Add connection";
    readonly id: "Connection ID";
    readonly host: "SSH host";
    readonly remotePort: "DSH Web port";
    readonly save: "Save";
    readonly cancel: "Cancel";
    readonly connect: "Connect";
    readonly disconnect: "Disconnect";
    readonly refresh: "Refresh connection";
    readonly reconnect: "Reconnect";
    readonly remove: "Delete";
    readonly connected: "Connected";
    readonly disconnected: "Disconnected";
    readonly noConnections: "No remote connections configured.";
    readonly edit: "Edit";
    readonly noSshHosts: "No explicit Host aliases were found in ~/.ssh/config.";
};
/** Translation keys rendered by the remote-project settings page. */
export type RemoteLocaleKey = keyof typeof en;
/** Simplified Chinese copy for the remote-project settings page. */
export declare const zh: {
    [K in RemoteLocaleKey]: string;
};
//# sourceMappingURL=locales.d.ts.map
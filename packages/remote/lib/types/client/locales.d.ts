/** Copy for the dsh-remote settings page. */
export declare const en: {
    readonly nav: "Remote";
    readonly title: "Remote projects";
    readonly add: "Add connection";
    readonly id: "Connection ID";
    readonly host: "SSH host";
    readonly socketPath: "Remote socket path";
    readonly save: "Save";
    readonly cancel: "Cancel";
    readonly connect: "Connect";
    readonly disconnect: "Disconnect";
    readonly remove: "Delete";
    readonly retry: "Retry";
    readonly connected: "Connected";
    readonly disconnected: "Disconnected";
    readonly projects: "Projects";
    readonly sessions: "Sessions";
    readonly newSession: "New session";
    readonly noConnections: "No remote connections configured.";
    readonly noProjects: "The remote host advertised no projects.";
    readonly noSessions: "No sessions in this project.";
    readonly selectProject: "Select a project.";
    readonly selectSession: "Select a session.";
    readonly prompt: "Message";
    readonly send: "Send";
    readonly stop: "Stop";
    readonly events: "Live session events";
    readonly loading: "Loading...";
    readonly connectionFailed: "Connection failed";
    readonly edit: "Edit";
    readonly noSshHosts: "No explicit Host aliases were found in ~/.ssh/config.";
    readonly newProject: "New project";
    readonly projectId: "Project ID";
    readonly projectRoot: "Remote project root";
    readonly manageHost: "Install or update remote Host";
    readonly installingHost: "Installing remote Host";
    readonly createProject: "Create project";
    readonly creatingProject: "Creating...";
};
/** Translation keys rendered by the remote-project settings page. */
export type RemoteLocaleKey = keyof typeof en;
/** Simplified Chinese copy for the remote-project settings page. */
export declare const zh: {
    [K in RemoteLocaleKey]: string;
};
//# sourceMappingURL=locales.d.ts.map
/** Browser-safe contracts for remote DSH authority management. */

/** One SSH target saved in local DSH settings. */
export interface RemoteConnectionConfig {
  /** Stable local authority identifier. */
  id: string
  /** OpenSSH host alias or hostname. */
  host: string
  /** Official DSH Web/API port bound on the remote loopback interface. */
  remotePort: number
}

/** Runtime connection row returned to the browser. */
export interface RemoteConnectionView extends RemoteConnectionConfig {
  /** Whether the SSH forward currently reaches the official remote API. */
  connected: boolean
  /** Same-origin browser path for the forwarded official API. */
  basePath: string
  /** Most recent connection failure, absent after a successful probe. */
  error?: string
}

/** Current local configuration and forward state. */
export interface RemoteStateView { connections: RemoteConnectionView[] }

/** Explicit OpenSSH Host alias available to the local user. */
export interface SshHostView { alias: string }

/** JSON actions accepted by the local management endpoint. */
export type RemoteAction =
  | { action: 'discoverHosts' }
  | { action: 'saveConnection'; connection: RemoteConnectionConfig }
  | { action: 'removeConnection'; connectionId: string }
  | { action: 'connect'; connectionId: string }
  | { action: 'disconnect'; connectionId: string }

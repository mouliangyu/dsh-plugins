/** Copy for the dsh-remote settings page. */

export const en = {
  nav: 'Remote', title: 'Remote connections', add: 'Add connection', id: 'Connection ID', host: 'SSH host',
  remotePort: 'DSH Web port', save: 'Save', cancel: 'Cancel', connect: 'Connect', disconnect: 'Disconnect',
  refresh: 'Refresh connection', reconnect: 'Reconnect', remove: 'Delete', connected: 'Connected', disconnected: 'Disconnected',
  noConnections: 'No remote connections configured.', edit: 'Edit',
  noSshHosts: 'No explicit Host aliases were found in ~/.ssh/config.',
} as const

/** Translation keys rendered by the remote-project settings page. */
export type RemoteLocaleKey = keyof typeof en

/** Simplified Chinese copy for the remote-project settings page. */
export const zh: { [K in RemoteLocaleKey]: string } = {
  nav: '远程', title: '远程连接', add: '添加连接', id: '连接 ID', host: 'SSH 主机', remotePort: 'DSH Web 端口',
  save: '保存', cancel: '取消', connect: '连接', disconnect: '断开', refresh: '刷新连接', reconnect: '重新连接', remove: '删除',
  connected: '已连接', disconnected: '未连接', noConnections: '尚未配置远程连接。', edit: '编辑',
  noSshHosts: '在 ~/.ssh/config 中没有发现明确的 Host alias。',
}

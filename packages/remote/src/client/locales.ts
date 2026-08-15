/** Copy for the dsh-remote settings page. */

export const en = {
  nav: 'Remote', title: 'Remote projects', add: 'Add connection', id: 'Connection ID', host: 'SSH host',
  socketPath: 'Remote socket path', save: 'Save', cancel: 'Cancel', connect: 'Connect', disconnect: 'Disconnect',
  remove: 'Delete', retry: 'Retry', connected: 'Connected', disconnected: 'Disconnected', projects: 'Projects',
  sessions: 'Sessions', newSession: 'New session', noConnections: 'No remote connections configured.',
  noProjects: 'The remote host advertised no projects.', noSessions: 'No sessions in this project.',
  selectProject: 'Select a project.', selectSession: 'Select a session.', prompt: 'Message', send: 'Send', stop: 'Stop',
  events: 'Live session events', loading: 'Loading...', connectionFailed: 'Connection failed', edit: 'Edit',
  noSshHosts: 'No explicit Host aliases were found in ~/.ssh/config.',
  newProject: 'New project', projectId: 'Project ID', projectRoot: 'Remote project root',
  manageHost: 'Install or update remote Host', installingHost: 'Installing remote Host',
  createProject: 'Create project', creatingProject: 'Creating...',
} as const

/** Translation keys rendered by the remote-project settings page. */
export type RemoteLocaleKey = keyof typeof en

/** Simplified Chinese copy for the remote-project settings page. */
export const zh: { [K in RemoteLocaleKey]: string } = {
  nav: '远程', title: '远程项目', add: '添加连接', id: '连接 ID', host: 'SSH 主机', socketPath: '远端 socket 路径',
  save: '保存', cancel: '取消', connect: '连接', disconnect: '断开', remove: '删除', retry: '重试',
  connected: '已连接', disconnected: '未连接', projects: '项目', sessions: '会话', newSession: '新建会话',
  noConnections: '尚未配置远程连接。', noProjects: '远端没有提供项目。', noSessions: '这个项目还没有会话。',
  selectProject: '请选择项目。', selectSession: '请选择会话。', prompt: '消息', send: '发送', stop: '停止',
  events: '实时会话事件', loading: '加载中...', connectionFailed: '连接失败', edit: '编辑',
  noSshHosts: '在 ~/.ssh/config 中没有发现明确的 Host alias。',
  newProject: '新建项目', projectId: '项目 ID', projectRoot: '远端项目路径',
  manageHost: '安装或更新远端 Host', installingHost: '正在安装远端 Host',
  createProject: '创建项目', creatingProject: '正在创建...',
}

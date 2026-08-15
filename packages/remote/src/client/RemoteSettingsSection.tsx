/** Remote connection, project, and root-session management page. */

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  Button, IconDownloadOutline16, IconEditOutline16, IconLoadingOutline16, IconPlusOutline16, IconTrashOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  RemoteConnectionConfig, RemoteConnectionView, RemoteProjectView, RemoteSessionView, RemoteStateView, SshHostView,
} from '../local-contract.ts'
import css from './RemoteSettingsSection.module.css'
import type { RemoteLocaleKey } from './locales.ts'

interface Props { t?: (key: RemoteLocaleKey) => string }
interface Selection { connectionId: string; projectId?: string; sessionId?: string }
interface RemoteEventEnvelope { event: { seq: number; type: string; data?: unknown } }

const API = '/dsh-remote/api'
const EVENTS = '/dsh-remote/events'

async function action<T>(body: object): Promise<T> {
  const response = await fetch(API, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
  const payload = await response.json() as { value?: T; error?: string }
  if (!response.ok || payload.error !== undefined) throw new Error(payload.error ?? `HTTP ${response.status}`)
  return payload.value as T
}

/** Render the complete remote-management page. */
export function RemoteSettingsSection({ t = key => key }: Props): ReactNode {
  const [state, setState] = useState<RemoteStateView>({ connections: [] })
  const [selection, setSelection] = useState<Selection | undefined>()
  const [projects, setProjects] = useState<RemoteProjectView[]>([])
  const [sessions, setSessions] = useState<RemoteSessionView[]>([])
  const [events, setEvents] = useState<RemoteEventEnvelope[]>([])
  const [editing, setEditing] = useState<RemoteConnectionConfig | null>(null)
  const [projectEditing, setProjectEditing] = useState(false)
  const [sshHosts, setSshHosts] = useState<SshHostView[]>([])
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [installingConnectionId, setInstallingConnectionId] = useState<string>()
  const [error, setError] = useState<string>()

  const refreshState = async (): Promise<void> => {
    const response = await fetch(API)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    setState(await response.json() as RemoteStateView)
  }
  useEffect(() => { void refreshState().catch((err: unknown) => { setError(String(err)) }) }, [])

  const selectedConnection = useMemo(
    () => state.connections.find(entry => entry.id === selection?.connectionId),
    [selection?.connectionId, state.connections],
  )

  useEffect(() => {
    if (selection?.connectionId === undefined || selection.projectId === undefined || selection.sessionId === undefined) return
    setEvents([])
    let nextSeq = 0
    const params = new URLSearchParams({
      connectionId: selection.connectionId,
      projectId: selection.projectId,
      sessionId: selection.sessionId,
      fromSeq: String(nextSeq),
    })
    const source = new EventSource(`${EVENTS}?${params.toString()}`)
    source.onmessage = (message) => {
      const event = JSON.parse(String(message.data)) as RemoteEventEnvelope
      nextSeq = Math.max(nextSeq, event.event.seq + 1)
      setEvents(current => [...current, event])
    }
    source.onerror = () => { source.close() }
    return () => { source.close() }
  }, [selection?.connectionId, selection?.projectId, selection?.sessionId])

  const run = async (operation: () => Promise<void>): Promise<void> => {
    setBusy(true); setError(undefined)
    try { await operation() } catch (err) { setError(err instanceof Error ? err.message : String(err)) } finally { setBusy(false) }
  }

  const connect = (connection: RemoteConnectionView): void => {
    setSelection({ connectionId: connection.id })
    setProjects([])
    setSessions([])
    void run(async () => {
      const result = await action<{ projects: RemoteProjectView[] }>({ action: 'connect', connectionId: connection.id })
      setProjects(result.projects)
      await refreshState()
    })
  }

  const addConnection = (): void => { void run(async () => {
    const result = await action<{ hosts: SshHostView[] }>({ action: 'discoverHosts' })
    setSshHosts(result.hosts)
    const host = result.hosts[0]?.alias ?? ''
    const id = suggestId(host)
    setEditing({ id, host, socketPath: `/tmp/dsh-remote-${id}.sock` })
  }) }

  const bootstrapHost = (connection: RemoteConnectionView): void => {
    setInstallingConnectionId(connection.id)
    void run(async () => {
      setSelection({ connectionId: connection.id })
      setSessions([])
      const result = await action<{ projects: RemoteProjectView[] }>({
        action: 'bootstrapHost', connectionId: connection.id,
      })
      setProjects(result.projects)
      await refreshState()
    }).finally(() => { setInstallingConnectionId(undefined) })
  }

  const createProject = (projectId: string, projectRoot: string): void => {
    if (selection === undefined) return
    void run(async () => {
      const result = await action<{ project: RemoteProjectView }>({
        action: 'createProject', connectionId: selection.connectionId, projectId, projectRoot,
      })
      setProjects(current => [...current.filter(project => project.id !== result.project.id), result.project])
      setSessions([])
      setSelection({ connectionId: selection.connectionId, projectId })
      setProjectEditing(false)
    })
  }

  const chooseProject = (project: RemoteProjectView): void => { if (selection === undefined) return; void run(async () => {
    const result = await action<{ sessions: RemoteSessionView[] }>({
      action: 'sessions', connectionId: selection.connectionId, projectId: project.id,
    })
    setSessions(result.sessions)
    setEvents([])
    setSelection({ connectionId: selection.connectionId, projectId: project.id })
  }) }

  const createSession = (): void => { if (selection?.projectId === undefined) return; void run(async () => {
    const result = await action<{ sessionId: string }>({
      action: 'createSession', connectionId: selection.connectionId, projectId: selection.projectId,
    })
    const listed = await action<{ sessions: RemoteSessionView[] }>({
      action: 'sessions', connectionId: selection.connectionId, projectId: selection.projectId,
    })
    setSessions(listed.sessions)
    setSelection({ ...selection, sessionId: result.sessionId })
  }) }

  const submitPrompt = (event: FormEvent): void => {
    event.preventDefault()
    if (selection?.projectId === undefined || selection.sessionId === undefined || prompt.trim() === '') return
    const text = prompt
    setPrompt('')
    void run(async () => { await action({ action: 'prompt', ...selection, text }) })
  }

  return (
    <section className={css.root}>
      <header className={css.header}>
        <h2>{t('title')}</h2>
        <Button variant="outline" icon={<IconPlusOutline16 />} onClick={addConnection}>{t('add')}</Button>
      </header>
      {error !== undefined ? <p className={css.error} role="alert">{error}</p> : null}
      {editing !== null ? <ConnectionForm
        initial={editing}
        hosts={sshHosts}
        busy={busy}
        t={t}
        onCancel={() => { setEditing(null) }}
        onSave={(connection) => { void run(async () => {
          setState(await action<RemoteStateView>({ action: 'saveConnection', connection }))
          setEditing(null)
        }) }}
      /> : null}
      {projectEditing && selection !== undefined ? <ProjectForm
        busy={busy}
        t={t}
        onCancel={() => { setProjectEditing(false) }}
        onSave={createProject}
      /> : null}
      <div className={css.columns}>
        <div className={css.column}>
          <h3>{t('nav')}</h3>
          {state.connections.length === 0 ? <p className={css.empty}>{t('noConnections')}</p> : null}
          {state.connections.map(connection => (
            <div className={css.row} data-selected={selection?.connectionId === connection.id || undefined} key={connection.id}>
              <button className={css.rowMain} type="button" onClick={() => { connect(connection) }}>
                <strong>{connection.id}</strong><span>{connection.host}</span>
                <small>{connection.connected ? t('connected') : t('disconnected')}</small>
              </button>
              <button
                aria-label={installingConnectionId === connection.id ? t('installingHost') : t('manageHost')}
                className={css.iconButton}
                disabled={busy}
                title={installingConnectionId === connection.id ? t('installingHost') : t('manageHost')}
                onClick={() => { bootstrapHost(connection) }}
              >{installingConnectionId === connection.id
                  ? <span className={css.spinning}><IconLoadingOutline16 /></span>
                  : <IconDownloadOutline16 />}</button>
              <button className={css.iconButton} title={t('edit')} onClick={() => { setEditing(connection) }}><IconEditOutline16 /></button>
              <button className={css.iconButton} title={t('remove')} onClick={() => { void run(async () => {
                setState(await action<RemoteStateView>({ action: 'removeConnection', connectionId: connection.id }))
                if (selection?.connectionId === connection.id) setSelection(undefined)
              }) }}><IconTrashOutline16 /></button>
            </div>
          ))}
        </div>
        <div className={css.column}>
          <div className={css.columnTitle}>
            <h3>{t('projects')}</h3>
            {selectedConnection?.connected === true
              ? <Button variant="outline" icon={<IconPlusOutline16 />} onClick={() => { setProjectEditing(true) }}>{t('newProject')}</Button>
              : null}
          </div>
          {selectedConnection !== undefined && projects.length === 0 ? <p className={css.empty}>{t('noProjects')}</p> : null}
          {projects.map(project => (
            <button
              className={css.listButton}
              data-selected={selection?.projectId === project.id || undefined}
              key={project.id}
              onClick={() => { chooseProject(project) }}
            >
              <strong>{project.id}</strong><span>{project.root}</span>
            </button>
          ))}
        </div>
        <div className={css.column}>
          <div className={css.columnTitle}><h3>{t('sessions')}</h3>{selection?.projectId !== undefined ? <Button variant="outline" onClick={createSession}>{t('newSession')}</Button> : null}</div>
          {selection?.projectId !== undefined && sessions.length === 0 ? <p className={css.empty}>{t('noSessions')}</p> : null}
          {sessions.map(session => (
            <button
              className={css.listButton}
              data-selected={selection?.sessionId === session.id || undefined}
              key={session.id}
              onClick={() => { setSelection(current => current === undefined ? current : { ...current, sessionId: session.id }) }}
            >
              <strong>{session.title ?? session.id}</strong><span>{session.cwd}</span>
            </button>
          ))}
        </div>
      </div>
      {selection?.sessionId !== undefined ? (
        <div className={css.sessionPane}>
          <div className={css.events}><h3>{t('events')}</h3>{events.map(({ event }) => <div className={css.event} key={event.seq}><code>{event.seq}</code><strong>{event.type}</strong><pre>{JSON.stringify(event.data ?? {}, null, 2)}</pre></div>)}</div>
          <form className={css.composer} onSubmit={submitPrompt}>
            <textarea aria-label={t('prompt')} value={prompt} onChange={(event) => { setPrompt(event.currentTarget.value) }} />
            <Button variant="primary" type="submit" disabled={busy || prompt.trim() === ''}>{t('send')}</Button>
            <Button variant="outline" type="button" disabled={busy} onClick={() => { void run(async () => { await action({ action: 'cancel', ...selection }) }) }}>{t('stop')}</Button>
          </form>
        </div>
      ) : null}
    </section>
  )
}

function ConnectionForm({ initial, hosts, busy, t, onCancel, onSave }: {
  initial: RemoteConnectionConfig
  hosts: SshHostView[]
  busy: boolean
  t: (key: RemoteLocaleKey) => string
  onCancel: () => void
  onSave: (value: RemoteConnectionConfig) => void
}): ReactNode {
  const [value, setValue] = useState(initial)
  return <form className={css.form} onSubmit={(event) => { event.preventDefault(); onSave(value) }}>
    <label>{t('id')}<input value={value.id} onChange={(event) => { setValue({ ...value, id: event.currentTarget.value }) }} /></label>
    <label>{t('host')}{hosts.length === 0
      ? <><input value={value.host} onChange={(event) => { setValue({ ...value, host: event.currentTarget.value }) }} /><span className={css.hostEmpty}>{t('noSshHosts')}</span></>
      : <select value={value.host} onChange={(event) => {
        const host = event.currentTarget.value
        const previousSuggestedId = suggestId(value.host)
        const nextSuggestedId = suggestId(host)
        setValue(current => ({
          ...current,
          host,
          id: current.id === previousSuggestedId ? nextSuggestedId : current.id,
          socketPath: current.socketPath === `/tmp/dsh-remote-${previousSuggestedId}.sock`
            ? `/tmp/dsh-remote-${nextSuggestedId}.sock`
            : current.socketPath,
        }))
      }}>{hosts.map(host => <option key={host.alias} value={host.alias}>{host.alias}</option>)}</select>}
    </label>
    <label>{t('socketPath')}<input value={value.socketPath} onChange={(event) => { setValue({ ...value, socketPath: event.currentTarget.value }) }} /></label>
    <div className={css.formActions}><Button type="button" onClick={onCancel}>{t('cancel')}</Button><Button variant="primary" type="submit" disabled={busy}>{t('save')}</Button></div>
  </form>
}

function ProjectForm({ busy, t, onCancel, onSave }: {
  busy: boolean
  t: (key: RemoteLocaleKey) => string
  onCancel: () => void
  onSave: (projectId: string, projectRoot: string) => void
}): ReactNode {
  const [projectId, setProjectId] = useState('project')
  const [projectRoot, setProjectRoot] = useState('')
  return <form className={`${css.form} ${css.projectForm}`} onSubmit={(event) => {
    event.preventDefault()
    onSave(projectId, projectRoot)
  }}>
    <label>{t('projectId')}<input value={projectId} onChange={(event) => { setProjectId(event.currentTarget.value) }} /></label>
    <label>{t('projectRoot')}<input
      placeholder="/srv/project"
      value={projectRoot}
      onChange={(event) => { setProjectRoot(event.currentTarget.value) }}
    /></label>
    <div className={css.formActions}>
      <Button type="button" onClick={onCancel}>{t('cancel')}</Button>
      <Button variant="primary" type="submit" disabled={busy || projectId === '' || projectRoot === ''}>
        {busy ? t('creatingProject') : t('createProject')}
      </Button>
    </div>
  </form>
}

function suggestId(host: string): string {
  const normalized = host.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const prefixed = /^[a-z]/.test(normalized) ? normalized : `remote-${normalized}`
  return prefixed.slice(0, 64).replace(/-+$/g, '')
}

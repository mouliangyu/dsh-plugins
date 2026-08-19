/** Remote authority connection settings. */

import { useState, useSyncExternalStore, type ReactNode } from 'react'
import { Button, IconEditOutline16, IconLoadingOutline16, IconPlusOutline16, IconRefreshOutline16, IconTrashOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { RemoteConnectionConfig, SshHostView } from '../local-contract.ts'
import type { RemoteAuthorityCoordinator } from './authority.ts'
import css from './RemoteSettingsSection.module.css'
import type { RemoteLocaleKey } from './locales.ts'

interface Props { coordinator: RemoteAuthorityCoordinator; t?: (key: RemoteLocaleKey) => string }

/** Render SSH authority discovery and lifecycle controls. */
export function RemoteSettingsSection({ coordinator, t = key => key }: Props): ReactNode {
  const state = useSyncExternalStore(coordinator.subscribe, coordinator.getSnapshot)
  const [editing, setEditing] = useState<RemoteConnectionConfig | null>(null)
  const [hosts, setHosts] = useState<SshHostView[]>([])
  const [busyId, setBusyId] = useState<string>()
  const [error, setError] = useState<string>()
  const run = async (id: string, operation: () => Promise<void>): Promise<void> => {
    setBusyId(id); setError(undefined)
    try { await operation() } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { setBusyId(undefined) }
  }
  const add = (): void => { void run('new', async () => {
    const discovered = await coordinator.discoverHosts()
    setHosts(discovered)
    const host = discovered[0]?.alias ?? ''
    setEditing({ id: suggestId(host), host, remotePort: 3090 })
  }) }
  return <section className={css.root}>
    <header className={css.header}><h2>{t('title')}</h2><Button variant="outline" icon={<IconPlusOutline16 />} onClick={add}>{t('add')}</Button></header>
    {error !== undefined ? <p className={css.error} role="alert">{error}</p> : null}
    {editing !== null ? <ConnectionForm initial={editing} hosts={hosts} busy={busyId !== undefined} t={t} onCancel={() => { setEditing(null) }} onSave={(connection) => { void run(connection.id, async () => { await coordinator.save(connection); setEditing(null) }) }} /> : null}
    <div className={css.connectionList}>
      {state.connections.length === 0 ? <p className={css.empty}>{t('noConnections')}</p> : null}
      {state.connections.map(connection => <div className={css.row} key={connection.id}>
        <span className={css.rowMain}>
          <strong>{connection.id}</strong>
          <span>{connection.host}:{connection.remotePort}</span>
          <small>{connection.connected ? t('connected') : connection.error ?? t('disconnected')}</small>
          {connection.connected ? <small>{connection.relayConnected ? t('relayConnected') : connection.relayError ?? t('relayUnavailable')}</small> : null}
        </span>
        <button aria-label={connection.connected ? t('reconnect') : t('connect')} className={css.iconButton} disabled={busyId !== undefined} title={connection.connected ? t('reconnect') : t('connect')} onClick={() => { void run(connection.id, async () => { if (connection.connected) await coordinator.reconnect(connection.id); else await coordinator.connect(connection.id) }) }}>
          {busyId === connection.id ? <span className={css.spinning}><IconLoadingOutline16 /></span> : <IconRefreshOutline16 />}
        </button>
        <button className={css.iconButton} title={t('edit')} onClick={() => { setEditing(connection) }}><IconEditOutline16 /></button>
        <button className={css.iconButton} title={t('remove')} onClick={() => { void run(connection.id, () => coordinator.remove(connection.id)) }}><IconTrashOutline16 /></button>
      </div>)}
    </div>
  </section>
}

function ConnectionForm({ initial, hosts, busy, t, onCancel, onSave }: { initial: RemoteConnectionConfig; hosts: SshHostView[]; busy: boolean; t: (key: RemoteLocaleKey) => string; onCancel: () => void; onSave: (value: RemoteConnectionConfig) => void }): ReactNode {
  const [value, setValue] = useState(initial)
  return <form className={css.form} onSubmit={(event) => { event.preventDefault(); onSave(value) }}>
    <label>{t('id')}<input value={value.id} onChange={(event) => { setValue({ ...value, id: event.currentTarget.value }) }} /></label>
    <label>{t('host')}{hosts.length === 0 ? <><input value={value.host} onChange={(event) => { setValue({ ...value, host: event.currentTarget.value }) }} /><span className={css.hostEmpty}>{t('noSshHosts')}</span></> : <select value={value.host} onChange={(event) => { const host = event.currentTarget.value; const previousId = suggestId(value.host); setValue(current => ({ ...current, host, id: current.id === previousId ? suggestId(host) : current.id })) }}>{hosts.map(host => <option key={host.alias} value={host.alias}>{host.alias}</option>)}</select>}</label>
    <label>{t('remotePort')}<input type="number" min={1} max={65535} value={value.remotePort} onChange={(event) => { setValue({ ...value, remotePort: Number(event.currentTarget.value) }) }} /></label>
    <div className={css.formActions}><Button type="button" onClick={onCancel}>{t('cancel')}</Button><Button variant="primary" type="submit" disabled={busy || value.id === '' || value.host === ''}>{t('save')}</Button></div>
  </form>
}

function suggestId(host: string): string {
  const normalized = host.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const prefixed = /^[a-z]/.test(normalized) ? normalized : `remote-${normalized}`
  return prefixed.slice(0, 64).replace(/-+$/g, '')
}

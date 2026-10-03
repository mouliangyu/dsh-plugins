/**
 * dsh-authority-proxy — host+client carrier for extra dsh authorities.
 *
 * Goal-bound contract (stable across dsh versions):
 *   The browser reaches every authority through THIS host's own origin, under
 *   /authority/<id>/. The client half never talks to an authority directly.
 *
 * Version-bound detail (re-derive per dsh release):
 *   - auth: GET /?token=<launchToken> -> Set-Cookie (authority-bound); every
 *     /api request needs that cookie, a rewritten Host, and same-origin markers.
 *   - client stream mux path (0.1.7: /api/remote.mux) and index injection rows.
 */
import fs from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { WebSocketServer, WebSocket as WsClient } from 'ws'

import { createSupervisor } from './supervisor.js'

export const name = 'authority-proxy'
export const inject = ['webServer', 'connection']

const PREFIX = '/authority'
const ADMIN_PREFIX = '/mhr-admin'
const STREAM_PATH = '/api/remote.mux'
const MODEL_CATALOG_PATH = '/api/session/modelCatalog'
const DIRECTORY_LIST_PATH = '/api/directoryPicker/list'
const DIRECTORY_CREATE_PATH = '/api/directoryPicker/createDirectory'
const WORKSPACE_CREATE_PATH = '/api/workspace/create'
const VIRTUAL_ROOT = '@authority'
const REMOTE_HOSTS_LABEL = '远端主机…'
const SELECT_MODEL_PATH = '/api/session/selectModel'

/** Where runtime-added authorities are persisted; config.store overrides it. */
function resolveStorePath(config) {
  if (typeof config?.store === 'string' && config.store.length > 0) return config.store
  const home = process.env.DSH_HOME ?? path.join(os.homedir(), '.dsh')
  return path.join(home, 'authority-proxy.json')
}

/** Read the persisted runtime registry; a missing or broken file means "empty". */
function readStore(storePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath, 'utf8'))
    return {
      authorities: Array.isArray(parsed?.authorities)
        ? parsed.authorities.filter((entry) => entry !== null && typeof entry === 'object' && typeof entry.id === 'string')
        : [],
      disabled: Array.isArray(parsed?.disabled) ? parsed.disabled.filter((id) => typeof id === 'string') : [],
    }
  } catch { return { authorities: [], disabled: [] } }
}

export function apply(ctx, config) {
  const list = Array.isArray(config?.authorities) ? config.authorities : []
  /**
   * Concrete ssh-config Host aliases (`Host <alias>` blocks, wildcards skipped) so the
   * panel can offer them as a picker instead of asking the operator to type one.
   */
  function sshConfigHosts() {
    try {
      const configPath = path.join(os.homedir(), '.ssh', 'config')
      const text = fs.readFileSync(configPath, 'utf8')
      const hosts = []
      let current = null
      for (const raw of text.split('\n')) {
        const line = raw.trim()
        if (line === '' || line.startsWith('#')) continue
        const match = /^([A-Za-z]+)[\s=]+(.+)$/.exec(line)
        if (match === null) continue
        const key = match[1].toLowerCase()
        const value = match[2].trim()
        if (key === 'host') {
          const aliases = value.split(/\s+/).filter((alias) => !/[*?!]/.test(alias))
          if (aliases.length === 0) { current = null; continue }
          current = { alias: aliases[0], aliases, hostName: undefined, user: undefined, port: undefined }
          hosts.push(current)
        } else if (current !== null) {
          if (key === 'hostname') current.hostName = value
          else if (key === 'user') current.user = value
          else if (key === 'port') current.port = value
        }
      }
      return hosts.sort((a, b) => a.alias.localeCompare(b.alias))
    } catch {
      return []
    }
  }

  /**
   * Suggest a local tunnel port that is neither used by another authority nor bound on this
   * machine, so the add form can prefill it. The remote port defaults to the dsh web default.
   */
  function localPortTaken(port) {
    for (const authority of byId.values()) {
      if (authority.ssh !== undefined && authority.ssh.localPort === port) return true
    }
    return false
  }
  async function suggestLocalPort() {
    for (let port = 3081; port < 3220; port++) {
      if (localPortTaken(port)) continue
      const free = await new Promise((resolve) => {
        const probe = net.createServer()
        probe.once('error', () => resolve(false))
        probe.once('listening', () => probe.close(() => resolve(true)))
        probe.listen(port, '127.0.0.1')
      })
      if (free) return port
    }
    return 3081
  }
  const DEFAULT_REMOTE_PORT = 3080

  const byId = new Map()
  const staticIds = new Set()
  // Per-authority runtime hooks registered by the mirror/event blocks below.
  const authorityStarters = new Set()
  const authorityStoppers = new Set()
  const supervisor = createSupervisor()
  const storePath = resolveStorePath(config)
  const store = readStore(storePath)
  const disabled = new Set(store.disabled)
  const dynamicEntries = new Map(store.authorities.map((entry) => [entry.id, entry]))
  /**
   * One authority row from config/store: an `ssh` block is mandatory (only ssh-managed
   * authorities are supported). Its upstream is the local tunnel the supervisor keeps open,
   * and the remote dsh web is started and watched by us.
   */
  function authorityFromEntry(entry, source) {
    const ssh = entry.ssh === undefined || entry.ssh === null ? undefined : entry.ssh
    if (ssh === undefined || ssh.localPort === undefined) {
      console.warn('[authority-proxy] authority ' + entry.id + ' has no ssh block; only ssh-managed authorities are supported — ignoring it')
      return null
    }
    const upstream = new URL('http://127.0.0.1:' + String(ssh.localPort))
    return { id: entry.id, upstream, token: undefined, cookie: null, inflight: null, source, ssh, remote: entry.remote, autoReconnect: entry.autoReconnect, healthIntervalMs: entry.healthIntervalMs }
  }
  for (const entry of list) {
    staticIds.add(entry.id)
    if (disabled.has(entry.id)) continue
    const configured = authorityFromEntry(entry, 'config')
    if (configured !== null) byId.set(entry.id, configured)
  }
  for (const entry of dynamicEntries.values()) {
    if (byId.has(entry.id)) continue
    const stored = authorityFromEntry(entry, 'store')
    if (stored !== null) byId.set(entry.id, stored)   // the store wins: UI edits override the profile config
  }
  /** Persist only the runtime registry plus the set of disabled config entries. */
  function saveStore() {
    try {
      fs.mkdirSync(path.dirname(storePath), { recursive: true })
      fs.writeFileSync(storePath, JSON.stringify({
        authorities: [...dynamicEntries.values()],
        disabled: [...disabled],
      }, null, 2))
    } catch (error) {
      console.error('[authority-proxy] store write failed', String(error?.message ?? error))
    }
  }

  /** Obtain (once) the authority-bound browser cookie via the launch-token exchange. */
  async function ensureCookie(a, force = false) {
    if (force) a.cookie = null
    if (a.cookie) return a.cookie
    if (!a.inflight) {
      a.inflight = (async () => {
        try {
          const url = new URL('/', a.upstream)
          if (a.token) url.searchParams.set('token', a.token)
          const res = await fetch(url, { redirect: 'manual' })
          const raw = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
          a.cookie = raw.map((c) => String(c).split(';')[0]).join('; ') || null
        } finally {
          a.inflight = null
        }
      })()
    }
    await a.inflight
    return a.cookie
  }

  /** Rewrite browser headers so the authority treats the request as its own loopback origin. */
  function upstreamHeaders(req, a) {
    const authority = a.upstream.host
    return {
      ...req.headers,
      host: authority,
      origin: `http://${authority}`,
      'sec-fetch-site': 'same-origin',
    }
  }

  /** Write a plain failure when nothing was sent yet; never throw from an error path. */
  function failResponse(res, status, text, contentType = 'text/plain; charset=utf-8') {
    try {
      if (res.headersSent) { res.end(); return }
      const body = Buffer.from(String(text), 'utf8')
      res.writeHead(status, { 'content-type': contentType, 'content-length': String(body.byteLength) })
      res.end(body)
    } catch { /* the response is already gone */ }
  }

  /** Prefix the ids an authority returns for its own pinned/archived lists. */
  function namespaceAuthorityIdList(text, authorityId, key) {
    try {
      const payload = JSON.parse(text)
      const value = payload?.result?.value
      if (value === null || typeof value !== 'object' || !Array.isArray(value[key])) return text
      value[key] = value[key].map((id) => (typeof id === 'string' && !id.startsWith('@authority/') ? '@authority/' + authorityId + '/' + id : id))
      // The sidebar archives a remote row through this proxy path (the authority connection),
      // not through the local routing path: feed the union cache too or the next local action
      // would answer with a stale list and pop these sessions back out.
      storeIdList(remoteIdLists, authorityId, key, value[key])
      return JSON.stringify(payload)
    } catch { return text }
  }

  function forwardHttp(a, targetPath, req, res, retry) {
    const headers = upstreamHeaders(req, a)
    if (a.cookie) headers.cookie = a.cookie
    // The pinned/archived rewrite below needs the plain JSON body; a compressed response would
    // have to be decompressed (and re-encoded), so ask upstream not to compress it at all.
    if (ID_LIST_KEYS[targetPath] !== undefined) delete headers['accept-encoding']
    const preq = http.request(
      { host: a.upstream.hostname, port: a.upstream.port, method: req.method, path: targetPath, headers },
      (pres) => {
        if (pres.statusCode === 401 && !retry) {
          pres.resume()
          ensureCookie(a, true)
            .then(() => forwardHttp(a, targetPath, req, res, true))
            .catch((error) => failResponse(res, 502, String(error)))
          return
        }
        const listKey = ID_LIST_KEYS[targetPath]
        if (listKey !== undefined) {
          const chunks = []
          pres.on('data', (chunk) => chunks.push(chunk))
          pres.on('end', () => {
            const raw = Buffer.concat(chunks)
            const encoding = pres.headers['content-encoding']
            // Safety net: if upstream compressed anyway, pass it through untouched rather than
            // rewriting bytes we would have to decode first.
            const buf = encoding === undefined
              ? Buffer.from(namespaceAuthorityIdList(raw.toString('utf8'), a.id, listKey), 'utf8')
              : raw
            try {
              const out = { ...pres.headers }
              delete out['content-length']
              delete out['transfer-encoding']
              res.writeHead(pres.statusCode ?? 502, { ...out, 'content-length': String(buf.byteLength) })
              res.end(buf)
            } catch (error) { failResponse(res, 502, String(error)) }
          })
          return
        }
        res.writeHead(pres.statusCode ?? 502, pres.headers)
        pres.pipe(res)
      },
    )
    preq.on('error', (error) => failResponse(res, 502, String(error)))
    req.pipe(preq)
  }

  async function forwardUpgrade(a, targetPath, req, socket, head) {
    await ensureCookie(a)
    const headers = upstreamHeaders(req, a)
    if (a.cookie) headers.cookie = a.cookie
    const upstream = net.connect(Number(a.upstream.port), a.upstream.hostname, () => {
      const lines = [`GET ${targetPath} HTTP/1.1`]
      for (const [key, value] of Object.entries(headers)) {
        if (value === undefined) continue
        for (const item of Array.isArray(value) ? value : [value]) lines.push(`${key}: ${item}`)
      }
      upstream.write(lines.join('\r\n') + '\r\n\r\n')
      if (head?.length) upstream.write(head)
      upstream.pipe(socket)
      socket.pipe(upstream)
    })
    upstream.on('error', () => socket.destroy())
    socket.on('error', () => upstream.destroy())
  }

  // --- Mux router: the client's stream mux is redirected here so streams that
  // address "@authority/<id>/…" can be served by that authority while local
  // streams keep flowing to the official mux. ---
  ctx.inject(['webServer', 'connection'], (muxCtx) => {
    const upstreams = new Map()
    const streamKey = new Map()
    const streamOwner = new Map()
    // Remote Workspace rows are merged into the local workspace/follow generation as
    // official increments, so the client needs no polling replay.
    const remoteWorkspaces = new Map() // authorityId -> Map(localId -> namespaced view)
    const mirrorStreams = new Set()    // browser streamIds carrying a local workspace/follow
    const mirrorOwner = new Map()      // browser streamId -> client socket
    const mirrorSent = new Map()       // browser streamId -> Map(namespacedId -> serialized view)
    const internalFollows = new Map()  // authorityId -> internal subscription socket
    const mirrorRetries = new Map()   // authorityId -> retry timer (a mirror that dies must come back)
    // Remote session projections (permissions, title, …) ride the authority's
    // session/control stream; inject them into the local control generation so the
    // official session manager shows live remote state (e.g. the composer's switcher).
    const CONTROL_KEYS = new Set(['permissions', 'title', 'sessionListMetadata', 'modelSelection'])
    const controlMirrors = new Map()  // browser streamId -> client socket
    const controlSent = new Map()     // browser streamId -> Map(entryId -> serialized value)
    const remoteControl = new Map()   // authorityId -> Map(localSessionId -> { asOfSeq, values })
    const controlSockets = new Map()  // authorityId -> internal socket
    let localCookie = null

    async function ensureLocalCookie() {
      if (localCookie !== null) return localCookie
      const port = muxCtx.webServer.port
      const url = muxCtx.connection.authenticatedUrl(`http://127.0.0.1:${String(port)}/`)
      const res = await fetch(url, { redirect: 'manual' })
      const raw = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
      localCookie = raw.map((entry) => String(entry).split(';')[0]).join('; ') || null
      return localCookie
    }

    async function connectUpstream(key) {
      const port = muxCtx.webServer.port
      if (key === 'local') {
        const cookie = await ensureLocalCookie()
        return new WsClient(`ws://127.0.0.1:${String(port)}/api/remote.mux`, cookie === null ? undefined : { headers: { cookie } })
      }
      return new WsClient(`ws://127.0.0.1:${String(port)}/authority/${encodeURIComponent(key)}/api/remote.mux`)
    }

    function upstreamFor(key) {
      const existing = upstreams.get(key)
      if (existing !== undefined) return existing
      const pending = connectUpstream(key)
        .then((socket) => new Promise((resolve, reject) => {
          if (socket.readyState === 1) { resolve(socket); return }
          const onOpen = () => { socket.removeListener('error', onError); resolve(socket) }
          const onError = (error) => { socket.removeListener('open', onOpen); reject(error) }
          socket.once('open', onOpen)
          socket.once('error', onError)
        }))
        .then((socket) => {
            socket.on('message', (data) => {
            let frame
            try { frame = JSON.parse(String(data)) } catch { return }
            const owner = streamOwner.get(frame.streamId)
            const onLocalStream = mirrorStreams.has(frame.streamId)
            const frameKind = onLocalStream ? (frame.value?.type ?? '') : ''
            if (frameKind === 'baseline' || frameKind === 'archived' || frameKind === 'pinned') {
              const body = frameKind === 'baseline' ? frame.value.value : frame.value
              if (Array.isArray(body?.pinnedSessionIds)) localIdLists.pinnedSessionIds = body.pinnedSessionIds.map(String)
              if (Array.isArray(body?.archivedSessionIds)) localIdLists.archivedSessionIds = body.archivedSessionIds.map(String)
            }
            const patchFrame = frameKind === 'baseline' || frameKind === 'archived' || frameKind === 'pinned'
            if (owner !== undefined && owner.readyState === 1) owner.send(patchFrame ? unionFrame(String(data)) : String(data))
            if (frameKind === 'baseline') {
            }
            if (controlMirrors.has(frame.streamId) && frame.value?.type === 'baseline') {
              controlSent.set(frame.streamId, new Map())
              publishControl(frame.streamId)
            }
          })
          socket.on('close', () => { if (upstreams.get(key) === pending) upstreams.delete(key) })
          socket.on('error', (error) => { console.error('[authority-proxy] mux upstream error', key, String(error?.message ?? error)) })
          return socket
        })
      upstreams.set(key, pending)
      pending.catch((error) => {
        console.error('[authority-proxy] mux upstream failed', key, String(error?.message ?? error))
        if (upstreams.get(key) === pending) upstreams.delete(key)
      })
      return pending
    }

    function streamTarget(payload) {
      // undefined = no namespaced id (local), null = namespaced but unknown authority.
      let found
      const walk = (node) => {
        if (found !== undefined) return
        if (typeof node === 'string') {
          const match = /^@authority\/([^/]+)\//.exec(node)
          if (match !== null) found = byId.has(match[1]) ? match[1] : null
          return
        }
        if (Array.isArray(node)) { for (const item of node) walk(item); return }
        if (node !== null && typeof node === 'object') { for (const key of Object.keys(node)) walk(node[key]) }
      }
      walk(payload?.args)
      return found === undefined ? 'local' : found
    }

    /** Namespace one authority's Workspace projection for the shared object model. */
    const namespaceView = (authorityId, view) => ({
      ...view,
      workspaceId: `@authority/${authorityId}/${view.workspaceId}`,
      sessionIds: (view.sessionIds ?? []).map((id) => `@authority/${authorityId}/${id}`),
    })

    /** Push the current remote rows into one browser workspace/follow stream. */
    function publishMirror(streamId) {
      const socket = mirrorOwner.get(streamId)
      if (socket === undefined || socket.readyState !== 1) return
      const sent = mirrorSent.get(streamId) ?? new Map()
      const desired = new Map()
      for (const views of remoteWorkspaces.values()) for (const view of views.values()) desired.set(view.workspaceId, view)
      for (const [id, view] of desired) {
        const json = JSON.stringify(view)
        if (sent.get(id) === json) continue
        socket.send(JSON.stringify({ type: 'item', streamId, value: { type: 'upsert', workspace: view } }))
        sent.set(id, json)
      }
      for (const id of [...sent.keys()]) {
        if (desired.has(id)) continue
        socket.send(JSON.stringify({ type: 'item', streamId, value: { type: 'remove', workspaceId: id } }))
        sent.delete(id)
      }
      mirrorSent.set(streamId, sent)
    }

    function publishAllMirrors() { for (const streamId of [...mirrorStreams]) publishMirror(streamId) }

    /** Push the current remote projections into one browser session/control stream. */
    function publishControl(streamId) {
      const socket = controlMirrors.get(streamId)
      if (socket === undefined || socket.readyState !== 1) return
      const sent = controlSent.get(streamId) ?? new Map()
      for (const [authorityId, sessions] of remoteControl) {
        for (const [sessionId, block] of sessions) {
          const namespaced = `@authority/${authorityId}/${sessionId}`
          for (const [key, value] of Object.entries(block.values ?? {})) {
            if (!CONTROL_KEYS.has(key)) continue
            const entryId = namespaced + '|' + key
            const json = JSON.stringify(value)
            if (sent.get(entryId) === json) continue
            socket.send(JSON.stringify({
              type: 'item',
              streamId,
              value: { type: 'projection', sessionId: namespaced, key, value, seq: block.asOfSeq ?? 0 },
            }))
            sent.set(entryId, json)
          }
        }
      }
      controlSent.set(streamId, sent)
    }
    function publishAllControl() { for (const streamId of [...controlMirrors.keys()]) publishControl(streamId) }

    /** Absorb one authority session/control frame (baseline or projection update). */
    function absorbControl(authorityId, frame) {
      if (frame?.type !== 'item') return
      const value = frame.value
      if (value?.type === 'baseline') {
        const next = new Map()
        for (const [sessionId, block] of Object.entries(value.value?.projections ?? {})) next.set(sessionId, block)
        remoteControl.set(authorityId, next)
        publishAllControl()
        return
      }
      if (value?.type === 'projection') {
        const map = remoteControl.get(authorityId)
        if (map === undefined) return
        const block = map.get(value.sessionId) ?? { asOfSeq: value.seq ?? 0, values: {} }
        block.values = { ...(block.values ?? {}), [value.key]: value.value }
        block.asOfSeq = Math.max(block.asOfSeq ?? 0, value.seq ?? 0)
        map.set(value.sessionId, block)
        publishAllControl()
      }
    }

    function followAuthorityControl(authorityId) {
      if (controlSockets.has(authorityId)) return
      const port = muxCtx.webServer.port
      const socket = new WsClient(`ws://127.0.0.1:${String(port)}/authority/${encodeURIComponent(authorityId)}/api/remote.mux`)
      controlSockets.set(authorityId, socket)
      socket.on('open', () => {
        socket.send(JSON.stringify({ type: 'open', streamId: 'mhr-control', endpoint: 'session/control', payload: { args: {} } }))
      })
      socket.on('message', (data) => { try { absorbControl(authorityId, JSON.parse(String(data))) } catch { /* ignore */ } })
      socket.on('error', (error) => { console.error('[authority-proxy] control mirror error', authorityId, String(error?.message ?? error)) })
      socket.on('close', () => { if (controlSockets.get(authorityId) === socket) controlSockets.delete(authorityId) })
    }
    function stopAuthorityControl(authorityId) {
      const socket = controlSockets.get(authorityId)
      controlSockets.delete(authorityId)
      remoteControl.delete(authorityId)
      if (socket !== undefined) { try { socket.close() } catch { /* ignore */ } }
      publishAllControl()
    }

    /** Translate one authority workspace/follow frame into shared remote state. */
    function absorbAuthorityFrame(authorityId, frame) {
      if (frame?.type !== 'item') return
      const value = frame.value
      if (value?.type === 'baseline') {
          remoteBaselineKeys.set(authorityId, Object.keys(value.value ?? {}).join(","))
          remoteBaselineRaw.set(authorityId, JSON.stringify(value.value ?? {}).slice(0, 400))
          if (Array.isArray(value.value?.pinnedSessionIds)) storeIdList(remoteIdLists, authorityId, 'pinnedSessionIds', value.value.pinnedSessionIds)
      if (value?.type === 'archived' && Array.isArray(value.archivedSessionIds)) storeIdList(remoteIdLists, authorityId, 'archivedSessionIds', value.archivedSessionIds)
      if (value?.type === 'pinned' && Array.isArray(value.pinnedSessionIds)) storeIdList(remoteIdLists, authorityId, 'pinnedSessionIds', value.pinnedSessionIds)
          if (Array.isArray(value.value?.archivedSessionIds)) storeIdList(remoteIdLists, authorityId, 'archivedSessionIds', value.value.archivedSessionIds)
        const next = new Map()
        for (const view of value.value?.items ?? []) next.set(view.workspaceId, namespaceView(authorityId, view))
        remoteWorkspaces.set(authorityId, next)
        publishAllMirrors()
        return
      }
      const current = remoteWorkspaces.get(authorityId)
      if (current === undefined) return
      if (value?.type === 'upsert') { current.set(value.workspace.workspaceId, namespaceView(authorityId, value.workspace)); publishAllMirrors(); return }
      if (value?.type === 'remove') { current.delete(value.workspaceId); publishAllMirrors() }
    }

    /** Subscribe to one authority's Workspace state for the mirror. */
    const scheduleMirrorRetry = (authorityId) => {
    internalFollows.delete(authorityId)
    if (!byId.has(authorityId)) return
    if (mirrorRetries.has(authorityId)) return
    mirrorRetries.set(authorityId, setTimeout(() => {
    mirrorRetries.delete(authorityId)
    followAuthorityWorkspaces(authorityId)
    }, 3000))
    }
    function followAuthorityWorkspaces(authorityId) {
      if (internalFollows.has(authorityId)) return
      const port = muxCtx.webServer.port
      const socket = new WsClient(`ws://127.0.0.1:${String(port)}/authority/${encodeURIComponent(authorityId)}/api/remote.mux`)
      internalFollows.set(authorityId, socket)
      socket.on('open', () => { socket.send(JSON.stringify({ type: 'open', streamId: 'mhr-workspaces', endpoint: 'workspace/follow', payload: { args: {} } })) })
      socket.on('message', (data) => { try { absorbAuthorityFrame(authorityId, JSON.parse(String(data))) } catch { /* ignore */ } })
      socket.on('error', (error) => { console.error('[authority-proxy] workspace mirror error', authorityId, String(error?.message ?? error)); scheduleMirrorRetry(authorityId) })
      socket.on('close', () => { scheduleMirrorRetry(authorityId) })
    }

    const workspaceStarter = (id) => followAuthorityWorkspaces(id)
    const workspaceStopper = (id) => {
      const retryTimer = mirrorRetries.get(id)
      if (retryTimer !== undefined) { clearTimeout(retryTimer); mirrorRetries.delete(id) }
      const socket = internalFollows.get(id)
      internalFollows.delete(id)
      remoteWorkspaces.delete(id)
      remoteIdLists.delete(id)
      if (socket !== undefined) { try { socket.close() } catch { /* ignore */ } }
      publishAllMirrors()
    }
    authorityStarters.add(workspaceStarter)
    authorityStoppers.add(workspaceStopper)
    authorityStarters.add(followAuthorityControl)
    authorityStoppers.add(stopAuthorityControl)
    for (const authorityId of byId.keys()) workspaceStarter(authorityId)
    for (const authorityId of byId.keys()) followAuthorityControl(authorityId)
    muxCtx.effect(() => () => {
      authorityStarters.delete(workspaceStarter)
      authorityStoppers.delete(workspaceStopper)
    }, 'authority-proxy: workspace mirror registry')

    /** Encode one client frame for the selected upstream, stripping our namespace for authorities. */
    const encodeFor = (key, frame) => (key === 'local' ? JSON.stringify(frame) : JSON.stringify(stripNamespace(key, frame)))

    const rejectUpgrade = (socket, status) => {
      socket.write(`HTTP/1.1 ${String(status)} ${status === 401 ? 'Unauthorized' : 'Forbidden'}\r\nconnection: close\r\n\r\n`)
      socket.destroy()
    }

    const wss = new WebSocketServer({ noServer: true })
    muxCtx.effect(() => {
      const dispose = muxCtx.webServer.registerUpgrade({
        path: '/mhr-mux/api/remote.mux',
        handler: (req, socket, head) => {
          const admission = muxCtx.connection.admit(req)
          if ('rejection' in admission) { rejectUpgrade(socket, admission.rejection); return }
          wss.handleUpgrade(req, socket, head, (client) => {
            client.on('message', (data) => {
              let frame
              try { frame = JSON.parse(String(data)) } catch { return }
              if (frame.streamId === undefined) return
              if (frame.type === 'open') {
                const key = streamTarget(frame.payload)
                if (key === null) {
                  client.send(JSON.stringify({
                    type: 'error',
                    streamId: frame.streamId,
                    error: {
                      code: 'authority/unknown',
                      message: 'No configured authority owns this stream target.',
                      details: { endpoint: String(frame.endpoint) },
                    },
                  }))
                  return
                }
                streamKey.set(frame.streamId, key)
                streamOwner.set(frame.streamId, client)
                if (key === 'local' && frame.endpoint === 'workspace/follow') {
                  mirrorStreams.add(frame.streamId)
                  mirrorOwner.set(frame.streamId, client)
                }
                if (key === 'local' && frame.endpoint === 'session/control') {
                  controlMirrors.set(frame.streamId, client)
                }
              }
              const key = streamKey.get(frame.streamId)
              if (key === undefined) return
              const encoded = frame.type === 'open' ? encodeFor(key, frame) : encodeFor(key, frame)
              void upstreamFor(key).then((upstream) => {
                if (upstream.readyState === 1) upstream.send(encoded)
              }).catch(() => undefined)
            })
            client.on('close', () => {
              for (const [streamId, owner] of [...streamOwner]) {
                if (owner !== client) continue
                const key = streamKey.get(streamId)
                if (key !== undefined) {
                  void upstreamFor(key).then((upstream) => {
                    if (upstream.readyState === 1) upstream.send(JSON.stringify({ type: 'cancel', streamId }))
                  }).catch(() => undefined)
                }
                streamOwner.delete(streamId)
                streamKey.delete(streamId)
                mirrorStreams.delete(streamId)
                mirrorOwner.delete(streamId)
                mirrorSent.delete(streamId)
                controlMirrors.delete(streamId)
                controlSent.delete(streamId)
              }
            })
            client.on('error', () => client.close())
          })
        },
      })
      return () => { dispose(); wss.close() }
    }, 'authority-proxy: mux router')

    void ensureLocalCookie().catch(() => undefined)
  })

  // --- Forward remote Session lifecycle as official forwarded Client events ---
  // The Gateway's forwarded-event list already includes api-session/*; emitting them on
  // this Host context makes remote Sessions live in the browser's official session store.
  ctx.inject(['webServer'], (eventCtx) => {
    const sockets = new Map()
    const SESSION_EVENTS = new Set([
      'api-session/added',
      'api-session/removed',
      'api-session/status',
      'api-session/activity',
      'api-session/error',
    ])

    function namespaceEventArgs(authorityId, event, args) {
      const prefix = `@authority/${authorityId}/`
      const first = args[0]
      if (event === 'api-session/added') {
        const summary = first ?? {}
        return [{
          ...summary,
          sessionId: prefix + String(summary.sessionId),
          ...(summary.parentSessionId === undefined ? {} : { parentSessionId: prefix + String(summary.parentSessionId) }),
        }, ...args.slice(1)]
      }
      if (typeof first === 'string') return [prefix + first, ...args.slice(1)]
      return args
    }

    function startAuthorityEvents(authorityId) {
      if (sockets.has(authorityId)) return
      const port = eventCtx.webServer.port
      const socket = new WsClient(`ws://127.0.0.1:${String(port)}/authority/${encodeURIComponent(authorityId)}/api/remote.mux`)
      sockets.set(authorityId, socket)
      socket.on('open', () => {
        socket.send(JSON.stringify({ type: 'open', streamId: 'mhr-events', endpoint: '$events', payload: { args: {} } }))
      })
      socket.on('message', (data) => {
        let frame
        try { frame = JSON.parse(String(data)) } catch { return }
        if (frame?.type !== 'item') return
        const value = frame.value
        if (value?.type !== 'emit' || !SESSION_EVENTS.has(value.event)) return
        try {
          eventCtx.emit(value.event, ...namespaceEventArgs(authorityId, value.event, Array.isArray(value.args) ? value.args : []))
        } catch (error) {
          console.error('[authority-proxy] event emit failed', value.event, String(error?.message ?? error))
        }
      })
      socket.on('error', () => undefined)
      socket.on('close', () => {
        if (sockets.get(authorityId) !== socket) return
        sockets.delete(authorityId)
        setTimeout(() => startAuthorityEvents(authorityId), 3000)
      })
    }

    const stopAuthorityEvents = (id) => {
      const socket = sockets.get(id)
      sockets.delete(id)
      if (socket !== undefined) { try { socket.close() } catch { /* ignore */ } }
    }
    authorityStarters.add(startAuthorityEvents)
    authorityStoppers.add(stopAuthorityEvents)
    for (const authorityId of byId.keys()) startAuthorityEvents(authorityId)
    eventCtx.effect(() => () => {
      authorityStarters.delete(startAuthorityEvents)
      authorityStoppers.delete(stopAuthorityEvents)
    }, 'authority-proxy: session event registry')
    eventCtx.effect(() => () => {
      for (const socket of sockets.values()) socket.close()
      sockets.clear()
    }, 'authority-proxy: remote session event bridge')
  })

  // The client half learns the authority list from this injected global, so the
  // two halves never duplicate configuration.
  /** Read one non-streaming authority endpoint through the SSH/HTTP forward. */
  async function remoteValue(a, endpoint, args) {
    await ensureCookie(a)
    const body = JSON.stringify({ type: 'client-request', rpcId: 'mhr-' + Math.random().toString(36).slice(2), method: endpoint, payload: { args } })
    const authority = a.upstream.host
    const headers = {
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(body),
      host: authority,
      origin: `http://${authority}`,
      'sec-fetch-site': 'same-origin',
    }
    if (a.cookie) headers.cookie = a.cookie
    const text = await new Promise((resolve, reject) => {
      const preq = http.request({ host: a.upstream.hostname, port: a.upstream.port, method: 'POST', path: '/api/' + endpoint, headers }, (pres) => {
        const chunks = []
        pres.on('data', (chunk) => chunks.push(chunk))
        pres.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      })
      preq.on('error', reject)
      preq.end(body)
    })
    const parsed = JSON.parse(text)
    return parsed?.result?.ok === true ? parsed.result.value : undefined
  }

  /** Cached per-authority model catalog; the merged picker reads it. */
  const catalogCache = new Map()
  async function authorityCatalog(a) {
    const now = Date.now()
    const cached = catalogCache.get(a.id)
    if (cached !== undefined && now - cached.at < 20000) return cached.value
    try {
      const value = await remoteValue(a, 'session/modelCatalog', {})
      if (value !== undefined) catalogCache.set(a.id, { at: now, value })
      return value ?? cached?.value ?? null
    } catch {
      return cached?.value ?? null
    }
  }

  /** Answer one client request with a synthetic Remote failure (HTTP 200, result.ok=false). */
  function sendRemoteFailure(res, parsed, code, message) {
    const out = Buffer.from(JSON.stringify({
      type: 'server-response',
      rpcId: parsed?.rpcId,
      result: { ok: false, error: { code, message, details: {} } },
    }), 'utf8')
    res.writeHead(200, { 'content-type': 'application/json', 'content-length': String(out.byteLength) })
    res.end(out)
  }

  /** Read a request body fully (the interceptor owns requests it handles). */
  function readBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = []
      req.on('data', (chunk) => chunks.push(chunk))
      req.on('end', () => resolve(Buffer.concat(chunks)))
      req.on('error', reject)
    })
  }

  /** Call this same host's official /api once, bypassing the interceptor. */
  function localApi(port, path, body, headers) {
    return new Promise((resolve, reject) => {
      const authority = `127.0.0.1:${String(port)}`
      const preq = http.request({
        host: '127.0.0.1',
        port,
        method: 'POST',
        path,
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
          host: authority,
          origin: `http://${authority}`,
          'sec-fetch-site': 'same-origin',
          'x-mhr-internal': '1',
          ...(headers.cookie === undefined ? {} : { cookie: headers.cookie }),
        },
      }, (pres) => {
        const chunks = []
        pres.on('data', (chunk) => chunks.push(chunk))
        pres.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      })
      preq.on('error', reject)
      preq.end(body)
    })
  }

  /** Endpoints whose request carries a Session/Workspace id we may have to route. */
  const ROUTED_ENDPOINTS = new Set([
    // Session creation must reach the authority that owns the requested workspace.
    '/api/session/create',
    // Slash commands (permission switch, etc.) and their catalog are session-scoped.
    '/api/commands/execute',
    '/api/commands/list',
    // Model selection and projection reads are session-scoped too.
    '/api/session/selectModel',
    '/api/session/projections',
    '/api/session/page',
    '/api/session/prompt',
    '/api/session/rename',
    '/api/session/cancel',
    '/api/session/fork',
    '/api/session/control',
    '/api/session/updateQueue',
    '/api/workspace/rename',
    '/api/workspace/delete',
    // Row/menu actions on a remote session: archive, pin, reorder, delete, ...
    '/api/workspace/archiveSession',
    '/api/workspace/unarchiveSession',
    '/api/workspace/pinSession',
    '/api/workspace/unpinSession',
    '/api/workspace/insertBefore',
    '/api/workspace/insertSessionBefore',
    '/api/workspace/initializeDefault',
    // Session-scoped reads/actions a remote row may trigger from its menu.
    '/api/session/search',
    '/api/session/attachment',
    '/api/session/canOpenWorkspacePath',
    '/api/session/openWorkspacePath',
    '/api/session/workspacePathApplications',
    '/api/session/initializeDefaultModel',
  ])

  /** Find the first namespaced id in a decoded args tree that names a known authority. */
  function findAuthority(value) {
    let found = null
    const walk = (node) => {
      if (found !== null) return
      if (typeof node === 'string') {
        const match = /^@authority\/([^/]+)\//.exec(node)
        if (match !== null && byId.has(match[1])) found = match[1]
        return
      }
      if (Array.isArray(node)) { for (const item of node) walk(item); return }
      if (node !== null && typeof node === 'object') { for (const key of Object.keys(node)) walk(node[key]) }
    }
    walk(value)
    return found
  }

  /** Strip one authority's namespace from every string leaf. */
  function stripNamespace(authorityId, value) {
    const prefix = `@authority/${authorityId}/`
    if (typeof value === 'string') return value.startsWith(prefix) ? value.slice(prefix.length) : value
    if (Array.isArray(value)) return value.map((item) => stripNamespace(authorityId, item))
    if (value !== null && typeof value === 'object') {
      const out = {}
      for (const key of Object.keys(value)) out[key] = stripNamespace(authorityId, value[key])
      return out
    }
    return value
  }

  /** The authority id a virtual picker path names (with or without a trailing slash), else null. */
  function virtualOwnerOf(path) {
    if (typeof path !== 'string' || !path.startsWith(VIRTUAL_ROOT + '/')) return null
    const rest = path.slice(VIRTUAL_ROOT.length + 1)
    const slash = rest.indexOf('/')
    const id = slash === -1 ? rest : rest.slice(0, slash)
    return id === '' ? null : id
  }

  /** The virtual path prefix one authority owns inside the directory picker. */
  function virtualPrefix(authorityId) {
    return `${VIRTUAL_ROOT}/${authorityId}`
  }

  /**
   * Virtual picker path -> the authority-local path to request. null means the path is
   * not ours, undefined means the authority's own default (its home directory, matching
   * how the picker opens locally), and a string is an explicit absolute path.
   */
  function remotePathOf(authorityId, path) {
    const prefix = virtualPrefix(authorityId)
    if (path === prefix) return undefined
    if (path === prefix + '/') return '/'
    if (path.startsWith(prefix + '/')) return path.slice(prefix.length)
    return null
  }

  /** Authority-local absolute path -> its virtual picker path. */
  function virtualPathOf(authorityId, path) {
    if (typeof path !== 'string' || !path.startsWith('/')) return path
    return `${virtualPrefix(authorityId)}${path === '/' ? '/' : path}`
  }

  /** Rewrite one authority listing into the virtual namespace the picker navigates. */
  function namespaceListing(text, authorityId) {
    try {
      const payload = JSON.parse(text)
      const value = payload?.result?.value
      if (value === undefined || !Array.isArray(value.entries)) return text
      const entries = value.entries.map((entry) => ({ ...entry, path: virtualPathOf(authorityId, entry.path) }))
      const crumbs = [
        { name: REMOTE_HOSTS_LABEL, path: VIRTUAL_ROOT, hidden: false },
        { name: authorityId, path: virtualPrefix(authorityId), hidden: false },
        ...(value.crumbs ?? []).map((crumb) => ({ ...crumb, path: virtualPathOf(authorityId, crumb.path) })),
      ]
      payload.result.value = {
        ...value,
        path: virtualPathOf(authorityId, value.path),
        home: virtualPathOf(authorityId, value.home),
        crumbs,
        entries,
      }
      return JSON.stringify(payload)
    } catch {
      return text
    }
  }

  /**
   * Surface the remote hosts as one explicitly labelled entry at the picker's
   * initial level: a host is not a directory, so it must not look like one.
   */
  function injectRemoteRoots(text, authorities, requestedPath) {
    try {
      const payload = JSON.parse(text)
      const value = payload?.result?.value
      if (value === undefined || !Array.isArray(value.entries) || authorities.length === 0) return text
      const atInitialLevel = requestedPath === undefined || requestedPath === null || requestedPath === value.home
      if (!atInitialLevel) return text
      const entry = { name: REMOTE_HOSTS_LABEL, path: VIRTUAL_ROOT, hidden: false }
      payload.result.value = { ...value, entries: [entry, ...value.entries] }
      return JSON.stringify(payload)
    } catch {
      return text
    }
  }

  /** Per-authority home directory, cached: a host entry must open the directory it names. */
  const homeCache = new Map()
  async function authorityHome(authority) {
    const now = Date.now()
    const cached = homeCache.get(authority.id)
    if (cached !== undefined && now - cached.at < 30000) return cached.value
    try {
      const encoded = JSON.stringify({ type: 'client-request', rpcId: `mhr-home-${authority.id}`, method: 'directoryPicker/list', payload: { args: {} } })
      const upstream = await authorityRaw(authority, DIRECTORY_LIST_PATH, encoded)
      const payload = JSON.parse(upstream.text)
      const home = payload?.result?.value?.home
      const value = typeof home === 'string' ? home : null
      homeCache.set(authority.id, { at: now, value })
      return value
    } catch {
      return cached?.value ?? null
    }
  }

  /**
   * The synthetic host list one level below {@link REMOTE_HOSTS_LABEL}. Each entry
   * names the directory it opens (the authority's home), because the official path
   * bar prefills from the selected entry path and would otherwise open the root.
   */
  async function hostsListing(parsed, authorities) {
    const entries = []
    for (const authority of authorities) {
      const home = await authorityHome(authority)
      entries.push({
        name: authority.id,
        path: home === null ? virtualPrefix(authority.id) : virtualPathOf(authority.id, home),
        hidden: false,
      })
    }
    const value = {
      path: VIRTUAL_ROOT,
      home: VIRTUAL_ROOT,
      crumbs: [{ name: REMOTE_HOSTS_LABEL, path: VIRTUAL_ROOT, hidden: false }],
      entries,
      truncated: false,
    }
    return JSON.stringify({ type: 'server-response', rpcId: parsed?.rpcId, result: { ok: true, value } })
  }

  /** Namespace the workspace id an authority minted for a created workspace. */
  function namespaceCreatedWorkspace(text, authorityId) {
    try {
      const payload = JSON.parse(text)
      const value = payload?.result?.value
      const workspace = value?.workspace
      if (workspace === undefined || typeof workspace.workspaceId !== 'string') return text
      if (workspace.workspaceId.startsWith(VIRTUAL_ROOT + '/')) return text
      payload.result.value = { ...value, workspace: { ...workspace, workspaceId: `${virtualPrefix(authorityId)}/${workspace.workspaceId}` } }
      return JSON.stringify(payload)
    } catch {
      return text
    }
  }

  /**
   * Session ids minted by an authority (create/fork) must come back namespaced, or
   * the client stores a bare id that later routes locally.
   */
  function namespaceMintedSession(text, authorityId) {
    try {
      const payload = JSON.parse(text)
      const value = payload?.result?.value
      if (value === undefined || typeof value.sessionId !== 'string') return text
      if (value.sessionId.startsWith('@authority/')) return text
      payload.result.value = { ...value, sessionId: `@authority/${authorityId}/${value.sessionId}` }
      return JSON.stringify(payload)
    } catch {
      return text
    }
  }

  /** Pinned/archived id lists per host, so an action on one can answer with the union. */
  const localIdLists = { pinnedSessionIds: [], archivedSessionIds: [] }
  const remoteIdLists = new Map()  // authorityId -> { pinnedSessionIds, archivedSessionIds }
  const remoteBaselineKeys = new Map()  // debug: baseline keys per authority
  const remoteBaselineRaw = new Map()   // debug: baseline head per authority

  /**
   * The union can only be as good as the captured per-authority lists. A mirror socket that
   * dies early must be retried, and a request that arrives before the first baseline must
   * wait (briefly) instead of answering with a truncated list.
   */
  function idListsCold() {
    for (const a of byId.values()) {
      if (a.ssh !== undefined && !remoteIdLists.has(a.id)) return true
    }
    return false
  }
  async function warmIdLists(timeoutMs = 1800) {
    if (!idListsCold()) return
    for (const a of byId.values()) {
      if (a.ssh === undefined || remoteIdLists.has(a.id)) continue
      for (const start of authorityStarters) { try { start(a.id) } catch { /* ignore */ } }
    }
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline && idListsCold()) await new Promise((resolve) => setTimeout(resolve, 120))
  }

  const ID_LIST_KEYS = {
    '/api/workspace/pinSession': 'pinnedSessionIds',
    '/api/workspace/unpinSession': 'pinnedSessionIds',
    '/api/workspace/archiveSession': 'archivedSessionIds',
    '/api/workspace/unarchiveSession': 'archivedSessionIds',
  }

  /** Merge one host's pinned/archived id list into the cross-host union. */
  function storeIdList(store, owner, key, ids) {
    const current = store.get(owner) ?? { pinnedSessionIds: [], archivedSessionIds: [] }
    store.set(owner, {
      ...current,
      [key]: ids
        .filter((id) => typeof id === 'string')
        .map((id) => (id.startsWith('@authority/') ? id : '@authority/' + owner + '/' + id)),
    })
  }

  /**
   * The client replaces its whole pinned/archived list with whatever one host returns, so a
   * bare response drops every other host's marks and archived sessions pop back out. Rewrite
   * the list to the union across the local host and all authorities, and remember this part.
   * @param text - raw response body from one host.
   * @param key - "pinnedSessionIds" or "archivedSessionIds".
   * @param owner - authority id, or null for the local host.
   */
  function unionIdList(text, key, owner) {
    let payload
    try { payload = JSON.parse(text) } catch { return text }
    const value = payload?.result?.value
    if (value === null || typeof value !== 'object') return text
    const raw = Array.isArray(value[key]) ? value[key] : []
    if (owner === null) localIdLists[key] = raw.filter((id) => typeof id === 'string')
    else storeIdList(remoteIdLists, owner, key, raw)
    const union = [...(owner === null ? localIdLists[key] : (remoteIdLists.get(owner)?.[key] ?? []))]
    for (const lists of remoteIdLists.values()) {
      for (const id of lists[key] ?? []) if (!union.includes(id)) union.push(id)
    }
    if (owner !== null) {
      for (const id of localIdLists[key]) if (!union.includes(id)) union.push(id)
    }
    value[key] = union
    return JSON.stringify(payload)
  }

  /**
   * Merge the cached remote pinned/archived lists into a local follow baseline before it
   * reaches the client: the client installs `baseline.archivedSessionIds` wholesale, so an
   * unpatched baseline drops every remote mark again.
   */
  /**
   * Merge the cached remote id lists into a local follow frame before it reaches the client.
   * The stream carries the whole list in three shapes: a baseline ({value:{...}}), and the
   * increments {value:{type:"archived"}} / {value:{type:"pinned"}}; an unpatched one of any
   * shape replaces the client's list wholesale and drops every remote mark.
   */
  function unionFrame(text) {
    let frame
    try { frame = JSON.parse(text) } catch { return text }
    const value = frame?.value
    if (value === null || typeof value !== 'object') return text
    const targets = []
    if (value.type === 'baseline' && value.value !== null && typeof value.value === 'object') targets.push([value.value, ['pinnedSessionIds', 'archivedSessionIds']])
    if (value.type === 'archived') targets.push([value, ['archivedSessionIds']])
    if (value.type === 'pinned') targets.push([value, ['pinnedSessionIds']])
    let changed = false
    for (const [body, keys] of targets) {
      for (const key of keys) {
        if (!Array.isArray(body[key])) continue
        const union = body[key].map(String)
        for (const lists of remoteIdLists.values()) {
          for (const id of lists[key] ?? []) if (!union.includes(id)) union.push(id)
        }
        body[key] = union
        changed = true
      }
    }
    return changed ? JSON.stringify(frame) : text
  }
  /** Send one already-encoded request to an authority and return its raw response. */
  function authorityRaw(a, path, body) {
    return new Promise((resolve, reject) => {
      const authority = a.upstream.host
      const headers = {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
        host: authority,
        origin: `http://${authority}`,
        'sec-fetch-site': 'same-origin',
      }
      if (a.cookie) headers.cookie = a.cookie
      const preq = http.request({ host: a.upstream.hostname, port: a.upstream.port, method: 'POST', path, headers }, (pres) => {
        const chunks = []
        pres.on('data', (chunk) => chunks.push(chunk))
        pres.on('end', () => resolve({ status: pres.statusCode ?? 502, text: Buffer.concat(chunks).toString('utf8') }))
      })
      preq.on('error', reject)
      preq.end(body)
    })
  }

  /**
   * Host-side aggregation seam: the official client asks this host for sessions;
   * we answer with local + every authority's items, namespacing remote ids, so one
   * object model reaches the UI without touching official packages.
   */
  ctx.inject(['connection', 'webServer'], (connectionCtx) => {
    connectionCtx.on('connection/request', async (req, res, next) => {
      const url = String(req.url ?? '')
      const internal = req.headers['x-mhr-internal'] === '1'
      if (req.method !== 'POST' || byId.size === 0 || internal) { await next(); return }
      if (url !== '/api/session/list' && url !== MODEL_CATALOG_PATH && url !== DIRECTORY_LIST_PATH && url !== WORKSPACE_CREATE_PATH && url !== DIRECTORY_CREATE_PATH && !ROUTED_ENDPOINTS.has(url)) { await next(); return }
      try {
        const body = await readBody(req)

        // Model catalog: list the local providers, plus remote-only providers labelled
        // with their authority (the catalog call carries no session, so this is the only
        // place provenance can be attached).
        if (url === MODEL_CATALOG_PATH) {
          const localText = await localApi(ctx.webServer.port, url, body, req.headers)
          let payload
          try { payload = JSON.parse(localText) } catch { payload = undefined }
          const local = payload?.result?.value
          if (local === undefined || !Array.isArray(local.groups)) {
            const buf = Buffer.from(localText, 'utf8')
            res.writeHead(200, { 'content-type': 'application/json', 'content-length': String(buf.byteLength) })
            res.end(buf)
            return
          }
          const localIds = new Set(local.groups.map((group) => group.id))
          const groups = [...local.groups]
          const failures = [...(local.failures ?? [])]
          const routable = new Set(local.routableProviders ?? [])
          for (const authority of byId.values()) {
            const catalog = await authorityCatalog(authority)
            if (catalog === null) continue
            for (const provider of catalog.routableProviders ?? []) routable.add(provider)
            for (const failure of catalog.failures ?? []) {
              failures.push({ ...failure, name: `${authority.id} · ${failure.name ?? failure.id}` })
            }
            for (const group of catalog.groups ?? []) {
              if ((group.models ?? []).length === 0 || localIds.has(group.id)) continue
              groups.push({ ...group, id: `${authority.id}::${group.id}`, name: `${authority.id} · ${group.name ?? group.id}` })
            }
          }
          const merged = { ...local, groups, failures, routableProviders: [...routable] }
          const out = Buffer.from(JSON.stringify({ ...payload, result: { ...payload.result, value: merged } }), 'utf8')
          res.writeHead(200, { 'content-type': 'application/json', 'content-length': String(out.byteLength) })
          res.end(out)
          return
        }

        // Directory picker: the official in-app browser lists one host's filesystem. Surface
        // every authority as a virtual root and translate virtual paths in both directions.
        if (url === DIRECTORY_LIST_PATH) {
          let parsed
          try { parsed = JSON.parse(body.toString('utf8')) } catch { parsed = undefined }
          const requested = typeof parsed?.payload?.args?.path === 'string' ? parsed.payload.args.path : undefined
          if (requested === VIRTUAL_ROOT) {
            const text = await hostsListing(parsed, [...byId.values()])
            const buf = Buffer.from(text, 'utf8')
            res.writeHead(200, { 'content-type': 'application/json', 'content-length': String(buf.byteLength) })
            res.end(buf)
            return
          }
          const requestedOwner = virtualOwnerOf(requested)
          if (requestedOwner !== null) {
            if (!byId.has(requestedOwner)) {
              sendRemoteFailure(res, parsed, 'authority/unknown', `未知的远端 host：${requested}`)
              return
            }
            const owner = requestedOwner
            const remotePath = remotePathOf(owner, requested)
            const args = remotePath === null ? parsed.payload.args : { ...parsed.payload.args, path: remotePath }
            if (remotePath === undefined) delete args.path
            const encoded = JSON.stringify({ ...parsed, payload: { ...parsed.payload, args } })
            const upstream = await authorityRaw(byId.get(owner), url, encoded)
            const text = namespaceListing(upstream.text, owner)
            const buf = Buffer.from(text, 'utf8')
            res.writeHead(upstream.status, { 'content-type': 'application/json', 'content-length': String(buf.byteLength) })
            res.end(buf)
            return
          }
          const localText = await localApi(ctx.webServer.port, url, body, req.headers)
          const text = injectRemoteRoots(localText, [...byId.values()], requested)
          const buf = Buffer.from(text, 'utf8')
          res.writeHead(200, { 'content-type': 'application/json', 'content-length': String(buf.byteLength) })
          res.end(buf)
          return
        }

        // Registering a workspace (or creating a directory) under a virtual remote path
        // belongs to that authority; the minted workspace id comes back namespaced.
        if (url === WORKSPACE_CREATE_PATH || url === DIRECTORY_CREATE_PATH) {
          let parsed
          try { parsed = JSON.parse(body.toString('utf8')) } catch { parsed = undefined }
          const args = parsed?.payload?.args
          const request = url === WORKSPACE_CREATE_PATH ? args?.request : args
          const candidate = typeof request?.path === 'string' ? request.path : undefined
          const candidateOwner = virtualOwnerOf(candidate)
          if (candidateOwner !== null) {
            if (!byId.has(candidateOwner)) {
              sendRemoteFailure(res, parsed, 'authority/unknown', `未知的远端 host：${candidate}`)
              return
            }
            const owner = candidateOwner
            const remotePath = remotePathOf(owner, candidate)
            if (remotePath === undefined) {
              sendRemoteFailure(res, parsed, 'authority/pick-a-directory', '请进入远端主机后选择一个具体目录。')
              return
            }
            if (remotePath !== null) {
              const rewritten = url === WORKSPACE_CREATE_PATH
                ? { ...args, request: { ...request, path: remotePath } }
                : { ...args, path: remotePath }
              const encoded = JSON.stringify({ ...parsed, payload: { ...parsed.payload, args: rewritten } })
              const upstream = await authorityRaw(byId.get(owner), url, encoded)
              const text = url === WORKSPACE_CREATE_PATH ? namespaceCreatedWorkspace(upstream.text, owner) : upstream.text
              const buf = Buffer.from(text, 'utf8')
              res.writeHead(upstream.status, { 'content-type': 'application/json', 'content-length': String(buf.byteLength) })
              res.end(buf)
              return
            }
          }
        }

        // Return routing: a request naming "@authority/<id>/…" is served by that authority.
        if (url !== '/api/session/list') {
          let parsed
          try { parsed = JSON.parse(body.toString('utf8')) } catch { parsed = undefined }
          let target = parsed === undefined ? null : findAuthority(parsed?.payload?.args)
          let request = parsed?.payload?.args?.request
          if (url === SELECT_MODEL_PATH && request !== undefined && typeof request.provider === 'string') {
            const prefixed = /^([A-Za-z0-9._-]+)::(.+)$/.exec(request.provider)
            if (prefixed !== null && byId.has(prefixed[1])) {
              const forced = prefixed[1]
              const owner = typeof request.sessionId === 'string' ? findAuthority(request.sessionId) : null
              if (owner !== forced) {
                sendRemoteFailure(res, parsed, 'authority/model-wrong-host',
                  `模型「${prefixed[2]}」属于远端 ${forced}；请在与该远端关联的会话里切换。`)
                return
              }
              request = { ...request, provider: prefixed[2] }
              parsed = { ...parsed, payload: { ...parsed.payload, args: { ...parsed.payload.args, request } } }
              target = forced
            }
          }
          if (target !== null && url === SELECT_MODEL_PATH && request !== undefined && request !== null && typeof request.provider === 'string') {
            const catalog = await authorityCatalog(byId.get(target))
            if (catalog !== null) {
              const available = (catalog.groups ?? []).some((group) =>
                group.id === request.provider && (group.models ?? []).some((model) => model.id === request.model))
              if (!available) {
                sendRemoteFailure(res, parsed, 'authority/model-unavailable',
                  `远端 ${target} 上没有模型 ${request.provider}/${String(request.model)}；它可能只在本机可用。`)
                return
              }
            }
          }
          const idListKey = ID_LIST_KEYS[url] ?? null
          if (idListKey !== null) await warmIdLists()
          if (target !== null) {
            const encoded = JSON.stringify({
              ...parsed,
              payload: { ...parsed.payload, args: stripNamespace(target, parsed.payload.args) },
            })
            const upstream = await authorityRaw(byId.get(target), url, encoded)
            const text = url === '/api/session/create' || url === '/api/session/fork'
              ? namespaceMintedSession(upstream.text, target)
              : idListKey === null ? upstream.text : unionIdList(upstream.text, idListKey, target)
            const buf = Buffer.from(text, 'utf8')
            res.writeHead(upstream.status, { 'content-type': 'application/json', 'content-length': String(buf.byteLength) })
            res.end(buf)
            return
          }
          const localText = await localApi(ctx.webServer.port, url, body, req.headers)
          const mergedLocal = idListKey === null ? localText : unionIdList(localText, idListKey, null)
          const buf = Buffer.from(mergedLocal, 'utf8')
          res.writeHead(200, { 'content-type': 'application/json', 'content-length': String(buf.byteLength) })
          res.end(buf)
          return
        }
        const localText = await localApi(ctx.webServer.port, '/api/session/list', body, req.headers)
        const payload = JSON.parse(localText)
        const localItems = payload?.result?.value?.items ?? []
        const remote = await Promise.all([...byId.values()].map(async (a) => {
          try {
            const value = await remoteValue(a, 'session/list', { _request: {} })
            return (value?.items ?? []).map((item) => ({
              ...item,
              sessionId: `@authority/${a.id}/${item.sessionId}`,
              ...(item.parentSessionId === undefined ? {} : { parentSessionId: `@authority/${a.id}/${item.parentSessionId}` }),
            }))
          } catch {
            return []
          }
        }))
        payload.result.value.items = [...localItems, ...remote.flat()]
        const out = Buffer.from(JSON.stringify(payload), 'utf8')
        res.writeHead(200, { 'content-type': 'application/json', 'content-length': String(out.byteLength) })
        res.end(out)
      } catch (error) {
        failResponse(res, 502, JSON.stringify({ error: String(error) }), 'application/json')
      }
    })
  })

  ctx.inject(['webServer'], (webCtx) => {
    webCtx.on('webserver/index-inject', (table) => {
      const origin = `http://127.0.0.1:${String(ctx.webServer?.port ?? 0)}/`
      // A desktop shell owns its own transport (Electron forwarding / IPC), so only
      // redirect the mux when nobody else already provides one.
      const hasTransport = Array.isArray(table) && table.some((entry) => entry?.name === '__DSH_TRANSPORT__')
      if (!hasTransport) {
        table.push({
          kind: 'global',
          name: '__DSH_TRANSPORT__',
          value: { streamBaseUrl: origin + 'mhr-mux/' },
        })
      }
      table.push({
        kind: 'global',
        name: '__DSH_AUTHORITY_ORIGIN__',
        value: origin,
      })
      table.push({
        kind: 'global',
        name: '__DSH_AUTHORITIES__',
        value: [...byId.values()].map((a) => ({ id: a.id, basePath: `${PREFIX}/${a.id}` })),
      })
    })
  })

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'prefix',
        path: PREFIX,
        handler: (req, res) => {
          const match = /^\/authority\/([^/?#]+)(\/[^?#]*)?(\?[^#]*)?$/.exec(req.url ?? '')
          if (match === null) { res.writeHead(404); res.end('unknown authority path'); return }
          const a = byId.get(decodeURIComponent(match[1]))
          if (a === undefined) { res.writeHead(404); res.end('unknown authority'); return }
          const target = (match[2] ?? '/') + (match[3] ?? '')
          try {
            forwardHttp(a, target, req, res, false)
          } catch (error) {
            failResponse(res, 502, 'authority unreachable: ' + String(error?.message ?? error))
          }
        },
      }),
    'authority-proxy: HTTP prefix',
  )

  // --- Runtime authority registry: add/remove without restarting the Host ---
  const upgradeDisposers = new Map()

  /** Drop one authority's live subscriptions and WS route, but keep its registry row. */
  function stopAuthority(id) {
    const dispose = upgradeDisposers.get(id)
    if (dispose !== undefined) { dispose(); upgradeDisposers.delete(id) }
    for (const stop of authorityStoppers) {
      try { stop(id) } catch { /* ignore */ }
    }
  }

  function unregisterAuthority(id) {
    stopAuthority(id)
    byId.delete(id)
  }

  ctx.inject(['webServer', 'connection'], (adminCtx) => {
    const authoritiesJson = () => [...byId.values()].map((a) => {
      const row = {
        id: a.id,
        upstream: a.upstream.origin,
        source: a.source ?? 'config',
      }
      if (a.ssh !== undefined) {
        row.supervised = true
        row.ssh = { host: a.ssh.host, localPort: a.ssh.localPort, remotePort: a.ssh.remotePort }
        row.connection = supervisor.has(a.id) ? supervisor.statusOf(a.id) : null
        row.remote = {
          managed: true,
          dsh: a.remote?.dsh ?? null,
          home: a.remote?.home ?? null,
          logFile: a.remote?.logFile ?? null,
        }
        row.fromConfig = staticIds.has(a.id)
      }
      return row
    })

    function registerAuthority(a) {
      if (upgradeDisposers.has(a.id)) return
      upgradeDisposers.set(a.id, adminCtx.webServer.registerUpgrade({
        path: `${PREFIX}/${a.id}${STREAM_PATH}`,
        handler: (req, socket, head) => {
          forwardUpgrade(a, STREAM_PATH, req, socket, head).catch(() => { try { socket.destroy() } catch { /* ignore */ } })
        },
      }))
      for (const start of authorityStarters) {
        try { start(a.id) } catch { /* ignore */ }
      }
    }
    /** Define one supervised authority: register it when the link is up, stop its
     *  subscriptions while it is down, and keep trying in the background. */
    function defineSupervised(a) {
      const state = supervisor.define(a.id, {
        host: a.ssh.host,
        localPort: a.ssh.localPort,
        remotePort: a.ssh.remotePort,
        identityFile: a.ssh.identityFile,
        dsh: a.remote?.dsh,
        home: a.remote?.home,
        profile: a.remote?.profile,
        logFile: a.remote?.logFile ?? '/tmp/mhr-remote-' + a.id + '.log',
        command: a.remote?.command,
        autoReconnect: a.autoReconnect !== false,
        healthIntervalMs: a.healthIntervalMs,
      })
      // The supervisor may have discovered a fresh token (remote started by us):
      // the proxy's cookie exchange must use it too.
      state.onUp = () => { a.token = state.token; a.cookie = null; registerAuthority(a) }
      // The supervisor may have moved off a busy local port; keep the proxy upstream and
      // the persisted entry in step with the port the tunnel actually bound.
      state.onPort = (port) => {
        const previous = a.ssh.localPort
        a.ssh.localPort = port
        a.upstream = new URL('http://127.0.0.1:' + String(port))
        const current = dynamicEntries.get(a.id)
        const base = current ?? { id: a.id, ssh: { host: a.ssh.host, localPort: port, remotePort: a.ssh.remotePort, identityFile: a.ssh.identityFile }, remote: a.remote ?? {}, autoReconnect: a.autoReconnect }
        dynamicEntries.set(a.id, { ...base, ssh: { ...base.ssh, localPort: port } })
        try { saveStore() } catch { /* ignore */ }
        console.log('[authority-proxy] ' + a.id + ' local port moved ' + String(previous) + ' -> ' + String(port))
      }
      state.onDown = () => { stopAuthority(a.id) }
      void supervisor.connect(a.id)
      return state
    }
    for (const a of byId.values()) if (a.ssh === undefined) registerAuthority(a)
    for (const a of byId.values()) if (a.ssh !== undefined) defineSupervised(a)

    adminCtx.effect(() => () => {
      supervisor.dispose()
      for (const dispose of upgradeDisposers.values()) dispose()
      upgradeDisposers.clear()
    }, 'authority-proxy: WS routes')

    const sendJson = (res, status, value) => {
      const body = Buffer.from(JSON.stringify(value), 'utf8')
      res.writeHead(status, { 'content-type': 'application/json', 'content-length': String(body.byteLength) })
      res.end(body)
    }
    const readJson = (req) => new Promise((resolve) => {
      const chunks = []
      let size = 0
      req.on('data', (chunk) => { size += chunk.length; if (size > 65536) { req.destroy(); return } chunks.push(chunk) })
      req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')) } catch { resolve(null) } })
      req.on('error', () => resolve(null))
    })

    const disposeAdmin = adminCtx.webServer.register({
      kind: 'prefix',
      path: ADMIN_PREFIX,
      handler: async (req, res) => {
        const url = new URL(req.url ?? '/', 'http://127.0.0.1')
        const action = url.pathname.slice(ADMIN_PREFIX.length)
        // The operator's own browser is the only admitted caller.
        let admitted = false
        try { admitted = !('rejection' in adminCtx.connection.admit(req)) } catch { admitted = false }
        if (!admitted) { sendJson(res, 401, { ok: false, error: 'unauthorized' }); return }
        try {
          if (req.method === 'GET' && action === '/ssh-hosts') {
            sendJson(res, 200, { ok: true, value: { hosts: sshConfigHosts() } })
            return
          }
          if (req.method === 'GET' && action === '/id-lists') {
            sendJson(res, 200, { ok: true, value: { local: localIdLists, remote: Object.fromEntries(remoteIdLists), baselineKeys: Object.fromEntries(remoteBaselineKeys) } })
            return
          }
          if (req.method === 'GET' && action === '/suggest-ports') {
            const localPort = await suggestLocalPort()
            const remotePort = Number(url.searchParams.get('remotePort') ?? DEFAULT_REMOTE_PORT)
            sendJson(res, 200, { ok: true, value: { localPort, remotePort: Number.isInteger(remotePort) ? remotePort : DEFAULT_REMOTE_PORT } })
            return
          }
          if (req.method === 'GET' && action === '/remote-ui-url') {
            const id = String(url.searchParams.get('id') ?? '')
            const authority = byId.get(id)
            if (authority === undefined) { sendJson(res, 404, { ok: false, error: 'no such authority: ' + id }); return }
            const port = authority.ssh === undefined ? undefined : authority.ssh.localPort
            if (port === undefined) { sendJson(res, 400, { ok: false, error: 'authority 没有 ssh 隧道端口' }); return }
            const link = new URL('http://127.0.0.1:' + String(port) + '/')
            if (typeof authority.token === 'string' && authority.token !== '') link.searchParams.set('token', authority.token)
            sendJson(res, 200, { ok: true, value: { url: link.toString() } })
            return
          }
          if (req.method === 'GET' && (action === '' || action === '/' || action === '/authorities')) {
            sendJson(res, 200, { ok: true, value: { authorities: authoritiesJson() } })
            return
          }
          if (req.method === 'POST' && action === '/authorities/add') {
            const body = await readJson(req)
            const id = String(body?.id ?? '').trim()
            if (!/^[A-Za-z0-9._-]{1,32}$/.test(id)) { sendJson(res, 400, { ok: false, error: 'id 需为 1-32 位字母/数字/._-' }); return }
            if (byId.has(id)) { sendJson(res, 409, { ok: false, error: `已存在同名 authority: ${id}` }); return }
            const ssh = body?.ssh === undefined || body?.ssh === null ? undefined : body.ssh
            if (ssh === undefined) { sendJson(res, 400, { ok: false, error: "只支持 ssh 托管：缺少 ssh 配置" }); return }
            const host = String(ssh.host ?? '').trim()
            if (host === '') { sendJson(res, 400, { ok: false, error: 'ssh 需要 host' }); return }
            const askedLocal = Number(ssh.localPort)
            const askedRemote = Number(ssh.remotePort)
            const localPort = Number.isInteger(askedLocal) && askedLocal > 0 ? askedLocal : await suggestLocalPort()
            const remotePort = Number.isInteger(askedRemote) && askedRemote > 0 ? askedRemote : DEFAULT_REMOTE_PORT
            const entry = {
              id,
              ssh: { host, localPort, remotePort, identityFile: ssh.identityFile },
              remote: body?.remote ?? {},
              autoReconnect: body?.autoReconnect,
            }
            const supervised = authorityFromEntry(entry, 'store')
            byId.set(id, supervised)
            dynamicEntries.set(id, entry)
            disabled.delete(id)
            saveStore()
            defineSupervised(supervised)
            sendJson(res, 200, { ok: true, value: { authorities: authoritiesJson() } })
            return
          }
if (req.method === 'POST' && action === '/authorities/update') {
	const body = await readJson(req)
	const id = String(body?.id ?? '').trim()
	const existing = byId.get(id)
	if (existing === undefined) { sendJson(res, 404, { ok: false, error: '没有这个 authority: ' + id }); return }
	if (existing.ssh === undefined) { sendJson(res, 400, { ok: false, error: '该 authority 不是 ssh 托管，无法编辑' }); return }
	const ssh = body?.ssh === undefined || body?.ssh === null ? {} : body.ssh
	const host = String(ssh.host ?? existing.ssh.host).trim()
	const localPort = Number(ssh.localPort ?? existing.ssh.localPort)
	const remotePort = Number(ssh.remotePort ?? existing.ssh.remotePort)
	if (host === '' || !Number.isInteger(localPort) || localPort <= 0 || !Number.isInteger(remotePort) || remotePort <= 0) {
		sendJson(res, 400, { ok: false, error: 'ssh 需要 host、localPort、remotePort' })
		return
	}
	const remote = body?.remote ?? existing.remote ?? {}
	// Rebuild the supervised authority: drop the old tunnel and subscriptions first.
	if (supervisor.has(id)) supervisor.remove(id)
	stopAuthority(id)
	const entry = {
		id,
		ssh: { host, localPort, remotePort, identityFile: ssh.identityFile ?? existing.ssh.identityFile },
		remote,
		autoReconnect: body?.autoReconnect ?? existing.autoReconnect,
	}
	dynamicEntries.set(id, entry)
	disabled.delete(id)
	saveStore()
	const authority = authorityFromEntry(entry, 'store')
	byId.set(id, authority)
	defineSupervised(authority)
	sendJson(res, 200, { ok: true, value: { authorities: authoritiesJson() } })
	return
}
          if (req.method === 'POST' && action === '/authorities/remove') {
            const body = await readJson(req)
            const id = String(body?.id ?? '')
            if (!byId.has(id)) { sendJson(res, 404, { ok: false, error: '没有这个 authority' }); return }
            unregisterAuthority(id)
            if (supervisor.has(id)) supervisor.remove(id)
            dynamicEntries.delete(id)
            if (staticIds.has(id)) disabled.add(id)
            saveStore()
            sendJson(res, 200, { ok: true, value: { authorities: authoritiesJson() } })
            return
          }
          if (req.method === 'POST' && (action === '/authorities/connect' || action === '/authorities/disconnect' || action === '/authorities/restart' || action === '/authorities/restart-remote')) {
            const body = await readJson(req)
            const id = String(body?.id ?? '')
            if (!supervisor.has(id)) { sendJson(res, 404, { ok: false, error: '该 authority 不在连接托管中（未配置 ssh）' }); return }
            if (action === '/authorities/connect') await supervisor.connect(id)
            else if (action === '/authorities/disconnect') supervisor.disconnect(id)
            else if (action === '/authorities/restart-remote') await supervisor.restartRemote(id)
            else await supervisor.restart(id)
            sendJson(res, 200, { ok: true, value: { connection: supervisor.statusOf(id), authorities: authoritiesJson() } })
            return
          }
          if (req.method === 'GET' && action === '/authorities/status') {
            sendJson(res, 200, { ok: true, value: { statuses: supervisor.statuses() } })
            return
          }
          sendJson(res, 404, { ok: false, error: '未知的 admin 操作' })
        } catch (error) {
          sendJson(res, 500, { ok: false, error: String(error?.message ?? error) })
        }
      },
    })
    adminCtx.effect(() => () => disposeAdmin(), 'authority-proxy: admin api')
  })

  // --- Directory picker: prefer the browse (in-app browser) backend so the sidebar
  // add-workspace flow can browse remote hosts as virtual roots. The official adaptive
  // row resolves native on an attended macOS host, whose OS dialog cannot reach a remote
  // filesystem; swapping it here keeps the install to this one plugin row. It runs only
  // once the official picker service exists (Cordis injection ordering) and stays native
  // on any failure, so the official interaction is never left broken.
  const PICKER_PACKAGES = {
    native: {
      backend: '@deepseek-ai/dsh-host-directory-picker-native',
      surface: '@deepseek-ai/dsh-client-ui-directory-picker-native',
    },
    browse: {
      backend: '@deepseek-ai/dsh-host-directory-picker-browse',
      surface: '@deepseek-ai/dsh-client-ui-directory-picker-browse',
    },
  }

  async function preferBrowseDirectoryPicker(pickerCtx) {
    try {
      if (pickerCtx.directoryPicker?.capability?.().kind !== 'native') return
      const loader = pickerCtx.loader
      const store = loader.store ?? {}
      const loaded = Object.entries(store)
      const findEntry = (packageName) => {
        for (const [id, entry] of loaded) {
          if (entry?.options?.name === packageName) return { id, entry }
        }
        return undefined
      }
      const doomed = [findEntry(PICKER_PACKAGES.native.surface), findEntry(PICKER_PACKAGES.native.backend)].filter(Boolean)
      if (doomed.length === 0) return
      // Surface first: it occupies the single-occupancy slot the browse surface needs,
      // and the backend's disposal releases ctx.directoryPicker.
      for (const target of doomed) {
        try {
          const disposal = target.entry.fiber?.dispose?.()
          loader.remove(target.id)
          await disposal
        } catch {
          /* the entry was already gone */
        }
      }
      for (const packageName of [PICKER_PACKAGES.browse.backend, PICKER_PACKAGES.browse.surface]) {
        const id = await loader.create({ name: packageName })
        const created = loader.resolve(id)
        if (created?.fiber === undefined) throw new Error('could not mount ' + packageName)
        await created.fiber.await()
      }
      console.log('[authority-proxy] directory picker switched to browse')
    } catch (error) {
      console.error('[authority-proxy] directory picker browse switch failed', String(error?.message ?? error))
    }
  }

  ctx.inject(['loader', 'directoryPicker'], (pickerCtx) => {
    void preferBrowseDirectoryPicker(pickerCtx)
  })
}

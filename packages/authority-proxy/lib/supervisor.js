/**
 * authority-proxy / connection supervisor.
 *
 * One authority's connectivity, managed end to end: the ssh tunnel to its dsh web
 * host, the remote host process itself (optionally), health probing, automatic
 * reconnect, and a bounded log ring the panel can show.
 *
 * All of this is host-side Node; no official dsh package is touched. The
 * version-bound facts (the remote dsh web flags and the token line it prints)
 * live in remoteStartCommand() and TOKEN_PATTERN so a release only re-derives
 * those two spots.
 */
import { spawn } from 'node:child_process'
import net from 'node:net'

/** The token a remote dsh web prints on startup: ... /?token=<id>. */
const TOKEN_PATTERN = /token=([A-Za-z0-9_-]+)/

function quote(value) {
  return "'" + String(value).replace(/'/g, "'\\''") + "'"
}

/** The remote start command; spec.command overrides it wholesale. */
function remoteStartCommand(spec) {
  if (typeof spec.command === 'string' && spec.command.trim() !== '') return spec.command
  const dsh = spec.dsh ?? 'dsh'
  const home = spec.home ?? '~/.dsh'
  const profile = spec.profile ?? 'web'
  const prefix = 'DSH_HOME=' + home + ' nohup ' + dsh + ' --profile ' + profile + ' --host 127.0.0.1 --port ' + String(Number(spec.remotePort) > 0 ? spec.remotePort : 3080) + ' --no-open'
  return prefix + ' >> ' + spec.logFile + ' 2>&1 & echo $!'
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)) }

/** Start one supervised connection set. */
export function createSupervisor(options = {}) {
  const logLimit = options.logLimit ?? 200
  const entries = new Map()

  function record(state, line) {
    const stamp = new Date().toISOString().slice(11, 19)
    state.log.push(stamp + ' ' + line)
    if (state.log.length > logLimit) state.log.splice(0, state.log.length - logLimit)
  }

  function sshArgs(spec) {
    const args = [
      '-o', 'BatchMode=yes',
      '-o', 'ConnectTimeout=10',
      '-o', 'ExitOnForwardFailure=yes',
      '-o', 'ServerAliveInterval=30',
      '-o', 'ServerAliveCountMax=3',
      '-o', 'StrictHostKeyChecking=accept-new',
    ]
    if (spec.identityFile !== undefined) args.push('-i', spec.identityFile)
    return args
  }

  /** One-shot remote command; resolves with trimmed stdout. */
  function runRemote(spec, command, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const child = spawn('ssh', [...sshArgs(spec), spec.host, command], { stdio: ['ignore', 'pipe', 'pipe'] })
      let out = ''
      let err = ''
      const timer = setTimeout(() => { try { child.kill('SIGKILL') } catch { /* gone */ } reject(new Error('ssh timeout')) }, timeoutMs)
      child.stdout.on('data', (chunk) => { out += chunk })
      child.stderr.on('data', (chunk) => { err += chunk })
      child.on('error', (error) => { clearTimeout(timer); reject(error) })
      child.on('exit', (code) => {
        clearTimeout(timer)
        if (code === 0) resolve(out.trim())
        else reject(new Error('ssh exit ' + String(code) + ': ' + err.trim().slice(0, 300)))
      })
    })
  }

  function entryOf(id) {
    const state = entries.get(id)
    if (state === undefined) throw new Error('authority ' + id + ' is not supervised')
    return state
  }

  /**
   * Is the remote dsh web listening on its port?
   * @returns true (listening), false (definitely not listening) or null when the probe
   * itself failed (ssh / network). Only a definite false may trigger a start: treating an
   * unreachable host as "missing" would spawn a second instance or lose the token.
   */
  async function remoteListening(state) {
    const spec = state.spec
    try {
      const command = "(ss -ltn 2>/dev/null || netstat -ltn 2>/dev/null) | grep -q ':" + String(spec.remotePort) + " ' && echo yes || echo no"
      const out = await runRemote(spec, command, 15000)
      if (out.includes('yes')) return true
      if (out.includes('no')) return false
      return null
    } catch (error) {
      record(state, 'remote probe failed: ' + String(error?.message ?? error))
      return null
    }
  }

  /** Reuse the remote host, or start it when the spec allows. */
  async function ensureRemote(state) {
    const spec = state.spec
    if (spec.remotePort === undefined) return { started: false }
    const listening = await remoteListening(state)
    if (listening === true) { state.remote = 'running'; return { started: false } }
    if (listening === null) throw new Error('cannot reach the remote host to check its dsh web')
    state.remote = 'missing'
    state.remote = 'starting'
    record(state, 'remote dsh missing; starting it')
    await runRemote(spec, remoteStartCommand(spec))
    const deadline = Date.now() + 30000
    while (Date.now() < deadline) {
      await sleep(1000)
      if ((await remoteListening(state)) === true) {
        state.remote = 'running'
        record(state, 'remote dsh is up')
        return { started: true }
      }
    }
    throw new Error('remote dsh did not come up within 30s')
  }

  /** Read the token the remote printed into its log file. */
  async function discoverToken(state) {
    const spec = state.spec
    const deadline = Date.now() + 20000
    const command = 'tail -40 ' + spec.logFile + ' 2>/dev/null | grep -o ' + quote('token=[A-Za-z0-9_-]*') + ' | tail -1'
    while (Date.now() < deadline) {
      const out = await runRemote(spec, command, 15000)
      const match = TOKEN_PATTERN.exec(out)
      if (match !== null) return match[1]
      await sleep(1000)
    }
    throw new Error('no token in the remote log yet')
  }

  /** Exchange the token for a cookie and list sessions through the tunnel. */
  async function probe(state) {
    const spec = state.spec
    const token = state.token
    if (token === undefined || token === null || token === '' || state.localPort === undefined) return false
    try {
      const base = 'http://127.0.0.1:' + String(state.localPort)
      const auth = await fetch(base + '/?token=' + encodeURIComponent(token), { redirect: 'manual', signal: AbortSignal.timeout(8000) })
      const cookie = (auth.headers.getSetCookie?.() ?? []).map((value) => value.split(';')[0]).join('; ')
      if (cookie === '') return false
      const response = await fetch(base + '/api/session/list', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ type: 'client-request', rpcId: 'mhr-probe', method: 'session/list', payload: { args: { _request: {} } } }),
        signal: AbortSignal.timeout(8000),
      })
      if (response.status !== 200) return false
      const payload = await response.json()
      return payload?.result?.ok === true
    } catch {
      return false
    }
  }

  function stopTunnel(state) {
    const child = state.child
    state.child = null
    if (child !== null && child !== undefined) {
      try { child.kill('SIGTERM') } catch { /* already gone */ }
    }
  }

  function clearTimers(state) {
    if (state.reconnectTimer !== null) { clearTimeout(state.reconnectTimer); state.reconnectTimer = null }
    if (state.healthTimer !== null) { clearInterval(state.healthTimer); state.healthTimer = null }
    if (state.watchTimer !== null) { clearInterval(state.watchTimer); state.watchTimer = null }
  }

  function scheduleReconnect(state) {
    if (state.stopping || state.spec.autoReconnect === false) { state.status = 'down'; state.onDown?.(); return }
    if (state.reconnectTimer !== null) { clearTimeout(state.reconnectTimer); state.reconnectTimer = null }
    state.status = 'reconnecting'
    state.attempts += 1
    const delay = Math.min(1000 * 2 ** Math.min(state.attempts - 1, 5), 30000)
    record(state, 'reconnecting in ' + String(Math.round(delay / 1000)) + 's (attempt ' + String(state.attempts) + ')')
    state.reconnectTimer = setTimeout(() => { state.reconnectTimer = null; void connect(state.id) }, delay)
  }

  /** Does this ssh stderr say the local port could not be bound? */
  function busyPort(text) {
    return /address already in use|cannot listen to port|could not request local forwarding/i.test(String(text))
  }

  /** Find a free loopback port at or after `from`, so a busy one can be replaced. */
  async function nextFreePort(from) {
    for (let port = from; port < from + 200; port++) {
      const free = await new Promise((resolve) => {
        const probe = net.createServer()
        probe.once('error', () => resolve(false))
        probe.once('listening', () => probe.close(() => resolve(true)))
        probe.listen(port, '127.0.0.1')
      })
      if (free) return port
    }
    return from
  }

  /** One tunnel attempt: true when healthy, "busy" when the local port is taken meanwhile. */
  async function startTunnelOnce(state) {
    const spec = state.spec
    state.stderr = ''
    state.settled = false
    const args = [
      ...sshArgs(spec),
      '-N',
      '-L', '127.0.0.1:' + String(state.localPort) + ':127.0.0.1:' + String(spec.remotePort),
      spec.host,
    ]
    record(state, 'ssh -N -L ' + String(state.localPort) + ':127.0.0.1:' + String(spec.remotePort) + ' ' + spec.host)
    const child = spawn('ssh', args, { stdio: ['ignore', 'pipe', 'pipe'] })
    state.child = child
    child.stderr.on('data', (chunk) => {
      const text = String(chunk).trim()
      if (text !== '') {
        state.stderr = (state.stderr + ' ' + text).slice(-1000)
        record(state, 'ssh: ' + text.slice(0, 300))
      }
    })
    child.on('exit', (code, signal) => {
      if (state.child !== child) return
      state.child = null
      if (state.healthTimer !== null) { clearInterval(state.healthTimer); state.healthTimer = null }
      record(state, 'tunnel exited (' + String(code) + '/' + String(signal) + ')')
      // While connect() waits for the tunnel it owns the retry; after the tunnel was
      // already reported healthy, an unexpected exit goes back through the reconnect path.
      if (state.settled === true) scheduleReconnect(state)
    })
    const deadline = Date.now() + 25000
    while (Date.now() < deadline) {
      if (state.child !== child) return busyPort(state.stderr) ? 'busy' : false
      await sleep(700)
      if (await probe(state)) {
        state.settled = true
        return true
      }
    }
    stopTunnel(state)
    throw new Error('tunnel did not become healthy')
  }

  /**
   * Start the tunnel, moving to a free local port when ours was taken meanwhile.
   * The suggested port can always lose a race (another tunnel, autossh, ...): never
   * keep retrying a port ssh cannot bind or the authority stays in "connecting" forever.
   */
  async function startTunnel(state) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const outcome = await startTunnelOnce(state)
      if (outcome === true) return true
      if (outcome !== 'busy') throw new Error('tunnel closed during connect')
      const busy = state.localPort
      const next = await nextFreePort(busy + 1)
      state.localPort = next
      state.attempts = 0
      record(state, 'local port ' + String(busy) + ' is busy; switching to ' + String(next))
      state.onPort?.(next)
    }
    throw new Error('could not bind a free local port for the tunnel')
  }

  function startHealthLoop(state) {
    if (state.healthTimer !== null) clearInterval(state.healthTimer)
    const interval = state.spec.healthIntervalMs ?? 30000
    state.healthTimer = setInterval(() => {
      void (async () => {
        if (state.stopping || state.healthTimer === null) return
        if (await probe(state)) { state.failures = 0; return }
        state.failures += 1
        record(state, 'health probe failed (' + String(state.failures) + ')')
        if (state.failures >= 2) {
          state.failures = 0
          record(state, 'restarting the tunnel')
          stopTunnel(state)
        }
      })()
    }, interval)
  }

  /** Discover the token again and hand it to the authority registry. */
  async function applyDiscoveredToken(state) {
    const token = await discoverToken(state)
    state.token = token
    state.onToken?.(token)
    record(state, 'token refreshed')
    return token
  }

  function remoteManaged(state) {
    return state.spec.remotePort !== undefined
  }

  /**
   * Restart the remote dsh web itself: kill it by port, start it again, and refresh
   * the token (the tunnel stays up; the forward is unaffected).
   */
  async function restartRemote(id) {
    const state = entryOf(id)
    if (!remoteManaged(state)) throw new Error('这个 authority 没有配置远端端口，无法重启远端 dsh')
    record(state, 'restarting the remote dsh')
    state.status = 'reconnecting'
    try {
// Kill whatever holds the remote port. A legacy `dsh web --no-open` process has no
// --port in its command line, so pkill alone would miss it and our start would fail.
const killByPort = 'for pid in $(lsof -ti tcp:' + String(state.spec.remotePort) + ' -sTCP:LISTEN 2>/dev/null); do kill $pid 2>/dev/null; done; pkill -f ' + quote('[p]ort ' + String(state.spec.remotePort)) + ' 2>/dev/null; true'
await runRemote(state.spec, killByPort, 15000)
    } catch { /* the port may already be free */ }
    const free = Date.now() + 10000
    while (Date.now() < free && (await remoteListening(state)) === true) await sleep(500)
    await runRemote(state.spec, remoteStartCommand(state.spec))
    const deadline = Date.now() + 30000
    let up = (await remoteListening(state)) === true
    while (!up && Date.now() < deadline) { await sleep(1000); up = (await remoteListening(state)) === true }
    if (!up) { state.status = 'up'; throw new Error('remote dsh did not come back within 30s') }
    await applyDiscoveredToken(state)
    state.status = 'up'
    state.lastError = null
    record(state, 'remote dsh restarted')
    state.onUp?.()
    return state.status
  }

  /** Watch the remote process: a managed remote that died is started again (fresh token). */
  function startRemoteWatch(state) {
    if (state.watchTimer !== null) clearInterval(state.watchTimer)
    if (!remoteManaged(state)) return
    state.watchTimer = setInterval(() => {
      void (async () => {
        if (state.stopping || state.status !== 'up') return
        const listening = await remoteListening(state)
        if (listening !== false) return
        record(state, 'remote dsh is gone; starting it')
        try {
          await runRemote(state.spec, remoteStartCommand(state.spec))
          const deadline = Date.now() + 30000
          let up = (await remoteListening(state)) === true
          while (!up && Date.now() < deadline) { await sleep(1000); up = (await remoteListening(state)) === true }
          if (!up) throw new Error('did not come back within 30s')
          await applyDiscoveredToken(state)
          record(state, 'remote dsh is back')
          state.onUp?.()
        } catch (error) {
          record(state, 'remote restart failed: ' + String(error?.message ?? error))
        }
      })()
    }, state.spec.remoteWatchMs ?? 20000)
  }

  async function connect(id) {
    const state = entryOf(id)
    if (state.status === 'connecting') return state.status
    state.stopping = false
    state.status = 'connecting'
    try {
      const remote = await ensureRemote(state)
      if (state.token === undefined || remote.started === true) {
        try {
          state.token = await discoverToken(state)
          state.onToken?.(state.token)
          record(state, 'token discovered')
        } catch (error) {
          record(state, 'no usable token in the remote log; restarting the managed remote')
          await restartRemote(state.id)
          if (state.token === undefined) throw error
        }
      }
      if (state.token === undefined) throw new Error('could not obtain a remote token')
      try {
      	await startTunnel(state)
      } catch (error) {
      	// The tunnel never became healthy. Do not kill the remote on every hiccup:
      	// 1) nothing on the port -> plain retry, the remote is simply away;
      	// 2) a dsh web answers but our token is stale (it rotated) -> re-read the log token;
      	// 3) it still does not fit -> the instance is not ours: take it over, at most every 2 min.
      	if (!remoteManaged(state)) throw error
      	const listening = await remoteListening(state)
      	if (listening !== true) throw error
      	const fresh = await discoverToken(state).catch(() => undefined)
      	if (fresh !== undefined && fresh !== state.token) {
      		state.token = fresh
      		state.onToken?.(fresh)
      		record(state, 'remote token rotated; retrying with the fresh one')
      		await startTunnel(state)
      	} else {
      		if (Date.now() - state.lastTakeoverAt < 120000) throw error
      		state.lastTakeoverAt = Date.now()
      		record(state, 'the dsh web on the port rejects our token; taking the remote over')
      		await restartRemote(state.id)
      		await startTunnel(state)
      	}
      }
      state.status = 'up'
      state.attempts = 0
      state.failures = 0
      state.lastError = null
      record(state, 'connected')
      startHealthLoop(state)
      startRemoteWatch(state)
      state.onUp?.()
      return state.status
    } catch (error) {
      state.lastError = String(error?.message ?? error)
      record(state, 'connect failed: ' + state.lastError)
      stopTunnel(state)
      scheduleReconnect(state)
      return state.status
    }
  }

  function disconnect(id) {
    const state = entryOf(id)
    state.stopping = true
    clearTimers(state)
    stopTunnel(state)
    state.status = 'down'
    record(state, 'disconnected by operator')
    state.onDown?.()
  }

  async function restart(id) {
    const state = entryOf(id)
    record(state, 'restart requested')
    state.stopping = true
    clearTimers(state)
    stopTunnel(state)
    state.token = undefined
    await sleep(500)
    state.stopping = false
    return await connect(id)
  }

  return {
    define(id, spec) {
      const state = {
        id,
        spec,
        remotePort: Number(spec.remotePort) > 0 ? Number(spec.remotePort) : 3080,
        localPort: spec.localPort,
        stderr: '',
        settled: false,
        onPort: null,
        lastTakeoverAt: 0,
        status: 'down',
        remote: 'unknown',
        token: undefined,
        child: null,
        reconnectTimer: null,
        healthTimer: null,
        watchTimer: null,
        attempts: 0,
        failures: 0,
        stopping: false,
        lastError: null,
        log: [],
        onUp: null,
        onDown: null,
      }
      entries.set(id, state)
      return state
    },
    statusOf(id) {
      const state = entryOf(id)
      return {
        id: state.id,
        status: state.status,
        remote: state.remote,
        token: state.token === undefined ? null : 'set',
        localPort: state.localPort,
        lastError: state.lastError,
        log: state.log.slice(-40),
      }
    },
    statuses() { return [...entries.keys()].map((key) => this.statusOf(key)) },
    has(id) { return entries.has(id) },
    isUp(id) { return entryOf(id).status === 'up' },
    connect,
    disconnect,
    restart,
    restartRemote,
    remove(id) {
      const state = entries.get(id)
      if (state === undefined) return
      disconnect(id)
      entries.delete(id)
    },
    dispose() { for (const id of [...entries.keys()]) this.remove(id) },
  }
}

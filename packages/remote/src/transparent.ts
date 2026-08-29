/** SSH transport for an official remote DSH Web/API authority. */

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createServer, type Server } from 'node:net'

/** One SSH-forwarded official DSH API endpoint. */
export interface RemoteApiForward {
  readonly localPort: number
  readonly remotePort: number
  readonly process: ChildProcessWithoutNullStreams
  close(): Promise<void>
}

/** Options for opening a loopback-only SSH port forward. */
export interface RemoteApiForwardOptions {
  /** OpenSSH alias or hostname; authentication remains OpenSSH-owned. */
  host: string
  /** Official DSH Web/API port on the remote loopback interface. */
  remotePort: number
  /** Optional local port; an available loopback port is selected when absent. */
  localPort?: number
  /** SSH connection deadline in seconds. */
  connectTimeoutSeconds?: number
  /** Injectable process launcher for tests. */
  spawn?: typeof spawn
}

/** Reserve a loopback port without exposing it to other hosts. */
async function reservePort(port: number | undefined): Promise<{ server: Server; localPort: number }> {
  const server = createServer()
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen({ host: '127.0.0.1', port: port ?? 0 }, () => {
      server.off('error', reject)
      resolve()
    })
  })
  const address = server.address()
  if (address === null || typeof address === 'string') {
    server.close()
    throw new Error('SSH forward did not receive a loopback port')
  }
  return { server, localPort: address.port }
}

/**
 * Open `127.0.0.1:<localPort> -> remote loopback:<remotePort>` through OpenSSH.
 * No application payload is decoded or translated by this transport.
 *
 * @param options - SSH alias and official remote API port.
 * @returns the live forward and its loopback port.
 */
export async function openRemoteApiForward(options: RemoteApiForwardOptions): Promise<RemoteApiForward> {
  const reserved = await reservePort(options.localPort)
  await new Promise<void>((resolve, reject) => { reserved.server.close(error => error === undefined ? resolve() : reject(error)) })
  const launch = options.spawn ?? spawn
  const timeout = options.connectTimeoutSeconds ?? 10
  const process = launch('ssh', [
    '-N', '-T', '-o', 'BatchMode=yes', '-o', 'ExitOnForwardFailure=yes', '-o', `ConnectTimeout=${timeout}`,
    // Keepalive probes so silent drops (remote hang, blackholed network) also
    // terminate the tunnel instead of hanging forever — that exit is what
    // triggers the host-side auto-reconnect.
    '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=4',
    '-L', `127.0.0.1:${reserved.localPort}:127.0.0.1:${options.remotePort}`,
    options.host,
  ], { stdio: ['pipe', 'pipe', 'pipe'] })
  let stderr = ''
  process.stderr.setEncoding('utf8')
  process.stderr.on('data', (chunk: string) => { stderr = (stderr + chunk).slice(-4096) })
  const close = async (): Promise<void> => {
    if (process.exitCode !== null || process.signalCode !== null) return
    process.kill('SIGTERM')
    await new Promise<void>(resolve => { process.once('exit', () => { resolve() }) })
  }
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { reject(new Error(`SSH forward timed out after ${timeout}s`)); process.kill('SIGTERM') }, timeout * 1000)
    process.once('error', error => { clearTimeout(timer); reject(error) })
    process.stderr.once('data', () => {
      if (stderr.includes('Permission denied') || stderr.includes('Could not resolve')) {
        clearTimeout(timer)
        reject(new Error(stderr.trim()))
      }
    })
    // ssh -N has no application-level ready event; the first writable stdin
    // edge means the child started. The forwarded socket remains the authority
    // check, and failures after this point close the returned process.
    setImmediate(() => { clearTimeout(timer); resolve() })
  })
  return { localPort: reserved.localPort, remotePort: options.remotePort, process, close }
}

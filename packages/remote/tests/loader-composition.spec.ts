/**
 * REAL-composition coverage: a test cordis.yml mounts the Remote Host through
 * the vendored Loader, and assertions observe its Unix socket and durable
 * project registry rather than a directly constructed service.
 */

import { once } from 'node:events'
import { lstat, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { connect, type Socket } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Include from '@deepseek-ai/cordis-plugin-include'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import RemoteProjectHost, { RemoteProjectClient } from '../src/index.ts'

let context: Context | undefined
let root: string | undefined
let socket: Socket | undefined

afterEach(async () => {
  socket?.destroy()
  socket = undefined
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

describe('real Loader composition', () => {
  it('creates persistent projects and removes its private socket on disposal', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-remote-loader-'))
    const socketPath = join(root, 'remote.sock')
    const projectsFile = join(root, 'state', 'projects.json')
    const projectRoot = join(root, 'workspaces', 'alpha')
    const configPath = join(root, 'cordis.yml')
    await writeFile(configPath, [
      "- name: 'dsh-remote/host'",
      '  config:',
      `    socketPath: ${JSON.stringify(socketPath)}`,
      `    projectsFile: ${JSON.stringify(projectsFile)}`,
      '',
    ].join('\n'))

    context = new Context()
    context.baseUrl = pathToFileURL(root).href + '/'
    await context.plugin(Loader)
    context.loader.builtins.include = Include
    context.loader.internal = {
      version: 'v2',
      async import(specifier: string) {
        if (specifier !== 'dsh-remote/host') {
          throw new Error(`unexpected Loader import: ${specifier}`)
        }
        return RemoteProjectHost
      },
    } as unknown as NonNullable<typeof context.loader.internal>
    await context.loader.create({
      name: 'cordis:include',
      config: { path: pathToFileURL(configPath).href },
    })
    await context.loader.await()

    socket = connect(socketPath)
    await once(socket, 'connect')
    const client = new RemoteProjectClient(socket, socket)
    await expect(client.createProject('alpha', projectRoot)).resolves.toEqual({
      project: { id: 'alpha', root: projectRoot },
    })
    await expect(readFile(projectsFile, 'utf8')).resolves.toBe(JSON.stringify({
      version: 0, projects: [{ id: 'alpha', root: projectRoot }],
    }, undefined, 2) + '\n')

    socket.destroy()
    socket = undefined
    await context.fiber.dispose()
    context = undefined
    await expect(lstat(socketPath)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})

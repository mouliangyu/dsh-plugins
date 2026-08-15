import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { discoverSshHostAliases } from '../src/ssh-config.ts'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('discoverSshHostAliases', () => {
  it('lists explicit aliases from the user config and recursive includes', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'dsh-remote-ssh-'))
    roots.push(root)
    const sshDirectory = resolve(root, '.ssh')
    await mkdir(resolve(sshDirectory, 'config.d'), { recursive: true })
    await writeFile(resolve(sshDirectory, 'config'), [
      'Host primary primary-alt',
      '  HostName 192.0.2.1',
      'Include config.d/*.conf',
      'Host *',
      '  ServerAliveInterval 30',
      '',
    ].join('\n'))
    await writeFile(resolve(sshDirectory, 'config.d', 'team.conf'), [
      'Host team-box !blocked',
      '  HostName 198.51.100.2',
      'Include ../config',
      '',
    ].join('\n'))

    await expect(discoverSshHostAliases({ sshDirectory })).resolves.toEqual([
      'primary', 'primary-alt', 'team-box',
    ])
  })

  it('returns an empty list when the user config does not exist', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'dsh-remote-ssh-'))
    roots.push(root)
    await expect(discoverSshHostAliases({ sshDirectory: resolve(root, '.ssh') })).resolves.toEqual([])
  })
})

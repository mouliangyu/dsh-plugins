import { Buffer } from 'node:buffer'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildRemoteBootstrapScript, packRemotePlugin } from '../src/bootstrap.ts'

describe('remote bootstrap', () => {
  it('transfers opaque values and installs a persistent user service', () => {
    const archive = Uint8Array.from([0x1f, 0x8b, 0x08, 0x00])
    const script = buildRemoteBootstrapScript({
      socketPath: '/tmp/private-remote.sock',
      dshPackage: '@deepseek-ai/dsh@0.1.0-rc.6',
      remotePackageArchive: archive,
    })

    expect(script).not.toContain('/tmp/private-remote.sock')
    expect(script).toContain(Buffer.from(archive).toString('base64'))
    expect(script).toContain('npm install --prefix "$runtime/npm"')
    expect(script).toContain('failed to install official remote DSH release')
    expect(script).toContain('npm install --prefix "$profile" --legacy-peer-deps')
    expect(script).toContain('--profile dsh-remote --dump-config')
    const decodedValues = [...script.matchAll(/'(?<value>[A-Za-z0-9+/=]{20,})'/g)]
      .map(match => Buffer.from(match.groups?.value ?? '', 'base64').toString('utf8'))
      .join('\n')
    expect(decodedValues).toContain("pathModule.join(process.env.HOME, '.dsh', 'remote-projects.json')")
    expect(decodedValues).toContain("JSON.stringify(patches, null, 2) + '\\n'")
    expect(script).toContain('systemctl --user restart dsh-remote-host.service')
    expect(script).toContain('launchctl bootstrap')
    expect(script).toContain('nohup "$runtime/node" "$host_script"')
    expect(script).toContain('test -S "$socket_path"')
  })

  it('packs the current plugin with a release-compatible version', async () => {
    const archive = await packRemotePlugin()

    expect(Buffer.from(archive.subarray(0, 3))).toEqual(Buffer.from([0x1f, 0x8b, 0x08]))
    const temporary = mkdtempSync(join(tmpdir(), 'dsh-remote-pack-test-'))
    try {
      const archivePath = join(temporary, 'plugin.tgz')
      writeFileSync(archivePath, archive)
      const manifest = JSON.parse(execFileSync(
        'tar', ['-xOzf', archivePath, 'package/package.json'], { encoding: 'utf8' },
      )) as { dependencies: Record<string, string> }
      expect(manifest.dependencies['@deepseek-ai/dsh-sdk-protocol']).toBe('^0.1.0-rc.6')
    } finally {
      rmSync(temporary, { recursive: true, force: true })
    }
  })
})

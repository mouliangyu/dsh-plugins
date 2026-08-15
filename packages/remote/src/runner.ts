/** Process lifecycle for the persistent remote host. @module dsh-remote/runner */

import { existsSync } from 'node:fs'
import { boot, installFailLoud, loadEnv, resolveConfigPath } from '@deepseek-ai/dsh-app-boot'

const NAME = 'dsh-remote-host'

/**
 * Boot the explicitly selected remote-host configuration and dispose it on a signal.
 * @param bareModuleBaseUrl - installed-runtime base for resolving bare Cordis plugins.
 * @returns after process lifecycle handlers are installed.
 */
export async function runRemoteProjectHost(bareModuleBaseUrl = import.meta.url): Promise<void> {
  installFailLoud(NAME)
  loadEnv(NAME)
  const fromEnv = process.env['DSH_CORDIS_CONFIG']
  const fromArgv = process.argv[2]
  const requested = fromEnv !== undefined && fromEnv !== ''
    ? fromEnv
    : fromArgv !== undefined && fromArgv !== '' ? fromArgv : undefined
  const configPath = requested === undefined ? undefined : resolveConfigPath(requested, undefined)
  if (configPath === undefined || !existsSync(configPath)) {
    process.stderr.write(`usage: ${NAME} <path/to/cordis.yml> (or set DSH_CORDIS_CONFIG)\n`)
    process.exit(1)
  }
  const ctx = await boot(NAME, configPath, undefined, undefined, bareModuleBaseUrl)
  let disposing: Promise<void> | undefined
  const disposeAndExit = (code: number): void => {
    disposing ??= ctx.fiber.dispose().finally(() => { process.exit(code) })
  }
  process.once('SIGTERM', () => { disposeAndExit(0) })
  process.once('SIGINT', () => { disposeAndExit(130) })
}

/** OpenSSH host-alias discovery for the local Web plugin. */

import { glob, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, resolve } from 'node:path'
import SSHConfig, { type Line, type SSHConfig as ParsedSshConfig } from 'ssh-config'

const MAX_CONFIG_FILES = 256
const EXPLICIT_HOST = /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/

/** Options used to locate a user OpenSSH configuration tree. */
export interface SshHostDiscoveryOptions {
  /** Root user config file. */
  configPath?: string
  /** Directory used for relative Include paths and tilde expansion. */
  sshDirectory?: string
}

/**
 * List explicit OpenSSH Host aliases without contacting any remote machine.
 * @param options Configuration paths used for discovery; defaults to the user's `~/.ssh` tree.
 * @returns Sorted aliases that can be selected for an SSH connection.
 */
export async function discoverSshHostAliases(options: SshHostDiscoveryOptions = {}): Promise<string[]> {
  const sshDirectory = options.sshDirectory ?? resolve(homedir(), '.ssh')
  const root = options.configPath ?? resolve(sshDirectory, 'config')
  const aliases = new Set<string>()
  const visited = new Set<string>()

  const visit = async (path: string): Promise<void> => {
    const absolute = resolve(path)
    if (visited.has(absolute)) return
    if (visited.size >= MAX_CONFIG_FILES) throw new Error(`SSH config includes more than ${MAX_CONFIG_FILES} files`)
    visited.add(absolute)
    let text: string
    try {
      text = await readFile(absolute, 'utf8')
    } catch (error) {
      if (isMissingFile(error)) return
      throw error
    }
    const config = SSHConfig.parse(text)
    collectAliases(config, aliases)
    for (const pattern of collectIncludes(config)) {
      const expanded = expandInclude(pattern, sshDirectory)
      for await (const included of glob(expanded)) await visit(included)
    }
  }

  await visit(root)
  return [...aliases].sort((left, right) => left.localeCompare(right))
}

function collectAliases(config: ParsedSshConfig, aliases: Set<string>): void {
  walk(config, (line) => {
    if (line.param.toLowerCase() !== 'host') return
    for (const alias of values(line)) {
      if (EXPLICIT_HOST.test(alias)) aliases.add(alias)
    }
  })
}

function collectIncludes(config: ParsedSshConfig): string[] {
  const includes: string[] = []
  walk(config, (line) => {
    if (line.param.toLowerCase() === 'include') includes.push(...values(line))
  })
  return includes
}

function walk(config: ParsedSshConfig, listener: (line: Extract<Line, { param: string }>) => void): void {
  for (const line of config) {
    if (!('param' in line)) continue
    listener(line)
    if ('config' in line) walk(line.config, listener)
  }
}

function values(line: Extract<Line, { param: string }>): string[] {
  return typeof line.value === 'string' ? [line.value] : line.value.map(value => value.val)
}

function expandInclude(pattern: string, sshDirectory: string): string {
  if (pattern === '~') return resolve(sshDirectory, '..')
  if (pattern.startsWith('~/')) return resolve(sshDirectory, '..', pattern.slice(2))
  return isAbsolute(pattern) ? pattern : resolve(sshDirectory, pattern)
}

function isMissingFile(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}

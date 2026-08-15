/** Package transfer and user-scoped remote-host bootstrap. */

import { spawn } from 'node:child_process'
import { Buffer } from 'node:buffer'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Inputs for one remote DSH Host installation or update. */
export interface RemoteBootstrapOptions {
  /** Absolute private socket path for the remote host. */
  socketPath: string
  /** npm package specifier for the matching DSH CLI release. */
  dshPackage: string
  /** Packed `dsh-remote` package bytes. */
  remotePackageArchive: Uint8Array
}

/**
 * Pack the installed remote plugin for transfer to an SSH target.
 * Source checkouts use pnpm so workspace ranges become publishable versions;
 * registry installations use npm and need no workspace rewriting.
 * @returns the package tarball bytes.
 */
export async function packRemotePlugin(): Promise<Uint8Array> {
  const { packageRoot, manifestText } = await readOwnManifest()
  const manifest = JSON.parse(manifestText) as { version?: unknown }
  if (typeof manifest.version !== 'string' || manifest.version === '') {
    throw new Error('dsh-remote package.json has no version')
  }
  const workspaceSource = manifestText.includes('"workspace:')
  const temporary = await mkdtemp(join(tmpdir(), 'dsh-remote-pack-'))
  try {
    const command = workspaceSource ? 'pnpm' : 'npm'
    const args = workspaceSource
      ? ['--dir', packageRoot, 'pack', '--pack-destination', temporary, '--silent']
      : ['pack', packageRoot, '--pack-destination', temporary, '--silent']
    await run(command, args)
    const archives = (await readdir(temporary)).filter(entry => entry.endsWith('.tgz'))
    const archive = archives[0]
    if (archive === undefined || archives.length !== 1) {
      throw new Error(`dsh-remote pack produced ${archives.length} archives`)
    }
    return await readFile(join(temporary, archive))
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
}

async function readOwnManifest(): Promise<{ packageRoot: string; manifestText: string }> {
  for (const relative of ['../package.json', '../../package.json']) {
    const url = new URL(relative, import.meta.url)
    try {
      return {
        packageRoot: dirname(fileURLToPath(url)),
        manifestText: await readFile(url, 'utf8'),
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
  throw new Error('cannot locate the installed dsh-remote package.json')
}

/**
 * Create the shell script that installs and starts a user-scoped remote host.
 * All user-controlled values and package bytes are base64 encoded before they
 * cross the shell parser.
 * @param options - package bytes and remote Host configuration.
 * @returns a POSIX shell script suitable for `ssh <host> sh -s`.
 */
export function buildRemoteBootstrapScript(options: RemoteBootstrapOptions): string {
  const manifest = JSON.stringify({
    name: 'dsh-profile-remote',
    private: true,
    dependencies: {},
    dsh: { profile: { bundles: ['@deepseek-ai/dsh-base'] } },
  }, undefined, 2) + '\n'
  const profileUpdate = `
const fs = require('node:fs')
const pathModule = require('node:path')
const path = process.argv[2]
const socketPath = Buffer.from(process.argv[3], 'base64').toString('utf8')
const projectsFile = pathModule.join(process.env.HOME, '.dsh', 'remote-projects.json')
const patches = [{ insert: [{
  id: 'remote-host',
  name: 'dsh-remote/host',
  config: { socketPath, projectsFile },
}] }]
fs.writeFileSync(path, JSON.stringify(patches, null, 2) + '\n')
`
  const unit = [
    '[Unit]',
    'Description=DeepSeek Harness remote host',
    'After=default.target',
    '',
    '[Service]',
    'Type=simple',
    'WorkingDirectory=%h',
    'ExecStart=%h/.local/share/dsh-remote/node %h/.dsh/profiles/dsh-remote/node_modules/dsh-remote/lib/bin.js %h/.dsh/profiles/dsh-remote/cordis.yml',
    'Restart=on-failure',
    'RestartSec=2',
    '',
    '[Install]',
    'WantedBy=default.target',
    '',
  ].join('\n')
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>ai.deepseek.dsh-remote-host</string>
<key>ProgramArguments</key><array><string>/bin/sh</string><string>-c</string>
<string>exec &quot;$HOME/.local/share/dsh-remote/node&quot; &quot;$HOME/.dsh/profiles/dsh-remote/node_modules/dsh-remote/lib/bin.js&quot; &quot;$HOME/.dsh/profiles/dsh-remote/cordis.yml&quot; &gt;&gt; &quot;$HOME/.local/share/dsh-remote/remote-host.log&quot; 2&gt;&amp;1</string>
</array>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
</dict></plist>
`
  const values = {
    manifest: encode(manifest),
    profileUpdate: encode(profileUpdate),
    socketPath: encode(options.socketPath),
    dshPackage: encode(options.dshPackage),
    archive: Buffer.from(options.remotePackageArchive).toString('base64'),
    unit: encode(unit),
    plist: encode(plist),
  }
  return `set -eu
decode() {
  if base64 -d </dev/null >/dev/null 2>&1; then base64 -d
  else base64 -D
  fi
}
runtime="$HOME/.local/share/dsh-remote"
profile="$HOME/.dsh/profiles/dsh-remote"
archive="$runtime/dsh-remote.tgz"
socket_path=$(printf '%s' '${values.socketPath}' | decode)
mkdir -p "$runtime/npm" "$profile" "$HOME/.config/systemd/user" "$HOME/Library/LaunchAgents"
command -v node >/dev/null 2>&1 || { echo 'remote bootstrap requires Node.js' >&2; exit 127; }
command -v npm >/dev/null 2>&1 || { echo 'remote bootstrap requires npm' >&2; exit 127; }
ln -sf "$(command -v node)" "$runtime/node"
printf '%s' '${values.archive}' | decode > "$archive"
dsh_package=$(printf '%s' '${values.dshPackage}' | decode)
if ! npm install --prefix "$runtime/npm" --no-audit --no-fund --no-package-lock "$dsh_package"; then
  echo "failed to install official remote DSH release: $dsh_package" >&2
  exit 1
fi
printf '%s' '${values.manifest}' | decode > "$profile/package.json"
npm install --prefix "$profile" --legacy-peer-deps --omit=dev --no-audit --no-fund --no-package-lock "$archive"
printf '%s' '${values.profileUpdate}' | decode | node - "$profile/cordis.patch.yml" '${values.socketPath}'
"$runtime/npm/node_modules/.bin/dsh" --profile dsh-remote --dump-config > "$profile/cordis.yml"
host_script="$profile/node_modules/dsh-remote/lib/bin.js"
test -f "$host_script" || { echo 'installed dsh-remote package has no host executable' >&2; exit 1; }
started=0
if command -v systemctl >/dev/null 2>&1 && systemctl --user show-environment >/dev/null 2>&1; then
  if command -v loginctl >/dev/null 2>&1; then loginctl enable-linger "$USER" >/dev/null 2>&1 || true; fi
  if ! command -v loginctl >/dev/null 2>&1 || test "$(loginctl show-user "$USER" -p Linger --value 2>/dev/null || true)" = yes; then
    printf '%s' '${values.unit}' | decode > "$HOME/.config/systemd/user/dsh-remote-host.service"
    systemctl --user daemon-reload
    systemctl --user enable dsh-remote-host.service >/dev/null
    systemctl --user restart dsh-remote-host.service
    started=1
  fi
fi
if test "$started" = 0 && command -v launchctl >/dev/null 2>&1; then
  plist_path="$HOME/Library/LaunchAgents/ai.deepseek.dsh-remote-host.plist"
  printf '%s' '${values.plist}' | decode > "$plist_path"
  launchctl bootout "user/$(id -u)/ai.deepseek.dsh-remote-host" >/dev/null 2>&1 || true
  launchctl bootstrap "user/$(id -u)" "$plist_path"
  launchctl kickstart -k "user/$(id -u)/ai.deepseek.dsh-remote-host"
  started=1
fi
if test "$started" = 0; then
  pid_file="$runtime/remote-host.pid"
  if test -f "$pid_file"; then
    old_pid=$(cat "$pid_file")
    case "$old_pid" in *[!0-9]*|'') old_pid='' ;; esac
    if test -n "$old_pid" && kill -0 "$old_pid" 2>/dev/null; then
      old_command=$(ps -p "$old_pid" -o command= 2>/dev/null || true)
      case "$old_command" in *dsh-remote-host*|*"$profile/cordis.yml"*) kill "$old_pid" 2>/dev/null || true ;; esac
    fi
  fi
  nohup "$runtime/node" "$host_script" "$profile/cordis.yml" > "$runtime/remote-host.log" 2>&1 </dev/null &
  echo "$!" > "$pid_file"
fi
attempt=0
while test "$attempt" -lt 30; do
  test -S "$socket_path" && exit 0
  attempt=$((attempt + 1))
  sleep 1
done
echo "remote host did not create socket: $socket_path" >&2
test -f "$runtime/remote-host.log" && tail -n 40 "$runtime/remote-host.log" >&2 || true
exit 1
`
}

function encode(value: string): string { return Buffer.from(value, 'utf8').toString('base64') }

async function run(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => { stderr = (stderr + chunk).slice(-8192) })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) resolve()
      else reject(new Error(stderr.trim() || `${command} exited (${code === null ? signal : String(code)})`))
    })
  })
}

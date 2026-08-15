#!/usr/bin/env node
/** Remote-project daemon and SSH bridge executable. @module dsh-remote/bin */

import { connect } from 'node:net'
import { resolve } from 'node:path'
import { runRemoteProjectHost } from './runner.ts'

const command = process.argv[2]
if (command === 'connect') {
  const socketPath = process.argv[3]
  if (socketPath === undefined || socketPath === '') {
    process.stderr.write('usage: dsh-remote-host connect <absolute-socket-path>\n')
    process.exit(1)
  }
  const socket = connect(resolve(socketPath))
  socket.once('error', (error) => {
    process.stderr.write(`dsh-remote-host connect: ${error.message}\n`)
    process.exit(1)
  })
  socket.pipe(process.stdout)
  process.stdin.pipe(socket)
  socket.once('close', () => { process.exit(0) })
} else {
  await runRemoteProjectHost()
}

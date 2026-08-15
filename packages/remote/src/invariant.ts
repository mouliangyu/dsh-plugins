/** Package-owned invariant companion for the remote host. @module dsh-remote/invariant */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

export const name = 'remote-invariant'
export const inject = ['invariants']

/**
 * No runtime invariant: project and session registries are private Host state;
 * their observable relations require wire calls and persistence round trips.
 */
const install: InvariantInstaller = () => {}

/** Register the package ownership companion. @param ctx - context carrying invariant registration. @returns the disposer. */
export const apply = (ctx: Context): Promise<() => void> => Promise.resolve(ctx.invariants.register('dsh-remote', install))

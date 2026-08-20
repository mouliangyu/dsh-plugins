/** Package-owned invariant companion for the stable skill catalog. @module dsh-skill-stabilizer/invariant */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

export const name = 'skill-stabilizer-invariant'
export const inject = ['invariants']

/**
 * No runtime invariant: the catalog section's presence is conditional on an
 * agent assembly and on model-invocable skills existing; its absence is a
 * legitimate empty state, not a corrupted relation.
 */
const install: InvariantInstaller = () => {}

/** Register the package ownership companion. @param ctx - context carrying invariant registration. @returns the disposer. */
export const apply = (ctx: Context): Promise<() => void> => Promise.resolve(ctx.invariants.register('dsh-skill-stabilizer', install))

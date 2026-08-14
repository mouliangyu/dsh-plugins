/** Package invariant companion for `dsh-session-control`. */

import type { Context } from "@deepseek-ai/cordis";
import type { InvariantInstaller } from "@deepseek-ai/dsh-invariants";

const PACKAGE_NAME = "dsh-session-control";

export const name = "session-control-invariant";
export const inject = ["invariants"];

/** No runtime invariant: DSH owns tool registration disposal and workspace persistence integrity. */
const install: InvariantInstaller = () => {};

/**
 * Register the package invariant companion.
 * @param ctx Host context carrying the invariant registry.
 * @returns Registration disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));

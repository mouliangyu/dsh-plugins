//#region lib/types/invariant.js
/** Package invariant companion for `dsh-session-control`. */
const PACKAGE_NAME = "dsh-session-control";
const name = "session-control-invariant";
const inject = ["invariants"];
/** No runtime invariant: DSH owns tool registration disposal and workspace persistence integrity. */
const install = () => {};
/**
* Register the package invariant companion.
* @param ctx Host context carrying the invariant registry.
* @returns Registration disposer after setup succeeds.
*/
const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
//#endregion
export { apply, inject, name };

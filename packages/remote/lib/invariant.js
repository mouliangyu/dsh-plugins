//#region lib/types/invariant.js
/** Package-owned invariant companion for the remote host. @module dsh-remote/invariant */
const name = "remote-invariant";
const inject = ["invariants"];
/**
* No runtime invariant: project and session registries are private Host state;
* their observable relations require wire calls and persistence round trips.
*/
const install = () => {};
/** Register the package ownership companion. @param ctx - context carrying invariant registration. @returns the disposer. */
const apply = (ctx) => Promise.resolve(ctx.invariants.register("dsh-remote", install));
//#endregion
export { apply, inject, name };

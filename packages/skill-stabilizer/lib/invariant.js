//#region lib/types/invariant.js
/** Package-owned invariant companion for the stable skill catalog. @module dsh-skill-stabilizer/invariant */
const name = "skill-stabilizer-invariant";
const inject = ["invariants"];
/**
* No runtime invariant: the catalog section's presence is conditional on an
* agent assembly and on model-invocable skills existing; its absence is a
* legitimate empty state, not a corrupted relation.
*/
const install = () => {};
/** Register the package ownership companion. @param ctx - context carrying invariant registration. @returns the disposer. */
const apply = (ctx) => Promise.resolve(ctx.invariants.register("dsh-skill-stabilizer", install));
//#endregion
export { apply, inject, name };

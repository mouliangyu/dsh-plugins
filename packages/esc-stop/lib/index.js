//#region lib/types/index.js
/**
* dsh-esc-stop — host half.
*
* This bundle is purely client-side: the loader row exists so the web
* profile activates the package and `dsh-client-modules` serves
* /plugins/dsh-esc-stop/client.js. The host half intentionally provides
* nothing; all behavior lives in the browser (lib/client.js).
*/
const name = "esc-stop";
const inject = [];
function apply() {}
//#endregion
export { apply, inject, name };

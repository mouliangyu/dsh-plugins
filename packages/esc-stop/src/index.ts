/**
 * dsh-esc-stop — host half.
 *
 * This bundle is purely client-side: the loader row exists so the web
 * profile activates the package and `dsh-client-modules` serves
 * /plugins/dsh-esc-stop/client.js. The host half intentionally provides
 * nothing; all behavior lives in the browser (lib/client.js).
 */
export const name = 'esc-stop'

export const inject = []

export function apply(): void {}

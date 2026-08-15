/** Browser plugin registering the dsh-remote management section. */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { RemoteSettingsSection } from './RemoteSettingsSection.tsx'
import { en, zh, type RemoteLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'settings.remote': RemoteLocaleKey }
}

const NS = 'settings.remote'
export const inject = ['slots', 'locale']

/** Register the remote-project management page. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-remote.client.locale')
  const t = ctx.locale.bind(NS)
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'remote',
    order: 20,
    label: () => t('nav'),
    locale: NS,
    inject: () => ({ t }),
  }, RemoteSettingsSection))
}

export { RemoteSettingsSection } from './RemoteSettingsSection.tsx'

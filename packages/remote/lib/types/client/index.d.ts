/** Browser plugin registering the dsh-remote management section. */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import { type RemoteLocaleKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        'settings.remote': RemoteLocaleKey;
    }
}
export declare const inject: string[];
/** Register the remote-project management page. */
export declare function apply(ctx: ClientContext): void;
export { RemoteSettingsSection } from './RemoteSettingsSection.tsx';
//# sourceMappingURL=index.d.ts.map
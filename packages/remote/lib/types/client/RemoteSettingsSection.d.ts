/** Remote authority connection settings. */
import { type ReactNode } from 'react';
import type { RemoteAuthorityCoordinator } from './authority.ts';
import type { RemoteLocaleKey } from './locales.ts';
interface Props {
    coordinator: RemoteAuthorityCoordinator;
    t?: (key: RemoteLocaleKey) => string;
}
/** Render SSH authority discovery and lifecycle controls. */
export declare function RemoteSettingsSection({ coordinator, t }: Props): ReactNode;
export {};
//# sourceMappingURL=RemoteSettingsSection.d.ts.map
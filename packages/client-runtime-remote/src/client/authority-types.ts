/** Structural authority registry types supplied by the client connection plugin. */

import type { IApiClient } from '@deepseek-ai/dsh-api-remotes/client'

export type AuthorityState = 'connecting' | 'ready' | 'degraded' | 'failed' | 'closed'

export interface AuthorityConnectionLike {
  readonly api: IApiClient
  readonly state: AuthorityState
  subscribe(listener: (state: AuthorityState) => void): () => void
  close(): Promise<void>
}

export interface AuthorityProviderLike {
  readonly id: string
  readonly kind: string
  connect(signal?: AbortSignal): Promise<AuthorityConnectionLike>
}

export interface AuthorityRegistryLike {
  register(provider: AuthorityProviderLike): () => Promise<void>
  connect(id: string, signal?: AbortSignal): Promise<AuthorityConnectionLike>
  disconnect(id: string): Promise<void>
  get(id: string): AuthorityConnectionLike | undefined
  getSnapshot(): { ids: readonly string[]; states: Readonly<Record<string, AuthorityState>> }
  subscribe(listener: () => void): () => void
}

/** Client half of the authority-proxy plugin: settings panel + sidebar origin labels. */
import type { Context } from '@deepseek-ai/cordis'

/** Services this client plugin waits for before it applies. */
export declare const inject: string[]

/** Register the panel, the origin labels and the per-authority carriers. */
export declare function apply(ctx: Context): void

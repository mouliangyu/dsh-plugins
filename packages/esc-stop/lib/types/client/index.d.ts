/** Minimal structural types — no @deepseek-ai runtime imports needed. */
interface SlotOptions {
    readonly name: string;
    readonly id: string;
    readonly order?: number;
    readonly label?: string;
}
interface SlotsLike {
    inject(name: string, provider: () => unknown): unknown;
    register(options: SlotOptions, component: unknown): unknown;
}
interface CtxLike {
    readonly slots: SlotsLike;
}
export declare const name = "esc-stop-client";
export declare const inject: string[];
export declare function apply(ctx: CtxLike): void;
export {};
//# sourceMappingURL=index.d.ts.map
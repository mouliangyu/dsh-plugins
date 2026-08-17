import { SlotRegistry } from "./slots.js";
import { SessionRuntime } from "./sessions/service.js";
import { WorkspaceRuntime } from "./workspaces/service.js";
import { ConversationEventRegistry } from "./conversation/event-registry.js";
import { ConversationViewRegistry } from "./conversation/view-registry.js";
import { AuthorityApiRouter } from "./authority-router.js";
export { authorityId, authorityOf, parseAuthorityId } from "./authority-router.js";
export { isAppendSurfaceEvent, isReplacementSurfaceEvent } from '@deepseek-ai/dsh-session/surface';
export { SlotRegistry } from "./slots.js";
export { ConversationEventRegistry } from "./conversation/event-registry.js";
export { ConversationViewRegistry } from "./conversation/view-registry.js";
export { ConversationNodeAssembler } from "./sessions/conversation-assembler.js";
export { ConversationLocationIndex } from "./sessions/conversation-location-index.js";
export { conversationContextKey } from "./contract/conversation.js";
export { SessionCreateError, SessionRuntime, scopeOf, workspaceTitleOf } from "./sessions/service.js";
export { indexSubagentDescendants } from "./sessions/subagent-lineage.js";
// The provide channel is shared with the client test runtime (one
// materialization/projection implementation; no test-side mirror to drift).
export { SessionProvideChannel } from "./sessions/provide.js";
export { createScope } from "./agents/scope.js";
export { DirectoryBrowseError, WorkspaceCreateError, WorkspaceRuntime } from "./workspaces/service.js";
export { resolveWorkspacePath } from "./workspaces/path.js";
// Runtime owns the snapshot store; web-react only binds it to React.
export { createSnapshotStore, defineStore, shallowEqual } from "./contract/store.js";
export { EMPTY_CHAT_SNAPSHOT, EMPTY_CONVERSATION_VIEWS, toAssistantBlock, toAssistantBlocks, } from "./sessions/conversation.js";
export { emptyAssistantBlock } from "./sessions/partial.js";
export { isTokenDelta } from "./sessions/assistant-timing.js";
export { contextForm, contextProvenance } from "./sessions/context-provenance.js";
export { displayFailureMessage } from "./sessions/failure-display.js";
export { PendingWait } from "./sessions/pending.js";
/** Required services: the wire handle and Client Typert registry. */
export const inject = ['connection', 'authorityRegistry', 'typert', 'remote', 'remote.commands'];
/** Mounts the browser runtime services and connection stream.
 * @param ctx - Client Cordis context.
 */
export function apply(ctx) {
    ctx.plugin(SlotRegistry);
    const conversation = {
        events: new ConversationEventRegistry(ctx),
        views: new ConversationViewRegistry(ctx),
    };
    const connection = ctx.get('connection');
    const authorities = ctx.get('authorityRegistry');
    const router = new AuthorityApiRouter(connection.api, authorities);
    ctx.effect(() => connection.routeApi(router.api), 'runtime: top-level authority API router');
    const sessions = new SessionRuntime(ctx, router.api, ctx.remote, conversation);
    ctx.typert.contexts.registerClient('agent', {
        identity: candidate => sessions.scopeOf(candidate),
    });
    const workspaces = new WorkspaceRuntime(ctx, router.api, sessions, router);
    ctx.effect(() => workspaces.startInitialSelection(), 'runtime: initial Workspace selection');
    const loop = connection.start({
        onMuxEnvelope: (envelope) => {
            sessions.handleMuxEnvelope(envelope);
        },
        onHostEnvelope: (envelope) => {
            sessions.handleHostEnvelope(envelope);
            workspaces.handleHostEnvelope(envelope);
            // Forwarded-event bridge: the session layer ignores registry frames (no
            // session routing). This plugin owns the frame sink, so it hands the
            // decoded frame straight to the Remote service, which fans it out to
            // `ctx.remote.$on` subscribers; no consumer reads a frame.
            const frame = envelope.payload;
            if (frame.type === 'host/remote-event')
                ctx.remote.$dispatch(frame.event, frame.args);
        },
        onConnected: () => {
            sessions.handleConnected();
            workspaces.handleConnected();
            ctx.emit('connection/reset');
        },
        onStateChange: (state) => {
            // Generation death fires before any next-generation frame can arrive
            // (reconnect replays flow from stream open, ahead of onConnected):
            // the only safe moment to drop generation-scoped interaction state.
            if (state === 'reconnecting') {
                sessions.handleDisconnected();
            }
        },
    });
    ctx.effect(() => () => { loop.stop(); }, 'runtime: connection stream loop');
    const remoteStreams = new RemoteAuthorityStreams(authorities, router, {
        onMuxEnvelope: envelope => { sessions.handleMuxEnvelope(envelope); },
        onHostEnvelope: envelope => {
            sessions.handleHostEnvelope(envelope);
            workspaces.handleHostEnvelope(envelope);
            const frame = envelope.payload;
            if (frame.type === 'host/remote-event')
                ctx.remote.$dispatch(frame.event, frame.args);
        },
        onConnected: () => {
            sessions.handleConnected();
            workspaces.handleConnected();
        },
    });
    remoteStreams.start();
    ctx.effect(() => () => { remoteStreams.stop(); }, 'runtime: remote authority streams');
}
class RemoteAuthorityStreams {
    registry;
    router;
    sinks;
    active = new Map();
    unsubscribe;
    constructor(registry, router, sinks) {
        this.registry = registry;
        this.router = router;
        this.sinks = sinks;
    }
    start() {
        this.unsubscribe = this.registry.subscribe(() => { this.reconcile(); });
        this.reconcile();
    }
    stop() {
        this.unsubscribe?.();
        this.unsubscribe = undefined;
        for (const stream of this.active.values())
            stream.abort.abort();
        this.active.clear();
    }
    reconcile() {
        const present = new Set(this.registry.getSnapshot().ids);
        for (const [id, stream] of this.active) {
            const connection = this.registry.get(id);
            if (present.has(id) && connection?.api === stream.api)
                continue;
            stream.abort.abort();
            this.active.delete(id);
        }
        for (const id of present) {
            if (this.active.has(id))
                continue;
            const connection = this.registry.get(id);
            if (connection === undefined)
                continue;
            const abort = new AbortController();
            const api = connection.api;
            this.active.set(id, { api, abort });
            void this.pump(id, api, abort.signal);
        }
    }
    async pump(id, api, signal) {
        let muxOpen = false;
        let hostOpen = false;
        let announced = false;
        const opened = () => {
            if (!announced && muxOpen && hostOpen) {
                announced = true;
                this.sinks.onConnected();
            }
        };
        const mux = this.consume(api.events.mux({}, signal, () => { muxOpen = true; opened(); }), envelope => {
            this.sinks.onMuxEnvelope(this.router.transformMux(id, envelope));
        });
        const host = this.consume(api.events.host({}, signal, () => { hostOpen = true; opened(); }), envelope => {
            this.sinks.onHostEnvelope(this.router.transformHost(id, envelope));
        });
        await Promise.all([mux, host]);
    }
    async consume(stream, sink) {
        try {
            for await (const envelope of stream)
                sink(envelope);
        }
        catch (error) {
            console.warn('[dsh-remote] authority stream ended:', error);
        }
    }
}
//# sourceMappingURL=index.js.map
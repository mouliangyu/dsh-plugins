/** Authority-aware routing over official DSH API clients. */
const PREFIX = '@authority/';
const ID_KEYS = new Set([
    'sessionId', 'parentSessionId', 'childSessionId', 'beforeSessionId',
    'workspaceId', 'beforeWorkspaceId',
]);
const ID_ARRAY_KEYS = new Set(['sessionIds', 'archivedSessionIds', 'workspaceIds']);
/** Encode an authority-owned id for the shared local object model. */
export function authorityId(authority, remoteId) {
    return `${PREFIX}${encodeURIComponent(authority)}/${encodeURIComponent(remoteId)}`;
}
/** Decode a shared id into its authority and wire id. */
export function parseAuthorityId(value) {
    if (!value.startsWith(PREFIX))
        return undefined;
    const [authority, remoteId, extra] = value.slice(PREFIX.length).split('/');
    if (authority === undefined || remoteId === undefined || extra !== undefined)
        return undefined;
    return { authorityId: decodeURIComponent(authority), remoteId: decodeURIComponent(remoteId) };
}
/** Return the authority label carried by a shared id. */
export function authorityOf(value) { return parseAuthorityId(value)?.authorityId; }
/** Official API router with local baseline aggregation and remote id isolation. */
export class AuthorityApiRouter {
    local;
    registry;
    api;
    directoryAuthority;
    rpcAuthorities = new Map();
    constructor(local, registry) {
        this.local = local;
        this.registry = registry;
        const domain = (name) => new Proxy({}, {
            get: (_target, method) => (payload, signal) => this.call(name, method, payload, signal),
        });
        this.api = {
            sessions: domain('sessions'), subagents: domain('subagents'), host: domain('host'),
            workspace: domain('workspace'), skills: domain('skills'), agentPresets: domain('agentPresets'),
            goals: domain('goals'), settings: domain('settings'), credentials: domain('credentials'), llm: domain('llm'),
            events: local.events,
            respond: async (message, signal) => {
                const authority = this.rpcAuthorities.get(String(message.rpcId));
                if (authority === undefined)
                    return this.local.respond(message, signal);
                const connection = this.registry.get(authority);
                if (connection === undefined)
                    throw new Error(`remote authority is not connected: ${authority}`);
                return connection.api.respond(message, signal);
            },
        };
    }
    setDirectoryAuthority(authority) { this.directoryAuthority = authority; }
    transformMux(authority, envelope) {
        this.rpcAuthorities.set(String(envelope.rpcId), authority);
        return this.transformEnvelope(authority, envelope);
    }
    transformHost(authority, envelope) {
        this.rpcAuthorities.set(String(envelope.rpcId), authority);
        return this.transformEnvelope(authority, envelope);
    }
    transformEnvelope(authority, envelope) {
        return { ...envelope, payload: mapIds(envelope.payload, id => authorityId(authority, id)) };
    }
    connected() {
        return this.registry.getSnapshot().ids.flatMap((id) => {
            const connection = this.registry.get(id);
            return connection === undefined ? [] : [[id, connection.api]];
        });
    }
    async call(domain, method, payload, signal) {
        if (domain === 'sessions' && (method === 'list' || method === 'search'))
            return this.aggregate(domain, method, payload, signal);
        if (domain === 'workspace' && method === 'list')
            return this.aggregate(domain, method, payload, signal);
        const routed = findAuthority(payload);
        const directoryAuthority = (domain === 'host' && method !== 'describe') || (domain === 'workspace' && method === 'create')
            ? this.directoryAuthority
            : undefined;
        const target = routed?.authorityId ?? directoryAuthority;
        const api = target === undefined ? this.local : this.registry.get(target)?.api;
        if (api === undefined)
            throw new Error(`remote authority is not connected: ${target ?? 'unknown'}`);
        const request = routed === undefined && target === undefined ? payload : mapIds(payload, unwrapId);
        const response = await invoke(api, domain, method, request, signal);
        return target === undefined ? response : mapIds(response, id => authorityId(target, id), responseIdKeys(domain, method));
    }
    async aggregate(domain, method, payload, signal) {
        const calls = [
            invoke(this.local, domain, method, payload, signal).then(response => ({ response })),
            ...this.connected().map(([authority, api]) => invoke(api, domain, method, payload, signal)
                .then(response => ({ authority, response }))),
        ];
        const settled = await Promise.allSettled(calls);
        const successes = settled.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
        if (successes.length === 0)
            throw settled[0]?.status === 'rejected' ? settled[0].reason : new Error('no authority response');
        const base = structuredClone(successes[0]?.response);
        const result = base.result;
        if (!result.ok || result.value === undefined)
            return base;
        const values = successes.flatMap(({ authority, response }) => {
            const candidate = response;
            if (!candidate.result.ok || candidate.result.value === undefined)
                return [];
            return [authority === undefined ? candidate.result.value : mapIds(candidate.result.value, id => authorityId(authority, id), responseIdKeys(domain, method))];
        });
        result.value.items = values.flatMap(value => Array.isArray(value.items) ? value.items : []);
        if (domain === 'workspace')
            result.value.archivedSessionIds = values.flatMap(value => Array.isArray(value.archivedSessionIds) ? value.archivedSessionIds : []);
        if (domain === 'sessions' && method === 'search')
            result.value.hasMore = values.some(value => value.hasMore === true);
        return base;
    }
}
function responseIdKeys(domain, method) {
    return domain === 'subagents' && method === 'list' ? new Set([...ID_KEYS, 'id']) : ID_KEYS;
}
function findAuthority(value) {
    if (typeof value === 'string')
        return parseAuthorityId(value);
    if (Array.isArray(value)) {
        for (const item of value) {
            const found = findAuthority(item);
            if (found !== undefined)
                return found;
        }
        return undefined;
    }
    if (value === null || typeof value !== 'object')
        return undefined;
    for (const [key, item] of Object.entries(value)) {
        if ((ID_KEYS.has(key) && typeof item === 'string') || (ID_ARRAY_KEYS.has(key) && Array.isArray(item))) {
            const found = findAuthority(item);
            if (found !== undefined)
                return found;
        }
    }
    return undefined;
}
function unwrapId(value) { return parseAuthorityId(value)?.remoteId ?? value; }
function mapIds(value, map, scalarKeys = ID_KEYS) {
    if (Array.isArray(value))
        return value.map(item => mapIds(item, map, scalarKeys));
    if (value === null || typeof value !== 'object')
        return value;
    const output = {};
    for (const [key, item] of Object.entries(value)) {
        if (scalarKeys.has(key) && typeof item === 'string')
            output[key] = map(item);
        else if (ID_ARRAY_KEYS.has(key) && Array.isArray(item))
            output[key] = item.map(id => typeof id === 'string' ? map(id) : id);
        else
            output[key] = mapIds(item, map, scalarKeys);
    }
    return output;
}
function invoke(api, domain, method, payload, signal) {
    const methods = api[domain];
    const operation = methods[method];
    if (operation === undefined)
        throw new Error(`unknown API method: ${String(domain)}.${method}`);
    return operation(payload, signal);
}
//# sourceMappingURL=authority-router.js.map
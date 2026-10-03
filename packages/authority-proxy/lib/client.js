/**
 * dsh-authority-proxy client face — one isolated Remote carrier per authority.
 *
 * Goal-bound contract (stable):
 *   Authority = { id, basePath, state, call(ns, method, args), stream(endpoint, payload, signal) }
 *   Aggregate = { sessions, workspaces, sources, resolveId(id), namespaceId(authority, localId),
 *                 routeCall(id, ns, method, args), refresh() }
 *   Ids of non-local objects are namespaced "@authority/<id>/<remoteId>".
 *
 * Version-bound detail (0.1.7-rc.2 observed):
 *   - client-face module ids are package names; isolate the SERVICE name "connection".
 *   - install the carrier INSIDE a plugin fiber, then carrierCtx.inject(["connection"]).
 *   - unary: rpc.call('/api', '<ns>/<method>', { args }, signal); args keyed by descriptor parameter name.
 *   - streams: transport.openStream; the official mux reads a global base, so we open
 *     our own mux socket per base (local '/api/remote.mux', authority
 *     '/authority/<id>/api/remote.mux'). Frames: open|item|end|cancel up, item|end|error down.
 *   - session list is unary (session/list, param _request); workspace list is the
 *     first frame of the workspace/follow stream ({type:'baseline', value:{items}}).
 */
window.__ModuleLoader__.load({
	id: "dsh-authority-proxy",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		const { installConnection } = require("@deepseek-ai/dsh-client-connection");
		const React = require("react");
		const primitives = require("@deepseek-ai/dsh-client-ui-primitives");

		const NAMESPACE = /^@authority\/([^/]+)\/(.+)$/;

		function namespaceId(authorityId, localId) {
			return authorityId === "local" ? localId : "@authority/" + authorityId + "/" + localId;
		}
		function resolveId(id) {
			const match = NAMESPACE.exec(String(id));
			if (match !== null) return { authority: match[1], localId: match[2], authorityId: match[1], id };
			return { authority: "local", localId: String(id), authorityId: "local", id };
		}

		/** Prefix one authority stream frame's pinned/archived ids so the official store matches its rows. */
/** Prefix one authority stream frame's pinned/archived ids so the official store matches its rows. */
		function namespaceStreamIds(value, authorityId) {
			try {
				const bodies = [];
				if (value?.type === "baseline" && value.value !== null && typeof value.value === "object") bodies.push([value.value, ["pinnedSessionIds", "archivedSessionIds"]]);
				if (value?.type === "archived") bodies.push([value, ["archivedSessionIds"]]);
				if (value?.type === "pinned") bodies.push([value, ["pinnedSessionIds"]]);
				for (const [body, keys] of bodies) {
					for (const key of keys) {
						if (!Array.isArray(body[key])) continue;
						body[key] = body[key].map((id) => (typeof id === "string" && !id.startsWith("@authority/") ? "@authority/" + authorityId + "/" + id : id));
					}
				}
				return value;
			} catch { return value; }
		}
		/** One shared mux socket per base path; every logical stream rides it. */
		function createMux(muxPath) {
			const streams = new Map();
			let socket = null;
			// Desktop shells serve the page from a custom scheme (dsh-app://) where
			// location.origin is opaque, so the Host injects its absolute origin.
			const streamBase = () => {
				const injected = globalThis.__DSH_AUTHORITY_ORIGIN__;
				return typeof injected === "string" && injected.length > 0 ? injected : location.href;
			};
			const ensure = () => {
				if (socket !== null && (socket.readyState === 0 || socket.readyState === 1)) return socket;
				const url = new URL(muxPath, streamBase());
				if (url.protocol !== "ws:" && url.protocol !== "wss:") url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
				socket = new WebSocket(url);
				socket.addEventListener("message", (event) => {
					try { const frame = JSON.parse(event.data); streams.get(frame.streamId)?.(frame); } catch { /* drop */ }
				});
				const lost = () => { socket = null; for (const push of streams.values()) push({ type: "error", error: { code: "carrier", message: "authority mux socket closed" } }); };
				socket.addEventListener("close", lost);
				socket.addEventListener("error", lost);
				return socket;
			};
			const ready = (ws) => new Promise((resolve, reject) => {
				if (ws.readyState === 1) { resolve(); return; }
				const ok = () => { ws.removeEventListener("open", ok); ws.removeEventListener("error", bad); resolve(); };
				const bad = () => { ws.removeEventListener("open", ok); ws.removeEventListener("error", bad); reject(new Error("authority mux: socket failed")); };
				ws.addEventListener("open", ok); ws.addEventListener("error", bad);
			});
			const close = () => {
				const current = socket;
				socket = null;
				for (const push of streams.values()) push({ type: "error", error: { code: "carrier", message: "authority mux closed" } });
				streams.clear();
				if (current !== null) { try { current.close(); } catch { /* ignore */ } }
			};
			return { streams, ensure, ready, muxPath, close };
		}

		/** Build the transport.openStream function for one mux base. */
		function createStream(mux, transform) {
			return async function* openStream(endpoint, payload, signal, uplink) {
				const ws = mux.ensure();
				await mux.ready(ws);
				const streamId = globalThis.crypto?.randomUUID?.() ?? String(Date.now()) + Math.random();
				const queue = [];
				let wake = null;
				const push = (frame) => { queue.push(frame); if (wake) { const w = wake; wake = null; w(); } };
				mux.streams.set(streamId, push);
				const send = (frame) => { if (ws.readyState === 1) ws.send(JSON.stringify(frame)); };
				const onAbort = () => push({ type: "error", error: { code: "cancelled", message: "stream aborted" } });
				signal?.addEventListener("abort", onAbort, { once: true });
				send({ type: "open", streamId, endpoint, payload });
				let pump = null;
				if (uplink !== undefined) {
					pump = (async () => { for await (const value of uplink) send({ type: "item", streamId, value }); send({ type: "end", streamId }); })().catch(() => undefined);
				}
				try {
					while (true) {
						while (queue.length === 0) await new Promise((resolve) => { wake = resolve; });
						const frame = queue.shift();
						if (frame.type === "item") { yield transform === undefined ? frame.value : transform(frame.value); continue; }
						if (frame.type === "error") { const error = new Error(frame.error?.message ?? "authority stream error"); error.code = frame.error?.code; throw error; }
						return;
					}
				} finally {
					signal?.removeEventListener("abort", onAbort);
					mux.streams.delete(streamId);
					send({ type: "cancel", streamId });
					if (pump !== null) await pump;
				}
			};
		}

		/** Read the first frame of a stream, then cancel it. */
		async function firstFrame(stream, endpoint, payload, timeoutMs) {
			const controller = new AbortController();
			const iterator = stream(endpoint, payload, controller.signal, undefined)[Symbol.asyncIterator]();
			try {
				const next = await Promise.race([
					iterator.next(),
					new Promise((resolve) => setTimeout(() => resolve({ timeout: true }), timeoutMs))
				]);
				return next?.value ?? null;
			} catch (error) {
				return null;
			} finally {
				controller.abort();
			}
		}

		function apply(ctx) {
			const list = globalThis.__DSH_AUTHORITIES__ ?? [];
			const state = (globalThis.__DSH_AUTHORITY_PROBE__ ??= { authorities: [], results: {}, steps: [] });
			state.authorities = list.map((a) => a.id);
			globalThis.__DSH_AUTHORITIES_CTX__ ??= {};
			const adapters = new Map();
			const step = (msg) => { state.steps.push(msg); console.log("[authority-proxy]", msg); };

			// The local host is just another source for the aggregate.
			const localStream = createStream(createMux("/api/remote.mux"));
			const localAdapter = {
				id: "local", basePath: "", state: "ready",
				call: (namespace, method, args) => ctx.connection.rpc.call("/api", namespace + "/" + method, { args: args ?? {} }, undefined),
				stream: (endpoint, payload, signal) => localStream(endpoint, payload, signal, undefined)
			};
			adapters.set("local", localAdapter);

			/** Runtime authority registry: hosts can grow/shrink without a reload. */
			const mounted = new Map();
			let aggregateRef = null;
			const syncSources = () => { if (aggregateRef !== null) aggregateRef.sources = [...adapters.keys()]; };

			function mountAuthority(authority) {
				if (authority === undefined || typeof authority.id !== "string" || mounted.has(authority.id)) return;
				const entry = (state.results[authority.id] ??= { state: "init" });
				const mux = createMux("/authority/" + encodeURIComponent(authority.id) + "/api/remote.mux");
				const openStream = createStream(mux, (value) => namespaceStreamIds(value, authority.id));
				const adapter = { id: authority.id, basePath: authority.basePath ?? ("/authority/" + authority.id), state: "connecting", call: null, stream: null };
				adapters.set(authority.id, adapter);
				globalThis.__DSH_AUTHORITIES_CTX__[authority.id] = adapter;
				let fork = null;
				try {
					const sub = ctx.isolate("connection");
					fork = sub.plugin({
						name: "authority-carrier:" + authority.id,
						inject: [],
						apply(carrierCtx) {
							installConnection(carrierCtx, {
								transport: {
									fetch: (input, init) => {
										const path = String(input).replace(/^\/+/, "");
										// Resolve against the document base: http(s) in the browser,
										// dsh-app:// in the desktop shell, which forwards to the Host.
										return globalThis.fetch("/authority/" + encodeURIComponent(authority.id) + "/" + path, init);
									},
									openStream: (endpoint, payload, signal, uplink) => openStream(endpoint, payload, signal, uplink)
								},
								location: { hostname: location.hostname }
							});
							carrierCtx.inject(["connection"], (connectionCtx) => {
								const rpc = connectionCtx.connection.rpc;
								adapter.call = (namespace, method, args) => rpc.call("/api", namespace + "/" + method, { args: args ?? {} }, undefined);
								adapter.stream = (endpoint, payload, signal) => openStream(endpoint, payload, signal, undefined);
								adapter.state = "ready";
								entry.state = "ready";
								entry.hasOpen = typeof rpc.open === "function";
								step("connection bound " + authority.id);
							});
						}
					});
				} catch (error) {
					entry.state = "setup-error";
					entry.error = String(error?.message ?? error).slice(0, 400);
				}
				mounted.set(authority.id, { mux, fork, adapter });
				state.authorities = [...adapters.keys()];
				syncSources();
			}

			function unmountAuthority(id) {
				const held = mounted.get(id);
				if (held === undefined) return;
				mounted.delete(id);
				try { held.fork?.dispose?.(); } catch { /* ignore */ }
				try { held.mux.close(); } catch { /* ignore */ }
				adapters.delete(id);
				delete globalThis.__DSH_AUTHORITIES_CTX__[id];
				delete state.results[id];
				state.authorities = [...adapters.keys()];
				syncSources();
			}

			/** Call this Host's runtime authority admin API (token-gated, same origin). */
			async function adminRequest(action, body) {
				const response = await globalThis.fetch("/mhr-admin" + action, {
					method: body === undefined ? "GET" : "POST",
					credentials: "same-origin",
					...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
				});
				let parsed = null;
				try { parsed = await response.json(); } catch { parsed = null; }
				if (!response.ok || parsed?.ok !== true) throw new Error(parsed?.error ?? ("admin " + String(response.status)));
				return parsed.value;
			}

			// Supervised connections may come up after this client fetched its first
			// list (spawn mode starts the remote, then tunnels). Re-list whenever a
			// connection changes state so the official store picks the sessions up.
			if (typeof ctx.inject === "function") {
				ctx.inject(["sessions"], (sessionCtx) => {
					const seen = new Map();
					const tick = async () => {
						try {
							const value = await adminRequest("/authorities");
							let changed = false;
							for (const entry of value?.authorities ?? []) {
								const status = entry?.connection?.status ?? null;
								if (status === null) continue;
								const before = seen.get(entry.id);
								if (before !== undefined && before !== status) changed = true;
								seen.set(entry.id, status);
							}
							if (changed && typeof sessionCtx.sessions?.refresh === "function") await sessionCtx.sessions.refresh();
						} catch { /* the host is restarting; the next tick retries */ }
					};
					const timer = setInterval(() => { void tick(); }, 2000);
					void tick();
					if (typeof ctx.effect === "function") ctx.effect(() => () => clearInterval(timer));
				});
			}

			// Mount what the boot injection knew, then reconcile with the Host registry.
			for (const authority of list) mountAuthority({ id: authority.id, basePath: authority.basePath });
			void (async () => {
				try {
					const value = await adminRequest("/authorities");
					const ids = (value?.authorities ?? []).map((entry) => entry.id).filter((id) => id !== "local");
					const wanted = new Set(ids);
					for (const id of ids) mountAuthority({ id, basePath: "/authority/" + id });
					for (const id of [...adapters.keys()]) if (id !== "local" && !wanted.has(id)) unmountAuthority(id);
					globalThis.__DSH_AUTHORITIES__ = ids.map((id) => ({ id, basePath: "/authority/" + id }));
					step("authorities synced (" + String(ids.length) + ")");
				} catch (error) {
					step("authorities sync failed: " + String(error?.message ?? error));
				}
			})();

			/** Aggregate sessions (unary session/list) from every ready source. */
			async function aggregateSessions() {
				const sources = [...adapters.values()].filter((a) => typeof a.call === "function");
				const lists = await Promise.all(sources.map(async (adapter) => {
					try {
						const result = await adapter.call("session", "list", { _request: {} });
						const items = result?.ok === true ? (result.value?.items ?? []) : [];
						return items.map((item) => {
							// The host-side merge already returns namespaced remote items inside the
							// local list, so the owning authority must come from the id, not the source.
							const raw = String(item.sessionId);
							const match = /^@authority\/([^/]+)\/(.+)$/.exec(raw);
							const authorityId = match !== null ? match[1] : adapter.id;
							const localId = match !== null ? match[2] : raw;
							return {
								authority: authorityId,
								id: match !== null ? raw : namespaceId(adapter.id, raw),
								localId,
								running: item.running,
								blank: item.blank,
								cwd: item.cwd
							};
						});
					} catch (error) { return []; }
				}));
				const seenSessions = new Set();
				return lists.flat().filter((item) => (seenSessions.has(item.id) ? false : (seenSessions.add(item.id), true)));
			}

			/** Aggregate workspaces (first frame of workspace/follow) from every source. */
			async function aggregateWorkspaces() {
				const sources = [...adapters.values()].filter((a) => typeof a.stream === "function");
				const lists = await Promise.all(sources.map(async (adapter) => {
					const frame = await firstFrame(adapter.stream, "workspace/follow", { args: {} }, 8000);
					const baseline = frame !== null && frame.type === "baseline" ? frame.value : undefined;
					const items = baseline?.items ?? [];
					return items.map((workspace) => ({
						authority: adapter.id,
						id: namespaceId(adapter.id, workspace.workspaceId),
						localId: workspace.workspaceId,
						title: workspace.title,
						path: workspace.path,
						createdAt: workspace.createdAt,
						updatedAt: workspace.updatedAt,
						sessionIds: (workspace.sessionIds ?? []).map((sid) => namespaceId(adapter.id, sid))
					}));
				}));
				const seenWorkspaces = new Set();
				return lists.flat().filter((item) => (seenWorkspaces.has(item.id) ? false : (seenWorkspaces.add(item.id), true)));
			}

			/**
			 * Delegate one task to another authority: create (or reuse) a Session there
			 * and deliver a queued prompt through the official session APIs.
			 */
			async function delegate(target, text, options) {
				const authorityId = String(target ?? "local");
				const adapter = adapters.get(authorityId);
				if (adapter === undefined || typeof adapter.call !== "function") throw new Error("delegate: unknown authority " + authorityId);
				let sessionId = options?.sessionId;
				let created = false;
				if (sessionId === undefined) {
					const made = await adapter.call("session", "create", { request: {} });
					if (made?.ok !== true) throw new Error("delegate: session/create failed: " + (made?.error?.message ?? "unknown"));
					sessionId = made.value?.sessionId;
					created = true;
				}
				const requestId = globalThis.crypto?.randomUUID?.() ?? String(Date.now());
				const prompted = await adapter.call("session", "prompt", {
					request: { requestId, sessionId, mode: options?.mode ?? "queue", content: [{ type: "text", text: String(text) }] }
				});
				return {
					authority: authorityId,
					sessionId,
					id: namespaceId(authorityId, sessionId),
					created,
					accepted: prompted?.ok === true && prompted.value?.accepted === true,
					error: prompted?.ok === false ? prompted.error?.message : undefined
				};
			}

			/** Strip one authority's namespace from every string leaf before a direct authority call. */
			function stripNamespace(authorityId, value) {
				const prefix = "@authority/" + authorityId + "/";
				if (typeof value === "string") return value.startsWith(prefix) ? value.slice(prefix.length) : value;
				if (Array.isArray(value)) return value.map((item) => stripNamespace(authorityId, item));
				if (value !== null && typeof value === "object") {
					const out = {};
					for (const key of Object.keys(value)) out[key] = stripNamespace(authorityId, value[key]);
					return out;
				}
				return value;
			}

			function routeCall(namespacedId, namespace, method, args) {
				const { authorityId } = resolveId(namespacedId);
				const adapter = adapters.get(authorityId);
				if (adapter === undefined || typeof adapter.call !== "function") throw new Error("unknown authority: " + authorityId);
				// The authority only knows its own ids, so strip our namespace before calling it directly.
				const payload = authorityId === "local" ? args : stripNamespace(authorityId, args);
				return adapter.call(namespace, method, payload);
			}

			const aggregate = (globalThis.__DSH_AUTHORITY_AGG__ = { sessions: [], workspaces: [], sources: [...adapters.keys()], resolveId, namespaceId, routeCall, delegate, refresh: null });
			aggregateRef = aggregate;
			aggregate.refresh = async () => {
				const [sessions, workspaces] = await Promise.all([aggregateSessions(), aggregateWorkspaces()]);
				aggregate.sessions = sessions;
				aggregate.workspaces = workspaces;
				return { sessions, workspaces };
			};

			aggregate.addRemote = async (input) => {
				const ssh = input?.ssh === undefined || input?.ssh === null ? undefined : input.ssh;
				const id = String(input?.id ?? "").trim();
				if (ssh === undefined) throw new Error("只支持 ssh 托管（缺少 ssh 配置）");
				if (id.length === 0) throw new Error("请填写 id");
				const value = await adminRequest("/authorities/add", { id, ssh, remote: input?.remote });
				mountAuthority({ id, basePath: "/authority/" + id });
				globalThis.__DSH_AUTHORITIES__ = [...adapters.keys()].filter((x) => x !== "local").map((x) => ({ id: x, basePath: "/authority/" + x }));
				attempts = 40;
				await settle();
				return value;
			};
			aggregate.removeRemote = async (id) => {
				const value = await adminRequest("/authorities/remove", { id: String(id) });
				unmountAuthority(String(id));
				globalThis.__DSH_AUTHORITIES__ = [...adapters.keys()].filter((x) => x !== "local").map((x) => ({ id: x, basePath: "/authority/" + x }));
				attempts = 40;
				await settle();
				return value;
			};

			let attempts = 40;
			const settle = async () => {
				const pending = [...adapters.keys()].filter((id) => typeof adapters.get(id)?.call !== "function");
				if (pending.length > 0 && attempts-- > 0) { setTimeout(() => { void settle(); }, 500); return; }
				let sessions = [];
				let workspaces = [];
				try { sessions = await aggregateSessions(); } catch { sessions = []; }
				try { workspaces = await aggregateWorkspaces(); } catch { workspaces = []; }
				if ((sessions.length === 0 || workspaces.length === 0) && attempts-- > 0) { setTimeout(() => { void settle(); }, 300); return; }
				aggregate.sessions = sessions;
				aggregate.workspaces = workspaces;
				const count = (items) => items.reduce((acc, item) => { acc[item.authority] = (acc[item.authority] ?? 0) + 1; return acc; }, {});
				state.aggregate = {
					sessions: sessions.length,
					workspaces: workspaces.length,
					sessionsByAuthority: count(sessions),
					workspacesByAuthority: count(workspaces),
					workspaceIds: workspaces.map((w) => w.id),
					sessionIds: sessions.map((s) => s.id)
				};
				step("aggregate sessions=" + String(sessions.length) + " workspaces=" + String(workspaces.length));
			};
			// --- In-page management surface: one settings section for every authority ---
			function AuthoritiesSection() {
				const [, force] = React.useState(0);
				React.useEffect(() => { const timer = setInterval(() => force((n) => n + 1), 1000); return () => clearInterval(timer); }, []);
				const aggregate = globalThis.__DSH_AUTHORITY_AGG__ ?? { sessions: [], workspaces: [], sources: [], delegate: null };
				const [text, setText] = React.useState("");
				const [target, setTarget] = React.useState("local");
				const [result, setResult] = React.useState(null);
				const [remoteId, setRemoteId] = React.useState("");
				const [busy, setBusy] = React.useState(false);
				const [rows, setRows] = React.useState([]);
				const [sshOptions, setSshOptions] = React.useState([]);
				const [editId, setEditId] = React.useState(null);
				const [editHost, setEditHost] = React.useState("");
				const [editLocal, setEditLocal] = React.useState("");
				const [editRemote, setEditRemote] = React.useState("");
				const [editDsh, setEditDsh] = React.useState("");
				const [editHome, setEditHome] = React.useState("");
				const [dshPath, setDshPath] = React.useState("");
				const [homePath, setHomePath] = React.useState("");
				const [sshHost, setSshHost] = React.useState("");
				const [sshLocal, setSshLocal] = React.useState("");
				const [sshRemote, setSshRemote] = React.useState("");
				React.useEffect(() => {
					adminRequest("/ssh-hosts").then((value) => { if (live) setSshOptions(value?.hosts ?? []); }).catch(() => undefined);
					fillSuggestedPorts();
					let live = true;
					const pull = () => { adminRequest("/authorities").then((value) => { if (live) setRows(value?.authorities ?? []); }).catch(() => undefined); };
					pull();
					const timer = setInterval(pull, 2000);
					return () => { live = false; clearInterval(timer); };
				}, []);
				const lifecycle = (id, op) => {
					setBusy(true);
					setResult({ state: op + " " + id });
					adminRequest("/authorities/" + op, { id })
						.then((value) => setResult({ ok: true, done: op, status: value?.connection?.status ?? null, error: value?.connection?.lastError ?? null }))
						.catch((error) => setResult({ error: String(error?.message ?? error) }))
						.finally(() => setBusy(false));
				};
				const rowOf = (id) => (rows ?? []).find((entry) => entry.id === id);
				const counts = (items) => (items ?? []).reduce((acc, item) => { acc[item.authority] = (acc[item.authority] ?? 0) + 1; return acc; }, {});
				const sessionCounts = counts(aggregate.sessions);
				const workspaceCounts = counts(aggregate.workspaces);
				const sources = aggregate.sources ?? [];
				if (sources.length > 0 && !sources.includes(target)) setTarget(sources[0]);
				const fillSuggestedPorts = () => {
					Promise.resolve(adminRequest("/suggest-ports")).then((value) => {
						if (value === null || value === undefined) return;
						if (Number.isInteger(value.localPort)) setSshLocal(String(value.localPort));
						if (Number.isInteger(value.remotePort)) setSshRemote(String(value.remotePort));
					}).catch(() => undefined);
				};
				const submitAdd = () => {
					const host = sshHost.trim();
					if (host === "") { setResult({ error: "需要 ssh host（可从下拉里选一台）" }); return; }
					const portOf = (value) => { const n = Number(value); return Number.isInteger(n) && n > 0 ? n : null; };
					const localPort = portOf(sshLocal);
					const remotePort = portOf(sshRemote);
					const id = remoteId.trim() || host.replace(/[^A-Za-z0-9._-]/g, "-").slice(0, 32);
					setBusy(true);
					setResult({ state: "adding" });
					Promise.resolve(aggregate.addRemote?.({
						id,
						ssh: { host, ...(localPort === null ? {} : { localPort }), ...(remotePort === null ? {} : { remotePort }) },
						remote: {
							start: true,
							...(dshPath.trim() === "" ? {} : { dsh: dshPath.trim() }),
							...(homePath.trim() === "" ? {} : { home: homePath.trim() }),
						},
					}))
						.then((value) => { setResult({ ok: true, authorities: (value?.authorities ?? []).map((entry) => entry.id) }); setSshHost(""); setSshLocal(""); setSshRemote(""); setDshPath(""); setHomePath(""); setRemoteId(""); })
						.catch((error) => setResult({ error: String(error?.message ?? error) }))
						.finally(() => setBusy(false));
				};
				const submitRemove = (id) => {
					if (typeof globalThis.confirm === "function" && !globalThis.confirm("移除远端 " + id + "？")) return;
					setBusy(true);
					setResult({ state: "removing " + id });
					Promise.resolve(aggregate.removeRemote?.(id))
						.then((value) => setResult({ ok: true, authorities: (value?.authorities ?? []).map((entry) => entry.id) }))
						.catch((error) => setResult({ error: String(error?.message ?? error) }))
						.finally(() => setBusy(false));
				};
				const startEdit = (id) => {
					const row = rowOf(id);
					setEditId(id);
					setEditHost(String(row?.ssh?.host ?? ""));
					setEditLocal(String(row?.ssh?.localPort ?? ""));
					setEditRemote(String(row?.ssh?.remotePort ?? ""));
					setEditDsh(String(row?.remote?.dsh ?? ""));
					setEditHome(String(row?.remote?.home ?? ""));
				};
				const saveEdit = () => {
					const id = editId;
					if (id === null) return;
					setBusy(true);
					setResult({ state: "saving " + id });
					Promise.resolve(adminRequest("/authorities/update", {
						id,
						ssh: { host: editHost.trim(), localPort: Number(editLocal), remotePort: Number(editRemote) },
						remote: { ...(editDsh.trim() === "" ? {} : { dsh: editDsh.trim() }), ...(editHome.trim() === "" ? {} : { home: editHome.trim() }) },
					}))
						.then((value) => { setEditId(null); setResult({ ok: true, updated: id, authorities: (value?.authorities ?? []).map((entry) => entry.id) }); })
						.catch((error) => setResult({ error: String(error?.message ?? error) }))
						.finally(() => setBusy(false));
				};
				const cardStyle = { display: "grid", gap: 8, padding: "12px 14px", border: "0.5px solid var(--dsw-alias-border-l3)", borderRadius: "var(--dsw-radius-lg, 12px)", background: "var(--dsw-alias-bg-layer-2)" };
				const mutedStyle = { fontSize: 12, color: "var(--dsw-alias-label-tertiary)" };
				const rowStyle = { display: "flex", alignItems: "center", gap: 8 };
				const selectStyle = { flex: 1, minWidth: 0, height: 32, padding: "0 8px", border: "0.5px solid var(--dsw-alias-border-l4)", borderRadius: "var(--dsw-radius-sm, 8px)", background: "var(--dsw-alias-button-elevated-fill, transparent)", color: "var(--dsw-alias-label-primary)", fontSize: 13 };
				const statusOf = (conn) => {
					if (conn === undefined || conn === null) return null;
					if (conn.status === "up") return { dot: "done", text: "已连接" };
					if (conn.status === "connecting") return { dot: "ongoing", text: "连接中…" };
					if (conn.status === "reconnecting") return { dot: "ongoing", text: "重连中…" };
					if (conn.lastError !== null && conn.lastError !== undefined) return { dot: "error", text: "出错" };
					return { dot: "idle", text: "未连接" };
				};
				return React.createElement("section", { style: { display: "grid", gap: 12 }, "data-mhr": "authorities" },
					React.createElement("div", { style: { display: "grid", gap: 4 } },
						React.createElement("h2", { style: { margin: 0, fontSize: 16, color: "var(--dsw-alias-label-primary)" } }, "多 Host"),
						React.createElement("span", { style: mutedStyle }, "通过 ssh 托管远端 dsh：自动建隧道、自动取 token、挂了自动拉起；远端会话与工作区并入本页。")),
					...sources.map((id) => {
						const conn = rowOf(id)?.connection;
						const status = statusOf(conn);
						return React.createElement("div", { key: id, "data-mhr-row": id, style: cardStyle },
							React.createElement("div", { style: rowStyle },
								React.createElement("span", {
									"data-mhr-swatch": id,
									title: id === "local" ? "本机" : "侧栏会话来源标记的颜色：" + id,
									style: { width: 16, height: 16, borderRadius: 5, flex: "none", background: "hsl(" + String(originHue(id)) + " 70% 88%)", border: "1px solid hsl(" + String(originHue(id)) + " 55% 70%)" }
								}),
								React.createElement("div", { style: { display: "grid", gap: 2, flex: 1, minWidth: 0 } },
									React.createElement("strong", { style: { fontSize: 13, color: "var(--dsw-alias-label-primary)" } }, id === "local" ? "本机（local）" : id),
									React.createElement("span", { style: mutedStyle }, "项目 " + String(workspaceCounts[id] ?? 0) + " · 会话 " + String(sessionCounts[id] ?? 0))),
								status === null ? null : React.createElement("span", { style: { display: "inline-flex", alignItems: "center", gap: 6, flex: "none", fontSize: 12, color: "var(--dsw-alias-label-secondary)" }, title: conn?.lastError ?? (conn?.remote === "missing" ? "远端 dsh 未运行" : "远端 " + String(conn?.remote)) },
									React.createElement(primitives.StateDot, { state: status.dot }),
									React.createElement("span", null, status.text))),
							React.createElement("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" } },
								conn === null || conn === undefined ? null : React.createElement(primitives.Button, { "data-mhr-connect": id, variant: "outline", size: "sm", disabled: busy || conn.status === "up", onClick: () => lifecycle(id, "connect") }, "连接"),
								conn === null || conn === undefined ? null : React.createElement(primitives.Button, { "data-mhr-disconnect": id, variant: "ghost", size: "sm", disabled: busy || conn.status === "down", onClick: () => lifecycle(id, "disconnect") }, "断开"),
								conn === null || conn === undefined ? null : React.createElement(primitives.Button, { "data-mhr-restart": id, variant: "ghost", size: "sm", disabled: busy, onClick: () => lifecycle(id, "restart") }, "重连"),
								conn !== null && conn !== undefined && rowOf(id)?.remote?.managed === true ? React.createElement(primitives.Button, { "data-mhr-restart-remote": id, variant: "ghost", size: "sm", disabled: busy, onClick: () => lifecycle(id, "restart-remote") }, "重启远端") : null,
								conn === null || conn === undefined ? null : React.createElement(primitives.Button, { "data-mhr-edit": id, variant: "ghost", size: "sm", disabled: busy, onClick: () => startEdit(id) }, editId === id ? "编辑中" : "编辑"),
									id === "local" ? null : React.createElement(primitives.Button, {
										"data-mhr-open-ui": id,
										variant: "ghost",
										size: "sm",
										title: "在系统浏览器里打开远端原生 UI（带 token 的隧道地址）",
										style: { marginLeft: "auto" },
										onClick: () => {
											Promise.resolve(adminRequest("/remote-ui-url?id=" + encodeURIComponent(id))).then((value) => {
												const url = value?.url;
												if (typeof url !== "string" || url === "") throw new Error("拿不到远端 UI 地址");
												let opened = undefined;
												try { opened = globalThis.open(url, "_blank"); } catch { opened = null; }
												if (opened === null || opened === undefined) { try { globalThis.navigator?.clipboard?.writeText(url); } catch { /* no clipboard */ } }
												setResult({ "远端 UI 地址": url, "结果": opened === null || opened === undefined ? "浏览器未打开，地址已尝试复制，请手动打开" : "已在浏览器打开" });
											}).catch((error) => setResult({ error: String(error?.message ?? error) }));
										}
									}, "打开远端 UI"),
								id === "local" ? null : React.createElement(primitives.Button, { "data-mhr-remove": id, variant: "ghost", size: "sm", disabled: busy, onClick: () => submitRemove(id), style: { color: "var(--dsw-alias-state-error-primary, #d92d20)" } }, "移除")),
								editId === id ? React.createElement("div", { style: { display: "grid", gap: 6, borderTop: "0.5px solid var(--dsw-alias-border-l3)", paddingTop: 8 } },
									React.createElement("span", { style: mutedStyle }, "编辑 " + id + (rowOf(id)?.fromConfig === true ? "（profile 配置里也有同名条目，保存后会覆盖它）" : "")),
									React.createElement("div", { style: rowStyle },
										React.createElement(primitives.Input, { "data-mhr-edit-host": id, value: editHost, placeholder: "ssh host", onChange: (event) => setEditHost(event.target.value), style: { flex: 1 } }),
										React.createElement(primitives.Input, { "data-mhr-edit-local": id, value: editLocal, placeholder: "本地端口（留空自动分配）", onChange: (event) => setEditLocal(event.target.value), style: { flex: 1 } }),
										React.createElement(primitives.Input, { "data-mhr-edit-remote": id, value: editRemote, placeholder: "远端端口（留空默认 3080）", onChange: (event) => setEditRemote(event.target.value), style: { flex: 1 } })),
									React.createElement("div", { style: rowStyle },
										React.createElement(primitives.Input, { "data-mhr-edit-dsh": id, value: editDsh, placeholder: "远端 dsh 路径（可选）", onChange: (event) => setEditDsh(event.target.value), style: { flex: 1 } }),
										React.createElement(primitives.Input, { "data-mhr-edit-home": id, value: editHome, placeholder: "DSH_HOME（可选）", onChange: (event) => setEditHome(event.target.value), style: { flex: 1 } })),
									React.createElement("div", { style: rowStyle },
										React.createElement(primitives.Button, { "data-mhr-edit-save": id, variant: "primary", size: "sm", disabled: busy, onClick: saveEdit }, "保存"),
										React.createElement(primitives.Button, { variant: "ghost", size: "sm", disabled: busy, onClick: () => setEditId(null) }, "取消"))) : null);
					}),
					React.createElement("div", { "data-mhr": "add-remote", style: cardStyle },
						React.createElement("strong", { style: { fontSize: 13, color: "var(--dsw-alias-label-primary)" } }, "添加远端"),
						React.createElement("span", { style: mutedStyle }, "远端 dsh 由我们通过 ssh 启动与看护；token 自动获取，无需手填。"),
						React.createElement("div", { style: rowStyle },
							React.createElement("select", {
								"data-mhr": "add-ssh-host-pick",
								value: sshOptions.some((option) => option.alias === sshHost) ? sshHost : "",
								onChange: (event) => {
									const picked = event.target.value;
									if (picked === "") return;
									setSshHost(picked);
									setRemoteId(picked);
									fillSuggestedPorts();
								},
								style: selectStyle
							},
								React.createElement("option", { value: "" }, sshOptions.length === 0 ? "（未读到 ~/.ssh/config）" : "选择 ~/.ssh/config 中的主机…"),
								...sshOptions.map((option) => React.createElement("option", { key: option.alias, value: option.alias }, option.hostName ? option.alias + " → " + option.hostName : option.alias))),
							React.createElement(primitives.Input, { "data-mhr": "add-ssh-host", value: sshHost, placeholder: "或直接输入 ssh host", onChange: (event) => setSshHost(event.target.value), style: { flex: 2 } })),
						React.createElement("div", { style: rowStyle },
							React.createElement(primitives.Input, { "data-mhr": "add-ssh-local", value: sshLocal, placeholder: "本地端口（留空自动分配）", onChange: (event) => setSshLocal(event.target.value), style: { flex: 1 } }),
							React.createElement(primitives.Input, { "data-mhr": "add-ssh-remote", value: sshRemote, placeholder: "远端端口（留空默认 3080）", onChange: (event) => setSshRemote(event.target.value), style: { flex: 1 } })),
						React.createElement("div", { style: rowStyle },
							React.createElement(primitives.Input, { "data-mhr": "add-dsh", value: dshPath, placeholder: "远端 dsh 路径（可选，默认 dsh）", onChange: (event) => setDshPath(event.target.value), style: { flex: 1 } }),
							React.createElement(primitives.Input, { "data-mhr": "add-home", value: homePath, placeholder: "DSH_HOME（可选，默认 ~/.dsh）", onChange: (event) => setHomePath(event.target.value), style: { flex: 1 } })),
						React.createElement("div", { style: rowStyle },
							React.createElement(primitives.Input, { "data-mhr": "add-id", value: remoteId, placeholder: "id（可选，默认取 ssh host）", onChange: (event) => setRemoteId(event.target.value), style: { flex: 1 } }),
							React.createElement(primitives.Button, { "data-mhr": "add-submit", variant: "primary", size: "sm", disabled: busy, onClick: submitAdd }, busy ? "处理中…" : "添加"))),
					React.createElement("div", { style: rowStyle },
						React.createElement("select", { value: target, onChange: (event) => setTarget(event.target.value), style: { ...selectStyle, flex: "none", width: 160 } },
							...sources.map((id) => React.createElement("option", { key: id, value: id }, id))),
						React.createElement(primitives.Input, { value: text, placeholder: "委托任务文本（交给另一台 host 执行）", onChange: (event) => setText(event.target.value), style: { flex: 1 } }),
						React.createElement(primitives.Button, { variant: "outline", size: "sm", onClick: () => { Promise.resolve(aggregate.delegate?.(target, text)).then(setResult).catch((error) => setResult({ error: String(error?.message ?? error) })); } }, "委托")),
					result !== null ? React.createElement("pre", { style: { margin: 0, padding: "8px 10px", fontSize: 11, whiteSpace: "pre-wrap", border: "0.5px solid var(--dsw-alias-border-l3)", borderRadius: "var(--dsw-radius-md, 12px)", background: "var(--dsw-alias-bg-layer-2)", color: "var(--dsw-alias-label-secondary)" } }, JSON.stringify(result, null, 1)) : null);
			}
			if (typeof ctx.slots?.inject === "function") {
				ctx.slots.inject("settings.section", () => ctx.slots.register({
					name: "settings.section",
					id: "authorities",
					order: 30,
					label: () => "多 Host"
				}, AuthoritiesSection));
				step("settings section registered");
			}

			// --- Session origin: mark rows that belong to a remote authority ---
			function authorityOfSession(sessionId) {
				const match = /^@authority\/([^/]+)\//.exec(String(sessionId ?? ""));
				return match === null ? null : match[1];
			}
			/** Deterministic hue so different remotes read as different colours. */
			function originHue(authorityId) {
				// Golden-angle spread over the known authorities: any two remotes stay far
				// apart on the colour wheel, unlike id hashing (which collides easily).
				const ids = [...adapters.keys()].filter((id) => id !== "local").sort();
				const index = ids.indexOf(String(authorityId));
				if (index < 0) return 210;
				return Math.round((index * 137.508) % 360);
			}
			function OriginHover(props) {
				const authorityId = authorityOfSession(props?.sessionId);
				if (authorityId === null) return null;
				return React.createElement("span", { "data-mhr-origin-hover": authorityId, style: { fontSize: 11 } }, "来源：" + authorityId);
			}
			// --- Origin label: an always-visible trailing marker on remote session rows.
			// The sidebar declares no trailing seat (row.action is hover-only), so this
			// cooperates with the row's own DOM instead: anchored by data-row-key, styled
			// with the official tertiary token, inert to pointer events, and replayed by
			// a MutationObserver. Its failure mode is a missing label, never a broken row.
			const ORIGIN_LABEL_ATTR = "data-mhr-origin-label";
			function installOriginLabels() {
				if (typeof document === "undefined") return () => {};
				const style = document.createElement("style");
				style.setAttribute("data-mhr-origin-style", "1");
				style.textContent = ".mhr-origin-label{display:inline-flex;align-items:center;gap:4px;flex:none;margin-left:6px;font-size:10px;line-height:16px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;pointer-events:none;user-select:none}.mhr-origin-label>i{width:5px;height:5px;border-radius:50%;flex:none}";
				document.head.appendChild(style);
				const apply = () => {
					for (const row of document.querySelectorAll('[data-row-key^="session:@authority/"]')) {
						const match = /^session:@authority\/([^/]+)\//.exec(String(row.getAttribute("data-row-key") ?? ""));
						if (match === null) continue;
						const authorityId = decodeURIComponent(match[1]);
						const existing = row.querySelector(":scope > [" + ORIGIN_LABEL_ATTR + "]");
						if (existing !== null && existing.getAttribute(ORIGIN_LABEL_ATTR) === authorityId) continue;
						if (existing !== null) existing.remove();
						const label = document.createElement("span");
						label.setAttribute(ORIGIN_LABEL_ATTR, authorityId);
						label.className = "mhr-origin-label";
						label.title = "来自远端 host: " + authorityId;
						const dot = document.createElement("i");
						dot.style.background = "hsl(" + String(originHue(authorityId)) + " 60% 62%)";
						label.appendChild(dot);
						label.appendChild(document.createTextNode(authorityId));
						try { row.appendChild(label); } catch { /* the row is mid-render */ }
					}
				};
				let queued = false;
				const schedule = () => {
					if (queued) return;
					queued = true;
					const run = () => { queued = false; apply(); };
					if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
					else setTimeout(run, 50);
				};
				const observer = new MutationObserver(schedule);
				observer.observe(document.body, { childList: true, subtree: true });
				apply();
				return () => {
					observer.disconnect();
					style.remove();
					for (const element of document.querySelectorAll("[" + ORIGIN_LABEL_ATTR + "]")) element.remove();
				};
			}
			try {
				const uninstallOriginLabels = installOriginLabels();
				if (typeof ctx.effect === "function") ctx.effect(() => uninstallOriginLabels);
				step("origin label installed");
			} catch (error) {
				step("origin label failed: " + String(error?.message ?? error));
			}
			if (typeof ctx.slots?.inject === "function") {
				try {
					ctx.slots.inject("sidebar.session.row.hover", () => ctx.slots.register({
						name: "sidebar.session.row.hover",
						id: "authority-origin",
						order: 60
					}, OriginHover));
					step("origin badge registered");
				} catch (error) {
					step("origin badge failed: " + String(error?.message ?? error));
				}
			}

			// --- Diagnostic: expose the official session store so a check can read it ---
			if (typeof ctx.inject === "function") {
				ctx.inject(["sessions"], (sessionCtx) => {
					globalThis.__DSH_SESSIONS_STORE__ = () => {
						try {
							const snapshot = sessionCtx.sessions.list.getSnapshot();
							return { ids: snapshot?.ids ?? [], count: (snapshot?.ids ?? []).length, phase: snapshot?.phase };
						} catch (error) {
							return { error: String(error?.message ?? error) };
						}
					};
				});
				// Diagnostic: expose the official workspace services (the real UI state + actions).
				ctx.inject(["workspaces"], (workspaceCtx) => {
					globalThis.__DSH_WORKSPACES_STORE__ = () => {
						const out = {};
						try { const w = workspaceCtx.workspaces; out.serviceKeys = Object.keys(w ?? {}); out.archived = w?.archivedSessionIds ?? null; out.pinned = w?.pinnedSessionIds ?? null; } catch (error) { out.error = String(error?.message ?? error); }
						try { const model = workspaceCtx.workspaces?.model; out.modelKeys = Object.keys(model ?? {}); out.modelArchived = model?.archivedSessionIds ?? null; out.modelPinned = model?.pinnedSessionIds ?? null; } catch (error) { out.modelError = String(error?.message ?? error); }
						try { const snapshot = workspaceCtx.workspaces?.list?.getSnapshot?.(); out.snapshotKeys = Object.keys(snapshot ?? {}); out.snapshotArchived = snapshot?.archivedSessionIds ?? null; } catch (error) { out.snapshotError = String(error?.message ?? error); }
						return out;
					};
				});
				ctx.inject(["uiWorkspace"], (uiCtx) => {
					globalThis.__DSH_UIWORKSPACE__ = () => uiCtx.uiWorkspace;
				});
			}

			setTimeout(() => { void settle(); }, 800);
		}

		exports.apply = apply;
		exports.inject = ["connection", "slots"];
		return module.exports;
	}
});

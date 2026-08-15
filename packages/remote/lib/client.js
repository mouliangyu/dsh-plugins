window.__ModuleLoader__.load({
	id: "dsh-remote",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region \0dsh-remote-css:/Users/mouliangyu/Documents/dsh-plugins/packages/remote/src/client/RemoteSettingsSection.module.css.mjs
		const css = ".ghiA-a_root{gap:16px;min-width:0;display:grid}.ghiA-a_header,.ghiA-a_columnTitle,.ghiA-a_formActions{justify-content:space-between;align-items:center;gap:8px;display:flex}.ghiA-a_header h2,.ghiA-a_column h3,.ghiA-a_events h3{letter-spacing:0;margin:0;font-size:16px}.ghiA-a_columns{grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;min-height:260px;display:grid}.ghiA-a_column{border:1px solid var(--border,#d6d9de);border-radius:6px;flex-direction:column;gap:8px;min-width:0;padding:10px;display:flex}.ghiA-a_row{border:1px solid #0000;border-radius:5px;grid-template-columns:minmax(0,1fr) 30px 30px 30px;align-items:center;display:grid}.ghiA-a_row[data-selected],.ghiA-a_listButton[data-selected]{border-color:var(--accent,#1677ff);background:color-mix(in srgb, var(--accent,#1677ff) 8%, transparent)}.ghiA-a_rowMain,.ghiA-a_listButton{appearance:none;border:1px solid var(--border,#d6d9de);color:inherit;text-align:left;cursor:pointer;background:0 0;border-radius:5px;gap:3px;min-width:0;padding:8px;display:grid}.ghiA-a_rowMain{border:0}.ghiA-a_rowMain span,.ghiA-a_rowMain small,.ghiA-a_listButton span{text-overflow:ellipsis;white-space:nowrap;color:var(--muted-foreground,#667085);font-size:12px;overflow:hidden}.ghiA-a_iconButton{width:28px;height:28px;color:inherit;cursor:pointer;background:0 0;border:0;place-items:center;display:grid}.ghiA-a_iconButton:disabled{cursor:default;opacity:.45}.ghiA-a_spinning{animation:1s linear infinite ghiA-a_remote-spin;display:inline-flex}@keyframes ghiA-a_remote-spin{to{transform:rotate(360deg)}}.ghiA-a_form{border:1px solid var(--border,#d6d9de);border-radius:6px;grid-template-columns:1fr 1fr 2fr auto;align-items:end;gap:10px;padding:12px;display:grid}.ghiA-a_projectForm{grid-template-columns:minmax(140px,1fr) minmax(260px,2fr) auto}.ghiA-a_form label{gap:5px;font-size:12px;display:grid}.ghiA-a_form input,.ghiA-a_form select,.ghiA-a_composer textarea{box-sizing:border-box;border:1px solid var(--border,#d6d9de);background:var(--background,#fff);width:100%;color:inherit;font:inherit;border-radius:5px;padding:8px}.ghiA-a_hostEmpty{color:var(--muted-foreground,#667085);font-size:11px}.ghiA-a_sessionPane{gap:10px;display:grid}.ghiA-a_events{border:1px solid var(--border,#d6d9de);border-radius:6px;gap:6px;max-height:360px;padding:10px;display:grid;overflow:auto}.ghiA-a_event{grid-template-columns:48px minmax(100px,180px) 1fr;align-items:start;gap:8px;font-size:12px;display:grid}.ghiA-a_event pre{white-space:pre-wrap;overflow-wrap:anywhere;margin:0}.ghiA-a_composer{grid-template-columns:1fr auto auto;align-items:end;gap:8px;display:grid}.ghiA-a_composer textarea{resize:vertical;min-height:72px}.ghiA-a_error{color:#b42318;margin:0}.ghiA-a_empty{color:var(--muted-foreground,#667085);font-size:13px}@media (width<=900px){.ghiA-a_columns,.ghiA-a_form,.ghiA-a_projectForm{grid-template-columns:1fr}.ghiA-a_event{grid-template-columns:40px 1fr}.ghiA-a_event pre{grid-column:1/-1}}";
		const tagId = "dsh-remote/RemoteSettingsSection.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-remote";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var RemoteSettingsSection_module_css_default = {
			"columns": "ghiA-a_columns",
			"column": "ghiA-a_column",
			"spinning": "ghiA-a_spinning",
			"empty": "ghiA-a_empty",
			"listButton": "ghiA-a_listButton",
			"iconButton": "ghiA-a_iconButton",
			"columnTitle": "ghiA-a_columnTitle",
			"rowMain": "ghiA-a_rowMain",
			"form": "ghiA-a_form",
			"root": "ghiA-a_root",
			"formActions": "ghiA-a_formActions",
			"remote-spin": "ghiA-a_remote-spin",
			"projectForm": "ghiA-a_projectForm",
			"hostEmpty": "ghiA-a_hostEmpty",
			"sessionPane": "ghiA-a_sessionPane",
			"composer": "ghiA-a_composer",
			"error": "ghiA-a_error",
			"header": "ghiA-a_header",
			"events": "ghiA-a_events",
			"row": "ghiA-a_row",
			"event": "ghiA-a_event"
		};
		//#endregion
		//#region src/client/RemoteSettingsSection.tsx
		/** Remote connection, project, and root-session management page. */
		const API = "/dsh-remote/api";
		const EVENTS = "/dsh-remote/events";
		async function action(body) {
			const response = await fetch(API, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body)
			});
			const payload = await response.json();
			if (!response.ok || payload.error !== void 0) throw new Error(payload.error ?? `HTTP ${response.status}`);
			return payload.value;
		}
		/** Render the complete remote-management page. */
		function RemoteSettingsSection({ t = (key) => key }) {
			const [state, setState] = (0, react.useState)({ connections: [] });
			const [selection, setSelection] = (0, react.useState)();
			const [projects, setProjects] = (0, react.useState)([]);
			const [sessions, setSessions] = (0, react.useState)([]);
			const [events, setEvents] = (0, react.useState)([]);
			const [editing, setEditing] = (0, react.useState)(null);
			const [projectEditing, setProjectEditing] = (0, react.useState)(false);
			const [sshHosts, setSshHosts] = (0, react.useState)([]);
			const [prompt, setPrompt] = (0, react.useState)("");
			const [busy, setBusy] = (0, react.useState)(false);
			const [installingConnectionId, setInstallingConnectionId] = (0, react.useState)();
			const [error, setError] = (0, react.useState)();
			const refreshState = async () => {
				const response = await fetch(API);
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				setState(await response.json());
			};
			(0, react.useEffect)(() => {
				refreshState().catch((err) => {
					setError(String(err));
				});
			}, []);
			const selectedConnection = (0, react.useMemo)(() => state.connections.find((entry) => entry.id === selection?.connectionId), [selection?.connectionId, state.connections]);
			(0, react.useEffect)(() => {
				if (selection?.connectionId === void 0 || selection.projectId === void 0 || selection.sessionId === void 0) return;
				setEvents([]);
				let nextSeq = 0;
				const params = new URLSearchParams({
					connectionId: selection.connectionId,
					projectId: selection.projectId,
					sessionId: selection.sessionId,
					fromSeq: String(nextSeq)
				});
				const source = new EventSource(`${EVENTS}?${params.toString()}`);
				source.onmessage = (message) => {
					const event = JSON.parse(String(message.data));
					nextSeq = Math.max(nextSeq, event.event.seq + 1);
					setEvents((current) => [...current, event]);
				};
				source.onerror = () => {
					source.close();
				};
				return () => {
					source.close();
				};
			}, [
				selection?.connectionId,
				selection?.projectId,
				selection?.sessionId
			]);
			const run = async (operation) => {
				setBusy(true);
				setError(void 0);
				try {
					await operation();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(false);
				}
			};
			const connect = (connection) => {
				setSelection({ connectionId: connection.id });
				setProjects([]);
				setSessions([]);
				run(async () => {
					const result = await action({
						action: "connect",
						connectionId: connection.id
					});
					setProjects(result.projects);
					await refreshState();
				});
			};
			const addConnection = () => {
				run(async () => {
					const result = await action({ action: "discoverHosts" });
					setSshHosts(result.hosts);
					const host = result.hosts[0]?.alias ?? "";
					const id = suggestId(host);
					setEditing({
						id,
						host,
						socketPath: `/tmp/dsh-remote-${id}.sock`
					});
				});
			};
			const bootstrapHost = (connection) => {
				setInstallingConnectionId(connection.id);
				run(async () => {
					setSelection({ connectionId: connection.id });
					setSessions([]);
					const result = await action({
						action: "bootstrapHost",
						connectionId: connection.id
					});
					setProjects(result.projects);
					await refreshState();
				}).finally(() => {
					setInstallingConnectionId(void 0);
				});
			};
			const createProject = (projectId, projectRoot) => {
				if (selection === void 0) return;
				run(async () => {
					const result = await action({
						action: "createProject",
						connectionId: selection.connectionId,
						projectId,
						projectRoot
					});
					setProjects((current) => [...current.filter((project) => project.id !== result.project.id), result.project]);
					setSessions([]);
					setSelection({
						connectionId: selection.connectionId,
						projectId
					});
					setProjectEditing(false);
				});
			};
			const chooseProject = (project) => {
				if (selection === void 0) return;
				run(async () => {
					const result = await action({
						action: "sessions",
						connectionId: selection.connectionId,
						projectId: project.id
					});
					setSessions(result.sessions);
					setEvents([]);
					setSelection({
						connectionId: selection.connectionId,
						projectId: project.id
					});
				});
			};
			const createSession = () => {
				if (selection?.projectId === void 0) return;
				run(async () => {
					const result = await action({
						action: "createSession",
						connectionId: selection.connectionId,
						projectId: selection.projectId
					});
					const listed = await action({
						action: "sessions",
						connectionId: selection.connectionId,
						projectId: selection.projectId
					});
					setSessions(listed.sessions);
					setSelection({
						...selection,
						sessionId: result.sessionId
					});
				});
			};
			const submitPrompt = (event) => {
				event.preventDefault();
				if (selection?.projectId === void 0 || selection.sessionId === void 0 || prompt.trim() === "") return;
				const text = prompt;
				setPrompt("");
				run(async () => {
					await action({
						action: "prompt",
						...selection,
						text
					});
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: RemoteSettingsSection_module_css_default.root,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						className: RemoteSettingsSection_module_css_default.header,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: t("title") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutline16, {}),
							onClick: addConnection,
							children: t("add")
						})]
					}),
					error !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: RemoteSettingsSection_module_css_default.error,
						role: "alert",
						children: error
					}) : null,
					editing !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ConnectionForm, {
						initial: editing,
						hosts: sshHosts,
						busy,
						t,
						onCancel: () => {
							setEditing(null);
						},
						onSave: (connection) => {
							run(async () => {
								setState(await action({
									action: "saveConnection",
									connection
								}));
								setEditing(null);
							});
						}
					}) : null,
					projectEditing && selection !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProjectForm, {
						busy,
						t,
						onCancel: () => {
							setProjectEditing(false);
						},
						onSave: createProject
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: RemoteSettingsSection_module_css_default.columns,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: RemoteSettingsSection_module_css_default.column,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t("nav") }),
									state.connections.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: RemoteSettingsSection_module_css_default.empty,
										children: t("noConnections")
									}) : null,
									state.connections.map((connection) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: RemoteSettingsSection_module_css_default.row,
										"data-selected": selection?.connectionId === connection.id || void 0,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
												className: RemoteSettingsSection_module_css_default.rowMain,
												type: "button",
												onClick: () => {
													connect(connection);
												},
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: connection.id }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: connection.host }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: connection.connected ? t("connected") : t("disconnected") })
												]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												"aria-label": installingConnectionId === connection.id ? t("installingHost") : t("manageHost"),
												className: RemoteSettingsSection_module_css_default.iconButton,
												disabled: busy,
												title: installingConnectionId === connection.id ? t("installingHost") : t("manageHost"),
												onClick: () => {
													bootstrapHost(connection);
												},
												children: installingConnectionId === connection.id ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: RemoteSettingsSection_module_css_default.spinning,
													children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconLoadingOutline16, {})
												}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconDownloadOutline16, {})
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												className: RemoteSettingsSection_module_css_default.iconButton,
												title: t("edit"),
												onClick: () => {
													setEditing(connection);
												},
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutline16, {})
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												className: RemoteSettingsSection_module_css_default.iconButton,
												title: t("remove"),
												onClick: () => {
													run(async () => {
														setState(await action({
															action: "removeConnection",
															connectionId: connection.id
														}));
														if (selection?.connectionId === connection.id) setSelection(void 0);
													});
												},
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutline16, {})
											})
										]
									}, connection.id))
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: RemoteSettingsSection_module_css_default.column,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: RemoteSettingsSection_module_css_default.columnTitle,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t("projects") }), selectedConnection?.connected === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
											variant: "outline",
											icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutline16, {}),
											onClick: () => {
												setProjectEditing(true);
											},
											children: t("newProject")
										}) : null]
									}),
									selectedConnection !== void 0 && projects.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: RemoteSettingsSection_module_css_default.empty,
										children: t("noProjects")
									}) : null,
									projects.map((project) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										className: RemoteSettingsSection_module_css_default.listButton,
										"data-selected": selection?.projectId === project.id || void 0,
										onClick: () => {
											chooseProject(project);
										},
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: project.id }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: project.root })]
									}, project.id))
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: RemoteSettingsSection_module_css_default.column,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: RemoteSettingsSection_module_css_default.columnTitle,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t("sessions") }), selection?.projectId !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
											variant: "outline",
											onClick: createSession,
											children: t("newSession")
										}) : null]
									}),
									selection?.projectId !== void 0 && sessions.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: RemoteSettingsSection_module_css_default.empty,
										children: t("noSessions")
									}) : null,
									sessions.map((session) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										className: RemoteSettingsSection_module_css_default.listButton,
										"data-selected": selection?.sessionId === session.id || void 0,
										onClick: () => {
											setSelection((current) => current === void 0 ? current : {
												...current,
												sessionId: session.id
											});
										},
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: session.title ?? session.id }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: session.cwd })]
									}, session.id))
								]
							})
						]
					}),
					selection?.sessionId !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: RemoteSettingsSection_module_css_default.sessionPane,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: RemoteSettingsSection_module_css_default.events,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t("events") }), events.map(({ event }) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: RemoteSettingsSection_module_css_default.event,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: event.seq }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: event.type }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", { children: JSON.stringify(event.data ?? {}, null, 2) })
								]
							}, event.seq))]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
							className: RemoteSettingsSection_module_css_default.composer,
							onSubmit: submitPrompt,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
									"aria-label": t("prompt"),
									value: prompt,
									onChange: (event) => {
										setPrompt(event.currentTarget.value);
									}
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "primary",
									type: "submit",
									disabled: busy || prompt.trim() === "",
									children: t("send")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "outline",
									type: "button",
									disabled: busy,
									onClick: () => {
										run(async () => {
											await action({
												action: "cancel",
												...selection
											});
										});
									},
									children: t("stop")
								})
							]
						})]
					}) : null
				]
			});
		}
		function ConnectionForm({ initial, hosts, busy, t, onCancel, onSave }) {
			const [value, setValue] = (0, react.useState)(initial);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
				className: RemoteSettingsSection_module_css_default.form,
				onSubmit: (event) => {
					event.preventDefault();
					onSave(value);
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [t("id"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						value: value.id,
						onChange: (event) => {
							setValue({
								...value,
								id: event.currentTarget.value
							});
						}
					})] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [t("host"), hosts.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						value: value.host,
						onChange: (event) => {
							setValue({
								...value,
								host: event.currentTarget.value
							});
						}
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: RemoteSettingsSection_module_css_default.hostEmpty,
						children: t("noSshHosts")
					})] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
						value: value.host,
						onChange: (event) => {
							const host = event.currentTarget.value;
							const previousSuggestedId = suggestId(value.host);
							const nextSuggestedId = suggestId(host);
							setValue((current) => ({
								...current,
								host,
								id: current.id === previousSuggestedId ? nextSuggestedId : current.id,
								socketPath: current.socketPath === `/tmp/dsh-remote-${previousSuggestedId}.sock` ? `/tmp/dsh-remote-${nextSuggestedId}.sock` : current.socketPath
							}));
						},
						children: hosts.map((host) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
							value: host.alias,
							children: host.alias
						}, host.alias))
					})] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [t("socketPath"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						value: value.socketPath,
						onChange: (event) => {
							setValue({
								...value,
								socketPath: event.currentTarget.value
							});
						}
					})] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: RemoteSettingsSection_module_css_default.formActions,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							type: "button",
							onClick: onCancel,
							children: t("cancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							type: "submit",
							disabled: busy,
							children: t("save")
						})]
					})
				]
			});
		}
		function ProjectForm({ busy, t, onCancel, onSave }) {
			const [projectId, setProjectId] = (0, react.useState)("project");
			const [projectRoot, setProjectRoot] = (0, react.useState)("");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
				className: `${RemoteSettingsSection_module_css_default.form} ${RemoteSettingsSection_module_css_default.projectForm}`,
				onSubmit: (event) => {
					event.preventDefault();
					onSave(projectId, projectRoot);
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [t("projectId"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						value: projectId,
						onChange: (event) => {
							setProjectId(event.currentTarget.value);
						}
					})] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [t("projectRoot"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						placeholder: "/srv/project",
						value: projectRoot,
						onChange: (event) => {
							setProjectRoot(event.currentTarget.value);
						}
					})] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: RemoteSettingsSection_module_css_default.formActions,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							type: "button",
							onClick: onCancel,
							children: t("cancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							type: "submit",
							disabled: busy || projectId === "" || projectRoot === "",
							children: busy ? t("creatingProject") : t("createProject")
						})]
					})
				]
			});
		}
		function suggestId(host) {
			const normalized = host.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
			return (/^[a-z]/.test(normalized) ? normalized : `remote-${normalized}`).slice(0, 64).replace(/-+$/g, "");
		}
		//#endregion
		//#region src/client/locales.ts
		/** Copy for the dsh-remote settings page. */
		const en = {
			nav: "Remote",
			title: "Remote projects",
			add: "Add connection",
			id: "Connection ID",
			host: "SSH host",
			socketPath: "Remote socket path",
			save: "Save",
			cancel: "Cancel",
			connect: "Connect",
			disconnect: "Disconnect",
			remove: "Delete",
			retry: "Retry",
			connected: "Connected",
			disconnected: "Disconnected",
			projects: "Projects",
			sessions: "Sessions",
			newSession: "New session",
			noConnections: "No remote connections configured.",
			noProjects: "The remote host advertised no projects.",
			noSessions: "No sessions in this project.",
			selectProject: "Select a project.",
			selectSession: "Select a session.",
			prompt: "Message",
			send: "Send",
			stop: "Stop",
			events: "Live session events",
			loading: "Loading...",
			connectionFailed: "Connection failed",
			edit: "Edit",
			noSshHosts: "No explicit Host aliases were found in ~/.ssh/config.",
			newProject: "New project",
			projectId: "Project ID",
			projectRoot: "Remote project root",
			manageHost: "Install or update remote Host",
			installingHost: "Installing remote Host",
			createProject: "Create project",
			creatingProject: "Creating..."
		};
		/** Simplified Chinese copy for the remote-project settings page. */
		const zh = {
			nav: "远程",
			title: "远程项目",
			add: "添加连接",
			id: "连接 ID",
			host: "SSH 主机",
			socketPath: "远端 socket 路径",
			save: "保存",
			cancel: "取消",
			connect: "连接",
			disconnect: "断开",
			remove: "删除",
			retry: "重试",
			connected: "已连接",
			disconnected: "未连接",
			projects: "项目",
			sessions: "会话",
			newSession: "新建会话",
			noConnections: "尚未配置远程连接。",
			noProjects: "远端没有提供项目。",
			noSessions: "这个项目还没有会话。",
			selectProject: "请选择项目。",
			selectSession: "请选择会话。",
			prompt: "消息",
			send: "发送",
			stop: "停止",
			events: "实时会话事件",
			loading: "加载中...",
			connectionFailed: "连接失败",
			edit: "编辑",
			noSshHosts: "在 ~/.ssh/config 中没有发现明确的 Host alias。",
			newProject: "新建项目",
			projectId: "项目 ID",
			projectRoot: "远端项目路径",
			manageHost: "安装或更新远端 Host",
			installingHost: "正在安装远端 Host",
			createProject: "创建项目",
			creatingProject: "正在创建..."
		};
		//#endregion
		//#region src/client/index.ts
		const NS = "settings.remote";
		const inject = ["slots", "locale"];
		/** Register the remote-project management page. */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-remote.client.locale");
			const t = ctx.locale.bind(NS);
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "remote",
				order: 20,
				label: () => t("nav"),
				locale: NS,
				inject: () => ({ t })
			}, RemoteSettingsSection));
		}
		//#endregion
		exports.RemoteSettingsSection = RemoteSettingsSection;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

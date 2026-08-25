window.__ModuleLoader__.load({
	id: "dsh-session-control",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		react = __toESM(react, 1);
		//#region lib/types/client/index.js
		const name = "session-control-client";
		const inject = ["slots"];
		const SETTINGS_ROUTE = "/api/session-control/settings";
		const styles = {
			card: {
				listStyle: "none",
				border: "1px solid var(--ds-border, rgba(127, 127, 127, 0.28))",
				borderRadius: 8,
				padding: 16,
				display: "grid",
				gap: 14
			},
			heading: {
				display: "grid",
				gap: 4
			},
			title: {
				fontSize: 14,
				fontWeight: 600
			},
			description: {
				fontSize: 12,
				color: "var(--ds-text-secondary, #666)"
			},
			row: {
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				gap: 16
			},
			label: {
				display: "grid",
				gap: 3,
				minWidth: 0
			},
			labelTitle: {
				fontSize: 13,
				fontWeight: 500
			},
			hint: {
				fontSize: 12,
				color: "var(--ds-text-secondary, #666)"
			},
			switch: {
				width: 36,
				height: 20,
				flex: "0 0 auto",
				cursor: "pointer"
			},
			status: {
				margin: 0,
				fontSize: 12,
				color: "var(--ds-text-secondary, #666)"
			}
		};
		function SessionControlSettingsCard() {
			const [value, setValue] = (0, react.useState)();
			const [saving, setSaving] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)();
			(0, react.useEffect)(() => {
				const controller = new AbortController();
				fetch(SETTINGS_ROUTE, {
					signal: controller.signal,
					cache: "no-store"
				}).then(async (response) => {
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					return await response.json();
				}).then((next) => {
					setValue(next);
					setError(void 0);
				}).catch((reason) => {
					if (controller.signal.aborted) return;
					setError(reason instanceof Error ? reason.message : String(reason));
				});
				return () => controller.abort();
			}, []);
			const update = async (allowGlobalAccess) => {
				const previous = value;
				setValue({ allowGlobalAccess });
				setSaving(true);
				setError(void 0);
				try {
					const response = await fetch(SETTINGS_ROUTE, {
						method: "PUT",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ allowGlobalAccess })
					});
					const body = await response.json();
					if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
					setValue(body);
				} catch (reason) {
					setValue(previous);
					setError(reason instanceof Error ? reason.message : String(reason));
				} finally {
					setSaving(false);
				}
			};
			return (0, react_jsx_runtime.jsxs)("li", {
				style: styles.card,
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						style: styles.heading,
						children: [(0, react_jsx_runtime.jsx)("span", {
							style: styles.title,
							children: "Session & Workspace Control"
						}), (0, react_jsx_runtime.jsx)("span", {
							style: styles.description,
							children: "会话与项目的 Agent 管理权限"
						})]
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						style: styles.row,
						children: [(0, react_jsx_runtime.jsxs)("label", {
							style: styles.label,
							htmlFor: "session-control-global-access",
							children: [(0, react_jsx_runtime.jsx)("span", {
								style: styles.labelTitle,
								children: "全局访问"
							}), (0, react_jsx_runtime.jsx)("span", {
								style: styles.hint,
								children: "允许管理所有项目及未归属会话"
							})]
						}), (0, react_jsx_runtime.jsx)("input", {
							id: "session-control-global-access",
							type: "checkbox",
							role: "switch",
							"aria-label": "全局访问",
							style: styles.switch,
							checked: value?.allowGlobalAccess ?? false,
							disabled: value === void 0 || saving,
							onChange: (event) => void update(event.currentTarget.checked)
						})]
					}),
					value === void 0 && error === void 0 ? (0, react_jsx_runtime.jsx)("p", {
						style: styles.status,
						children: "正在读取设置…"
					}) : null,
					saving ? (0, react_jsx_runtime.jsx)("p", {
						style: styles.status,
						children: "正在保存…"
					}) : null,
					error !== void 0 ? (0, react_jsx_runtime.jsxs)("p", {
						style: {
							...styles.status,
							color: "var(--ds-danger, #c33)"
						},
						role: "alert",
						children: ["保存失败：", error]
					}) : null
				]
			});
		}
		function apply(ctx) {
			ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
				name: "settings.plugin.item",
				key: "session-control",
				id: "session-control",
				order: 30
			}, SessionControlSettingsCard));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});

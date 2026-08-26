window.__ModuleLoader__.load({
	id: "dsh-esc-stop",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		//#region lib/types/client/logic.js
		/**
		* Pure escape-to-stop decision helper.
		*
		* Kept free of DOM and React so the guard rules are unit-testable and the
		* browser bundle stays dependency-light.
		*/
		function shouldStopEscape(input) {
			if (input.key !== "Escape") return false;
			if (input.composing) return false;
			if (input.alt || input.ctrl || input.meta) return false;
			if (input.defaultPrevented) return false;
			if (!input.running) return false;
			if (input.approvalPending) return false;
			if (!input.stopAvailable) return false;
			return true;
		}
		//#endregion
		//#region lib/types/client/index.js
		/**
		* dsh-esc-stop — browser half.
		*
		* Makes Escape stop the running generation, exactly like the Stop button
		* ("停止生成" / "Stop generating") the composer shows while a turn is in
		* flight. The listener is scoped to the session's conversation view and
		* defers to every built-in Escape consumer:
		*
		*   - IME composition, modifier chords and already-consumed keys are left
		*     alone (the slash/mention menus and overlays keep their first Esc);
		*   - an approval/question panel gets first claim on Esc;
		*   - Esc only acts while the agent is actually running and a Stop button
		*     is rendered and enabled.
		*
		* The stop is performed by clicking the composer's own Stop button, so the
		* exact official cancel path runs (no second session-control dependency).
		*/
		const STOP_SELECTOR = ["停止生成", "Stop generating"].map((label) => `button[aria-label="${label}"]`).join(", ");
		/** The per-session conversation view: message area + composer seat. */
		const VIEW_SELECTOR = "[data-conversation-scroll]";
		/** Approval / question panels that should keep ownership of Escape. */
		const APPROVAL_SELECTOR = "[data-approval-key], [data-approval-scroll]";
		function EscapeStopKeys(props) {
			const [anchor, setAnchor] = (0, react.useState)(null);
			const running = Boolean(props.session?.running);
			(0, react.useEffect)(() => {
				if (anchor === null) return;
				const doc = anchor.ownerDocument;
				const view = anchor.closest(VIEW_SELECTOR);
				if (view === null) return;
				const onKeyDown = (event) => {
					const target = event.target;
					if (!(target instanceof Node) || !view.contains(target)) return;
					const stopButton = view.querySelector(STOP_SELECTOR);
					if (!shouldStopEscape({
						key: event.key,
						composing: event.isComposing,
						alt: event.altKey,
						ctrl: event.ctrlKey,
						meta: event.metaKey,
						defaultPrevented: event.defaultPrevented,
						running,
						stopAvailable: stopButton !== null && !stopButton.disabled,
						approvalPending: view.querySelector(APPROVAL_SELECTOR) !== null
					})) return;
					event.preventDefault();
					event.stopPropagation();
					stopButton?.click();
				};
				doc.addEventListener("keydown", onKeyDown);
				return () => doc.removeEventListener("keydown", onKeyDown);
			}, [anchor, running]);
			return (0, react_jsx_runtime.jsx)("span", {
				ref: setAnchor,
				"aria-hidden": "true",
				style: { display: "none" }
			});
		}
		const name = "esc-stop-client";
		const inject = ["slots"];
		function apply(ctx) {
			ctx.slots.inject("conversation.input.left", () => ctx.slots.register({
				name: "conversation.input.left",
				id: "esc-stop",
				order: 100,
				label: "Esc to stop"
			}, EscapeStopKeys));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});

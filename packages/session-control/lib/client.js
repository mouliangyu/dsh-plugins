window.__ModuleLoader__.load({ id: "dsh-session-control", factory: (require) => { var module = { exports: {} }; var exports = module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.tsx
var client_exports = {};
__export(client_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(client_exports);
var import_react = __toESM(require("react"), 1);
var name = "session-control-client";
var inject = ["slots"];
var SETTINGS_ROUTE = "/api/session-control/settings";
var styles = {
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
  const [value, setValue] = (0, import_react.useState)();
  const [saving, setSaving] = (0, import_react.useState)(false);
  const [error, setError] = (0, import_react.useState)();
  (0, import_react.useEffect)(() => {
    const controller = new AbortController();
    fetch(SETTINGS_ROUTE, { signal: controller.signal, cache: "no-store" }).then(async (response) => {
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
  return /* @__PURE__ */ import_react.default.createElement("li", { style: styles.card }, /* @__PURE__ */ import_react.default.createElement("div", { style: styles.heading }, /* @__PURE__ */ import_react.default.createElement("span", { style: styles.title }, "Session & Workspace Control"), /* @__PURE__ */ import_react.default.createElement("span", { style: styles.description }, "\u4F1A\u8BDD\u4E0E\u9879\u76EE\u7684 Agent \u7BA1\u7406\u6743\u9650")), /* @__PURE__ */ import_react.default.createElement("div", { style: styles.row }, /* @__PURE__ */ import_react.default.createElement("label", { style: styles.label, htmlFor: "session-control-global-access" }, /* @__PURE__ */ import_react.default.createElement("span", { style: styles.labelTitle }, "\u5168\u5C40\u8BBF\u95EE"), /* @__PURE__ */ import_react.default.createElement("span", { style: styles.hint }, "\u5141\u8BB8\u7BA1\u7406\u6240\u6709\u9879\u76EE\u53CA\u672A\u5F52\u5C5E\u4F1A\u8BDD")), /* @__PURE__ */ import_react.default.createElement(
    "input",
    {
      id: "session-control-global-access",
      type: "checkbox",
      role: "switch",
      "aria-label": "\u5168\u5C40\u8BBF\u95EE",
      style: styles.switch,
      checked: value?.allowGlobalAccess ?? false,
      disabled: value === void 0 || saving,
      onChange: (event) => void update(event.currentTarget.checked)
    }
  )), value === void 0 && error === void 0 ? /* @__PURE__ */ import_react.default.createElement("p", { style: styles.status }, "\u6B63\u5728\u8BFB\u53D6\u8BBE\u7F6E\u2026") : null, saving ? /* @__PURE__ */ import_react.default.createElement("p", { style: styles.status }, "\u6B63\u5728\u4FDD\u5B58\u2026") : null, error !== void 0 ? /* @__PURE__ */ import_react.default.createElement("p", { style: { ...styles.status, color: "var(--ds-danger, #c33)" }, role: "alert" }, "\u4FDD\u5B58\u5931\u8D25\uFF1A", error) : null);
}
function apply(ctx) {
  ctx.slots.inject(
    "settings.plugin.item",
    () => ctx.slots.register(
      {
        name: "settings.plugin.item",
        id: "session-control",
        order: 30
      },
      SessionControlSettingsCard
    )
  );
}
return module.exports; } });

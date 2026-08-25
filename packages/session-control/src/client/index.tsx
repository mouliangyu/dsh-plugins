import React, { useEffect, useState } from "react";
import type { ClientContext } from "@deepseek-ai/dsh-client-runtime/client";
import type {} from "@deepseek-ai/dsh-client-ui-settings-plugins/client";
import type {} from "@deepseek-ai/dsh-client-ui-slots";

export const name = "session-control-client";
export const inject = ["slots"];

const SETTINGS_ROUTE = "/api/session-control/settings";

interface SettingsValue {
  readonly allowGlobalAccess: boolean;
}

const styles = {
  card: {
    listStyle: "none",
    border: "1px solid var(--ds-border, rgba(127, 127, 127, 0.28))",
    borderRadius: 8,
    padding: 16,
    display: "grid",
    gap: 14,
  },
  heading: {
    display: "grid",
    gap: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: 600,
  },
  description: {
    fontSize: 12,
    color: "var(--ds-text-secondary, #666)",
  },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  label: {
    display: "grid",
    gap: 3,
    minWidth: 0,
  },
  labelTitle: {
    fontSize: 13,
    fontWeight: 500,
  },
  hint: {
    fontSize: 12,
    color: "var(--ds-text-secondary, #666)",
  },
  switch: {
    width: 36,
    height: 20,
    flex: "0 0 auto",
    cursor: "pointer",
  },
  status: {
    margin: 0,
    fontSize: 12,
    color: "var(--ds-text-secondary, #666)",
  },
} as const;

function SessionControlSettingsCard() {
  const [value, setValue] = useState<SettingsValue>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const controller = new AbortController();
    fetch(SETTINGS_ROUTE, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return (await response.json()) as SettingsValue;
      })
      .then((next) => {
        setValue(next);
        setError(undefined);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => controller.abort();
  }, []);

  const update = async (allowGlobalAccess: boolean): Promise<void> => {
    const previous = value;
    setValue({ allowGlobalAccess });
    setSaving(true);
    setError(undefined);
    try {
      const response = await fetch(SETTINGS_ROUTE, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ allowGlobalAccess }),
      });
      const body = (await response.json()) as SettingsValue & { error?: string };
      if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
      setValue(body);
    } catch (reason) {
      setValue(previous);
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSaving(false);
    }
  };

  return (
    <li style={styles.card}>
      <div style={styles.heading}>
        <span style={styles.title}>Session &amp; Workspace Control</span>
        <span style={styles.description}>会话与项目的 Agent 管理权限</span>
      </div>
      <div style={styles.row}>
        <label style={styles.label} htmlFor="session-control-global-access">
          <span style={styles.labelTitle}>全局访问</span>
          <span style={styles.hint}>允许管理所有项目及未归属会话</span>
        </label>
        <input
          id="session-control-global-access"
          type="checkbox"
          role="switch"
          aria-label="全局访问"
          style={styles.switch}
          checked={value?.allowGlobalAccess ?? false}
          disabled={value === undefined || saving}
          onChange={(event) => void update(event.currentTarget.checked)}
        />
      </div>
      {value === undefined && error === undefined ? (
        <p style={styles.status}>正在读取设置…</p>
      ) : null}
      {saving ? <p style={styles.status}>正在保存…</p> : null}
      {error !== undefined ? (
        <p style={{ ...styles.status, color: "var(--ds-danger, #c33)" }} role="alert">
          保存失败：{error}
        </p>
      ) : null}
    </li>
  );
}

export function apply(ctx: ClientContext): void {
  ctx.slots.inject("settings.plugin.item", () =>
    ctx.slots.register(
      {
        name: "settings.plugin.item",
        key: "session-control",
        id: "session-control",
        order: 30,
      },
      SessionControlSettingsCard,
    ),
  );
}

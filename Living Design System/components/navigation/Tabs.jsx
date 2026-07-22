import React from "react";

/**
 * Living — Tabs
 * Quiet underline tabs. Controlled or uncontrolled.
 */
export function Tabs({
  items = [],
  value,
  defaultValue,
  onChange,
  size = "md",
  style,
  ...rest
}) {
  const isControlled = value !== undefined;
  const first = defaultValue ?? (items[0] && (items[0].value ?? items[0]));
  const [internal, setInternal] = React.useState(first);
  const active = isControlled ? value : internal;

  const select = (v) => { if (!isControlled) setInternal(v); onChange && onChange(v); };
  const fs = size === "sm" ? "var(--text-sm)" : "var(--text-base)";

  return (
    <div role="tablist" style={{
      display: "flex", gap: 4, borderBottom: "1px solid var(--border-subtle)", ...style,
    }} {...rest}>
      {items.map((it) => {
        const v = it.value ?? it;
        const label = it.label ?? it;
        const on = v === active;
        return (
          <button key={v} role="tab" aria-selected={on} onClick={() => select(v)}
            style={{
              position: "relative", appearance: "none", border: "none", background: "transparent",
              padding: size === "sm" ? "8px 12px" : "12px 14px", cursor: "pointer",
              fontFamily: "var(--font-sans)", fontSize: fs,
              fontWeight: on ? "var(--fw-semibold)" : "var(--fw-medium)",
              color: on ? "var(--text-strong)" : "var(--text-muted)",
              letterSpacing: "var(--tracking-tight)",
              transition: "var(--transition-color)",
              display: "inline-flex", alignItems: "center", gap: 7,
            }}>
            {it.icon ? <span style={{ fontSize: "1.05em" }}>{it.icon}</span> : null}
            {label}
            {it.count != null ? (
              <span style={{
                fontSize: "var(--text-xs)", fontWeight: "var(--fw-semibold)",
                padding: "1px 7px", borderRadius: "var(--radius-pill)",
                background: on ? "var(--surface-tint)" : "var(--surface-sunken)",
                color: on ? "var(--text-brand)" : "var(--text-muted)",
              }}>{it.count}</span>
            ) : null}
            <span style={{
              position: "absolute", left: 8, right: 8, bottom: -1, height: 2,
              borderRadius: "2px 2px 0 0",
              background: on ? "var(--brand-primary)" : "transparent",
              transition: "var(--transition-color)",
            }} />
          </button>
        );
      })}
    </div>
  );
}

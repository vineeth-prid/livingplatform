import React from "react";

/**
 * Living — Checkbox
 * Controlled or uncontrolled. Pine fill when checked, soft check.
 */
export function Checkbox({
  label,
  description,
  checked,
  defaultChecked,
  disabled = false,
  onChange,
  id,
  style,
  ...rest
}) {
  const reactId = React.useId();
  const boxId = id || reactId;
  const isControlled = checked !== undefined;
  const [internal, setInternal] = React.useState(!!defaultChecked);
  const on = isControlled ? checked : internal;

  const toggle = (e) => {
    if (disabled) return;
    if (!isControlled) setInternal(e.target.checked);
    onChange && onChange(e);
  };

  return (
    <label htmlFor={boxId} style={{
      display: "inline-flex", alignItems: description ? "flex-start" : "center", gap: 12,
      cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? "var(--opacity-disabled)" : 1, ...style,
    }}>
      <input id={boxId} type="checkbox" checked={on} disabled={disabled} onChange={toggle}
        style={{ position: "absolute", opacity: 0, width: 1, height: 1 }} {...rest} />
      <span aria-hidden style={{
        flexShrink: 0, width: 20, height: 20, marginTop: description ? 2 : 0,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        borderRadius: "var(--radius-xs)",
        background: on ? "var(--brand-primary)" : "var(--surface-raised)",
        border: `1.5px solid ${on ? "var(--brand-primary)" : "var(--border-strong)"}`,
        color: "var(--brand-on-primary)", fontSize: 13, lineHeight: 1,
        boxShadow: on ? "none" : "var(--shadow-xs)",
        transition: "var(--transition-color)",
      }}>{on ? "✓" : ""}</span>
      {(label || description) ? (
        <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {label ? <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-base)", color: "var(--text-strong)", lineHeight: 1.4 }}>{label}</span> : null}
          {description ? <span style={{ fontSize: "var(--text-sm)", color: "var(--text-subtle)" }}>{description}</span> : null}
        </span>
      ) : null}
    </label>
  );
}

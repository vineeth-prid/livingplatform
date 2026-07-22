import React from "react";

/**
 * Living — Input
 * Quiet field with warm border, soft focus ring. Optional label,
 * hint, error and leading/trailing adornments.
 */
export function Input({
  label,
  hint,
  error,
  size = "md",
  type = "text",
  leading = null,
  trailing = null,
  disabled = false,
  id,
  style,
  ...rest
}) {
  const reactId = React.useId();
  const inputId = id || reactId;
  const [focus, setFocus] = React.useState(false);
  const heights = { sm: 38, md: 46, lg: 54 };
  const h = heights[size] || heights.md;

  const borderColor = error
    ? "var(--danger-solid)"
    : focus
      ? "var(--brand-primary)"
      : "var(--border-default)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, ...style }}>
      {label ? (
        <label htmlFor={inputId} style={{
          fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", fontWeight: "var(--fw-medium)",
          color: "var(--text-body)", letterSpacing: "var(--tracking-tight)",
        }}>{label}</label>
      ) : null}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        height: h, padding: "0 14px",
        background: disabled ? "var(--surface-sunken)" : "var(--surface-raised)",
        border: `1px solid ${borderColor}`,
        borderRadius: "var(--radius-control)",
        boxShadow: focus ? "var(--ring-focus-shadow)" : "var(--shadow-xs)",
        transition: "var(--transition-color), var(--transition-shadow)",
        opacity: disabled ? "var(--opacity-disabled)" : 1,
      }}>
        {leading ? <span style={{ color: "var(--text-subtle)", display: "inline-flex", fontSize: 18 }}>{leading}</span> : null}
        <input
          id={inputId}
          type={type}
          disabled={disabled}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent",
            fontFamily: "var(--font-body)", fontSize: "var(--text-base)", color: "var(--text-strong)",
          }}
          {...rest}
        />
        {trailing ? <span style={{ color: "var(--text-subtle)", display: "inline-flex", fontSize: 18 }}>{trailing}</span> : null}
      </div>
      {error ? (
        <span style={{ fontSize: "var(--text-sm)", color: "var(--danger-fg)" }}>{error}</span>
      ) : hint ? (
        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-subtle)" }}>{hint}</span>
      ) : null}
    </div>
  );
}

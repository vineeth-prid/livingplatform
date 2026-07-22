import React from "react";

/**
 * Living — Select
 * Native select styled to match Input, with a soft chevron.
 */
export function Select({
  label,
  hint,
  error,
  size = "md",
  disabled = false,
  options = [],
  placeholder,
  id,
  style,
  ...rest
}) {
  const reactId = React.useId();
  const selectId = id || reactId;
  const [focus, setFocus] = React.useState(false);
  const heights = { sm: 38, md: 46, lg: 54 };
  const h = heights[size] || heights.md;
  const borderColor = error ? "var(--danger-solid)" : focus ? "var(--brand-primary)" : "var(--border-default)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, ...style }}>
      {label ? (
        <label htmlFor={selectId} style={{
          fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", fontWeight: "var(--fw-medium)",
          color: "var(--text-body)", letterSpacing: "var(--tracking-tight)",
        }}>{label}</label>
      ) : null}
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <select
          id={selectId}
          disabled={disabled}
          defaultValue={placeholder ? "" : undefined}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            appearance: "none", WebkitAppearance: "none",
            width: "100%", height: h, padding: "0 40px 0 14px",
            background: disabled ? "var(--surface-sunken)" : "var(--surface-raised)",
            border: `1px solid ${borderColor}`, borderRadius: "var(--radius-control)",
            boxShadow: focus ? "var(--ring-focus-shadow)" : "var(--shadow-xs)",
            fontFamily: "var(--font-body)", fontSize: "var(--text-base)",
            color: "var(--text-strong)", cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? "var(--opacity-disabled)" : 1,
            transition: "var(--transition-color), var(--transition-shadow)",
          }}
          {...rest}
        >
          {placeholder ? <option value="" disabled>{placeholder}</option> : null}
          {options.map((o) => {
            const value = typeof o === "string" ? o : o.value;
            const labelText = typeof o === "string" ? o : o.label;
            return <option key={value} value={value}>{labelText}</option>;
          })}
        </select>
        <span aria-hidden style={{
          position: "absolute", right: 14, pointerEvents: "none",
          color: "var(--text-subtle)", fontSize: 12,
        }}>▾</span>
      </div>
      {error ? (
        <span style={{ fontSize: "var(--text-sm)", color: "var(--danger-fg)" }}>{error}</span>
      ) : hint ? (
        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-subtle)" }}>{hint}</span>
      ) : null}
    </div>
  );
}

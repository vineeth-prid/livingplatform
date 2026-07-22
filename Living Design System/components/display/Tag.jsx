import React from "react";

/**
 * Living — Tag
 * Filter / attribute chip. Optional removable, optional selected.
 */
export function Tag({
  selected = false,
  removable = false,
  onRemove,
  icon = null,
  onClick,
  children,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  return (
    <span
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        padding: "6px 12px", fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)",
        fontWeight: "var(--fw-medium)", lineHeight: 1,
        borderRadius: "var(--radius-pill)", cursor: onClick ? "pointer" : "default",
        color: selected ? "var(--brand-on-primary)" : "var(--text-body)",
        background: selected ? "var(--brand-primary)" : (hover && onClick ? "var(--surface-sunken)" : "var(--surface-raised)"),
        border: `1px solid ${selected ? "var(--brand-primary)" : "var(--border-default)"}`,
        transition: "var(--transition-color)",
        ...style,
      }}
      {...rest}
    >
      {icon ? <span style={{ display: "inline-flex", fontSize: 15 }}>{icon}</span> : null}
      {children}
      {removable ? (
        <button type="button" aria-label="Remove" onClick={(e) => { e.stopPropagation(); onRemove && onRemove(e); }}
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 16, height: 16, marginRight: -3, padding: 0, border: "none",
            borderRadius: "50%", background: "transparent", cursor: "pointer",
            color: "inherit", opacity: 0.7, fontSize: 13, lineHeight: 1,
          }}>×</button>
      ) : null}
    </span>
  );
}

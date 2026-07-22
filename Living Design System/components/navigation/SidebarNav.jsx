import React from "react";

/**
 * Living — SidebarNav
 * Vertical navigation for admin / dashboard shells. Items with
 * icon, label, optional badge. Active item gets a tinted Pine pill.
 */
export function SidebarNav({
  items = [],
  value,
  onChange,
  style,
  ...rest
}) {
  return (
    <nav style={{ display: "flex", flexDirection: "column", gap: 2, ...style }} {...rest}>
      {items.map((it) => {
        if (it.section) {
          return (
            <div key={"s-" + it.section} style={{
              padding: "16px 12px 6px", fontFamily: "var(--font-sans)",
              fontSize: "var(--text-2xs)", fontWeight: "var(--fw-semibold)",
              letterSpacing: "var(--tracking-wider)", textTransform: "uppercase",
              color: "var(--text-subtle)",
            }}>{it.section}</div>
          );
        }
        const v = it.value ?? it.label;
        const on = v === value;
        return (
          <SidebarItem key={v} item={it} active={on} onClick={() => onChange && onChange(v)} />
        );
      })}
    </nav>
  );
}

function SidebarItem({ item, active, onClick }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button type="button" onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 12, width: "100%",
        padding: "10px 12px", border: "none", cursor: "pointer", textAlign: "left",
        borderRadius: "var(--radius-md)",
        background: active ? "var(--surface-tint)" : (hover ? "var(--surface-sunken)" : "transparent"),
        color: active ? "var(--text-brand)" : "var(--text-body)",
        fontFamily: "var(--font-sans)", fontSize: "var(--text-base)",
        fontWeight: active ? "var(--fw-semibold)" : "var(--fw-medium)",
        transition: "var(--transition-color)",
      }}>
      {item.icon ? <span style={{ display: "inline-flex", width: 20, justifyContent: "center", fontSize: 17, opacity: active ? 1 : 0.8 }}>{item.icon}</span> : null}
      <span style={{ flex: 1 }}>{item.label}</span>
      {item.badge != null ? (
        <span style={{
          fontSize: "var(--text-xs)", fontWeight: "var(--fw-semibold)",
          minWidth: 20, textAlign: "center", padding: "1px 7px", borderRadius: "var(--radius-pill)",
          background: active ? "var(--brand-primary)" : "var(--surface-sunken)",
          color: active ? "var(--brand-on-primary)" : "var(--text-muted)",
        }}>{item.badge}</span>
      ) : null}
    </button>
  );
}

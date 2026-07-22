import React from "react";

/**
 * Living — EmptyState
 * Calm placeholder for empty lists, no-results, first-run.
 */
export function EmptyState({
  icon = null,
  title,
  description,
  action = null,
  style,
  ...rest
}) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
      gap: 16, padding: "var(--space-9) var(--space-6)", maxWidth: 420, marginInline: "auto", ...style,
    }} {...rest}>
      {icon ? (
        <div style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 64, height: 64, borderRadius: "var(--radius-full)",
          background: "var(--surface-tint)", color: "var(--text-brand)", fontSize: 28,
        }}>{icon}</div>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {title ? <h3 style={{ fontFamily: "var(--font-display)", fontWeight: "var(--fw-medium)", fontSize: "1.5rem", color: "var(--text-strong)" }}>{title}</h3> : null}
        {description ? <p style={{ fontSize: "var(--text-base)", color: "var(--text-muted)", lineHeight: 1.6 }}>{description}</p> : null}
      </div>
      {action ? <div style={{ marginTop: 4 }}>{action}</div> : null}
    </div>
  );
}

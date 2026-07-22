import React from "react";

/**
 * Living — StatCard / KPI widget
 * Dashboard metric with label, value, delta and optional sparkline slot.
 */
export function StatCard({
  label,
  value,
  delta,
  trend = "up",
  icon = null,
  hint,
  children,
  style,
  ...rest
}) {
  const trendColor = trend === "up" ? "var(--success-fg)" : trend === "down" ? "var(--danger-fg)" : "var(--text-muted)";
  const arrow = trend === "up" ? "↑" : trend === "down" ? "↓" : "→";

  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 14,
      padding: "var(--space-5)", background: "var(--surface-card)",
      border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-card)",
      boxShadow: "var(--shadow-sm)", ...style,
    }} {...rest}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span style={{
          fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", fontWeight: "var(--fw-medium)",
          color: "var(--text-muted)", letterSpacing: "var(--tracking-wide)",
        }}>{label}</span>
        {icon ? (
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 34, height: 34, borderRadius: "var(--radius-sm)",
            background: "var(--surface-tint)", color: "var(--text-brand)", fontSize: 17,
          }}>{icon}</span>
        ) : null}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={{
          fontFamily: "var(--font-display)", fontWeight: "var(--fw-medium)",
          fontSize: "2.5rem", lineHeight: 1, color: "var(--text-strong)",
          letterSpacing: "var(--tracking-tight)",
        }}>{value}</span>
        {delta != null ? (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 3,
            fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)",
            fontWeight: "var(--fw-semibold)", color: trendColor,
          }}>{arrow} {delta}</span>
        ) : null}
      </div>
      {children}
      {hint ? <span style={{ fontSize: "var(--text-sm)", color: "var(--text-subtle)" }}>{hint}</span> : null}
    </div>
  );
}

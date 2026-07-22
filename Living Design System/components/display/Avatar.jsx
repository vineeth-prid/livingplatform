import React from "react";

/**
 * Living — Avatar
 * Person or community image with initials fallback. Optional status ring.
 */
export function Avatar({
  src,
  name = "",
  size = "md",
  shape = "circle",
  status,
  style,
  ...rest
}) {
  const sizes = { xs: 24, sm: 32, md: 40, lg: 52, xl: 72 };
  const d = sizes[size] || sizes.md;
  const initials = name.split(" ").map((n) => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  const radius = shape === "square" ? "var(--radius-md)" : "var(--radius-full)";

  const statusColors = { online: "var(--success-solid)", away: "var(--warning-solid)", busy: "var(--danger-solid)", offline: "var(--stone-400)" };

  return (
    <span style={{ position: "relative", display: "inline-flex", flexShrink: 0, ...style }} {...rest}>
      <span style={{
        width: d, height: d, borderRadius: radius, overflow: "hidden",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: "var(--surface-tint)", color: "var(--text-brand)",
        fontFamily: "var(--font-sans)", fontWeight: "var(--fw-semibold)",
        fontSize: d * 0.38, letterSpacing: "0.02em",
        border: "1px solid var(--border-subtle)",
      }}>
        {src ? <img src={src} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials}
      </span>
      {status ? (
        <span style={{
          position: "absolute", right: -1, bottom: -1,
          width: Math.max(8, d * 0.26), height: Math.max(8, d * 0.26),
          borderRadius: "50%", background: statusColors[status] || statusColors.offline,
          border: "2px solid var(--surface-card)",
        }} />
      ) : null}
    </span>
  );
}

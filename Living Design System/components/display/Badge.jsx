import React from "react";

/**
 * Living — Badge
 * Small status pill. Semantic tones + brand. Soft or solid.
 */
export function Badge({
  tone = "neutral",
  variant = "soft",
  size = "md",
  dot = false,
  children,
  style,
  ...rest
}) {
  const tones = {
    neutral: { fg: "var(--text-muted)", bg: "var(--surface-sunken)", solidBg: "var(--stone-600)" },
    brand: { fg: "var(--text-brand)", bg: "var(--surface-tint)", solidBg: "var(--brand-primary)" },
    accent: { fg: "var(--text-accent)", bg: "var(--clay-50)", solidBg: "var(--brand-accent)" },
    success: { fg: "var(--success-fg)", bg: "var(--success-bg)", solidBg: "var(--success-solid)" },
    warning: { fg: "var(--warning-fg)", bg: "var(--warning-bg)", solidBg: "var(--warning-solid)" },
    danger: { fg: "var(--danger-fg)", bg: "var(--danger-bg)", solidBg: "var(--danger-solid)" },
    info: { fg: "var(--info-fg)", bg: "var(--info-bg)", solidBg: "var(--info-solid)" },
  };
  const t = tones[tone] || tones.neutral;
  const solid = variant === "solid";
  const pad = size === "sm" ? "2px 8px" : "3px 11px";
  const fs = size === "sm" ? "var(--text-2xs)" : "var(--text-xs)";

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: pad, fontFamily: "var(--font-sans)", fontSize: fs,
      fontWeight: "var(--fw-semibold)", letterSpacing: "var(--tracking-wide)",
      lineHeight: 1.4, borderRadius: "var(--radius-pill)",
      color: solid ? "var(--brand-on-primary)" : t.fg,
      background: solid ? t.solidBg : t.bg,
      border: variant === "outline" ? `1px solid ${t.fg}` : "1px solid transparent",
      whiteSpace: "nowrap", ...style,
    }} {...rest}>
      {dot ? <span style={{ width: 6, height: 6, borderRadius: "50%", background: solid ? "currentColor" : t.solidBg }} /> : null}
      {children}
    </span>
  );
}

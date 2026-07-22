import React from "react";
import { IconButton } from "../forms/IconButton.jsx";

/**
 * Living — Dialog
 * Centred modal over a soft scrim. Calm fade + rise entrance.
 */
export function Dialog({
  open = false,
  onClose,
  title,
  description,
  size = "md",
  footer = null,
  children,
  style,
  ...rest
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose && onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: 400, md: 520, lg: 680 };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose && onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "var(--space-5)", background: "var(--surface-scrim)",
        backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)",
        animation: "living-fade var(--duration-base) var(--ease-out)",
      }}
    >
      <div style={{
        width: "100%", maxWidth: widths[size] || widths.md,
        background: "var(--surface-raised)", borderRadius: "var(--radius-xl)",
        border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-floating)",
        animation: "living-rise var(--duration-slow) var(--ease-out)",
        overflow: "hidden", ...style,
      }} {...rest}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, padding: "var(--space-6) var(--space-6) 0" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {title ? <h2 style={{ fontFamily: "var(--font-display)", fontWeight: "var(--fw-medium)", fontSize: "1.75rem", lineHeight: 1.1, color: "var(--text-strong)" }}>{title}</h2> : null}
            {description ? <p style={{ fontSize: "var(--text-base)", color: "var(--text-muted)" }}>{description}</p> : null}
          </div>
          <IconButton aria-label="Close" variant="ghost" onClick={onClose} style={{ marginRight: -6, marginTop: -4 }}>×</IconButton>
        </div>
        {children ? <div style={{ padding: "var(--space-5) var(--space-6)" }}>{children}</div> : <div style={{ height: "var(--space-5)" }} />}
        {footer ? (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, padding: "var(--space-4) var(--space-6) var(--space-6)", borderTop: "1px solid var(--border-subtle)" }}>{footer}</div>
        ) : null}
      </div>
      <style>{`
        @keyframes living-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes living-rise { from { opacity: 0; transform: translateY(12px) scale(0.98); } to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  );
}

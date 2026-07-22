import React from "react";

/**
 * Living — Tooltip
 * Quiet ink label on hover/focus. Four placements.
 */
export function Tooltip({ label, placement = "top", children, style }) {
  const [show, setShow] = React.useState(false);

  const pos = {
    top: { bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)" },
    bottom: { top: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)" },
    left: { right: "calc(100% + 8px)", top: "50%", transform: "translateY(-50%)" },
    right: { left: "calc(100% + 8px)", top: "50%", transform: "translateY(-50%)" },
  }[placement];

  return (
    <span
      style={{ position: "relative", display: "inline-flex", ...style }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      {show ? (
        <span role="tooltip" style={{
          position: "absolute", zIndex: 900, ...pos,
          padding: "6px 10px", background: "var(--surface-inverse)",
          color: "var(--text-inverse)", fontFamily: "var(--font-sans)",
          fontSize: "var(--text-xs)", fontWeight: "var(--fw-medium)",
          letterSpacing: "var(--tracking-wide)", lineHeight: 1.3,
          borderRadius: "var(--radius-sm)", boxShadow: "var(--shadow-md)",
          whiteSpace: "nowrap", pointerEvents: "none",
          animation: "living-tip var(--duration-fast) var(--ease-out)",
        }}>{label}</span>
      ) : null}
      <style>{`@keyframes living-tip { from { opacity: 0; } to { opacity: 1; } }`}</style>
    </span>
  );
}

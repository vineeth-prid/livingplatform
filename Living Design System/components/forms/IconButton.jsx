import React from "react";

/**
 * Living — IconButton
 * Square, quiet control for toolbars, cards, nav. Icon-only.
 */
export function IconButton({
  variant = "ghost",
  size = "md",
  disabled = false,
  "aria-label": ariaLabel,
  onClick,
  children,
  style,
  ...rest
}) {
  const dims = { sm: 32, md: 40, lg: 48 };
  const d = dims[size] || dims.md;

  const variants = {
    ghost: { background: "transparent", color: "var(--text-muted)", border: "1px solid transparent" },
    soft: { background: "var(--surface-sunken)", color: "var(--text-body)", border: "1px solid transparent" },
    outline: { background: "var(--surface-raised)", color: "var(--text-body)", border: "1px solid var(--border-default)" },
    solid: { background: "var(--brand-primary)", color: "var(--brand-on-primary)", border: "1px solid transparent" },
  };
  const v = variants[variant] || variants.ghost;
  const [hover, setHover] = React.useState(false);

  const hoverBg = {
    ghost: "var(--surface-sunken)",
    soft: "var(--surface-tint)",
    outline: "var(--surface-sunken)",
    solid: "var(--brand-primary-hover)",
  }[variant];

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: d,
        height: d,
        borderRadius: "var(--radius-control)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? "var(--opacity-disabled)" : 1,
        fontSize: size === "sm" ? 16 : 18,
        transition: "var(--transition-color), var(--transition-transform)",
        ...v,
        ...(hover && !disabled ? { background: hoverBg, color: variant === "solid" ? v.color : "var(--text-strong)" } : null),
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

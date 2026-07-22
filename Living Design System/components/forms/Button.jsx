import React from "react";

/**
 * Living — Button
 * Primary action uses deep Pine; accent uses living Clay.
 * Calm hover (lift + darken), gentle press (scale). No bounce.
 */
export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  disabled = false,
  iconLeft = null,
  iconRight = null,
  type = "button",
  onClick,
  children,
  style,
  ...rest
}) {
  const sizes = {
    sm: { height: 36, padding: "0 16px", font: "var(--text-sm)", gap: 8, radius: "var(--radius-sm)" },
    md: { height: 44, padding: "0 22px", font: "var(--text-base)", gap: 9, radius: "var(--radius-control)" },
    lg: { height: 54, padding: "0 30px", font: "var(--text-lg)", gap: 10, radius: "var(--radius-control)" },
  };
  const s = sizes[size] || sizes.md;

  const variants = {
    primary: {
      background: "var(--brand-primary)",
      color: "var(--brand-on-primary)",
      border: "1px solid transparent",
      boxShadow: "var(--shadow-sm)",
    },
    accent: {
      background: "var(--brand-accent)",
      color: "var(--brand-on-accent)",
      border: "1px solid transparent",
      boxShadow: "var(--shadow-sm)",
    },
    secondary: {
      background: "var(--surface-raised)",
      color: "var(--text-strong)",
      border: "1px solid var(--border-default)",
      boxShadow: "var(--shadow-xs)",
    },
    ghost: {
      background: "transparent",
      color: "var(--text-brand)",
      border: "1px solid transparent",
      boxShadow: "none",
    },
    outline: {
      background: "transparent",
      color: "var(--text-brand)",
      border: "1px solid var(--brand-primary)",
      boxShadow: "none",
    },
  };
  const v = variants[variant] || variants.primary;

  const [hover, setHover] = React.useState(false);
  const [active, setActive] = React.useState(false);

  const hoverBg = {
    primary: "var(--brand-primary-hover)",
    accent: "var(--brand-accent-hover)",
    secondary: "var(--surface-sunken)",
    ghost: "var(--surface-tint)",
    outline: "var(--surface-tint)",
  }[variant];

  return (
    <button
      type={type}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setActive(false); }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: s.gap,
        width: fullWidth ? "100%" : "auto",
        height: s.height,
        padding: s.padding,
        fontFamily: "var(--font-sans)",
        fontSize: s.font,
        fontWeight: "var(--fw-semibold)",
        letterSpacing: "var(--tracking-tight)",
        lineHeight: 1,
        borderRadius: s.radius,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? "var(--opacity-disabled)" : 1,
        transform: !disabled && active ? "scale(var(--press-scale))" : (!disabled && hover ? "translateY(var(--lift-hover))" : "none"),
        transition: "var(--transition-color), var(--transition-transform), var(--transition-shadow)",
        whiteSpace: "nowrap",
        ...v,
        ...(hover && !disabled ? { background: hoverBg, boxShadow: variant === "primary" || variant === "accent" ? "var(--shadow-md)" : v.boxShadow } : null),
        ...style,
      }}
      {...rest}
    >
      {iconLeft ? <span style={{ display: "inline-flex", fontSize: "1.1em" }}>{iconLeft}</span> : null}
      {children}
      {iconRight ? <span style={{ display: "inline-flex", fontSize: "1.1em" }}>{iconRight}</span> : null}
    </button>
  );
}

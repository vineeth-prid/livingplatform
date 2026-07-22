import React from "react";

/**
 * Living — Card
 * Calm content surface. Elevated | outline | glass. Optional hover lift.
 */
export function Card({
  variant = "elevated",
  padding = "lg",
  interactive = false,
  as = "div",
  onClick,
  children,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const pads = { none: 0, sm: "var(--space-4)", md: "var(--space-5)", lg: "var(--pad-card)" };

  const variants = {
    elevated: { background: "var(--surface-card)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-md)" },
    outline: { background: "var(--surface-card)", border: "1px solid var(--border-default)", boxShadow: "none" },
    quiet: { background: "var(--surface-sunken)", border: "1px solid transparent", boxShadow: "none" },
    glass: {
      background: "var(--surface-glass)",
      border: "1px solid var(--border-inverse)",
      boxShadow: "var(--shadow-md)",
      backdropFilter: "blur(18px) saturate(1.4)",
      WebkitBackdropFilter: "blur(18px) saturate(1.4)",
    },
  };
  const v = variants[variant] || variants.elevated;
  const Tag = as;

  return (
    <Tag
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        borderRadius: "var(--radius-card)",
        padding: pads[padding],
        color: "var(--text-body)",
        transition: "var(--transition-transform), var(--transition-shadow), var(--transition-color)",
        cursor: interactive || onClick ? "pointer" : "default",
        ...v,
        ...((interactive || onClick) && hover
          ? { transform: "translateY(-3px)", boxShadow: "var(--shadow-lg)", borderColor: "var(--border-default)" }
          : null),
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

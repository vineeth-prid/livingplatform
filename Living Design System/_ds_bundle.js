/* @ds-bundle: {"format":4,"namespace":"LivingDesignSystem_bba765","components":[{"name":"Avatar","sourcePath":"components/display/Avatar.jsx"},{"name":"Badge","sourcePath":"components/display/Badge.jsx"},{"name":"Card","sourcePath":"components/display/Card.jsx"},{"name":"StatCard","sourcePath":"components/display/StatCard.jsx"},{"name":"Tag","sourcePath":"components/display/Tag.jsx"},{"name":"Dialog","sourcePath":"components/feedback/Dialog.jsx"},{"name":"EmptyState","sourcePath":"components/feedback/EmptyState.jsx"},{"name":"Tooltip","sourcePath":"components/feedback/Tooltip.jsx"},{"name":"Button","sourcePath":"components/forms/Button.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"IconButton","sourcePath":"components/forms/IconButton.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"SidebarNav","sourcePath":"components/navigation/SidebarNav.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"},{"name":"PropertyCard","sourcePath":"components/property/PropertyCard.jsx"}],"sourceHashes":{"components/display/Avatar.jsx":"11dff00cd265","components/display/Badge.jsx":"9d067f1e6be1","components/display/Card.jsx":"3ab75f325a72","components/display/StatCard.jsx":"2fc76791fbe4","components/display/Tag.jsx":"a2b935de4a53","components/feedback/Dialog.jsx":"320e6026063f","components/feedback/EmptyState.jsx":"1a775912cac3","components/feedback/Tooltip.jsx":"3a43a625757b","components/forms/Button.jsx":"c85c5ec09b47","components/forms/Checkbox.jsx":"29cb4094af26","components/forms/IconButton.jsx":"207799f7735c","components/forms/Input.jsx":"18b58143440b","components/forms/Select.jsx":"bee4160b4f7f","components/forms/Switch.jsx":"fd14218ba47c","components/navigation/SidebarNav.jsx":"8854794b3f4e","components/navigation/Tabs.jsx":"8212b8c57c29","components/property/PropertyCard.jsx":"049a4f645e22","ui_kits/admin/dashboard.jsx":"9ac2038983fa","ui_kits/admin/residents.jsx":"0517e6afd930","ui_kits/admin/tweaks-panel.jsx":"6591467622ed","ui_kits/resident/app.jsx":"6f1aa5a40af7","ui_kits/resident/tweaks-panel.jsx":"6591467622ed","ui_kits/website/chrome.jsx":"b0e93951da23","ui_kits/website/detail.jsx":"c0fefa54377d","ui_kits/website/home.jsx":"505a6deedbe1"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.LivingDesignSystem_bba765 = window.LivingDesignSystem_bba765 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/display/Avatar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Living — Avatar
 * Person or community image with initials fallback. Optional status ring.
 */
function Avatar({
  src,
  name = "",
  size = "md",
  shape = "circle",
  status,
  style,
  ...rest
}) {
  const sizes = {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 52,
    xl: 72
  };
  const d = sizes[size] || sizes.md;
  const initials = name.split(" ").map(n => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  const radius = shape === "square" ? "var(--radius-md)" : "var(--radius-full)";
  const statusColors = {
    online: "var(--success-solid)",
    away: "var(--warning-solid)",
    busy: "var(--danger-solid)",
    offline: "var(--stone-400)"
  };
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      position: "relative",
      display: "inline-flex",
      flexShrink: 0,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      width: d,
      height: d,
      borderRadius: radius,
      overflow: "hidden",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--surface-tint)",
      color: "var(--text-brand)",
      fontFamily: "var(--font-sans)",
      fontWeight: "var(--fw-semibold)",
      fontSize: d * 0.38,
      letterSpacing: "0.02em",
      border: "1px solid var(--border-subtle)"
    }
  }, src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: name,
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover"
    }
  }) : initials), status ? /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      right: -1,
      bottom: -1,
      width: Math.max(8, d * 0.26),
      height: Math.max(8, d * 0.26),
      borderRadius: "50%",
      background: statusColors[status] || statusColors.offline,
      border: "2px solid var(--surface-card)"
    }
  }) : null);
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/display/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Living — Badge
 * Small status pill. Semantic tones + brand. Soft or solid.
 */
function Badge({
  tone = "neutral",
  variant = "soft",
  size = "md",
  dot = false,
  children,
  style,
  ...rest
}) {
  const tones = {
    neutral: {
      fg: "var(--text-muted)",
      bg: "var(--surface-sunken)",
      solidBg: "var(--stone-600)"
    },
    brand: {
      fg: "var(--text-brand)",
      bg: "var(--surface-tint)",
      solidBg: "var(--brand-primary)"
    },
    accent: {
      fg: "var(--text-accent)",
      bg: "var(--clay-50)",
      solidBg: "var(--brand-accent)"
    },
    success: {
      fg: "var(--success-fg)",
      bg: "var(--success-bg)",
      solidBg: "var(--success-solid)"
    },
    warning: {
      fg: "var(--warning-fg)",
      bg: "var(--warning-bg)",
      solidBg: "var(--warning-solid)"
    },
    danger: {
      fg: "var(--danger-fg)",
      bg: "var(--danger-bg)",
      solidBg: "var(--danger-solid)"
    },
    info: {
      fg: "var(--info-fg)",
      bg: "var(--info-bg)",
      solidBg: "var(--info-solid)"
    }
  };
  const t = tones[tone] || tones.neutral;
  const solid = variant === "solid";
  const pad = size === "sm" ? "2px 8px" : "3px 11px";
  const fs = size === "sm" ? "var(--text-2xs)" : "var(--text-xs)";
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: pad,
      fontFamily: "var(--font-sans)",
      fontSize: fs,
      fontWeight: "var(--fw-semibold)",
      letterSpacing: "var(--tracking-wide)",
      lineHeight: 1.4,
      borderRadius: "var(--radius-pill)",
      color: solid ? "var(--brand-on-primary)" : t.fg,
      background: solid ? t.solidBg : t.bg,
      border: variant === "outline" ? `1px solid ${t.fg}` : "1px solid transparent",
      whiteSpace: "nowrap",
      ...style
    }
  }, rest), dot ? /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: "50%",
      background: solid ? "currentColor" : t.solidBg
    }
  }) : null, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Badge.jsx", error: String((e && e.message) || e) }); }

// components/display/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Living — Card
 * Calm content surface. Elevated | outline | glass. Optional hover lift.
 */
function Card({
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
  const pads = {
    none: 0,
    sm: "var(--space-4)",
    md: "var(--space-5)",
    lg: "var(--pad-card)"
  };
  const variants = {
    elevated: {
      background: "var(--surface-card)",
      border: "1px solid var(--border-subtle)",
      boxShadow: "var(--shadow-md)"
    },
    outline: {
      background: "var(--surface-card)",
      border: "1px solid var(--border-default)",
      boxShadow: "none"
    },
    quiet: {
      background: "var(--surface-sunken)",
      border: "1px solid transparent",
      boxShadow: "none"
    },
    glass: {
      background: "var(--surface-glass)",
      border: "1px solid var(--border-inverse)",
      boxShadow: "var(--shadow-md)",
      backdropFilter: "blur(18px) saturate(1.4)",
      WebkitBackdropFilter: "blur(18px) saturate(1.4)"
    }
  };
  const v = variants[variant] || variants.elevated;
  const Tag = as;
  return /*#__PURE__*/React.createElement(Tag, _extends({
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      borderRadius: "var(--radius-card)",
      padding: pads[padding],
      color: "var(--text-body)",
      transition: "var(--transition-transform), var(--transition-shadow), var(--transition-color)",
      cursor: interactive || onClick ? "pointer" : "default",
      ...v,
      ...((interactive || onClick) && hover ? {
        transform: "translateY(-3px)",
        boxShadow: "var(--shadow-lg)",
        borderColor: "var(--border-default)"
      } : null),
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Card.jsx", error: String((e && e.message) || e) }); }

// components/display/StatCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Living — StatCard / KPI widget
 * Dashboard metric with label, value, delta and optional sparkline slot.
 */
function StatCard({
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
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 14,
      padding: "var(--space-5)",
      background: "var(--surface-card)",
      border: "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-card)",
      boxShadow: "var(--shadow-sm)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-sm)",
      fontWeight: "var(--fw-medium)",
      color: "var(--text-muted)",
      letterSpacing: "var(--tracking-wide)"
    }
  }, label), icon ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: 34,
      height: 34,
      borderRadius: "var(--radius-sm)",
      background: "var(--surface-tint)",
      color: "var(--text-brand)",
      fontSize: 17
    }
  }, icon) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: 10,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: "var(--fw-medium)",
      fontSize: "2.5rem",
      lineHeight: 1,
      color: "var(--text-strong)",
      letterSpacing: "var(--tracking-tight)"
    }
  }, value), delta != null ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 3,
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-sm)",
      fontWeight: "var(--fw-semibold)",
      color: trendColor
    }
  }, arrow, " ", delta) : null), children, hint ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-sm)",
      color: "var(--text-subtle)"
    }
  }, hint) : null);
}
Object.assign(__ds_scope, { StatCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/StatCard.jsx", error: String((e && e.message) || e) }); }

// components/display/Tag.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Living — Tag
 * Filter / attribute chip. Optional removable, optional selected.
 */
function Tag({
  selected = false,
  removable = false,
  onRemove,
  icon = null,
  onClick,
  children,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("span", _extends({
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 7,
      padding: "6px 12px",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-sm)",
      fontWeight: "var(--fw-medium)",
      lineHeight: 1,
      borderRadius: "var(--radius-pill)",
      cursor: onClick ? "pointer" : "default",
      color: selected ? "var(--brand-on-primary)" : "var(--text-body)",
      background: selected ? "var(--brand-primary)" : hover && onClick ? "var(--surface-sunken)" : "var(--surface-raised)",
      border: `1px solid ${selected ? "var(--brand-primary)" : "var(--border-default)"}`,
      transition: "var(--transition-color)",
      ...style
    }
  }, rest), icon ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      fontSize: 15
    }
  }, icon) : null, children, removable ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Remove",
    onClick: e => {
      e.stopPropagation();
      onRemove && onRemove(e);
    },
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: 16,
      height: 16,
      marginRight: -3,
      padding: 0,
      border: "none",
      borderRadius: "50%",
      background: "transparent",
      cursor: "pointer",
      color: "inherit",
      opacity: 0.7,
      fontSize: 13,
      lineHeight: 1
    }
  }, "\xD7") : null);
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Tag.jsx", error: String((e && e.message) || e) }); }

// components/feedback/EmptyState.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Living — EmptyState
 * Calm placeholder for empty lists, no-results, first-run.
 */
function EmptyState({
  icon = null,
  title,
  description,
  action = null,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      textAlign: "center",
      gap: 16,
      padding: "var(--space-9) var(--space-6)",
      maxWidth: 420,
      marginInline: "auto",
      ...style
    }
  }, rest), icon ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: 64,
      height: 64,
      borderRadius: "var(--radius-full)",
      background: "var(--surface-tint)",
      color: "var(--text-brand)",
      fontSize: 28
    }
  }, icon) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, title ? /*#__PURE__*/React.createElement("h3", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: "var(--fw-medium)",
      fontSize: "1.5rem",
      color: "var(--text-strong)"
    }
  }, title) : null, description ? /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: "var(--text-base)",
      color: "var(--text-muted)",
      lineHeight: 1.6
    }
  }, description) : null), action ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 4
    }
  }, action) : null);
}
Object.assign(__ds_scope, { EmptyState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/EmptyState.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Tooltip.jsx
try { (() => {
/**
 * Living — Tooltip
 * Quiet ink label on hover/focus. Four placements.
 */
function Tooltip({
  label,
  placement = "top",
  children,
  style
}) {
  const [show, setShow] = React.useState(false);
  const pos = {
    top: {
      bottom: "calc(100% + 8px)",
      left: "50%",
      transform: "translateX(-50%)"
    },
    bottom: {
      top: "calc(100% + 8px)",
      left: "50%",
      transform: "translateX(-50%)"
    },
    left: {
      right: "calc(100% + 8px)",
      top: "50%",
      transform: "translateY(-50%)"
    },
    right: {
      left: "calc(100% + 8px)",
      top: "50%",
      transform: "translateY(-50%)"
    }
  }[placement];
  return /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      display: "inline-flex",
      ...style
    },
    onMouseEnter: () => setShow(true),
    onMouseLeave: () => setShow(false),
    onFocus: () => setShow(true),
    onBlur: () => setShow(false)
  }, children, show ? /*#__PURE__*/React.createElement("span", {
    role: "tooltip",
    style: {
      position: "absolute",
      zIndex: 900,
      ...pos,
      padding: "6px 10px",
      background: "var(--surface-inverse)",
      color: "var(--text-inverse)",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-xs)",
      fontWeight: "var(--fw-medium)",
      letterSpacing: "var(--tracking-wide)",
      lineHeight: 1.3,
      borderRadius: "var(--radius-sm)",
      boxShadow: "var(--shadow-md)",
      whiteSpace: "nowrap",
      pointerEvents: "none",
      animation: "living-tip var(--duration-fast) var(--ease-out)"
    }
  }, label) : null, /*#__PURE__*/React.createElement("style", null, `@keyframes living-tip { from { opacity: 0; } to { opacity: 1; } }`));
}
Object.assign(__ds_scope, { Tooltip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Tooltip.jsx", error: String((e && e.message) || e) }); }

// components/forms/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Living — Button
 * Primary action uses deep Pine; accent uses living Clay.
 * Calm hover (lift + darken), gentle press (scale). No bounce.
 */
function Button({
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
    sm: {
      height: 36,
      padding: "0 16px",
      font: "var(--text-sm)",
      gap: 8,
      radius: "var(--radius-sm)"
    },
    md: {
      height: 44,
      padding: "0 22px",
      font: "var(--text-base)",
      gap: 9,
      radius: "var(--radius-control)"
    },
    lg: {
      height: 54,
      padding: "0 30px",
      font: "var(--text-lg)",
      gap: 10,
      radius: "var(--radius-control)"
    }
  };
  const s = sizes[size] || sizes.md;
  const variants = {
    primary: {
      background: "var(--brand-primary)",
      color: "var(--brand-on-primary)",
      border: "1px solid transparent",
      boxShadow: "var(--shadow-sm)"
    },
    accent: {
      background: "var(--brand-accent)",
      color: "var(--brand-on-accent)",
      border: "1px solid transparent",
      boxShadow: "var(--shadow-sm)"
    },
    secondary: {
      background: "var(--surface-raised)",
      color: "var(--text-strong)",
      border: "1px solid var(--border-default)",
      boxShadow: "var(--shadow-xs)"
    },
    ghost: {
      background: "transparent",
      color: "var(--text-brand)",
      border: "1px solid transparent",
      boxShadow: "none"
    },
    outline: {
      background: "transparent",
      color: "var(--text-brand)",
      border: "1px solid var(--brand-primary)",
      boxShadow: "none"
    }
  };
  const v = variants[variant] || variants.primary;
  const [hover, setHover] = React.useState(false);
  const [active, setActive] = React.useState(false);
  const hoverBg = {
    primary: "var(--brand-primary-hover)",
    accent: "var(--brand-accent-hover)",
    secondary: "var(--surface-sunken)",
    ghost: "var(--surface-tint)",
    outline: "var(--surface-tint)"
  }[variant];
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    onClick: disabled ? undefined : onClick,
    disabled: disabled,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setActive(false);
    },
    onMouseDown: () => setActive(true),
    onMouseUp: () => setActive(false),
    style: {
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
      transform: !disabled && active ? "scale(var(--press-scale))" : !disabled && hover ? "translateY(var(--lift-hover))" : "none",
      transition: "var(--transition-color), var(--transition-transform), var(--transition-shadow)",
      whiteSpace: "nowrap",
      ...v,
      ...(hover && !disabled ? {
        background: hoverBg,
        boxShadow: variant === "primary" || variant === "accent" ? "var(--shadow-md)" : v.boxShadow
      } : null),
      ...style
    }
  }, rest), iconLeft ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      fontSize: "1.1em"
    }
  }, iconLeft) : null, children, iconRight ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      fontSize: "1.1em"
    }
  }, iconRight) : null);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Button.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Living — Checkbox
 * Controlled or uncontrolled. Pine fill when checked, soft check.
 */
function Checkbox({
  label,
  description,
  checked,
  defaultChecked,
  disabled = false,
  onChange,
  id,
  style,
  ...rest
}) {
  const reactId = React.useId();
  const boxId = id || reactId;
  const isControlled = checked !== undefined;
  const [internal, setInternal] = React.useState(!!defaultChecked);
  const on = isControlled ? checked : internal;
  const toggle = e => {
    if (disabled) return;
    if (!isControlled) setInternal(e.target.checked);
    onChange && onChange(e);
  };
  return /*#__PURE__*/React.createElement("label", {
    htmlFor: boxId,
    style: {
      display: "inline-flex",
      alignItems: description ? "flex-start" : "center",
      gap: 12,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? "var(--opacity-disabled)" : 1,
      ...style
    }
  }, /*#__PURE__*/React.createElement("input", _extends({
    id: boxId,
    type: "checkbox",
    checked: on,
    disabled: disabled,
    onChange: toggle,
    style: {
      position: "absolute",
      opacity: 0,
      width: 1,
      height: 1
    }
  }, rest)), /*#__PURE__*/React.createElement("span", {
    "aria-hidden": true,
    style: {
      flexShrink: 0,
      width: 20,
      height: 20,
      marginTop: description ? 2 : 0,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "var(--radius-xs)",
      background: on ? "var(--brand-primary)" : "var(--surface-raised)",
      border: `1.5px solid ${on ? "var(--brand-primary)" : "var(--border-strong)"}`,
      color: "var(--brand-on-primary)",
      fontSize: 13,
      lineHeight: 1,
      boxShadow: on ? "none" : "var(--shadow-xs)",
      transition: "var(--transition-color)"
    }
  }, on ? "✓" : ""), label || description ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 2
    }
  }, label ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-base)",
      color: "var(--text-strong)",
      lineHeight: 1.4
    }
  }, label) : null, description ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-sm)",
      color: "var(--text-subtle)"
    }
  }, description) : null) : null);
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Living — IconButton
 * Square, quiet control for toolbars, cards, nav. Icon-only.
 */
function IconButton({
  variant = "ghost",
  size = "md",
  disabled = false,
  "aria-label": ariaLabel,
  onClick,
  children,
  style,
  ...rest
}) {
  const dims = {
    sm: 32,
    md: 40,
    lg: 48
  };
  const d = dims[size] || dims.md;
  const variants = {
    ghost: {
      background: "transparent",
      color: "var(--text-muted)",
      border: "1px solid transparent"
    },
    soft: {
      background: "var(--surface-sunken)",
      color: "var(--text-body)",
      border: "1px solid transparent"
    },
    outline: {
      background: "var(--surface-raised)",
      color: "var(--text-body)",
      border: "1px solid var(--border-default)"
    },
    solid: {
      background: "var(--brand-primary)",
      color: "var(--brand-on-primary)",
      border: "1px solid transparent"
    }
  };
  const v = variants[variant] || variants.ghost;
  const [hover, setHover] = React.useState(false);
  const hoverBg = {
    ghost: "var(--surface-sunken)",
    soft: "var(--surface-tint)",
    outline: "var(--surface-sunken)",
    solid: "var(--brand-primary-hover)"
  }[variant];
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    "aria-label": ariaLabel,
    onClick: disabled ? undefined : onClick,
    disabled: disabled,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
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
      ...(hover && !disabled ? {
        background: hoverBg,
        color: variant === "solid" ? v.color : "var(--text-strong)"
      } : null),
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Dialog.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Living — Dialog
 * Centred modal over a soft scrim. Calm fade + rise entrance.
 */
function Dialog({
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
    const onKey = e => {
      if (e.key === "Escape") onClose && onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  const widths = {
    sm: 400,
    md: 520,
    lg: 680
  };
  return /*#__PURE__*/React.createElement("div", {
    role: "dialog",
    "aria-modal": "true",
    onMouseDown: e => {
      if (e.target === e.currentTarget) onClose && onClose();
    },
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 1000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "var(--space-5)",
      background: "var(--surface-scrim)",
      backdropFilter: "blur(3px)",
      WebkitBackdropFilter: "blur(3px)",
      animation: "living-fade var(--duration-base) var(--ease-out)"
    }
  }, /*#__PURE__*/React.createElement("div", _extends({
    style: {
      width: "100%",
      maxWidth: widths[size] || widths.md,
      background: "var(--surface-raised)",
      borderRadius: "var(--radius-xl)",
      border: "1px solid var(--border-subtle)",
      boxShadow: "var(--shadow-floating)",
      animation: "living-rise var(--duration-slow) var(--ease-out)",
      overflow: "hidden",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 16,
      padding: "var(--space-6) var(--space-6) 0"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, title ? /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: "var(--fw-medium)",
      fontSize: "1.75rem",
      lineHeight: 1.1,
      color: "var(--text-strong)"
    }
  }, title) : null, description ? /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: "var(--text-base)",
      color: "var(--text-muted)"
    }
  }, description) : null), /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    "aria-label": "Close",
    variant: "ghost",
    onClick: onClose,
    style: {
      marginRight: -6,
      marginTop: -4
    }
  }, "\xD7")), children ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "var(--space-5) var(--space-6)"
    }
  }, children) : /*#__PURE__*/React.createElement("div", {
    style: {
      height: "var(--space-5)"
    }
  }), footer ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "flex-end",
      gap: 12,
      padding: "var(--space-4) var(--space-6) var(--space-6)",
      borderTop: "1px solid var(--border-subtle)"
    }
  }, footer) : null), /*#__PURE__*/React.createElement("style", null, `
        @keyframes living-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes living-rise { from { opacity: 0; transform: translateY(12px) scale(0.98); } to { opacity: 1; transform: none; } }
      `));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Living — Input
 * Quiet field with warm border, soft focus ring. Optional label,
 * hint, error and leading/trailing adornments.
 */
function Input({
  label,
  hint,
  error,
  size = "md",
  type = "text",
  leading = null,
  trailing = null,
  disabled = false,
  id,
  style,
  ...rest
}) {
  const reactId = React.useId();
  const inputId = id || reactId;
  const [focus, setFocus] = React.useState(false);
  const heights = {
    sm: 38,
    md: 46,
    lg: 54
  };
  const h = heights[size] || heights.md;
  const borderColor = error ? "var(--danger-solid)" : focus ? "var(--brand-primary)" : "var(--border-default)";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      ...style
    }
  }, label ? /*#__PURE__*/React.createElement("label", {
    htmlFor: inputId,
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-sm)",
      fontWeight: "var(--fw-medium)",
      color: "var(--text-body)",
      letterSpacing: "var(--tracking-tight)"
    }
  }, label) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      height: h,
      padding: "0 14px",
      background: disabled ? "var(--surface-sunken)" : "var(--surface-raised)",
      border: `1px solid ${borderColor}`,
      borderRadius: "var(--radius-control)",
      boxShadow: focus ? "var(--ring-focus-shadow)" : "var(--shadow-xs)",
      transition: "var(--transition-color), var(--transition-shadow)",
      opacity: disabled ? "var(--opacity-disabled)" : 1
    }
  }, leading ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-subtle)",
      display: "inline-flex",
      fontSize: 18
    }
  }, leading) : null, /*#__PURE__*/React.createElement("input", _extends({
    id: inputId,
    type: type,
    disabled: disabled,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      flex: 1,
      minWidth: 0,
      border: "none",
      outline: "none",
      background: "transparent",
      fontFamily: "var(--font-body)",
      fontSize: "var(--text-base)",
      color: "var(--text-strong)"
    }
  }, rest)), trailing ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-subtle)",
      display: "inline-flex",
      fontSize: 18
    }
  }, trailing) : null), error ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-sm)",
      color: "var(--danger-fg)"
    }
  }, error) : hint ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-sm)",
      color: "var(--text-subtle)"
    }
  }, hint) : null);
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Living — Select
 * Native select styled to match Input, with a soft chevron.
 */
function Select({
  label,
  hint,
  error,
  size = "md",
  disabled = false,
  options = [],
  placeholder,
  id,
  style,
  ...rest
}) {
  const reactId = React.useId();
  const selectId = id || reactId;
  const [focus, setFocus] = React.useState(false);
  const heights = {
    sm: 38,
    md: 46,
    lg: 54
  };
  const h = heights[size] || heights.md;
  const borderColor = error ? "var(--danger-solid)" : focus ? "var(--brand-primary)" : "var(--border-default)";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      ...style
    }
  }, label ? /*#__PURE__*/React.createElement("label", {
    htmlFor: selectId,
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-sm)",
      fontWeight: "var(--fw-medium)",
      color: "var(--text-body)",
      letterSpacing: "var(--tracking-tight)"
    }
  }, label) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      display: "flex",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("select", _extends({
    id: selectId,
    disabled: disabled,
    defaultValue: placeholder ? "" : undefined,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      appearance: "none",
      WebkitAppearance: "none",
      width: "100%",
      height: h,
      padding: "0 40px 0 14px",
      background: disabled ? "var(--surface-sunken)" : "var(--surface-raised)",
      border: `1px solid ${borderColor}`,
      borderRadius: "var(--radius-control)",
      boxShadow: focus ? "var(--ring-focus-shadow)" : "var(--shadow-xs)",
      fontFamily: "var(--font-body)",
      fontSize: "var(--text-base)",
      color: "var(--text-strong)",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? "var(--opacity-disabled)" : 1,
      transition: "var(--transition-color), var(--transition-shadow)"
    }
  }, rest), placeholder ? /*#__PURE__*/React.createElement("option", {
    value: "",
    disabled: true
  }, placeholder) : null, options.map(o => {
    const value = typeof o === "string" ? o : o.value;
    const labelText = typeof o === "string" ? o : o.label;
    return /*#__PURE__*/React.createElement("option", {
      key: value,
      value: value
    }, labelText);
  })), /*#__PURE__*/React.createElement("span", {
    "aria-hidden": true,
    style: {
      position: "absolute",
      right: 14,
      pointerEvents: "none",
      color: "var(--text-subtle)",
      fontSize: 12
    }
  }, "\u25BE")), error ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-sm)",
      color: "var(--danger-fg)"
    }
  }, error) : hint ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-sm)",
      color: "var(--text-subtle)"
    }
  }, hint) : null);
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Living — Switch
 * Soft toggle for settings. Pine track when on. Gentle knob glide.
 */
function Switch({
  label,
  checked,
  defaultChecked,
  disabled = false,
  size = "md",
  onChange,
  id,
  style,
  ...rest
}) {
  const reactId = React.useId();
  const switchId = id || reactId;
  const isControlled = checked !== undefined;
  const [internal, setInternal] = React.useState(!!defaultChecked);
  const on = isControlled ? checked : internal;
  const dims = size === "sm" ? {
    w: 38,
    h: 22,
    k: 16
  } : {
    w: 46,
    h: 26,
    k: 20
  };
  const toggle = e => {
    if (disabled) return;
    if (!isControlled) setInternal(e.target.checked);
    onChange && onChange(e);
  };
  return /*#__PURE__*/React.createElement("label", {
    htmlFor: switchId,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 12,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? "var(--opacity-disabled)" : 1,
      ...style
    }
  }, /*#__PURE__*/React.createElement("input", _extends({
    id: switchId,
    type: "checkbox",
    checked: on,
    disabled: disabled,
    onChange: toggle,
    style: {
      position: "absolute",
      opacity: 0,
      width: 1,
      height: 1
    }
  }, rest)), /*#__PURE__*/React.createElement("span", {
    "aria-hidden": true,
    style: {
      position: "relative",
      flexShrink: 0,
      width: dims.w,
      height: dims.h,
      borderRadius: "var(--radius-pill)",
      background: on ? "var(--brand-primary)" : "var(--stone-300)",
      transition: "background-color var(--duration-base) var(--ease-standard)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: (dims.h - dims.k) / 2,
      left: on ? dims.w - dims.k - (dims.h - dims.k) / 2 : (dims.h - dims.k) / 2,
      width: dims.k,
      height: dims.k,
      borderRadius: "var(--radius-full)",
      background: "#fff",
      boxShadow: "var(--shadow-sm)",
      transition: "left var(--duration-base) var(--ease-settle)"
    }
  })), label ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-base)",
      color: "var(--text-strong)"
    }
  }, label) : null);
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/navigation/SidebarNav.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Living — SidebarNav
 * Vertical navigation for admin / dashboard shells. Items with
 * icon, label, optional badge. Active item gets a tinted Pine pill.
 */
function SidebarNav({
  items = [],
  value,
  onChange,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("nav", _extends({
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 2,
      ...style
    }
  }, rest), items.map(it => {
    if (it.section) {
      return /*#__PURE__*/React.createElement("div", {
        key: "s-" + it.section,
        style: {
          padding: "16px 12px 6px",
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-2xs)",
          fontWeight: "var(--fw-semibold)",
          letterSpacing: "var(--tracking-wider)",
          textTransform: "uppercase",
          color: "var(--text-subtle)"
        }
      }, it.section);
    }
    const v = it.value ?? it.label;
    const on = v === value;
    return /*#__PURE__*/React.createElement(SidebarItem, {
      key: v,
      item: it,
      active: on,
      onClick: () => onChange && onChange(v)
    });
  }));
}
function SidebarItem({
  item,
  active,
  onClick
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      width: "100%",
      padding: "10px 12px",
      border: "none",
      cursor: "pointer",
      textAlign: "left",
      borderRadius: "var(--radius-md)",
      background: active ? "var(--surface-tint)" : hover ? "var(--surface-sunken)" : "transparent",
      color: active ? "var(--text-brand)" : "var(--text-body)",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-base)",
      fontWeight: active ? "var(--fw-semibold)" : "var(--fw-medium)",
      transition: "var(--transition-color)"
    }
  }, item.icon ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      width: 20,
      justifyContent: "center",
      fontSize: 17,
      opacity: active ? 1 : 0.8
    }
  }, item.icon) : null, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }, item.label), item.badge != null ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-xs)",
      fontWeight: "var(--fw-semibold)",
      minWidth: 20,
      textAlign: "center",
      padding: "1px 7px",
      borderRadius: "var(--radius-pill)",
      background: active ? "var(--brand-primary)" : "var(--surface-sunken)",
      color: active ? "var(--brand-on-primary)" : "var(--text-muted)"
    }
  }, item.badge) : null);
}
Object.assign(__ds_scope, { SidebarNav });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/SidebarNav.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Living — Tabs
 * Quiet underline tabs. Controlled or uncontrolled.
 */
function Tabs({
  items = [],
  value,
  defaultValue,
  onChange,
  size = "md",
  style,
  ...rest
}) {
  const isControlled = value !== undefined;
  const first = defaultValue ?? (items[0] && (items[0].value ?? items[0]));
  const [internal, setInternal] = React.useState(first);
  const active = isControlled ? value : internal;
  const select = v => {
    if (!isControlled) setInternal(v);
    onChange && onChange(v);
  };
  const fs = size === "sm" ? "var(--text-sm)" : "var(--text-base)";
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "tablist",
    style: {
      display: "flex",
      gap: 4,
      borderBottom: "1px solid var(--border-subtle)",
      ...style
    }
  }, rest), items.map(it => {
    const v = it.value ?? it;
    const label = it.label ?? it;
    const on = v === active;
    return /*#__PURE__*/React.createElement("button", {
      key: v,
      role: "tab",
      "aria-selected": on,
      onClick: () => select(v),
      style: {
        position: "relative",
        appearance: "none",
        border: "none",
        background: "transparent",
        padding: size === "sm" ? "8px 12px" : "12px 14px",
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        fontSize: fs,
        fontWeight: on ? "var(--fw-semibold)" : "var(--fw-medium)",
        color: on ? "var(--text-strong)" : "var(--text-muted)",
        letterSpacing: "var(--tracking-tight)",
        transition: "var(--transition-color)",
        display: "inline-flex",
        alignItems: "center",
        gap: 7
      }
    }, it.icon ? /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: "1.05em"
      }
    }, it.icon) : null, label, it.count != null ? /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: "var(--text-xs)",
        fontWeight: "var(--fw-semibold)",
        padding: "1px 7px",
        borderRadius: "var(--radius-pill)",
        background: on ? "var(--surface-tint)" : "var(--surface-sunken)",
        color: on ? "var(--text-brand)" : "var(--text-muted)"
      }
    }, it.count) : null, /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        left: 8,
        right: 8,
        bottom: -1,
        height: 2,
        borderRadius: "2px 2px 0 0",
        background: on ? "var(--brand-primary)" : "transparent",
        transition: "var(--transition-color)"
      }
    }));
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/property/PropertyCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Living — PropertyCard
 * The signature listing card: large editorial photography, restrained
 * meta, a favourite affordance, and a calm hover lift.
 */
function PropertyCard({
  image,
  title,
  location,
  price,
  period,
  status,
  statusTone = "success",
  beds,
  baths,
  area,
  favourite = false,
  onFavourite,
  onClick,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const [fav, setFav] = React.useState(favourite);
  const specs = [beds != null ? {
    label: "Beds",
    value: beds
  } : null, baths != null ? {
    label: "Baths",
    value: baths
  } : null, area != null ? {
    label: "Area",
    value: area
  } : null].filter(Boolean);
  return /*#__PURE__*/React.createElement("article", _extends({
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: "flex",
      flexDirection: "column",
      background: "var(--surface-card)",
      borderRadius: "var(--radius-card)",
      border: "1px solid var(--border-subtle)",
      overflow: "hidden",
      boxShadow: hover ? "var(--shadow-lg)" : "var(--shadow-sm)",
      transform: hover ? "translateY(-4px)" : "none",
      transition: "var(--transition-transform), var(--transition-shadow)",
      cursor: onClick ? "pointer" : "default",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      aspectRatio: "4 / 3",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: image ? `url(${image}) center/cover no-repeat` : "linear-gradient(135deg, var(--pine-400), var(--pine-700))",
      transform: hover ? "scale(1.05)" : "scale(1)",
      transition: "transform var(--duration-slow) var(--ease-out)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: "0 0 auto 0",
      height: 88,
      background: "linear-gradient(to bottom, rgba(20,17,15,0.34), transparent)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 14,
      left: 14
    }
  }, status ? /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: statusTone,
    variant: "solid",
    dot: true
  }, status) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 12,
      right: 12
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    "aria-label": fav ? "Remove from favourites" : "Add to favourites",
    variant: "glass",
    onClick: e => {
      e.stopPropagation();
      setFav(!fav);
      onFavourite && onFavourite(!fav);
    },
    style: {
      background: "var(--surface-glass)",
      backdropFilter: "blur(10px)",
      WebkitBackdropFilter: "blur(10px)",
      color: fav ? "var(--brand-accent)" : "var(--stone-700)"
    }
  }, fav ? "♥" : "♡"))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "var(--space-5)",
      display: "flex",
      flexDirection: "column",
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: "var(--fw-medium)",
      fontSize: "1.5rem",
      lineHeight: 1.1,
      letterSpacing: "var(--tracking-tight)",
      color: "var(--text-strong)"
    }
  }, title), location ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      fontSize: "var(--text-sm)",
      color: "var(--text-muted)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": true,
    style: {
      fontSize: 13
    }
  }, "\u25CE"), location) : null), specs.length ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 18,
      paddingTop: 2,
      borderTop: "1px solid var(--border-subtle)",
      paddingBlock: "12px 0"
    }
  }, specs.map(s => /*#__PURE__*/React.createElement("div", {
    key: s.label,
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontWeight: "var(--fw-semibold)",
      fontSize: "var(--text-base)",
      color: "var(--text-strong)"
    }
  }, s.value), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-xs)",
      color: "var(--text-subtle)",
      letterSpacing: "var(--tracking-wide)"
    }
  }, s.label)))) : null, price != null ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: 6,
      marginTop: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontWeight: "var(--fw-bold)",
      fontSize: "1.25rem",
      color: "var(--text-strong)"
    }
  }, price), period ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-sm)",
      color: "var(--text-muted)"
    }
  }, period) : null) : null));
}
Object.assign(__ds_scope, { PropertyCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/property/PropertyCard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/admin/dashboard.jsx
try { (() => {
/* Living — Admin UI kit: dashboard shell + overview */
const {
  SidebarNav,
  Tabs,
  StatCard,
  Card,
  Badge,
  Button,
  IconButton,
  Avatar,
  Input,
  Tag
} = window.LivingDesignSystem_bba765;
function AdminShell({
  children,
  route,
  setRoute
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "256px 1fr",
      height: "100vh",
      background: "var(--surface-page)"
    }
  }, /*#__PURE__*/React.createElement("aside", {
    style: {
      borderRight: "1px solid var(--border-subtle)",
      background: "var(--surface-card)",
      display: "flex",
      flexDirection: "column",
      padding: "20px 16px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 8px 20px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 500,
      fontSize: "1.5rem",
      letterSpacing: "-0.02em",
      color: "var(--text-strong)"
    }
  }, "Living", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--brand-accent)"
    }
  }, ".")), /*#__PURE__*/React.createElement(Badge, {
    tone: "brand",
    size: "sm"
  }, "Admin")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12,
      padding: "0 4px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 12px",
      background: "var(--surface-sunken)",
      borderRadius: "var(--radius-md)",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 28,
      height: 28,
      borderRadius: 8,
      background: "var(--pine-600)",
      color: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 13,
      fontWeight: 600
    }
  }, "RG"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "0.88rem",
      fontWeight: 600,
      color: "var(--text-strong)",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, "Riverside Greens"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "0.72rem",
      color: "var(--text-subtle)"
    }
  }, "248 residences")), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-subtle)",
      fontSize: 11
    }
  }, "\u25BE"))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: "auto"
    }
  }, /*#__PURE__*/React.createElement(SidebarNav, {
    value: route,
    onChange: setRoute,
    items: [{
      section: "Manage"
    }, {
      value: "overview",
      label: "Overview",
      icon: /*#__PURE__*/React.createElement("span", null, "\u25C8")
    }, {
      value: "residents",
      label: "Residents",
      icon: /*#__PURE__*/React.createElement("span", null, "\u25CE"),
      badge: 248
    }, {
      value: "tickets",
      label: "Tickets",
      icon: /*#__PURE__*/React.createElement("span", null, "\u2726"),
      badge: 12
    }, {
      value: "amenities",
      label: "Amenities",
      icon: /*#__PURE__*/React.createElement("span", null, "\u2756")
    }, {
      section: "Operate"
    }, {
      value: "vendors",
      label: "Vendors",
      icon: /*#__PURE__*/React.createElement("span", null, "\u25C7")
    }, {
      value: "billing",
      label: "Billing",
      icon: /*#__PURE__*/React.createElement("span", null, "\u25A4")
    }, {
      value: "analytics",
      label: "Analytics",
      icon: /*#__PURE__*/React.createElement("span", null, "\u25D4")
    }]
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "12px 8px 4px",
      borderTop: "1px solid var(--border-subtle)",
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: "Dev Menon",
    status: "online",
    size: "sm"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "0.85rem",
      fontWeight: 600,
      color: "var(--text-strong)"
    }
  }, "Dev Menon"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "0.72rem",
      color: "var(--text-subtle)"
    }
  }, "Facility Manager")), /*#__PURE__*/React.createElement(IconButton, {
    "aria-label": "Settings",
    variant: "ghost",
    size: "sm"
  }, "\u2699"))), /*#__PURE__*/React.createElement("main", {
    style: {
      overflowY: "auto",
      display: "flex",
      flexDirection: "column"
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 20,
      padding: "18px 32px",
      borderBottom: "1px solid var(--border-subtle)",
      background: "var(--surface-glass)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      position: "sticky",
      top: 0,
      zIndex: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      flex: 1,
      maxWidth: 380
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      left: 14,
      top: "50%",
      transform: "translateY(-50%)",
      color: "var(--text-subtle)",
      fontSize: 15
    }
  }, "\u2315"), /*#__PURE__*/React.createElement("input", {
    placeholder: "Search residents, tickets, units\u2026",
    style: {
      width: "100%",
      height: 42,
      padding: "0 14px 0 38px",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-md)",
      background: "var(--surface-raised)",
      fontFamily: "var(--font-body)",
      fontSize: "0.95rem",
      color: "var(--text-strong)"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    "aria-label": "Notifications",
    variant: "soft"
  }, "\u25D4"), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "sm",
    iconLeft: /*#__PURE__*/React.createElement("span", null, "\uFF0B")
  }, "New notice"))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "32px",
      flex: 1
    }
  }, children)));
}
function Sparkline({
  color = "var(--brand-primary)"
}) {
  const pts = [12, 18, 14, 22, 19, 26, 24, 30, 28, 34];
  const max = Math.max(...pts),
    min = Math.min(...pts);
  const d = pts.map((p, i) => `${i / (pts.length - 1) * 100},${28 - (p - min) / (max - min) * 24}`).join(" ");
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 100 28",
    preserveAspectRatio: "none",
    style: {
      width: "100%",
      height: 32
    }
  }, /*#__PURE__*/React.createElement("polyline", {
    points: d,
    fill: "none",
    stroke: color,
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    vectorEffect: "non-scaling-stroke"
  }));
}
function Overview() {
  const tickets = [["Leaking tap · Unit A-1204", "Plumbing", "warning", "Anaya Rao"], ["Lift maintenance · Tower B", "Elevator", "info", "Vendor: OtisCare"], ["Noise complaint · C-0803", "Community", "neutral", "Dev Menon"], ["Gym AC not cooling", "HVAC", "danger", "Unassigned"]];
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow",
    style: {
      marginBottom: 8
    }
  }, "Riverside Greens \xB7 This month"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 400,
      fontSize: "2.5rem",
      letterSpacing: "-0.015em",
      color: "var(--text-strong)",
      margin: 0
    }
  }, "Good morning, Dev.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(4,1fr)",
      gap: 20,
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    label: "Occupancy",
    value: "94.2%",
    delta: "2.1%",
    trend: "up",
    icon: /*#__PURE__*/React.createElement("span", null, "\u25C8")
  }, /*#__PURE__*/React.createElement(Sparkline, null)), /*#__PURE__*/React.createElement(StatCard, {
    label: "Dues collected",
    value: "\u20B938.4L",
    delta: "6.4%",
    trend: "up",
    icon: /*#__PURE__*/React.createElement("span", null, "\u25A4")
  }, /*#__PURE__*/React.createElement(Sparkline, {
    color: "var(--green-500)"
  })), /*#__PURE__*/React.createElement(StatCard, {
    label: "Open tickets",
    value: "12",
    delta: "4",
    trend: "down",
    icon: /*#__PURE__*/React.createElement("span", null, "\u2726")
  }, /*#__PURE__*/React.createElement(Sparkline, {
    color: "var(--clay-500)"
  })), /*#__PURE__*/React.createElement(StatCard, {
    label: "Avg. resolution",
    value: "6.2h",
    delta: "0.8h",
    trend: "down",
    icon: /*#__PURE__*/React.createElement("span", null, "\u25D4")
  }, /*#__PURE__*/React.createElement(Sparkline, {
    color: "var(--blue-500)"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1.6fr 1fr",
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(Card, {
    variant: "outline",
    padding: "none"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "20px 24px 0"
    }
  }, /*#__PURE__*/React.createElement(Tabs, {
    defaultValue: "open",
    items: [{
      value: "open",
      label: "Open tickets",
      count: 12
    }, {
      value: "progress",
      label: "In progress",
      count: 5
    }, {
      value: "closed",
      label: "Resolved"
    }]
  })), /*#__PURE__*/React.createElement("div", null, tickets.map(([t, cat, tone, who], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 16,
      padding: "16px 24px",
      borderTop: i ? "1px solid var(--border-subtle)" : "none"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "0.98rem",
      fontWeight: 600,
      color: "var(--text-strong)"
    }
  }, t), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "0.85rem",
      color: "var(--text-muted)",
      marginTop: 2
    }
  }, who)), /*#__PURE__*/React.createElement(Badge, {
    tone: tone,
    size: "sm"
  }, cat), /*#__PURE__*/React.createElement(IconButton, {
    "aria-label": "Open ticket",
    variant: "ghost",
    size: "sm"
  }, "\u2192"))))), /*#__PURE__*/React.createElement(Card, {
    variant: "outline"
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: "1.05rem",
      fontWeight: 600,
      color: "var(--text-strong)",
      marginBottom: 4
    }
  }, "Amenity bookings"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: "0.85rem",
      color: "var(--text-muted)",
      marginBottom: 18
    }
  }, "Today \xB7 6 reservations"), [["Clubhouse", "The Rao family", "6:00 PM", "success"], ["Tennis court", "K. Iyer", "5:30 PM", "success"], ["Party lawn", "Residents' Assoc.", "7:00 PM", "warning"]].map(([a, w, time, tone], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "12px 0",
      borderTop: i ? "1px solid var(--border-subtle)" : "none"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      borderRadius: "var(--radius-sm)",
      background: "var(--surface-tint)",
      color: "var(--text-brand)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 16
    }
  }, "\u2756"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "0.92rem",
      fontWeight: 600,
      color: "var(--text-strong)"
    }
  }, a), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "0.8rem",
      color: "var(--text-muted)"
    }
  }, w)), /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: "0.82rem",
      color: "var(--text-body)"
    }
  }, time))), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    fullWidth: true,
    style: {
      marginTop: 12
    }
  }, "View calendar"))));
}
Object.assign(window, {
  AdminShell,
  Overview
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin/dashboard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/admin/residents.jsx
try { (() => {
/* Living — Admin UI kit: Residents table view */
const {
  Card,
  Badge,
  Button,
  IconButton,
  Avatar,
  Tabs,
  Tag,
  Input
} = window.LivingDesignSystem_bba765;
function Residents() {
  const rows = [["Anaya Rao", "A-1204", "Owner", "success", "Current", "anaya@living.co"], ["Kabir Iyer", "B-0812", "Tenant", "success", "Current", "kabir@mail.co"], ["The Menon Family", "C-0803", "Owner", "warning", "₹18,400 due", "menon@mail.co"], ["Sara Fernandes", "A-0907", "Tenant", "success", "Current", "sara@mail.co"], ["Rohan Gupta", "D-1101", "Owner", "danger", "₹42,000 overdue", "rohan@mail.co"], ["Leela Nair", "B-0203", "Owner", "success", "Current", "leela@mail.co"]];
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between",
      marginBottom: 24,
      gap: 20,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow",
    style: {
      marginBottom: 8
    }
  }, "Riverside Greens"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 400,
      fontSize: "2.5rem",
      letterSpacing: "-0.015em",
      color: "var(--text-strong)",
      margin: 0
    }
  }, "Residents")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    iconLeft: /*#__PURE__*/React.createElement("span", null, "\u21EA")
  }, "Export"), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    iconLeft: /*#__PURE__*/React.createElement("span", null, "\uFF0B")
  }, "Add resident"))), /*#__PURE__*/React.createElement(Card, {
    variant: "outline",
    padding: "none"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16,
      padding: "16px 20px",
      borderBottom: "1px solid var(--border-subtle)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Tag, {
    selected: true
  }, "All \xB7 248"), /*#__PURE__*/React.createElement(Tag, null, "Owners \xB7 156"), /*#__PURE__*/React.createElement(Tag, null, "Tenants \xB7 92"), /*#__PURE__*/React.createElement(Tag, null, "Dues \xB7 14")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: 260
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      left: 12,
      top: "50%",
      transform: "translateY(-50%)",
      color: "var(--text-subtle)",
      fontSize: 14
    }
  }, "\u2315"), /*#__PURE__*/React.createElement("input", {
    placeholder: "Search residents",
    style: {
      width: "100%",
      height: 38,
      padding: "0 12px 0 34px",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-md)",
      background: "var(--surface-raised)",
      fontFamily: "var(--font-body)",
      fontSize: "0.9rem",
      color: "var(--text-strong)"
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "2.2fr 1fr 1fr 1.4fr 0.6fr",
      gap: 16,
      padding: "12px 24px",
      background: "var(--surface-sunken)",
      fontSize: "0.72rem",
      fontWeight: 600,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: "var(--text-subtle)"
    }
  }, /*#__PURE__*/React.createElement("span", null, "Resident"), /*#__PURE__*/React.createElement("span", null, "Unit"), /*#__PURE__*/React.createElement("span", null, "Type"), /*#__PURE__*/React.createElement("span", null, "Billing"), /*#__PURE__*/React.createElement("span", null)), rows.map((r, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: "grid",
      gridTemplateColumns: "2.2fr 1fr 1fr 1.4fr 0.6fr",
      gap: 16,
      alignItems: "center",
      padding: "14px 24px",
      borderTop: "1px solid var(--border-subtle)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: r[0],
    size: "sm"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "0.95rem",
      fontWeight: 600,
      color: "var(--text-strong)"
    }
  }, r[0]), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "0.8rem",
      color: "var(--text-subtle)"
    }
  }, r[5]))), /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: "0.9rem",
      color: "var(--text-body)"
    }
  }, r[1]), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(Badge, {
    tone: r[2] === "Owner" ? "brand" : "neutral",
    size: "sm"
  }, r[2])), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(Badge, {
    tone: r[3],
    size: "sm",
    dot: true
  }, r[4])), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: "right"
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    "aria-label": "Row actions",
    variant: "ghost",
    size: "sm"
  }, "\u22EF")))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "14px 24px",
      borderTop: "1px solid var(--border-subtle)",
      fontSize: "0.85rem",
      color: "var(--text-muted)"
    }
  }, /*#__PURE__*/React.createElement("span", null, "Showing 6 of 248"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm"
  }, "Previous"), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "sm"
  }, "Next")))));
}
Object.assign(window, {
  Residents
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin/residents.jsx", error: String((e && e.message) || e) }); }

// ui_kits/admin/tweaks-panel.jsx
try { (() => {
// @ds-adherence-ignore -- omelette starter scaffold (raw elements/hex/px by design)

/* BEGIN USAGE */
// tweaks-panel.jsx
// Reusable Tweaks shell + form-control helpers.
// Exports (to window): useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider,
//   TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton.
//
// Owns the host protocol (listens for __activate_edit_mode / __deactivate_edit_mode,
// posts __edit_mode_available / __edit_mode_set_keys / __edit_mode_dismissed) so
// individual prototypes don't re-roll it. Ships a consistent set of controls so you
// don't hand-draw <input type="range">, segmented radios, steppers, etc.
//
// Usage (in an HTML file that loads React + Babel):
//
//   const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
//     "primaryColor": "#D97757",
//     "palette": ["#D97757", "#29261b", "#f6f4ef"],
//     "fontSize": 16,
//     "density": "regular",
//     "dark": false
//   }/*EDITMODE-END*/;
//
//   function App() {
//     const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
//     return (
//       <div style={{ fontSize: t.fontSize, color: t.primaryColor }}>
//         Hello
//         <TweaksPanel>
//           <TweakSection label="Typography" />
//           <TweakSlider label="Font size" value={t.fontSize} min={10} max={32} unit="px"
//                        onChange={(v) => setTweak('fontSize', v)} />
//           <TweakRadio  label="Density" value={t.density}
//                        options={['compact', 'regular', 'comfy']}
//                        onChange={(v) => setTweak('density', v)} />
//           <TweakSection label="Theme" />
//           <TweakColor  label="Primary" value={t.primaryColor}
//                        options={['#D97757', '#2A6FDB', '#1F8A5B', '#7A5AE0']}
//                        onChange={(v) => setTweak('primaryColor', v)} />
//           <TweakColor  label="Palette" value={t.palette}
//                        options={[['#D97757', '#29261b', '#f6f4ef'],
//                                  ['#475569', '#0f172a', '#f1f5f9']]}
//                        onChange={(v) => setTweak('palette', v)} />
//           <TweakToggle label="Dark mode" value={t.dark}
//                        onChange={(v) => setTweak('dark', v)} />
//         </TweaksPanel>
//       </div>
//     );
//   }
//
// TweakRadio is the segmented control for 2–3 short options (auto-falls-back to
// TweakSelect past ~16/~10 chars per label); reach for TweakSelect directly when
// options are many or long. For color tweaks always curate 3-4 options rather than
// a free picker; an option can also be a whole 2–5 color palette (the stored value
// is the array). The Tweak* controls are a floor, not a ceiling — build custom
// controls inside the panel if a tweak calls for UI they don't cover.
/* END USAGE */
// ─────────────────────────────────────────────────────────────────────────────

const __TWEAKS_STYLE = `
  .twk-panel{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:280px;
    max-height:calc(100vh - 32px);display:flex;flex-direction:column;
    transform:scale(var(--dc-inv-zoom,1));transform-origin:bottom right;
    background:rgba(250,249,247,.78);color:#29261b;
    -webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);
    border:.5px solid rgba(255,255,255,.6);border-radius:14px;
    box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 12px 40px rgba(0,0,0,.18);
    font:11.5px/1.4 ui-sans-serif,system-ui,-apple-system,sans-serif;overflow:hidden}
  .twk-hd{display:flex;align-items:center;justify-content:space-between;
    padding:10px 8px 10px 14px;cursor:move;user-select:none}
  .twk-hd b{font-size:12px;font-weight:600;letter-spacing:.01em}
  .twk-x{appearance:none;border:0;background:transparent;color:rgba(41,38,27,.55);
    width:22px;height:22px;border-radius:6px;cursor:default;font-size:13px;line-height:1}
  .twk-x:hover{background:rgba(0,0,0,.06);color:#29261b}
  .twk-body{padding:2px 14px 14px;display:flex;flex-direction:column;gap:10px;
    overflow-y:auto;overflow-x:hidden;min-height:0;
    scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.15) transparent}
  .twk-body::-webkit-scrollbar{width:8px}
  .twk-body::-webkit-scrollbar-track{background:transparent;margin:2px}
  .twk-body::-webkit-scrollbar-thumb{background:rgba(0,0,0,.15);border-radius:4px;
    border:2px solid transparent;background-clip:content-box}
  .twk-body::-webkit-scrollbar-thumb:hover{background:rgba(0,0,0,.25);
    border:2px solid transparent;background-clip:content-box}
  .twk-row{display:flex;flex-direction:column;gap:5px}
  .twk-row-h{flex-direction:row;align-items:center;justify-content:space-between;gap:10px}
  .twk-lbl{display:flex;justify-content:space-between;align-items:baseline;
    color:rgba(41,38,27,.72)}
  .twk-lbl>span:first-child{font-weight:500}
  .twk-val{color:rgba(41,38,27,.5);font-variant-numeric:tabular-nums}

  .twk-sect{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
    color:rgba(41,38,27,.45);padding:10px 0 0}
  .twk-sect:first-child{padding-top:0}

  .twk-field{appearance:none;box-sizing:border-box;width:100%;min-width:0;height:26px;padding:0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;
    background:rgba(255,255,255,.6);color:inherit;font:inherit;outline:none}
  .twk-field:focus{border-color:rgba(0,0,0,.25);background:rgba(255,255,255,.85)}
  select.twk-field{padding-right:22px;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='rgba(0,0,0,.5)' d='M0 0h10L5 6z'/></svg>");
    background-repeat:no-repeat;background-position:right 8px center}

  .twk-slider{appearance:none;-webkit-appearance:none;width:100%;height:4px;margin:6px 0;
    border-radius:999px;background:rgba(0,0,0,.12);outline:none}
  .twk-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;
    width:14px;height:14px;border-radius:50%;background:#fff;
    border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}
  .twk-slider::-moz-range-thumb{width:14px;height:14px;border-radius:50%;
    background:#fff;border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}

  .twk-seg{position:relative;display:flex;padding:2px;border-radius:8px;
    background:rgba(0,0,0,.06);user-select:none}
  .twk-seg-thumb{position:absolute;top:2px;bottom:2px;border-radius:6px;
    background:rgba(255,255,255,.9);box-shadow:0 1px 2px rgba(0,0,0,.12);
    transition:left .15s cubic-bezier(.3,.7,.4,1),width .15s}
  .twk-seg.dragging .twk-seg-thumb{transition:none}
  .twk-seg button{appearance:none;position:relative;z-index:1;flex:1;border:0;
    background:transparent;color:inherit;font:inherit;font-weight:500;min-height:22px;
    border-radius:6px;cursor:default;padding:4px 6px;line-height:1.2;
    overflow-wrap:anywhere}

  .twk-toggle{position:relative;width:32px;height:18px;border:0;border-radius:999px;
    background:rgba(0,0,0,.15);transition:background .15s;cursor:default;padding:0}
  .twk-toggle[data-on="1"]{background:#34c759}
  .twk-toggle i{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;
    background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
  .twk-toggle[data-on="1"] i{transform:translateX(14px)}

  .twk-num{display:flex;align-items:center;box-sizing:border-box;min-width:0;height:26px;padding:0 0 0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;background:rgba(255,255,255,.6)}
  .twk-num-lbl{font-weight:500;color:rgba(41,38,27,.6);cursor:ew-resize;
    user-select:none;padding-right:8px}
  .twk-num input{flex:1;min-width:0;height:100%;border:0;background:transparent;
    font:inherit;font-variant-numeric:tabular-nums;text-align:right;padding:0 8px 0 0;
    outline:none;color:inherit;-moz-appearance:textfield}
  .twk-num input::-webkit-inner-spin-button,.twk-num input::-webkit-outer-spin-button{
    -webkit-appearance:none;margin:0}
  .twk-num-unit{padding-right:8px;color:rgba(41,38,27,.45)}

  .twk-btn{appearance:none;height:26px;padding:0 12px;border:0;border-radius:7px;
    background:rgba(0,0,0,.78);color:#fff;font:inherit;font-weight:500;cursor:default}
  .twk-btn:hover{background:rgba(0,0,0,.88)}
  .twk-btn.secondary{background:rgba(0,0,0,.06);color:inherit}
  .twk-btn.secondary:hover{background:rgba(0,0,0,.1)}

  .twk-swatch{appearance:none;-webkit-appearance:none;width:56px;height:22px;
    border:.5px solid rgba(0,0,0,.1);border-radius:6px;padding:0;cursor:default;
    background:transparent;flex-shrink:0}
  .twk-swatch::-webkit-color-swatch-wrapper{padding:0}
  .twk-swatch::-webkit-color-swatch{border:0;border-radius:5.5px}
  .twk-swatch::-moz-color-swatch{border:0;border-radius:5.5px}

  .twk-chips{display:flex;gap:6px}
  .twk-chip{position:relative;appearance:none;flex:1;min-width:0;height:46px;
    padding:0;border:0;border-radius:6px;overflow:hidden;cursor:default;
    box-shadow:0 0 0 .5px rgba(0,0,0,.12),0 1px 2px rgba(0,0,0,.06);
    transition:transform .12s cubic-bezier(.3,.7,.4,1),box-shadow .12s}
  .twk-chip:hover{transform:translateY(-1px);
    box-shadow:0 0 0 .5px rgba(0,0,0,.18),0 4px 10px rgba(0,0,0,.12)}
  .twk-chip[data-on="1"]{box-shadow:0 0 0 1.5px rgba(0,0,0,.85),
    0 2px 6px rgba(0,0,0,.15)}
  .twk-chip>span{position:absolute;top:0;bottom:0;right:0;width:34%;
    display:flex;flex-direction:column;box-shadow:-1px 0 0 rgba(0,0,0,.1)}
  .twk-chip>span>i{flex:1;box-shadow:0 -1px 0 rgba(0,0,0,.1)}
  .twk-chip>span>i:first-child{box-shadow:none}
  .twk-chip svg{position:absolute;top:6px;left:6px;width:13px;height:13px;
    filter:drop-shadow(0 1px 1px rgba(0,0,0,.3))}
`;

// ── useTweaks ───────────────────────────────────────────────────────────────
// Single source of truth for tweak values. setTweak persists via the host
// (__edit_mode_set_keys → host rewrites the EDITMODE block on disk).
function useTweaks(defaults) {
  const [values, setValues] = React.useState(defaults);
  // Accepts either setTweak('key', value) or setTweak({ key: value, ... }) so a
  // useState-style call doesn't write a "[object Object]" key into the persisted
  // JSON block.
  const setTweak = React.useCallback((keyOrEdits, val) => {
    const edits = typeof keyOrEdits === 'object' && keyOrEdits !== null ? keyOrEdits : {
      [keyOrEdits]: val
    };
    setValues(prev => ({
      ...prev,
      ...edits
    }));
    window.parent.postMessage({
      type: '__edit_mode_set_keys',
      edits
    }, '*');
    // Same-window signal so in-page listeners (deck-stage rail thumbnails)
    // can react — the parent message only reaches the host, not peers.
    window.dispatchEvent(new CustomEvent('tweakchange', {
      detail: edits
    }));
  }, []);
  return [values, setTweak];
}

// ── TweaksPanel ─────────────────────────────────────────────────────────────
// Floating shell. Registers the protocol listener BEFORE announcing
// availability — if the announce ran first, the host's activate could land
// before our handler exists and the toolbar toggle would silently no-op.
// The close button posts __edit_mode_dismissed so the host's toolbar toggle
// flips off in lockstep; the host echoes __deactivate_edit_mode back which
// is what actually hides the panel.
function TweaksPanel({
  title = 'Tweaks',
  children
}) {
  const [open, setOpen] = React.useState(false);
  const dragRef = React.useRef(null);
  const offsetRef = React.useRef({
    x: 16,
    y: 16
  });
  const PAD = 16;
  const clampToViewport = React.useCallback(() => {
    const panel = dragRef.current;
    if (!panel) return;
    const w = panel.offsetWidth,
      h = panel.offsetHeight;
    const maxRight = Math.max(PAD, window.innerWidth - w - PAD);
    const maxBottom = Math.max(PAD, window.innerHeight - h - PAD);
    offsetRef.current = {
      x: Math.min(maxRight, Math.max(PAD, offsetRef.current.x)),
      y: Math.min(maxBottom, Math.max(PAD, offsetRef.current.y))
    };
    panel.style.right = offsetRef.current.x + 'px';
    panel.style.bottom = offsetRef.current.y + 'px';
  }, []);
  React.useEffect(() => {
    if (!open) return;
    clampToViewport();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', clampToViewport);
      return () => window.removeEventListener('resize', clampToViewport);
    }
    const ro = new ResizeObserver(clampToViewport);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [open, clampToViewport]);
  React.useEffect(() => {
    const onMsg = e => {
      const t = e?.data?.type;
      if (t === '__activate_edit_mode') setOpen(true);else if (t === '__deactivate_edit_mode') setOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({
      type: '__edit_mode_available'
    }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);
  const dismiss = () => {
    setOpen(false);
    window.parent.postMessage({
      type: '__edit_mode_dismissed'
    }, '*');
  };
  const onDragStart = e => {
    const panel = dragRef.current;
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const sx = e.clientX,
      sy = e.clientY;
    const startRight = window.innerWidth - r.right;
    const startBottom = window.innerHeight - r.bottom;
    const move = ev => {
      offsetRef.current = {
        x: startRight - (ev.clientX - sx),
        y: startBottom - (ev.clientY - sy)
      };
      clampToViewport();
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  if (!open) return null;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("style", null, __TWEAKS_STYLE), /*#__PURE__*/React.createElement("div", {
    ref: dragRef,
    className: "twk-panel",
    "data-omelette-chrome": "",
    style: {
      right: offsetRef.current.x,
      bottom: offsetRef.current.y
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-hd",
    onMouseDown: onDragStart
  }, /*#__PURE__*/React.createElement("b", null, title), /*#__PURE__*/React.createElement("button", {
    className: "twk-x",
    "aria-label": "Close tweaks",
    onMouseDown: e => e.stopPropagation(),
    onClick: dismiss
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    className: "twk-body"
  }, children)));
}

// ── Layout helpers ──────────────────────────────────────────────────────────

function TweakSection({
  label,
  children
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "twk-sect"
  }, label), children);
}
function TweakRow({
  label,
  value,
  children,
  inline = false
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: inline ? 'twk-row twk-row-h' : 'twk-row'
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-lbl"
  }, /*#__PURE__*/React.createElement("span", null, label), value != null && /*#__PURE__*/React.createElement("span", {
    className: "twk-val"
  }, value)), children);
}

// ── Controls ────────────────────────────────────────────────────────────────

function TweakSlider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label,
    value: `${value}${unit}`
  }, /*#__PURE__*/React.createElement("input", {
    type: "range",
    className: "twk-slider",
    min: min,
    max: max,
    step: step,
    value: value,
    onChange: e => onChange(Number(e.target.value))
  }));
}
function TweakToggle({
  label,
  value,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "twk-row twk-row-h"
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-lbl"
  }, /*#__PURE__*/React.createElement("span", null, label)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "twk-toggle",
    "data-on": value ? '1' : '0',
    role: "switch",
    "aria-checked": !!value,
    onClick: () => onChange(!value)
  }, /*#__PURE__*/React.createElement("i", null)));
}
function TweakRadio({
  label,
  value,
  options,
  onChange
}) {
  const trackRef = React.useRef(null);
  const [dragging, setDragging] = React.useState(false);
  // The active value is read by pointer-move handlers attached for the lifetime
  // of a drag — ref it so a stale closure doesn't fire onChange for every move.
  const valueRef = React.useRef(value);
  valueRef.current = value;

  // Segments wrap mid-word once per-segment width runs out. The track is
  // ~248px (280 panel − 28 body pad − 4 seg pad), each button loses 12px
  // to its own padding, and 11.5px system-ui averages ~6.3px/char — so 2
  // options fit ~16 chars each, 3 fit ~10. Past that (or >3 options), fall
  // back to a dropdown rather than wrap.
  const labelLen = o => String(typeof o === 'object' ? o.label : o).length;
  const maxLen = options.reduce((m, o) => Math.max(m, labelLen(o)), 0);
  const fitsAsSegments = maxLen <= ({
    2: 16,
    3: 10
  }[options.length] ?? 0);
  if (!fitsAsSegments) {
    // <select> emits strings — map back to the original option value so the
    // fallback stays type-preserving (numbers, booleans) like the segment path.
    const resolve = s => {
      const m = options.find(o => String(typeof o === 'object' ? o.value : o) === s);
      return m === undefined ? s : typeof m === 'object' ? m.value : m;
    };
    return /*#__PURE__*/React.createElement(TweakSelect, {
      label: label,
      value: value,
      options: options,
      onChange: s => onChange(resolve(s))
    });
  }
  const opts = options.map(o => typeof o === 'object' ? o : {
    value: o,
    label: o
  });
  const idx = Math.max(0, opts.findIndex(o => o.value === value));
  const n = opts.length;
  const segAt = clientX => {
    const r = trackRef.current.getBoundingClientRect();
    const inner = r.width - 4;
    const i = Math.floor((clientX - r.left - 2) / inner * n);
    return opts[Math.max(0, Math.min(n - 1, i))].value;
  };
  const onPointerDown = e => {
    setDragging(true);
    const v0 = segAt(e.clientX);
    if (v0 !== valueRef.current) onChange(v0);
    const move = ev => {
      if (!trackRef.current) return;
      const v = segAt(ev.clientX);
      if (v !== valueRef.current) onChange(v);
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("div", {
    ref: trackRef,
    role: "radiogroup",
    onPointerDown: onPointerDown,
    className: dragging ? 'twk-seg dragging' : 'twk-seg'
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-seg-thumb",
    style: {
      left: `calc(2px + ${idx} * (100% - 4px) / ${n})`,
      width: `calc((100% - 4px) / ${n})`
    }
  }), opts.map(o => /*#__PURE__*/React.createElement("button", {
    key: o.value,
    type: "button",
    role: "radio",
    "aria-checked": o.value === value
  }, o.label))));
}
function TweakSelect({
  label,
  value,
  options,
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("select", {
    className: "twk-field",
    value: value,
    onChange: e => onChange(e.target.value)
  }, options.map(o => {
    const v = typeof o === 'object' ? o.value : o;
    const l = typeof o === 'object' ? o.label : o;
    return /*#__PURE__*/React.createElement("option", {
      key: v,
      value: v
    }, l);
  })));
}
function TweakText({
  label,
  value,
  placeholder,
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("input", {
    className: "twk-field",
    type: "text",
    value: value,
    placeholder: placeholder,
    onChange: e => onChange(e.target.value)
  }));
}
function TweakNumber({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange
}) {
  const clamp = n => {
    if (min != null && n < min) return min;
    if (max != null && n > max) return max;
    return n;
  };
  const startRef = React.useRef({
    x: 0,
    val: 0
  });
  const onScrubStart = e => {
    e.preventDefault();
    startRef.current = {
      x: e.clientX,
      val: value
    };
    const decimals = (String(step).split('.')[1] || '').length;
    const move = ev => {
      const dx = ev.clientX - startRef.current.x;
      const raw = startRef.current.val + dx * step;
      const snapped = Math.round(raw / step) * step;
      onChange(clamp(Number(snapped.toFixed(decimals))));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "twk-num"
  }, /*#__PURE__*/React.createElement("span", {
    className: "twk-num-lbl",
    onPointerDown: onScrubStart
  }, label), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: value,
    min: min,
    max: max,
    step: step,
    onChange: e => onChange(clamp(Number(e.target.value)))
  }), unit && /*#__PURE__*/React.createElement("span", {
    className: "twk-num-unit"
  }, unit));
}

// Relative-luminance contrast pick — checkmarks drawn over a swatch need to
// read on both #111 and #fafafa without per-option configuration. Hex input
// only (#rgb / #rrggbb); named or rgb()/hsl() colors fall through to "light".
function __twkIsLight(hex) {
  const h = String(hex).replace('#', '');
  const x = h.length === 3 ? h.replace(/./g, c => c + c) : h.padEnd(6, '0');
  const n = parseInt(x.slice(0, 6), 16);
  if (Number.isNaN(n)) return true;
  const r = n >> 16 & 255,
    g = n >> 8 & 255,
    b = n & 255;
  return r * 299 + g * 587 + b * 114 > 148000;
}
const __TwkCheck = ({
  light
}) => /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 14 14",
  "aria-hidden": "true"
}, /*#__PURE__*/React.createElement("path", {
  d: "M3 7.2 5.8 10 11 4.2",
  fill: "none",
  strokeWidth: "2.2",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  stroke: light ? 'rgba(0,0,0,.78)' : '#fff'
}));

// TweakColor — curated color/palette picker. Each option is either a single
// hex string or an array of 1-5 hex strings; the card adapts — a lone color
// renders solid, a palette renders colors[0] as the hero (left ~2/3) with the
// rest stacked in a sharp column on the right. onChange emits the
// option in the shape it was passed (string stays string, array stays array).
// Without options it falls back to the native color input for back-compat.
function TweakColor({
  label,
  value,
  options,
  onChange
}) {
  if (!options || !options.length) {
    return /*#__PURE__*/React.createElement("div", {
      className: "twk-row twk-row-h"
    }, /*#__PURE__*/React.createElement("div", {
      className: "twk-lbl"
    }, /*#__PURE__*/React.createElement("span", null, label)), /*#__PURE__*/React.createElement("input", {
      type: "color",
      className: "twk-swatch",
      value: value,
      onChange: e => onChange(e.target.value)
    }));
  }
  // Native <input type=color> emits lowercase hex per the HTML spec, so
  // compare case-insensitively. String() guards JSON.stringify(undefined),
  // which returns the primitive undefined (no .toLowerCase).
  const key = o => String(JSON.stringify(o)).toLowerCase();
  const cur = key(value);
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-chips",
    role: "radiogroup"
  }, options.map((o, i) => {
    const colors = Array.isArray(o) ? o : [o];
    const [hero, ...rest] = colors;
    const sup = rest.slice(0, 4);
    const on = key(o) === cur;
    return /*#__PURE__*/React.createElement("button", {
      key: i,
      type: "button",
      className: "twk-chip",
      role: "radio",
      "aria-checked": on,
      "data-on": on ? '1' : '0',
      "aria-label": colors.join(', '),
      title: colors.join(' · '),
      style: {
        background: hero
      },
      onClick: () => onChange(o)
    }, sup.length > 0 && /*#__PURE__*/React.createElement("span", null, sup.map((c, j) => /*#__PURE__*/React.createElement("i", {
      key: j,
      style: {
        background: c
      }
    }))), on && /*#__PURE__*/React.createElement(__TwkCheck, {
      light: __twkIsLight(hero)
    }));
  })));
}
function TweakButton({
  label,
  onClick,
  secondary = false
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: secondary ? 'twk-btn secondary' : 'twk-btn',
    onClick: onClick
  }, label);
}
Object.assign(window, {
  useTweaks,
  TweaksPanel,
  TweakSection,
  TweakRow,
  TweakSlider,
  TweakToggle,
  TweakRadio,
  TweakSelect,
  TweakText,
  TweakNumber,
  TweakColor,
  TweakButton
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin/tweaks-panel.jsx", error: String((e && e.message) || e) }); }

// ui_kits/resident/app.jsx
try { (() => {
/* Living — Resident mobile app UI kit (subtle, modern refresh) */
const {
  Button,
  Card,
  Badge,
  Avatar,
  IconButton,
  Tag
} = window.LivingDesignSystem_bba765;
const MARK = "../../assets/living-mark.svg";
const MARK_LIGHT = "../../assets/living-mark-light.svg";

// Subtle accent tones — a quiet tint + matching soft icon colour, never a loud gradient.
const TONES = {
  pine: {
    tint: "var(--pine-50)",
    soft: "var(--pine-100)",
    ink: "var(--pine-700)",
    ring: "var(--pine-500)"
  },
  clay: {
    tint: "var(--clay-50)",
    soft: "var(--clay-100)",
    ink: "var(--clay-700)",
    ring: "var(--clay-500)"
  },
  ink: {
    tint: "var(--stone-100)",
    soft: "var(--stone-200)",
    ink: "var(--stone-800)",
    ring: "var(--stone-600)"
  },
  coast: {
    tint: "var(--blue-50)",
    soft: "#DCE7EE",
    ink: "var(--blue-600)",
    ring: "var(--blue-500)"
  }
};
function StatusBar({
  light
}) {
  const c = light ? "var(--stone-50)" : "var(--text-strong)";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "12px 24px 4px",
      fontFamily: "var(--font-sans)",
      fontSize: 13,
      fontWeight: 600,
      color: c
    }
  }, /*#__PURE__*/React.createElement("span", null, "9:41"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      gap: 6,
      fontSize: 11,
      alignItems: "center"
    }
  }, "\u25CF\u25CF\u25CF \u2303 \u25AE"));
}

// Quiet brand app bar: mark + wordmark, notification bell.
function AppBar({
  tone,
  dark
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "8px 20px 14px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 9
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: dark ? MARK_LIGHT : MARK,
    width: "26",
    height: "26",
    alt: ""
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 500,
      fontSize: 21,
      letterSpacing: "-0.02em",
      color: "var(--text-strong)"
    }
  }, "Living", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--brand-accent)"
    }
  }, "."))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    "aria-label": "Notifications",
    variant: "ghost"
  }, "\u25D4"), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: 5,
      right: 5,
      width: 7,
      height: 7,
      borderRadius: "50%",
      background: "var(--clay-500)",
      border: "2px solid var(--surface-page)"
    }
  })));
}
function BottomNav({
  tab,
  setTab
}) {
  const items = [["home", "⌂", "Home"], ["services", "❖", "Services"], ["pay", "▤", "Pay"], ["profile", "◎", "You"]];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      padding: "8px 12px 24px",
      borderTop: "1px solid var(--border-subtle)",
      background: "var(--surface-glass)",
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)"
    }
  }, items.map(([id, icon, label]) => {
    const on = tab === id;
    return /*#__PURE__*/React.createElement("button", {
      key: id,
      onClick: () => setTab(id),
      style: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "6px 0",
        color: on ? "var(--text-brand)" : "var(--text-subtle)"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 19
      }
    }, icon), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10.5,
        fontWeight: on ? 600 : 500
      }
    }, label));
  }));
}
function ResidentHome({
  theme = "pine",
  dark = false
}) {
  const t = TONES[theme] || TONES.pine;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: "auto",
      background: "var(--surface-page)"
    }
  }, /*#__PURE__*/React.createElement(StatusBar, null), /*#__PURE__*/React.createElement(AppBar, {
    tone: t,
    dark: dark
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "2px 20px 22px",
      display: "flex",
      flexDirection: "column",
      gap: 24
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: "var(--text-subtle)",
      letterSpacing: "0.02em"
    }
  }, "Good evening"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 500,
      fontSize: 30,
      color: "var(--text-strong)",
      lineHeight: 1.08,
      margin: "3px 0 0",
      letterSpacing: "-0.015em"
    }
  }, "Anaya Rao")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: t.tint,
      border: "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-lg)",
      padding: "18px 20px",
      boxShadow: "var(--shadow-sm)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: "var(--text-muted)",
      letterSpacing: "0.03em"
    }
  }, "Maintenance due \xB7 July"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono)",
      fontWeight: 500,
      fontSize: 30,
      color: t.ink,
      marginTop: 4,
      letterSpacing: "-0.01em"
    }
  }, "\u20B98,450")), /*#__PURE__*/React.createElement(Badge, {
    tone: "warning",
    size: "sm"
  }, "Due Jul 15")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "accent",
    size: "sm",
    style: {
      flex: 1
    }
  }, "Pay now"), /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    size: "sm",
    style: {
      flex: 1
    }
  }, "View bill"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(4,1fr)",
      gap: 12
    }
  }, [["✦", "Raise\nticket"], ["❖", "Book\namenity"], ["◇", "Visitor\npass"], ["▤", "Notices"]].map(([ic, l]) => /*#__PURE__*/React.createElement("div", {
    key: l,
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 8,
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 56,
      height: 56,
      borderRadius: "50%",
      background: "var(--surface-raised)",
      border: "1px solid var(--border-subtle)",
      color: t.ink,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 21,
      boxShadow: "var(--shadow-sm)"
    }
  }, ic), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      textAlign: "center",
      color: "var(--text-muted)",
      whiteSpace: "pre-line",
      lineHeight: 1.25
    }
  }, l)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 15,
      fontWeight: 600,
      color: "var(--text-strong)",
      margin: 0
    }
  }, "From your community"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => e.preventDefault(),
    style: {
      fontSize: 12.5,
      color: "var(--text-brand)",
      fontWeight: 600
    }
  }, "See all")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Card, {
    variant: "elevated",
    padding: "md"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 13
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      height: 44,
      borderRadius: "var(--radius-md)",
      background: "var(--clay-50)",
      color: "var(--clay-700)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 18,
      flexShrink: 0
    }
  }, "\u2756"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: "var(--text-strong)"
    }
  }, "Pool reopens Saturday"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: "var(--text-muted)",
      marginTop: 2,
      lineHeight: 1.45
    }
  }, "Deep-cleaning complete. New hours 6 AM\u20139 PM."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 9
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: "info",
    size: "sm"
  }, "Amenities"))))), /*#__PURE__*/React.createElement(Card, {
    variant: "elevated",
    padding: "md"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 13
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      height: 44,
      borderRadius: "var(--radius-md)",
      background: "var(--pine-50)",
      color: "var(--pine-700)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 18,
      flexShrink: 0
    }
  }, "\u25D4"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: "var(--text-strong)"
    }
  }, "Diwali celebration \xB7 Oct 20"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: "var(--text-muted)",
      marginTop: 2,
      lineHeight: 1.45
    }
  }, "Party lawn, 7 PM onwards. RSVP to reserve seats."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 9
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: "brand",
    size: "sm"
  }, "Event")))))))));
}
function ResidentServices({
  theme = "pine",
  dark = false
}) {
  const t = TONES[theme] || TONES.pine;
  const cats = [["Cleaning", "◇", "From ₹499", "var(--pine-50)", "var(--pine-700)"], ["Plumbing", "❖", "From ₹299", "var(--clay-50)", "var(--clay-700)"], ["Electrician", "✦", "From ₹349", "var(--blue-50)", "var(--blue-600)"], ["Painting", "◈", "Get quote", "var(--amber-50)", "var(--amber-600)"], ["Pest control", "◔", "From ₹899", "var(--green-50)", "var(--green-600)"], ["Carpentry", "◦", "From ₹399", "var(--stone-100)", "var(--text-body)"]];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: "auto",
      background: "var(--surface-page)"
    }
  }, /*#__PURE__*/React.createElement(StatusBar, null), /*#__PURE__*/React.createElement(AppBar, {
    tone: t,
    dark: dark
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "2px 20px 6px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow",
    style: {
      marginBottom: 6
    }
  }, "Home services"), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 500,
      fontSize: 28,
      color: "var(--text-strong)",
      margin: 0,
      letterSpacing: "-0.015em"
    }
  }, "Vetted help, on demand.")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "16px 20px",
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 12
    }
  }, cats.map(([n, ic, price, bg, fg]) => /*#__PURE__*/React.createElement(Card, {
    key: n,
    variant: "outline",
    padding: "md",
    interactive: true
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      height: 44,
      borderRadius: "var(--radius-md)",
      background: bg,
      color: fg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 19,
      marginBottom: 12
    }
  }, ic), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14.5,
      fontWeight: 600,
      color: "var(--text-strong)"
    }
  }, n), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "var(--text-muted)",
      marginTop: 2
    }
  }, price)))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "4px 20px 20px"
    }
  }, /*#__PURE__*/React.createElement(Card, {
    variant: "elevated",
    padding: "md",
    style: {
      background: t.tint,
      border: "1px solid var(--border-subtle)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: 19,
      color: "var(--text-strong)"
    }
  }, "Living Care+"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: "var(--text-muted)",
      margin: "3px 0 0"
    }
  }, "Unlimited priority visits \xB7 \u20B9999/mo.")), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "sm"
  }, "Explore")))));
}
function Phone({
  children,
  appearance = "light"
}) {
  return /*#__PURE__*/React.createElement("div", {
    "data-theme": appearance === "dark" ? "dark" : "light",
    style: {
      width: 390,
      height: 800,
      background: "var(--surface-page)",
      borderRadius: 46,
      border: "10px solid #0f0d0b",
      boxShadow: "var(--shadow-floating)",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 14,
      left: "50%",
      transform: "translateX(-50%)",
      width: 116,
      height: 30,
      background: "#0f0d0b",
      borderRadius: 18,
      zIndex: 20
    }
  }), children);
}
function ResidentApp({
  theme = "pine",
  appearance = "light"
}) {
  const [tab, setTab] = React.useState("home");
  const dark = appearance === "dark";
  return /*#__PURE__*/React.createElement(Phone, {
    appearance: appearance
  }, tab === "services" ? /*#__PURE__*/React.createElement(ResidentServices, {
    theme: theme,
    dark: dark
  }) : tab === "home" ? /*#__PURE__*/React.createElement(ResidentHome, {
    theme: theme,
    dark: dark
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      background: "var(--surface-page)"
    }
  }, /*#__PURE__*/React.createElement(StatusBar, null), /*#__PURE__*/React.createElement(AppBar, {
    tone: TONES[theme] || TONES.pine,
    dark: dark
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "var(--text-muted)",
      fontSize: 14,
      textTransform: "capitalize"
    }
  }, tab)), /*#__PURE__*/React.createElement(BottomNav, {
    tab: tab,
    setTab: setTab
  }));
}
Object.assign(window, {
  ResidentApp
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/resident/app.jsx", error: String((e && e.message) || e) }); }

// ui_kits/resident/tweaks-panel.jsx
try { (() => {
// @ds-adherence-ignore -- omelette starter scaffold (raw elements/hex/px by design)

/* BEGIN USAGE */
// tweaks-panel.jsx
// Reusable Tweaks shell + form-control helpers.
// Exports (to window): useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider,
//   TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton.
//
// Owns the host protocol (listens for __activate_edit_mode / __deactivate_edit_mode,
// posts __edit_mode_available / __edit_mode_set_keys / __edit_mode_dismissed) so
// individual prototypes don't re-roll it. Ships a consistent set of controls so you
// don't hand-draw <input type="range">, segmented radios, steppers, etc.
//
// Usage (in an HTML file that loads React + Babel):
//
//   const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
//     "primaryColor": "#D97757",
//     "palette": ["#D97757", "#29261b", "#f6f4ef"],
//     "fontSize": 16,
//     "density": "regular",
//     "dark": false
//   }/*EDITMODE-END*/;
//
//   function App() {
//     const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
//     return (
//       <div style={{ fontSize: t.fontSize, color: t.primaryColor }}>
//         Hello
//         <TweaksPanel>
//           <TweakSection label="Typography" />
//           <TweakSlider label="Font size" value={t.fontSize} min={10} max={32} unit="px"
//                        onChange={(v) => setTweak('fontSize', v)} />
//           <TweakRadio  label="Density" value={t.density}
//                        options={['compact', 'regular', 'comfy']}
//                        onChange={(v) => setTweak('density', v)} />
//           <TweakSection label="Theme" />
//           <TweakColor  label="Primary" value={t.primaryColor}
//                        options={['#D97757', '#2A6FDB', '#1F8A5B', '#7A5AE0']}
//                        onChange={(v) => setTweak('primaryColor', v)} />
//           <TweakColor  label="Palette" value={t.palette}
//                        options={[['#D97757', '#29261b', '#f6f4ef'],
//                                  ['#475569', '#0f172a', '#f1f5f9']]}
//                        onChange={(v) => setTweak('palette', v)} />
//           <TweakToggle label="Dark mode" value={t.dark}
//                        onChange={(v) => setTweak('dark', v)} />
//         </TweaksPanel>
//       </div>
//     );
//   }
//
// TweakRadio is the segmented control for 2–3 short options (auto-falls-back to
// TweakSelect past ~16/~10 chars per label); reach for TweakSelect directly when
// options are many or long. For color tweaks always curate 3-4 options rather than
// a free picker; an option can also be a whole 2–5 color palette (the stored value
// is the array). The Tweak* controls are a floor, not a ceiling — build custom
// controls inside the panel if a tweak calls for UI they don't cover.
/* END USAGE */
// ─────────────────────────────────────────────────────────────────────────────

const __TWEAKS_STYLE = `
  .twk-panel{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:280px;
    max-height:calc(100vh - 32px);display:flex;flex-direction:column;
    transform:scale(var(--dc-inv-zoom,1));transform-origin:bottom right;
    background:rgba(250,249,247,.78);color:#29261b;
    -webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);
    border:.5px solid rgba(255,255,255,.6);border-radius:14px;
    box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 12px 40px rgba(0,0,0,.18);
    font:11.5px/1.4 ui-sans-serif,system-ui,-apple-system,sans-serif;overflow:hidden}
  .twk-hd{display:flex;align-items:center;justify-content:space-between;
    padding:10px 8px 10px 14px;cursor:move;user-select:none}
  .twk-hd b{font-size:12px;font-weight:600;letter-spacing:.01em}
  .twk-x{appearance:none;border:0;background:transparent;color:rgba(41,38,27,.55);
    width:22px;height:22px;border-radius:6px;cursor:default;font-size:13px;line-height:1}
  .twk-x:hover{background:rgba(0,0,0,.06);color:#29261b}
  .twk-body{padding:2px 14px 14px;display:flex;flex-direction:column;gap:10px;
    overflow-y:auto;overflow-x:hidden;min-height:0;
    scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.15) transparent}
  .twk-body::-webkit-scrollbar{width:8px}
  .twk-body::-webkit-scrollbar-track{background:transparent;margin:2px}
  .twk-body::-webkit-scrollbar-thumb{background:rgba(0,0,0,.15);border-radius:4px;
    border:2px solid transparent;background-clip:content-box}
  .twk-body::-webkit-scrollbar-thumb:hover{background:rgba(0,0,0,.25);
    border:2px solid transparent;background-clip:content-box}
  .twk-row{display:flex;flex-direction:column;gap:5px}
  .twk-row-h{flex-direction:row;align-items:center;justify-content:space-between;gap:10px}
  .twk-lbl{display:flex;justify-content:space-between;align-items:baseline;
    color:rgba(41,38,27,.72)}
  .twk-lbl>span:first-child{font-weight:500}
  .twk-val{color:rgba(41,38,27,.5);font-variant-numeric:tabular-nums}

  .twk-sect{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
    color:rgba(41,38,27,.45);padding:10px 0 0}
  .twk-sect:first-child{padding-top:0}

  .twk-field{appearance:none;box-sizing:border-box;width:100%;min-width:0;height:26px;padding:0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;
    background:rgba(255,255,255,.6);color:inherit;font:inherit;outline:none}
  .twk-field:focus{border-color:rgba(0,0,0,.25);background:rgba(255,255,255,.85)}
  select.twk-field{padding-right:22px;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='rgba(0,0,0,.5)' d='M0 0h10L5 6z'/></svg>");
    background-repeat:no-repeat;background-position:right 8px center}

  .twk-slider{appearance:none;-webkit-appearance:none;width:100%;height:4px;margin:6px 0;
    border-radius:999px;background:rgba(0,0,0,.12);outline:none}
  .twk-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;
    width:14px;height:14px;border-radius:50%;background:#fff;
    border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}
  .twk-slider::-moz-range-thumb{width:14px;height:14px;border-radius:50%;
    background:#fff;border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}

  .twk-seg{position:relative;display:flex;padding:2px;border-radius:8px;
    background:rgba(0,0,0,.06);user-select:none}
  .twk-seg-thumb{position:absolute;top:2px;bottom:2px;border-radius:6px;
    background:rgba(255,255,255,.9);box-shadow:0 1px 2px rgba(0,0,0,.12);
    transition:left .15s cubic-bezier(.3,.7,.4,1),width .15s}
  .twk-seg.dragging .twk-seg-thumb{transition:none}
  .twk-seg button{appearance:none;position:relative;z-index:1;flex:1;border:0;
    background:transparent;color:inherit;font:inherit;font-weight:500;min-height:22px;
    border-radius:6px;cursor:default;padding:4px 6px;line-height:1.2;
    overflow-wrap:anywhere}

  .twk-toggle{position:relative;width:32px;height:18px;border:0;border-radius:999px;
    background:rgba(0,0,0,.15);transition:background .15s;cursor:default;padding:0}
  .twk-toggle[data-on="1"]{background:#34c759}
  .twk-toggle i{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;
    background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
  .twk-toggle[data-on="1"] i{transform:translateX(14px)}

  .twk-num{display:flex;align-items:center;box-sizing:border-box;min-width:0;height:26px;padding:0 0 0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;background:rgba(255,255,255,.6)}
  .twk-num-lbl{font-weight:500;color:rgba(41,38,27,.6);cursor:ew-resize;
    user-select:none;padding-right:8px}
  .twk-num input{flex:1;min-width:0;height:100%;border:0;background:transparent;
    font:inherit;font-variant-numeric:tabular-nums;text-align:right;padding:0 8px 0 0;
    outline:none;color:inherit;-moz-appearance:textfield}
  .twk-num input::-webkit-inner-spin-button,.twk-num input::-webkit-outer-spin-button{
    -webkit-appearance:none;margin:0}
  .twk-num-unit{padding-right:8px;color:rgba(41,38,27,.45)}

  .twk-btn{appearance:none;height:26px;padding:0 12px;border:0;border-radius:7px;
    background:rgba(0,0,0,.78);color:#fff;font:inherit;font-weight:500;cursor:default}
  .twk-btn:hover{background:rgba(0,0,0,.88)}
  .twk-btn.secondary{background:rgba(0,0,0,.06);color:inherit}
  .twk-btn.secondary:hover{background:rgba(0,0,0,.1)}

  .twk-swatch{appearance:none;-webkit-appearance:none;width:56px;height:22px;
    border:.5px solid rgba(0,0,0,.1);border-radius:6px;padding:0;cursor:default;
    background:transparent;flex-shrink:0}
  .twk-swatch::-webkit-color-swatch-wrapper{padding:0}
  .twk-swatch::-webkit-color-swatch{border:0;border-radius:5.5px}
  .twk-swatch::-moz-color-swatch{border:0;border-radius:5.5px}

  .twk-chips{display:flex;gap:6px}
  .twk-chip{position:relative;appearance:none;flex:1;min-width:0;height:46px;
    padding:0;border:0;border-radius:6px;overflow:hidden;cursor:default;
    box-shadow:0 0 0 .5px rgba(0,0,0,.12),0 1px 2px rgba(0,0,0,.06);
    transition:transform .12s cubic-bezier(.3,.7,.4,1),box-shadow .12s}
  .twk-chip:hover{transform:translateY(-1px);
    box-shadow:0 0 0 .5px rgba(0,0,0,.18),0 4px 10px rgba(0,0,0,.12)}
  .twk-chip[data-on="1"]{box-shadow:0 0 0 1.5px rgba(0,0,0,.85),
    0 2px 6px rgba(0,0,0,.15)}
  .twk-chip>span{position:absolute;top:0;bottom:0;right:0;width:34%;
    display:flex;flex-direction:column;box-shadow:-1px 0 0 rgba(0,0,0,.1)}
  .twk-chip>span>i{flex:1;box-shadow:0 -1px 0 rgba(0,0,0,.1)}
  .twk-chip>span>i:first-child{box-shadow:none}
  .twk-chip svg{position:absolute;top:6px;left:6px;width:13px;height:13px;
    filter:drop-shadow(0 1px 1px rgba(0,0,0,.3))}
`;

// ── useTweaks ───────────────────────────────────────────────────────────────
// Single source of truth for tweak values. setTweak persists via the host
// (__edit_mode_set_keys → host rewrites the EDITMODE block on disk).
function useTweaks(defaults) {
  const [values, setValues] = React.useState(defaults);
  // Accepts either setTweak('key', value) or setTweak({ key: value, ... }) so a
  // useState-style call doesn't write a "[object Object]" key into the persisted
  // JSON block.
  const setTweak = React.useCallback((keyOrEdits, val) => {
    const edits = typeof keyOrEdits === 'object' && keyOrEdits !== null ? keyOrEdits : {
      [keyOrEdits]: val
    };
    setValues(prev => ({
      ...prev,
      ...edits
    }));
    window.parent.postMessage({
      type: '__edit_mode_set_keys',
      edits
    }, '*');
    // Same-window signal so in-page listeners (deck-stage rail thumbnails)
    // can react — the parent message only reaches the host, not peers.
    window.dispatchEvent(new CustomEvent('tweakchange', {
      detail: edits
    }));
  }, []);
  return [values, setTweak];
}

// ── TweaksPanel ─────────────────────────────────────────────────────────────
// Floating shell. Registers the protocol listener BEFORE announcing
// availability — if the announce ran first, the host's activate could land
// before our handler exists and the toolbar toggle would silently no-op.
// The close button posts __edit_mode_dismissed so the host's toolbar toggle
// flips off in lockstep; the host echoes __deactivate_edit_mode back which
// is what actually hides the panel.
function TweaksPanel({
  title = 'Tweaks',
  children
}) {
  const [open, setOpen] = React.useState(false);
  const dragRef = React.useRef(null);
  const offsetRef = React.useRef({
    x: 16,
    y: 16
  });
  const PAD = 16;
  const clampToViewport = React.useCallback(() => {
    const panel = dragRef.current;
    if (!panel) return;
    const w = panel.offsetWidth,
      h = panel.offsetHeight;
    const maxRight = Math.max(PAD, window.innerWidth - w - PAD);
    const maxBottom = Math.max(PAD, window.innerHeight - h - PAD);
    offsetRef.current = {
      x: Math.min(maxRight, Math.max(PAD, offsetRef.current.x)),
      y: Math.min(maxBottom, Math.max(PAD, offsetRef.current.y))
    };
    panel.style.right = offsetRef.current.x + 'px';
    panel.style.bottom = offsetRef.current.y + 'px';
  }, []);
  React.useEffect(() => {
    if (!open) return;
    clampToViewport();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', clampToViewport);
      return () => window.removeEventListener('resize', clampToViewport);
    }
    const ro = new ResizeObserver(clampToViewport);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [open, clampToViewport]);
  React.useEffect(() => {
    const onMsg = e => {
      const t = e?.data?.type;
      if (t === '__activate_edit_mode') setOpen(true);else if (t === '__deactivate_edit_mode') setOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({
      type: '__edit_mode_available'
    }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);
  const dismiss = () => {
    setOpen(false);
    window.parent.postMessage({
      type: '__edit_mode_dismissed'
    }, '*');
  };
  const onDragStart = e => {
    const panel = dragRef.current;
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const sx = e.clientX,
      sy = e.clientY;
    const startRight = window.innerWidth - r.right;
    const startBottom = window.innerHeight - r.bottom;
    const move = ev => {
      offsetRef.current = {
        x: startRight - (ev.clientX - sx),
        y: startBottom - (ev.clientY - sy)
      };
      clampToViewport();
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  if (!open) return null;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("style", null, __TWEAKS_STYLE), /*#__PURE__*/React.createElement("div", {
    ref: dragRef,
    className: "twk-panel",
    "data-omelette-chrome": "",
    style: {
      right: offsetRef.current.x,
      bottom: offsetRef.current.y
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-hd",
    onMouseDown: onDragStart
  }, /*#__PURE__*/React.createElement("b", null, title), /*#__PURE__*/React.createElement("button", {
    className: "twk-x",
    "aria-label": "Close tweaks",
    onMouseDown: e => e.stopPropagation(),
    onClick: dismiss
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    className: "twk-body"
  }, children)));
}

// ── Layout helpers ──────────────────────────────────────────────────────────

function TweakSection({
  label,
  children
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "twk-sect"
  }, label), children);
}
function TweakRow({
  label,
  value,
  children,
  inline = false
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: inline ? 'twk-row twk-row-h' : 'twk-row'
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-lbl"
  }, /*#__PURE__*/React.createElement("span", null, label), value != null && /*#__PURE__*/React.createElement("span", {
    className: "twk-val"
  }, value)), children);
}

// ── Controls ────────────────────────────────────────────────────────────────

function TweakSlider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label,
    value: `${value}${unit}`
  }, /*#__PURE__*/React.createElement("input", {
    type: "range",
    className: "twk-slider",
    min: min,
    max: max,
    step: step,
    value: value,
    onChange: e => onChange(Number(e.target.value))
  }));
}
function TweakToggle({
  label,
  value,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "twk-row twk-row-h"
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-lbl"
  }, /*#__PURE__*/React.createElement("span", null, label)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "twk-toggle",
    "data-on": value ? '1' : '0',
    role: "switch",
    "aria-checked": !!value,
    onClick: () => onChange(!value)
  }, /*#__PURE__*/React.createElement("i", null)));
}
function TweakRadio({
  label,
  value,
  options,
  onChange
}) {
  const trackRef = React.useRef(null);
  const [dragging, setDragging] = React.useState(false);
  // The active value is read by pointer-move handlers attached for the lifetime
  // of a drag — ref it so a stale closure doesn't fire onChange for every move.
  const valueRef = React.useRef(value);
  valueRef.current = value;

  // Segments wrap mid-word once per-segment width runs out. The track is
  // ~248px (280 panel − 28 body pad − 4 seg pad), each button loses 12px
  // to its own padding, and 11.5px system-ui averages ~6.3px/char — so 2
  // options fit ~16 chars each, 3 fit ~10. Past that (or >3 options), fall
  // back to a dropdown rather than wrap.
  const labelLen = o => String(typeof o === 'object' ? o.label : o).length;
  const maxLen = options.reduce((m, o) => Math.max(m, labelLen(o)), 0);
  const fitsAsSegments = maxLen <= ({
    2: 16,
    3: 10
  }[options.length] ?? 0);
  if (!fitsAsSegments) {
    // <select> emits strings — map back to the original option value so the
    // fallback stays type-preserving (numbers, booleans) like the segment path.
    const resolve = s => {
      const m = options.find(o => String(typeof o === 'object' ? o.value : o) === s);
      return m === undefined ? s : typeof m === 'object' ? m.value : m;
    };
    return /*#__PURE__*/React.createElement(TweakSelect, {
      label: label,
      value: value,
      options: options,
      onChange: s => onChange(resolve(s))
    });
  }
  const opts = options.map(o => typeof o === 'object' ? o : {
    value: o,
    label: o
  });
  const idx = Math.max(0, opts.findIndex(o => o.value === value));
  const n = opts.length;
  const segAt = clientX => {
    const r = trackRef.current.getBoundingClientRect();
    const inner = r.width - 4;
    const i = Math.floor((clientX - r.left - 2) / inner * n);
    return opts[Math.max(0, Math.min(n - 1, i))].value;
  };
  const onPointerDown = e => {
    setDragging(true);
    const v0 = segAt(e.clientX);
    if (v0 !== valueRef.current) onChange(v0);
    const move = ev => {
      if (!trackRef.current) return;
      const v = segAt(ev.clientX);
      if (v !== valueRef.current) onChange(v);
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("div", {
    ref: trackRef,
    role: "radiogroup",
    onPointerDown: onPointerDown,
    className: dragging ? 'twk-seg dragging' : 'twk-seg'
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-seg-thumb",
    style: {
      left: `calc(2px + ${idx} * (100% - 4px) / ${n})`,
      width: `calc((100% - 4px) / ${n})`
    }
  }), opts.map(o => /*#__PURE__*/React.createElement("button", {
    key: o.value,
    type: "button",
    role: "radio",
    "aria-checked": o.value === value
  }, o.label))));
}
function TweakSelect({
  label,
  value,
  options,
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("select", {
    className: "twk-field",
    value: value,
    onChange: e => onChange(e.target.value)
  }, options.map(o => {
    const v = typeof o === 'object' ? o.value : o;
    const l = typeof o === 'object' ? o.label : o;
    return /*#__PURE__*/React.createElement("option", {
      key: v,
      value: v
    }, l);
  })));
}
function TweakText({
  label,
  value,
  placeholder,
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("input", {
    className: "twk-field",
    type: "text",
    value: value,
    placeholder: placeholder,
    onChange: e => onChange(e.target.value)
  }));
}
function TweakNumber({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange
}) {
  const clamp = n => {
    if (min != null && n < min) return min;
    if (max != null && n > max) return max;
    return n;
  };
  const startRef = React.useRef({
    x: 0,
    val: 0
  });
  const onScrubStart = e => {
    e.preventDefault();
    startRef.current = {
      x: e.clientX,
      val: value
    };
    const decimals = (String(step).split('.')[1] || '').length;
    const move = ev => {
      const dx = ev.clientX - startRef.current.x;
      const raw = startRef.current.val + dx * step;
      const snapped = Math.round(raw / step) * step;
      onChange(clamp(Number(snapped.toFixed(decimals))));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "twk-num"
  }, /*#__PURE__*/React.createElement("span", {
    className: "twk-num-lbl",
    onPointerDown: onScrubStart
  }, label), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: value,
    min: min,
    max: max,
    step: step,
    onChange: e => onChange(clamp(Number(e.target.value)))
  }), unit && /*#__PURE__*/React.createElement("span", {
    className: "twk-num-unit"
  }, unit));
}

// Relative-luminance contrast pick — checkmarks drawn over a swatch need to
// read on both #111 and #fafafa without per-option configuration. Hex input
// only (#rgb / #rrggbb); named or rgb()/hsl() colors fall through to "light".
function __twkIsLight(hex) {
  const h = String(hex).replace('#', '');
  const x = h.length === 3 ? h.replace(/./g, c => c + c) : h.padEnd(6, '0');
  const n = parseInt(x.slice(0, 6), 16);
  if (Number.isNaN(n)) return true;
  const r = n >> 16 & 255,
    g = n >> 8 & 255,
    b = n & 255;
  return r * 299 + g * 587 + b * 114 > 148000;
}
const __TwkCheck = ({
  light
}) => /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 14 14",
  "aria-hidden": "true"
}, /*#__PURE__*/React.createElement("path", {
  d: "M3 7.2 5.8 10 11 4.2",
  fill: "none",
  strokeWidth: "2.2",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  stroke: light ? 'rgba(0,0,0,.78)' : '#fff'
}));

// TweakColor — curated color/palette picker. Each option is either a single
// hex string or an array of 1-5 hex strings; the card adapts — a lone color
// renders solid, a palette renders colors[0] as the hero (left ~2/3) with the
// rest stacked in a sharp column on the right. onChange emits the
// option in the shape it was passed (string stays string, array stays array).
// Without options it falls back to the native color input for back-compat.
function TweakColor({
  label,
  value,
  options,
  onChange
}) {
  if (!options || !options.length) {
    return /*#__PURE__*/React.createElement("div", {
      className: "twk-row twk-row-h"
    }, /*#__PURE__*/React.createElement("div", {
      className: "twk-lbl"
    }, /*#__PURE__*/React.createElement("span", null, label)), /*#__PURE__*/React.createElement("input", {
      type: "color",
      className: "twk-swatch",
      value: value,
      onChange: e => onChange(e.target.value)
    }));
  }
  // Native <input type=color> emits lowercase hex per the HTML spec, so
  // compare case-insensitively. String() guards JSON.stringify(undefined),
  // which returns the primitive undefined (no .toLowerCase).
  const key = o => String(JSON.stringify(o)).toLowerCase();
  const cur = key(value);
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-chips",
    role: "radiogroup"
  }, options.map((o, i) => {
    const colors = Array.isArray(o) ? o : [o];
    const [hero, ...rest] = colors;
    const sup = rest.slice(0, 4);
    const on = key(o) === cur;
    return /*#__PURE__*/React.createElement("button", {
      key: i,
      type: "button",
      className: "twk-chip",
      role: "radio",
      "aria-checked": on,
      "data-on": on ? '1' : '0',
      "aria-label": colors.join(', '),
      title: colors.join(' · '),
      style: {
        background: hero
      },
      onClick: () => onChange(o)
    }, sup.length > 0 && /*#__PURE__*/React.createElement("span", null, sup.map((c, j) => /*#__PURE__*/React.createElement("i", {
      key: j,
      style: {
        background: c
      }
    }))), on && /*#__PURE__*/React.createElement(__TwkCheck, {
      light: __twkIsLight(hero)
    }));
  })));
}
function TweakButton({
  label,
  onClick,
  secondary = false
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: secondary ? 'twk-btn secondary' : 'twk-btn',
    onClick: onClick
  }, label);
}
Object.assign(window, {
  useTweaks,
  TweaksPanel,
  TweakSection,
  TweakRow,
  TweakSlider,
  TweakToggle,
  TweakRadio,
  TweakSelect,
  TweakText,
  TweakNumber,
  TweakColor,
  TweakButton
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/resident/tweaks-panel.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/chrome.jsx
try { (() => {
/* Living — Website UI kit: shared chrome (Nav + Footer) */
const {
  Button,
  IconButton
} = window.LivingDesignSystem_bba765;
function Wordmark({
  light
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 9
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: light ? "../../assets/living-mark-light.svg" : "../../assets/living-mark.svg",
    width: "26",
    height: "26",
    alt: "",
    style: {
      display: "block"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 500,
      fontSize: "1.65rem",
      letterSpacing: "-0.02em",
      lineHeight: 1,
      color: light ? "var(--stone-50)" : "var(--text-strong)"
    }
  }, "Living", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--brand-accent)"
    }
  }, ".")));
}
function SiteNav({
  route,
  go
}) {
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const el = document.querySelector("#site-scroll");
    if (!el) return;
    const on = () => setScrolled(el.scrollTop > 12);
    el.addEventListener("scroll", on);
    return () => el.removeEventListener("scroll", on);
  }, []);
  const links = ["Buy", "Rent", "Communities", "Services", "About"];
  // Only float transparent-over-photo on the home hero, before scrolling.
  // Everywhere else (scrolled, or any non-hero route) gets a readable glass bar.
  const overHero = route === "home" && !scrolled;
  const fg = overHero ? "var(--stone-50)" : "var(--text-body)";
  const fgStrong = overHero ? "var(--stone-50)" : "var(--text-strong)";
  return /*#__PURE__*/React.createElement("header", {
    style: {
      position: "sticky",
      top: 0,
      zIndex: 50,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "16px clamp(20px, 5vw, 64px)",
      background: overHero ? "transparent" : "var(--surface-glass)",
      backdropFilter: overHero ? "none" : "blur(16px) saturate(1.4)",
      WebkitBackdropFilter: overHero ? "none" : "blur(16px) saturate(1.4)",
      borderBottom: overHero ? "1px solid transparent" : "1px solid var(--border-subtle)",
      transition: "background .25s ease, border-color .25s ease"
    }
  }, /*#__PURE__*/React.createElement("style", null, `
        .nav-link { position: relative; text-decoration: none; padding-bottom: 3px; transition: color .2s ease; }
        .nav-link::after { content: ""; position: absolute; left: 0; right: 100%; bottom: -1px; height: 1.5px; background: currentColor; transition: right .25s cubic-bezier(.16,.8,.24,1); }
        .nav-link:hover::after { right: 0; }
      `), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 40
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      go("home");
    },
    style: {
      textDecoration: "none"
    }
  }, /*#__PURE__*/React.createElement(Wordmark, {
    light: overHero
  })), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: "flex",
      gap: 26
    }
  }, links.map(l => /*#__PURE__*/React.createElement("a", {
    key: l,
    className: "nav-link",
    href: "#",
    onClick: e => {
      e.preventDefault();
      go(l === "Buy" ? "home" : "home");
    },
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: "0.95rem",
      fontWeight: 500,
      color: fg
    }
  }, l)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => e.preventDefault(),
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: "0.95rem",
      fontWeight: 500,
      color: fg,
      whiteSpace: "nowrap"
    }
  }, "Sign in"), overHero ? /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "sm",
    style: {
      background: "rgba(255,255,255,0.16)",
      color: "var(--stone-50)",
      borderColor: "rgba(255,255,255,0.45)"
    }
  }, "List your home") : /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "sm"
  }, "List your home")));
}
function SiteFooter() {
  const cols = {
    Explore: ["Buy a home", "Rent a home", "New communities", "NRI services"],
    Platform: ["Community app", "Facility management", "Marketplace", "Analytics"],
    Company: ["About Living", "Careers", "Press", "Contact"]
  };
  return /*#__PURE__*/React.createElement("footer", {
    style: {
      background: "var(--pine-800)",
      color: "var(--stone-200)",
      padding: "72px clamp(20px,5vw,64px) 40px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1.4fr 1fr 1fr 1fr",
      gap: 40,
      maxWidth: 1320,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Wordmark, {
    light: true
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: "1.5rem",
      lineHeight: 1.2,
      color: "var(--stone-50)",
      maxWidth: 260,
      margin: 0
    }
  }, "Life Happens Here."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: "0.9rem",
      color: "var(--pine-200)",
      maxWidth: 280
    }
  }, "One premium ecosystem for buying, renting, living and managing a home.")), Object.entries(cols).map(([head, items]) => /*#__PURE__*/React.createElement("div", {
    key: head,
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "0.7rem",
      fontWeight: 600,
      letterSpacing: "0.16em",
      textTransform: "uppercase",
      color: "var(--pine-300)"
    }
  }, head), items.map(i => /*#__PURE__*/React.createElement("a", {
    key: i,
    href: "#",
    onClick: e => e.preventDefault(),
    style: {
      fontSize: "0.92rem",
      color: "var(--stone-200)",
      textDecoration: "none"
    }
  }, i))))), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1320,
      margin: "48px auto 0",
      paddingTop: 24,
      borderTop: "1px solid rgba(255,255,255,0.12)",
      display: "flex",
      justifyContent: "space-between",
      fontSize: "0.82rem",
      color: "var(--pine-200)"
    }
  }, /*#__PURE__*/React.createElement("span", null, "\xA9 2026 Living. All rights reserved."), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => e.preventDefault(),
    style: {
      color: "var(--pine-200)"
    }
  }, "Privacy"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => e.preventDefault(),
    style: {
      color: "var(--pine-200)"
    }
  }, "Terms"))));
}
Object.assign(window, {
  Wordmark,
  SiteNav,
  SiteFooter
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/chrome.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/detail.jsx
try { (() => {
/* Living — Website UI kit: Property detail page */
const {
  Button,
  Badge,
  Tag,
  Card,
  Avatar,
  Input
} = window.LivingDesignSystem_bba765;
function PropertyDetail({
  home,
  back
}) {
  const h = home || window.HOMES[0];
  const gallery = [h.image, "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=900&q=80&auto=format&fit=crop", "https://images.unsplash.com/photo-1600489000022-c2086d79f9d4?w=900&q=80&auto=format&fit=crop", "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=900&q=80&auto=format&fit=crop"];
  const amenities = ["Clubhouse", "Infinity pool", "Landscaped gardens", "24/7 concierge", "EV charging", "Yoga deck", "Co-working lounge", "Pet park"];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1320,
      margin: "0 auto",
      padding: "28px clamp(20px,5vw,64px) 88px"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: back,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      background: "transparent",
      border: "none",
      cursor: "pointer",
      fontFamily: "var(--font-sans)",
      fontSize: "0.95rem",
      fontWeight: 500,
      color: "var(--text-muted)",
      padding: 0,
      marginBottom: 20
    }
  }, "\u2190 Back to homes"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "2fr 1fr 1fr",
      gridTemplateRows: "1fr 1fr",
      gap: 12,
      height: 460,
      marginBottom: 40
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      gridRow: "1 / 3",
      borderRadius: "var(--radius-xl)",
      overflow: "hidden",
      background: `url(${gallery[0]}) center/cover`
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: "var(--radius-lg)",
      overflow: "hidden",
      background: `url(${gallery[1]}) center/cover`
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: "var(--radius-lg)",
      overflow: "hidden",
      background: `url(${gallery[2]}) center/cover`
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      gridColumn: "2 / 4",
      borderRadius: "var(--radius-lg)",
      overflow: "hidden",
      background: `url(${gallery[3]}) center/cover`,
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: "rgba(20,17,15,0.35)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "var(--stone-50)",
      fontFamily: "var(--font-sans)",
      fontWeight: 600
    }
  }, "+ 18 photos"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 380px",
      gap: 48,
      alignItems: "start"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: h.statusTone,
    dot: true
  }, h.status), /*#__PURE__*/React.createElement(Badge, {
    tone: "neutral"
  }, "RERA registered")), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 400,
      fontSize: "3rem",
      lineHeight: 1.03,
      letterSpacing: "-0.02em",
      color: "var(--text-strong)",
      margin: 0
    }
  }, h.title), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      color: "var(--text-muted)",
      fontSize: "1.05rem",
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("span", null, "\u25CE"), h.location), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 40,
      padding: "28px 0",
      margin: "28px 0",
      borderTop: "1px solid var(--border-subtle)",
      borderBottom: "1px solid var(--border-subtle)"
    }
  }, [["Bedrooms", h.beds], ["Bathrooms", h.baths], ["Carpet area", h.area], ["Facing", "East"]].map(([l, v]) => /*#__PURE__*/React.createElement("div", {
    key: l
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontWeight: 600,
      fontSize: "1.35rem",
      color: "var(--text-strong)"
    }
  }, v), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "0.82rem",
      color: "var(--text-subtle)",
      letterSpacing: "0.02em",
      marginTop: 3
    }
  }, l)))), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: "1.35rem",
      fontFamily: "var(--font-display)",
      fontWeight: 500,
      color: "var(--text-strong)",
      marginBottom: 12
    }
  }, "About this home"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: "1.05rem",
      lineHeight: 1.7,
      color: "var(--text-body)",
      marginBottom: 12
    }
  }, "A calm, light-filled residence in one of the city's most considered communities. Floor-to-ceiling glass opens onto a private balcony overlooking landscaped gardens, while warm oak floors and stone finishes carry through every room."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: "1.05rem",
      lineHeight: 1.7,
      color: "var(--text-body)"
    }
  }, "Residents enjoy a full suite of Living amenities and the ease of the Living app \u2014 bookings, payments and services, all in one place."), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: "1.35rem",
      fontFamily: "var(--font-display)",
      fontWeight: 500,
      color: "var(--text-strong)",
      margin: "36px 0 16px"
    }
  }, "Amenities"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 10
    }
  }, amenities.map(a => /*#__PURE__*/React.createElement(Tag, {
    key: a,
    icon: /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13
      }
    }, "\u25E6")
  }, a)))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "sticky",
      top: 100
    }
  }, /*#__PURE__*/React.createElement(Card, {
    variant: "elevated",
    padding: "lg"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: 8,
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontWeight: 700,
      fontSize: "2rem",
      color: "var(--text-strong)"
    }
  }, h.price), h.period ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-muted)"
    }
  }, h.period) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "0.9rem",
      color: "var(--text-subtle)",
      marginBottom: 20
    }
  }, "Est. \u20B91.4L EMI \xB7 Includes clubhouse"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Input, {
    label: "Preferred date",
    defaultValue: "Sat, 12 Jul \xB7 11:00 AM"
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "lg",
    fullWidth: true
  }, "Book a private tour"), /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    size: "lg",
    fullWidth: true
  }, "Request details")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      marginTop: 20,
      paddingTop: 20,
      borderTop: "1px solid var(--border-subtle)"
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: "Anaya Rao",
    status: "online"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "0.92rem",
      fontWeight: 600,
      color: "var(--text-strong)"
    }
  }, "Anaya Rao"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "0.82rem",
      color: "var(--text-muted)"
    }
  }, "Your Living advisor")))))));
}
Object.assign(window, {
  PropertyDetail
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/detail.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/home.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Living — Website UI kit: Home page */
const {
  Button,
  PropertyCard,
  Tag,
  Badge,
  Card
} = window.LivingDesignSystem_bba765;

// Respect reduced-motion; otherwise reveal content on scroll with a soft rise + fade.
const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function useInView(threshold = 0.18) {
  const reduced = prefersReducedMotion();
  const ref = React.useRef(null);
  const [inView, setInView] = React.useState(reduced);
  React.useEffect(() => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        io.disconnect();
      }
    }, {
      threshold
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, inView];
}
function Reveal({
  children,
  delay = 0,
  y = 22,
  as: Tag = "div",
  style
}) {
  const [ref, inView] = useInView();
  return /*#__PURE__*/React.createElement(Tag, {
    ref: ref,
    style: {
      opacity: inView ? 1 : 0,
      transform: inView ? "translateY(0)" : `translateY(${y}px)`,
      transition: `opacity .7s cubic-bezier(.16,.8,.24,1) ${delay}s, transform .7s cubic-bezier(.16,.8,.24,1) ${delay}s`,
      ...style
    }
  }, children);
}
const HOMES = [{
  id: 1,
  image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&q=80&auto=format&fit=crop",
  title: "Riverside Greens",
  location: "Whitefield, Bengaluru",
  status: "Available",
  statusTone: "success",
  beds: 3,
  baths: 2,
  area: "1,840 sqft",
  price: "₹1.85 Cr"
}, {
  id: 2,
  image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=900&q=80&auto=format&fit=crop",
  title: "The Meadows Penthouse",
  location: "Koramangala, Bengaluru",
  status: "New",
  statusTone: "brand",
  beds: 4,
  baths: 4,
  area: "3,200 sqft",
  price: "₹4.20 Cr"
}, {
  id: 3,
  image: "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=900&q=80&auto=format&fit=crop",
  title: "Highgrove Studio",
  location: "Indiranagar, Bengaluru",
  status: "Pending",
  statusTone: "warning",
  beds: 1,
  baths: 1,
  area: "640 sqft",
  price: "₹85,000",
  period: "/month"
}, {
  id: 4,
  image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=900&q=80&auto=format&fit=crop",
  title: "Amber Court Villa",
  location: "Sarjapur, Bengaluru",
  status: "Available",
  statusTone: "success",
  beds: 4,
  baths: 5,
  area: "4,100 sqft",
  price: "₹6.75 Cr"
}, {
  id: 5,
  image: "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=900&q=80&auto=format&fit=crop",
  title: "The Linden Residences",
  location: "Hebbal, Bengaluru",
  status: "Available",
  statusTone: "success",
  beds: 3,
  baths: 3,
  area: "2,050 sqft",
  price: "₹2.40 Cr"
}, {
  id: 6,
  image: "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=900&q=80&auto=format&fit=crop",
  title: "Cedar Loft",
  location: "HSR Layout, Bengaluru",
  status: "New",
  statusTone: "brand",
  beds: 2,
  baths: 2,
  area: "1,180 sqft",
  price: "₹1.20 Cr"
}];
function Hero({
  openDetail
}) {
  const reduced = prefersReducedMotion();
  const [loaded, setLoaded] = React.useState(reduced);
  React.useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => setLoaded(true), 80);
    return () => clearTimeout(t);
  }, []);
  const rise = delay => ({
    opacity: loaded ? 1 : 0,
    transform: loaded ? "translateY(0)" : "translateY(20px)",
    transition: `opacity .8s cubic-bezier(.16,.8,.24,1) ${delay}s, transform .8s cubic-bezier(.16,.8,.24,1) ${delay}s`
  });
  return /*#__PURE__*/React.createElement("section", {
    style: {
      position: "relative",
      minHeight: 640,
      display: "flex",
      alignItems: "flex-end",
      marginTop: -84,
      paddingTop: 84,
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: "url('https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=1800&q=80&auto=format&fit=crop') center/cover",
      transform: loaded ? "scale(1)" : "scale(1.08)",
      transition: "transform 5s cubic-bezier(.16,.8,.24,1)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 170,
      background: "linear-gradient(to bottom, rgba(15,33,26,0.55), rgba(15,33,26,0))"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: "linear-gradient(to top, rgba(15,33,26,0.72) 0%, rgba(15,33,26,0.15) 45%, rgba(15,33,26,0.25) 100%)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: "100%",
      maxWidth: 1320,
      margin: "0 auto",
      padding: "0 clamp(20px,5vw,64px) 64px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 640
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "0.72rem",
      fontWeight: 600,
      letterSpacing: "0.16em",
      textTransform: "uppercase",
      color: "var(--clay-200)",
      marginBottom: 16,
      ...rise(0)
    }
  }, "Premium homes \xB7"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 400,
      fontSize: "clamp(3rem, 6vw, 5rem)",
      lineHeight: 1.02,
      letterSpacing: "-0.02em",
      color: "var(--stone-50)",
      margin: 0,
      ...rise(0.08)
    }
  }, "Life Happens Here."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: "1.15rem",
      lineHeight: 1.6,
      color: "rgba(250,248,244,0.9)",
      maxWidth: 480,
      marginTop: 20,
      ...rise(0.16)
    }
  }, "Discover considered homes in the city's most liveable communities \u2014 and everything that comes after you move in.")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 36,
      background: "var(--surface-glass)",
      backdropFilter: "blur(18px) saturate(1.4)",
      WebkitBackdropFilter: "blur(18px) saturate(1.4)",
      border: "1px solid rgba(255,255,255,0.4)",
      borderRadius: "var(--radius-xl)",
      boxShadow: "var(--shadow-lg)",
      padding: 10,
      display: "flex",
      alignItems: "center",
      gap: 8,
      maxWidth: 760,
      ...rise(0.26)
    }
  }, [["Location", "Bengaluru"], ["Type", "Buy · Apartment"], ["Budget", "Up to ₹3 Cr"]].map(([k, v], i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: k
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      padding: "8px 14px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "0.68rem",
      fontWeight: 600,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: "var(--text-subtle)"
    }
  }, k), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "0.98rem",
      fontWeight: 500,
      color: "var(--text-strong)",
      marginTop: 2
    }
  }, v)), i < 2 ? /*#__PURE__*/React.createElement("div", {
    style: {
      width: 1,
      height: 34,
      background: "var(--border-default)"
    }
  }) : null)), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "lg",
    onClick: () => openDetail(HOMES[0])
  }, "Search"))));
}
function StatStrip() {
  const stats = [["12,400+", "Homes listed"], ["68", "Communities"], ["9,200", "Families living"], ["4.9★", "Resident rating"]];
  return /*#__PURE__*/React.createElement("section", {
    style: {
      background: "var(--surface-card)",
      borderBottom: "1px solid var(--border-subtle)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1320,
      margin: "0 auto",
      padding: "40px clamp(20px,5vw,64px)",
      display: "grid",
      gridTemplateColumns: "repeat(4,1fr)",
      gap: 24
    }
  }, stats.map(([n, l], i) => /*#__PURE__*/React.createElement(Reveal, {
    key: l,
    delay: i * 0.08,
    y: 14,
    style: {
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 500,
      fontSize: "2.75rem",
      lineHeight: 1,
      color: "var(--text-strong)"
    }
  }, n), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "0.9rem",
      color: "var(--text-muted)",
      marginTop: 6
    }
  }, l)))));
}
function FeaturedListings({
  openDetail
}) {
  const [filter, setFilter] = React.useState("All");
  const filters = ["All", "Apartments", "Villas", "New", "Rentals"];
  return /*#__PURE__*/React.createElement("section", {
    style: {
      maxWidth: 1320,
      margin: "0 auto",
      padding: "88px clamp(20px,5vw,64px)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: 24,
      flexWrap: "wrap",
      marginBottom: 32
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow",
    style: {
      marginBottom: 10
    }
  }, "Curated for you"), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 400,
      fontSize: "2.75rem",
      lineHeight: 1.05,
      letterSpacing: "-0.015em",
      color: "var(--text-strong)",
      margin: 0
    }
  }, "Featured residences")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, filters.map(f => /*#__PURE__*/React.createElement(Tag, {
    key: f,
    selected: filter === f,
    onClick: () => setFilter(f)
  }, f)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 28
    }
  }, HOMES.map((h, i) => /*#__PURE__*/React.createElement(Reveal, {
    key: h.id,
    delay: i % 3 * 0.1
  }, /*#__PURE__*/React.createElement(PropertyCard, _extends({}, h, {
    onClick: () => openDetail(h)
  }))))));
}
function EcosystemBand() {
  const items = [["Property Sales", "Buy and sell with editorial listings and honest guidance."], ["Community Living", "A calm app for residents — payments, bookings, notices."], ["Home Services", "Vetted vendors for everything a home needs."], ["Facility Management", "Owners and managers, one refined dashboard."]];
  return /*#__PURE__*/React.createElement("section", {
    style: {
      background: "var(--surface-tint)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1320,
      margin: "0 auto",
      padding: "88px clamp(20px,5vw,64px)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 620,
      marginBottom: 44
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow",
    style: {
      marginBottom: 10
    }
  }, "One ecosystem"), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 400,
      fontSize: "2.75rem",
      lineHeight: 1.05,
      letterSpacing: "-0.015em",
      color: "var(--text-strong)",
      margin: 0
    }
  }, "Everything a home needs, in one place.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(4,1fr)",
      gap: 20
    }
  }, items.map(([t, d], i) => /*#__PURE__*/React.createElement(Reveal, {
    key: t,
    delay: i * 0.09
  }, /*#__PURE__*/React.createElement(Card, {
    variant: "elevated",
    interactive: true
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: "1.4rem",
      color: "var(--brand-accent)",
      marginBottom: 12
    }
  }, "0", i + 1), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: "1.1rem",
      fontWeight: 600,
      color: "var(--text-strong)",
      marginBottom: 8
    }
  }, t), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: "0.92rem",
      color: "var(--text-muted)",
      lineHeight: 1.55,
      margin: 0
    }
  }, d)))))));
}
function CTABand() {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      maxWidth: 1320,
      margin: "0 auto",
      padding: "0 clamp(20px,5vw,64px) 88px"
    }
  }, /*#__PURE__*/React.createElement(Reveal, {
    y: 30
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      overflow: "hidden",
      borderRadius: "var(--radius-2xl)",
      padding: "72px 56px",
      background: "url('https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1600&q=80&auto=format&fit=crop') center/cover"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: "linear-gradient(120deg, rgba(21,46,36,0.86), rgba(21,46,36,0.35))"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      maxWidth: 520
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 400,
      fontSize: "3rem",
      lineHeight: 1.05,
      color: "var(--stone-50)",
      margin: 0
    }
  }, "Ready to find where life happens?"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: "1.1rem",
      color: "rgba(250,248,244,0.88)",
      marginTop: 16,
      marginBottom: 28
    }
  }, "Talk to a Living advisor, or start browsing homes tonight."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "accent",
    size: "lg"
  }, "Book a consultation"), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "lg",
    style: {
      background: "rgba(255,255,255,0.14)",
      color: "var(--stone-50)",
      borderColor: "rgba(255,255,255,0.4)"
    }
  }, "Browse homes"))))));
}
function HomePage({
  openDetail
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Hero, {
    openDetail: openDetail
  }), /*#__PURE__*/React.createElement(StatStrip, null), /*#__PURE__*/React.createElement(FeaturedListings, {
    openDetail: openDetail
  }), /*#__PURE__*/React.createElement(EcosystemBand, null), /*#__PURE__*/React.createElement(CTABand, null));
}
Object.assign(window, {
  HomePage,
  HOMES
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/home.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.StatCard = __ds_scope.StatCard;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.EmptyState = __ds_scope.EmptyState;

__ds_ns.Tooltip = __ds_scope.Tooltip;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.SidebarNav = __ds_scope.SidebarNav;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.PropertyCard = __ds_scope.PropertyCard;

})();

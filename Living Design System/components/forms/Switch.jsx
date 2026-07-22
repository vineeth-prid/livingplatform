import React from "react";

/**
 * Living — Switch
 * Soft toggle for settings. Pine track when on. Gentle knob glide.
 */
export function Switch({
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

  const dims = size === "sm" ? { w: 38, h: 22, k: 16 } : { w: 46, h: 26, k: 20 };

  const toggle = (e) => {
    if (disabled) return;
    if (!isControlled) setInternal(e.target.checked);
    onChange && onChange(e);
  };

  return (
    <label htmlFor={switchId} style={{
      display: "inline-flex", alignItems: "center", gap: 12,
      cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? "var(--opacity-disabled)" : 1, ...style,
    }}>
      <input id={switchId} type="checkbox" checked={on} disabled={disabled} onChange={toggle}
        style={{ position: "absolute", opacity: 0, width: 1, height: 1 }} {...rest} />
      <span aria-hidden style={{
        position: "relative", flexShrink: 0, width: dims.w, height: dims.h,
        borderRadius: "var(--radius-pill)",
        background: on ? "var(--brand-primary)" : "var(--stone-300)",
        transition: "background-color var(--duration-base) var(--ease-standard)",
      }}>
        <span style={{
          position: "absolute", top: (dims.h - dims.k) / 2,
          left: on ? dims.w - dims.k - (dims.h - dims.k) / 2 : (dims.h - dims.k) / 2,
          width: dims.k, height: dims.k, borderRadius: "var(--radius-full)",
          background: "#fff", boxShadow: "var(--shadow-sm)",
          transition: "left var(--duration-base) var(--ease-settle)",
        }} />
      </span>
      {label ? <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-base)", color: "var(--text-strong)" }}>{label}</span> : null}
    </label>
  );
}

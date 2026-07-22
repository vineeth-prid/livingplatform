import React from "react";
import { Badge } from "../display/Badge.jsx";
import { IconButton } from "../forms/IconButton.jsx";

/**
 * Living — PropertyCard
 * The signature listing card: large editorial photography, restrained
 * meta, a favourite affordance, and a calm hover lift.
 */
export function PropertyCard({
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

  const specs = [
    beds != null ? { label: "Beds", value: beds } : null,
    baths != null ? { label: "Baths", value: baths } : null,
    area != null ? { label: "Area", value: area } : null,
  ].filter(Boolean);

  return (
    <article
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", flexDirection: "column",
        background: "var(--surface-card)", borderRadius: "var(--radius-card)",
        border: "1px solid var(--border-subtle)", overflow: "hidden",
        boxShadow: hover ? "var(--shadow-lg)" : "var(--shadow-sm)",
        transform: hover ? "translateY(-4px)" : "none",
        transition: "var(--transition-transform), var(--transition-shadow)",
        cursor: onClick ? "pointer" : "default", ...style,
      }}
      {...rest}
    >
      <div style={{ position: "relative", aspectRatio: "4 / 3", overflow: "hidden" }}>
        <div style={{
          position: "absolute", inset: 0,
          background: image
            ? `url(${image}) center/cover no-repeat`
            : "linear-gradient(135deg, var(--pine-400), var(--pine-700))",
          transform: hover ? "scale(1.05)" : "scale(1)",
          transition: "transform var(--duration-slow) var(--ease-out)",
        }} />
        {/* top protection gradient for legibility of overlay chips */}
        <div style={{
          position: "absolute", inset: "0 0 auto 0", height: 88,
          background: "linear-gradient(to bottom, rgba(20,17,15,0.34), transparent)",
        }} />
        <div style={{ position: "absolute", top: 14, left: 14 }}>
          {status ? <Badge tone={statusTone} variant="solid" dot>{status}</Badge> : null}
        </div>
        <div style={{ position: "absolute", top: 12, right: 12 }}>
          <IconButton
            aria-label={fav ? "Remove from favourites" : "Add to favourites"}
            variant="glass"
            onClick={(e) => { e.stopPropagation(); setFav(!fav); onFavourite && onFavourite(!fav); }}
            style={{
              background: "var(--surface-glass)", backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)", color: fav ? "var(--brand-accent)" : "var(--stone-700)",
            }}
          >{fav ? "♥" : "♡"}</IconButton>
        </div>
      </div>

      <div style={{ padding: "var(--space-5)", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h3 style={{
            fontFamily: "var(--font-display)", fontWeight: "var(--fw-medium)",
            fontSize: "1.5rem", lineHeight: 1.1, letterSpacing: "var(--tracking-tight)",
            color: "var(--text-strong)",
          }}>{title}</h3>
          {location ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
              <span aria-hidden style={{ fontSize: 13 }}>◎</span>{location}
            </span>
          ) : null}
        </div>

        {specs.length ? (
          <div style={{ display: "flex", gap: 18, paddingTop: 2, borderTop: "1px solid var(--border-subtle)", paddingBlock: "12px 0" }}>
            {specs.map((s) => (
              <div key={s.label} style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <span style={{ fontFamily: "var(--font-sans)", fontWeight: "var(--fw-semibold)", fontSize: "var(--text-base)", color: "var(--text-strong)" }}>{s.value}</span>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-subtle)", letterSpacing: "var(--tracking-wide)" }}>{s.label}</span>
              </div>
            ))}
          </div>
        ) : null}

        {price != null ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 2 }}>
            <span style={{ fontFamily: "var(--font-sans)", fontWeight: "var(--fw-bold)", fontSize: "1.25rem", color: "var(--text-strong)" }}>{price}</span>
            {period ? <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>{period}</span> : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

/* Living — Website UI kit: Property detail page */
const { Button, Badge, Tag, Card, Avatar, Input } = window.LivingDesignSystem_bba765;

function PropertyDetail({ home, back }) {
  const h = home || window.HOMES[0];
  const gallery = [
    h.image,
    "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=900&q=80&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1600489000022-c2086d79f9d4?w=900&q=80&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=900&q=80&auto=format&fit=crop",
  ];
  const amenities = ["Clubhouse", "Infinity pool", "Landscaped gardens", "24/7 concierge", "EV charging", "Yoga deck", "Co-working lounge", "Pet park"];

  return (
    <div style={{ maxWidth: 1320, margin: "0 auto", padding: "28px clamp(20px,5vw,64px) 88px" }}>
      <button onClick={back} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "transparent", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "0.95rem", fontWeight: 500, color: "var(--text-muted)", padding: 0, marginBottom: 20 }}>← Back to homes</button>

      {/* Gallery */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 12, height: 460, marginBottom: 40 }}>
        <div style={{ gridRow: "1 / 3", borderRadius: "var(--radius-xl)", overflow: "hidden", background: `url(${gallery[0]}) center/cover` }} />
        <div style={{ borderRadius: "var(--radius-lg)", overflow: "hidden", background: `url(${gallery[1]}) center/cover` }} />
        <div style={{ borderRadius: "var(--radius-lg)", overflow: "hidden", background: `url(${gallery[2]}) center/cover` }} />
        <div style={{ gridColumn: "2 / 4", borderRadius: "var(--radius-lg)", overflow: "hidden", background: `url(${gallery[3]}) center/cover`, position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(20,17,15,0.35)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--stone-50)", fontFamily: "var(--font-sans)", fontWeight: 600 }}>+ 18 photos</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 48, alignItems: "start" }}>
        {/* Left: content */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <Badge tone={h.statusTone} dot>{h.status}</Badge>
            <Badge tone="neutral">RERA registered</Badge>
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: "3rem", lineHeight: 1.03, letterSpacing: "-0.02em", color: "var(--text-strong)", margin: 0 }}>{h.title}</h1>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-muted)", fontSize: "1.05rem", marginTop: 10 }}><span>◎</span>{h.location}</div>

          <div style={{ display: "flex", gap: 40, padding: "28px 0", margin: "28px 0", borderTop: "1px solid var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)" }}>
            {[["Bedrooms", h.beds], ["Bathrooms", h.baths], ["Carpet area", h.area], ["Facing", "East"]].map(([l, v]) => (
              <div key={l}>
                <div style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "1.35rem", color: "var(--text-strong)" }}>{v}</div>
                <div style={{ fontSize: "0.82rem", color: "var(--text-subtle)", letterSpacing: "0.02em", marginTop: 3 }}>{l}</div>
              </div>
            ))}
          </div>

          <h3 style={{ fontSize: "1.35rem", fontFamily: "var(--font-display)", fontWeight: 500, color: "var(--text-strong)", marginBottom: 12 }}>About this home</h3>
          <p style={{ fontSize: "1.05rem", lineHeight: 1.7, color: "var(--text-body)", marginBottom: 12 }}>A calm, light-filled residence in one of the city's most considered communities. Floor-to-ceiling glass opens onto a private balcony overlooking landscaped gardens, while warm oak floors and stone finishes carry through every room.</p>
          <p style={{ fontSize: "1.05rem", lineHeight: 1.7, color: "var(--text-body)" }}>Residents enjoy a full suite of Living amenities and the ease of the Living app — bookings, payments and services, all in one place.</p>

          <h3 style={{ fontSize: "1.35rem", fontFamily: "var(--font-display)", fontWeight: 500, color: "var(--text-strong)", margin: "36px 0 16px" }}>Amenities</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {amenities.map((a) => <Tag key={a} icon={<span style={{ fontSize: 13 }}>◦</span>}>{a}</Tag>)}
          </div>
        </div>

        {/* Right: sticky booking card */}
        <div style={{ position: "sticky", top: 100 }}>
          <Card variant="elevated" padding="lg">
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
              <span style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "2rem", color: "var(--text-strong)" }}>{h.price}</span>
              {h.period ? <span style={{ color: "var(--text-muted)" }}>{h.period}</span> : null}
            </div>
            <div style={{ fontSize: "0.9rem", color: "var(--text-subtle)", marginBottom: 20 }}>Est. ₹1.4L EMI · Includes clubhouse</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Input label="Preferred date" defaultValue="Sat, 12 Jul · 11:00 AM" />
              <Button variant="primary" size="lg" fullWidth>Book a private tour</Button>
              <Button variant="outline" size="lg" fullWidth>Request details</Button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--border-subtle)" }}>
              <Avatar name="Anaya Rao" status="online" />
              <div>
                <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "var(--text-strong)" }}>Anaya Rao</div>
                <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>Your Living advisor</div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { PropertyDetail });

/* Living — Admin UI kit: Residents table view */
const { Card, Badge, Button, IconButton, Avatar, Tabs, Tag, Input } = window.LivingDesignSystem_bba765;

function Residents() {
  const rows = [
    ["Anaya Rao", "A-1204", "Owner", "success", "Current", "anaya@living.co"],
    ["Kabir Iyer", "B-0812", "Tenant", "success", "Current", "kabir@mail.co"],
    ["The Menon Family", "C-0803", "Owner", "warning", "₹18,400 due", "menon@mail.co"],
    ["Sara Fernandes", "A-0907", "Tenant", "success", "Current", "sara@mail.co"],
    ["Rohan Gupta", "D-1101", "Owner", "danger", "₹42,000 overdue", "rohan@mail.co"],
    ["Leela Nair", "B-0203", "Owner", "success", "Current", "leela@mail.co"],
  ];
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24, gap: 20, flexWrap: "wrap" }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Riverside Greens</div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: "2.5rem", letterSpacing: "-0.015em", color: "var(--text-strong)", margin: 0 }}>Residents</h1>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <Button variant="secondary" iconLeft={<span>⇪</span>}>Export</Button>
          <Button variant="primary" iconLeft={<span>＋</span>}>Add resident</Button>
        </div>
      </div>

      <Card variant="outline" padding="none">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <Tag selected>All · 248</Tag>
            <Tag>Owners · 156</Tag>
            <Tag>Tenants · 92</Tag>
            <Tag>Dues · 14</Tag>
          </div>
          <div style={{ position: "relative", width: 260 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-subtle)", fontSize: 14 }}>⌕</span>
            <input placeholder="Search residents" style={{ width: "100%", height: 38, padding: "0 12px 0 34px", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", background: "var(--surface-raised)", fontFamily: "var(--font-body)", fontSize: "0.9rem", color: "var(--text-strong)" }} />
          </div>
        </div>

        {/* table head */}
        <div style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr 1fr 1.4fr 0.6fr", gap: 16, padding: "12px 24px", background: "var(--surface-sunken)", fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-subtle)" }}>
          <span>Resident</span><span>Unit</span><span>Type</span><span>Billing</span><span></span>
        </div>
        {rows.map((r, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr 1fr 1.4fr 0.6fr", gap: 16, alignItems: "center", padding: "14px 24px", borderTop: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar name={r[0]} size="sm" />
              <div>
                <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-strong)" }}>{r[0]}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-subtle)" }}>{r[5]}</div>
              </div>
            </div>
            <span className="mono" style={{ fontSize: "0.9rem", color: "var(--text-body)" }}>{r[1]}</span>
            <span><Badge tone={r[2] === "Owner" ? "brand" : "neutral"} size="sm">{r[2]}</Badge></span>
            <span><Badge tone={r[3]} size="sm" dot>{r[4]}</Badge></span>
            <span style={{ textAlign: "right" }}><IconButton aria-label="Row actions" variant="ghost" size="sm">⋯</IconButton></span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px", borderTop: "1px solid var(--border-subtle)", fontSize: "0.85rem", color: "var(--text-muted)" }}>
          <span>Showing 6 of 248</span>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="ghost" size="sm">Previous</Button>
            <Button variant="secondary" size="sm">Next</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

Object.assign(window, { Residents });

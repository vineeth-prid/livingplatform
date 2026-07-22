/* Living — Admin UI kit: dashboard shell + overview */
const { SidebarNav, Tabs, StatCard, Card, Badge, Button, IconButton, Avatar, Input, Tag } = window.LivingDesignSystem_bba765;

function AdminShell({ children, route, setRoute }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "256px 1fr", height: "100vh", background: "var(--surface-page)" }}>
      {/* Sidebar */}
      <aside style={{ borderRight: "1px solid var(--border-subtle)", background: "var(--surface-card)", display: "flex", flexDirection: "column", padding: "20px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 8px 20px" }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: "1.5rem", letterSpacing: "-0.02em", color: "var(--text-strong)" }}>Living<span style={{ color: "var(--brand-accent)" }}>.</span></div>
          <Badge tone="brand" size="sm">Admin</Badge>
        </div>
        <div style={{ marginBottom: 12, padding: "0 4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--surface-sunken)", borderRadius: "var(--radius-md)", cursor: "pointer" }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--pine-600)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600 }}>RG</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--text-strong)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Riverside Greens</div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-subtle)" }}>248 residences</div>
            </div>
            <span style={{ color: "var(--text-subtle)", fontSize: 11 }}>▾</span>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          <SidebarNav value={route} onChange={setRoute} items={[
            { section: "Manage" },
            { value: "overview", label: "Overview", icon: <span>◈</span> },
            { value: "residents", label: "Residents", icon: <span>◎</span>, badge: 248 },
            { value: "tickets", label: "Tickets", icon: <span>✦</span>, badge: 12 },
            { value: "amenities", label: "Amenities", icon: <span>❖</span> },
            { section: "Operate" },
            { value: "vendors", label: "Vendors", icon: <span>◇</span> },
            { value: "billing", label: "Billing", icon: <span>▤</span> },
            { value: "analytics", label: "Analytics", icon: <span>◔</span> },
          ]} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 8px 4px", borderTop: "1px solid var(--border-subtle)", marginTop: 12 }}>
          <Avatar name="Dev Menon" status="online" size="sm" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-strong)" }}>Dev Menon</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-subtle)" }}>Facility Manager</div>
          </div>
          <IconButton aria-label="Settings" variant="ghost" size="sm">⚙</IconButton>
        </div>
      </aside>

      {/* Main */}
      <main style={{ overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, padding: "18px 32px", borderBottom: "1px solid var(--border-subtle)", background: "var(--surface-glass)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{ position: "relative", flex: 1, maxWidth: 380 }}>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-subtle)", fontSize: 15 }}>⌕</span>
            <input placeholder="Search residents, tickets, units…" style={{ width: "100%", height: 42, padding: "0 14px 0 38px", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", background: "var(--surface-raised)", fontFamily: "var(--font-body)", fontSize: "0.95rem", color: "var(--text-strong)" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <IconButton aria-label="Notifications" variant="soft">◔</IconButton>
            <Button variant="primary" size="sm" iconLeft={<span>＋</span>}>New notice</Button>
          </div>
        </header>
        <div style={{ padding: "32px", flex: 1 }}>{children}</div>
      </main>
    </div>
  );
}

function Sparkline({ color = "var(--brand-primary)" }) {
  const pts = [12, 18, 14, 22, 19, 26, 24, 30, 28, 34];
  const max = Math.max(...pts), min = Math.min(...pts);
  const d = pts.map((p, i) => `${(i / (pts.length - 1)) * 100},${28 - ((p - min) / (max - min)) * 24}`).join(" ");
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" style={{ width: "100%", height: 32 }}>
      <polyline points={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Overview() {
  const tickets = [
    ["Leaking tap · Unit A-1204", "Plumbing", "warning", "Anaya Rao"],
    ["Lift maintenance · Tower B", "Elevator", "info", "Vendor: OtisCare"],
    ["Noise complaint · C-0803", "Community", "neutral", "Dev Menon"],
    ["Gym AC not cooling", "HVAC", "danger", "Unassigned"],
  ];
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Riverside Greens · This month</div>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: "2.5rem", letterSpacing: "-0.015em", color: "var(--text-strong)", margin: 0 }}>Good morning, Dev.</h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20, marginBottom: 24 }}>
        <StatCard label="Occupancy" value="94.2%" delta="2.1%" trend="up" icon={<span>◈</span>}><Sparkline /></StatCard>
        <StatCard label="Dues collected" value="₹38.4L" delta="6.4%" trend="up" icon={<span>▤</span>}><Sparkline color="var(--green-500)" /></StatCard>
        <StatCard label="Open tickets" value="12" delta="4" trend="down" icon={<span>✦</span>}><Sparkline color="var(--clay-500)" /></StatCard>
        <StatCard label="Avg. resolution" value="6.2h" delta="0.8h" trend="down" icon={<span>◔</span>}><Sparkline color="var(--blue-500)" /></StatCard>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 20 }}>
        <Card variant="outline" padding="none">
          <div style={{ padding: "20px 24px 0" }}>
            <Tabs defaultValue="open" items={[{ value: "open", label: "Open tickets", count: 12 }, { value: "progress", label: "In progress", count: 5 }, { value: "closed", label: "Resolved" }]} />
          </div>
          <div>
            {tickets.map(([t, cat, tone, who], i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 24px", borderTop: i ? "1px solid var(--border-subtle)" : "none" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.98rem", fontWeight: 600, color: "var(--text-strong)" }}>{t}</div>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: 2 }}>{who}</div>
                </div>
                <Badge tone={tone} size="sm">{cat}</Badge>
                <IconButton aria-label="Open ticket" variant="ghost" size="sm">→</IconButton>
              </div>
            ))}
          </div>
        </Card>

        <Card variant="outline">
          <h3 style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--text-strong)", marginBottom: 4 }}>Amenity bookings</h3>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 18 }}>Today · 6 reservations</p>
          {[["Clubhouse", "The Rao family", "6:00 PM", "success"], ["Tennis court", "K. Iyer", "5:30 PM", "success"], ["Party lawn", "Residents' Assoc.", "7:00 PM", "warning"]].map(([a, w, time, tone], i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderTop: i ? "1px solid var(--border-subtle)" : "none" }}>
              <div style={{ width: 40, height: 40, borderRadius: "var(--radius-sm)", background: "var(--surface-tint)", color: "var(--text-brand)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>❖</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "var(--text-strong)" }}>{a}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{w}</div>
              </div>
              <span className="mono" style={{ fontSize: "0.82rem", color: "var(--text-body)" }}>{time}</span>
            </div>
          ))}
          <Button variant="ghost" size="sm" fullWidth style={{ marginTop: 12 }}>View calendar</Button>
        </Card>
      </div>
    </div>
  );
}

Object.assign(window, { AdminShell, Overview });

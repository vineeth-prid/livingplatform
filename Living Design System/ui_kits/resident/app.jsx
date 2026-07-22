/* Living — Resident mobile app UI kit (subtle, modern refresh) */
const { Button, Card, Badge, Avatar, IconButton, Tag } = window.LivingDesignSystem_bba765;

const MARK = "../../assets/living-mark.svg";
const MARK_LIGHT = "../../assets/living-mark-light.svg";

// Subtle accent tones — a quiet tint + matching soft icon colour, never a loud gradient.
const TONES = {
  pine:  { tint: "var(--pine-50)",   soft: "var(--pine-100)",  ink: "var(--pine-700)",  ring: "var(--pine-500)"  },
  clay:  { tint: "var(--clay-50)",   soft: "var(--clay-100)",  ink: "var(--clay-700)",  ring: "var(--clay-500)"  },
  ink:   { tint: "var(--stone-100)", soft: "var(--stone-200)", ink: "var(--stone-800)", ring: "var(--stone-600)" },
  coast: { tint: "var(--blue-50)",   soft: "#DCE7EE",          ink: "var(--blue-600)",  ring: "var(--blue-500)"  },
};

function StatusBar({ light }) {
  const c = light ? "var(--stone-50)" : "var(--text-strong)";
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 24px 4px", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600, color: c }}>
      <span>9:41</span>
      <span style={{ display: "flex", gap: 6, fontSize: 11, alignItems: "center" }}>●●● ⌃ ▮</span>
    </div>
  );
}

// Quiet brand app bar: mark + wordmark, notification bell.
function AppBar({ tone, dark }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 20px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <img src={dark ? MARK_LIGHT : MARK} width="26" height="26" alt="" />
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 21, letterSpacing: "-0.02em", color: "var(--text-strong)" }}>
          Living<span style={{ color: "var(--brand-accent)" }}>.</span>
        </span>
      </div>
      <div style={{ position: "relative" }}>
        <IconButton aria-label="Notifications" variant="ghost">◔</IconButton>
        <span style={{ position: "absolute", top: 5, right: 5, width: 7, height: 7, borderRadius: "50%", background: "var(--clay-500)", border: "2px solid var(--surface-page)" }} />
      </div>
    </div>
  );
}

function BottomNav({ tab, setTab }) {
  const items = [["home", "⌂", "Home"], ["services", "❖", "Services"], ["pay", "▤", "Pay"], ["profile", "◎", "You"]];
  return (
    <div style={{ display: "flex", padding: "8px 12px 24px", borderTop: "1px solid var(--border-subtle)", background: "var(--surface-glass)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
      {items.map(([id, icon, label]) => {
        const on = tab === id;
        return (
          <button key={id} onClick={() => setTab(id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", padding: "6px 0", color: on ? "var(--text-brand)" : "var(--text-subtle)" }}>
            <span style={{ fontSize: 19 }}>{icon}</span>
            <span style={{ fontSize: 10.5, fontWeight: on ? 600 : 500 }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ResidentHome({ theme = "pine", dark = false }) {
  const t = TONES[theme] || TONES.pine;

  return (
    <div style={{ flex: 1, overflowY: "auto", background: "var(--surface-page)" }}>
      <StatusBar />
      <AppBar tone={t} dark={dark} />

      <div style={{ padding: "2px 20px 22px", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Greeting */}
        <div>
          <div style={{ fontSize: 12.5, color: "var(--text-subtle)", letterSpacing: "0.02em" }}>Good evening</div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 30, color: "var(--text-strong)", lineHeight: 1.08, margin: "3px 0 0", letterSpacing: "-0.015em" }}>Anaya Rao</h1>
        </div>

        {/* Balance card — soft tinted surface, no loud gradient */}
        <div style={{ background: t.tint, border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "18px 20px", boxShadow: "var(--shadow-sm)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)", letterSpacing: "0.03em" }}>Maintenance due · July</div>
              <div style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 30, color: t.ink, marginTop: 4, letterSpacing: "-0.01em" }}>₹8,450</div>
            </div>
            <Badge tone="warning" size="sm">Due Jul 15</Badge>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
            <Button variant="accent" size="sm" style={{ flex: 1 }}>Pay now</Button>
            <Button variant="outline" size="sm" style={{ flex: 1 }}>View bill</Button>
          </div>
        </div>

        {/* Quick actions — soft round chips */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
          {[["✦", "Raise\nticket"], ["❖", "Book\namenity"], ["◇", "Visitor\npass"], ["▤", "Notices"]].map(([ic, l]) => (
            <div key={l} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--surface-raised)", border: "1px solid var(--border-subtle)", color: t.ink, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 21, boxShadow: "var(--shadow-sm)" }}>{ic}</div>
              <span style={{ fontSize: 11, textAlign: "center", color: "var(--text-muted)", whiteSpace: "pre-line", lineHeight: 1.25 }}>{l}</span>
            </div>
          ))}
        </div>

        {/* Community notices */}
        <div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-strong)", margin: 0 }}>From your community</h3>
            <a href="#" onClick={(e)=>e.preventDefault()} style={{ fontSize: 12.5, color: "var(--text-brand)", fontWeight: 600 }}>See all</a>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Card variant="elevated" padding="md">
              <div style={{ display: "flex", gap: 13 }}>
                <div style={{ width: 44, height: 44, borderRadius: "var(--radius-md)", background: "var(--clay-50)", color: "var(--clay-700)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>❖</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>Pool reopens Saturday</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2, lineHeight: 1.45 }}>Deep-cleaning complete. New hours 6 AM–9 PM.</div>
                  <div style={{ marginTop: 9 }}><Badge tone="info" size="sm">Amenities</Badge></div>
                </div>
              </div>
            </Card>
            <Card variant="elevated" padding="md">
              <div style={{ display: "flex", gap: 13 }}>
                <div style={{ width: 44, height: 44, borderRadius: "var(--radius-md)", background: "var(--pine-50)", color: "var(--pine-700)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>◔</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>Diwali celebration · Oct 20</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2, lineHeight: 1.45 }}>Party lawn, 7 PM onwards. RSVP to reserve seats.</div>
                  <div style={{ marginTop: 9 }}><Badge tone="brand" size="sm">Event</Badge></div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResidentServices({ theme = "pine", dark = false }) {
  const t = TONES[theme] || TONES.pine;
  const cats = [
    ["Cleaning", "◇", "From ₹499", "var(--pine-50)", "var(--pine-700)"],
    ["Plumbing", "❖", "From ₹299", "var(--clay-50)", "var(--clay-700)"],
    ["Electrician", "✦", "From ₹349", "var(--blue-50)", "var(--blue-600)"],
    ["Painting", "◈", "Get quote", "var(--amber-50)", "var(--amber-600)"],
    ["Pest control", "◔", "From ₹899", "var(--green-50)", "var(--green-600)"],
    ["Carpentry", "◦", "From ₹399", "var(--stone-100)", "var(--text-body)"],
  ];
  return (
    <div style={{ flex: 1, overflowY: "auto", background: "var(--surface-page)" }}>
      <StatusBar />
      <AppBar tone={t} dark={dark} />
      <div style={{ padding: "2px 20px 6px" }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Home services</div>
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 28, color: "var(--text-strong)", margin: 0, letterSpacing: "-0.015em" }}>Vetted help, on demand.</h2>
      </div>
      <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {cats.map(([n, ic, price, bg, fg]) => (
          <Card key={n} variant="outline" padding="md" interactive>
            <div style={{ width: 44, height: 44, borderRadius: "var(--radius-md)", background: bg, color: fg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, marginBottom: 12 }}>{ic}</div>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-strong)" }}>{n}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{price}</div>
          </Card>
        ))}
      </div>
      {/* Living Care+ promo — subtle tinted card, not a dark gradient */}
      <div style={{ padding: "4px 20px 20px" }}>
        <Card variant="elevated" padding="md" style={{ background: t.tint, border: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 19, color: "var(--text-strong)" }}>Living Care+</div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "3px 0 0" }}>Unlimited priority visits · ₹999/mo.</div>
            </div>
            <Button variant="primary" size="sm">Explore</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Phone({ children, appearance = "light" }) {
  return (
    <div data-theme={appearance === "dark" ? "dark" : "light"} style={{ width: 390, height: 800, background: "var(--surface-page)", borderRadius: 46, border: "10px solid #0f0d0b", boxShadow: "var(--shadow-floating)", overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }}>
      <div style={{ position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)", width: 116, height: 30, background: "#0f0d0b", borderRadius: 18, zIndex: 20 }} />
      {children}
    </div>
  );
}

function ResidentApp({ theme = "pine", appearance = "light" }) {
  const [tab, setTab] = React.useState("home");
  const dark = appearance === "dark";
  return (
    <Phone appearance={appearance}>
      {tab === "services" ? <ResidentServices theme={theme} dark={dark} /> : tab === "home" ? <ResidentHome theme={theme} dark={dark} /> : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--surface-page)" }}>
          <StatusBar />
          <AppBar tone={TONES[theme] || TONES.pine} dark={dark} />
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 14, textTransform: "capitalize" }}>{tab}</div>
        </div>
      )}
      <BottomNav tab={tab} setTab={setTab} />
    </Phone>
  );
}

Object.assign(window, { ResidentApp });

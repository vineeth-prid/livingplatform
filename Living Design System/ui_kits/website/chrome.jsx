/* Living — Website UI kit: shared chrome (Nav + Footer) */
const { Button, IconButton } = window.LivingDesignSystem_bba765;

function Wordmark({ light }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <img src={light ? "../../assets/living-mark-light.svg" : "../../assets/living-mark.svg"} width="26" height="26" alt="" style={{ display: "block" }} />
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: "1.65rem", letterSpacing: "-0.02em", lineHeight: 1, color: light ? "var(--stone-50)" : "var(--text-strong)" }}>
        Living<span style={{ color: "var(--brand-accent)" }}>.</span>
      </span>
    </div>
  );
}

function SiteNav({ route, go }) {
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
  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 50,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "16px clamp(20px, 5vw, 64px)",
      background: overHero ? "transparent" : "var(--surface-glass)",
      backdropFilter: overHero ? "none" : "blur(16px) saturate(1.4)",
      WebkitBackdropFilter: overHero ? "none" : "blur(16px) saturate(1.4)",
      borderBottom: overHero ? "1px solid transparent" : "1px solid var(--border-subtle)",
      transition: "background .25s ease, border-color .25s ease",
    }}>
      <style>{`
        .nav-link { position: relative; text-decoration: none; padding-bottom: 3px; transition: color .2s ease; }
        .nav-link::after { content: ""; position: absolute; left: 0; right: 100%; bottom: -1px; height: 1.5px; background: currentColor; transition: right .25s cubic-bezier(.16,.8,.24,1); }
        .nav-link:hover::after { right: 0; }
      `}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
        <a href="#" onClick={(e) => { e.preventDefault(); go("home"); }} style={{ textDecoration: "none" }}><Wordmark light={overHero} /></a>
        <nav style={{ display: "flex", gap: 26 }}>
          {links.map((l) => (
            <a key={l} className="nav-link" href="#" onClick={(e) => { e.preventDefault(); go(l === "Buy" ? "home" : "home"); }}
              style={{ fontFamily: "var(--font-sans)", fontSize: "0.95rem", fontWeight: 500, color: fg }}>{l}</a>
          ))}
        </nav>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <a href="#" onClick={(e) => e.preventDefault()} style={{ fontFamily: "var(--font-sans)", fontSize: "0.95rem", fontWeight: 500, color: fg, whiteSpace: "nowrap" }}>Sign in</a>
        {overHero ? (
          <Button variant="secondary" size="sm" style={{ background: "rgba(255,255,255,0.16)", color: "var(--stone-50)", borderColor: "rgba(255,255,255,0.45)" }}>List your home</Button>
        ) : (
          <Button variant="primary" size="sm">List your home</Button>
        )}
      </div>
    </header>
  );
}

function SiteFooter() {
  const cols = {
    Explore: ["Buy a home", "Rent a home", "New communities", "NRI services"],
    Platform: ["Community app", "Facility management", "Marketplace", "Analytics"],
    Company: ["About Living", "Careers", "Press", "Contact"],
  };
  return (
    <footer style={{ background: "var(--pine-800)", color: "var(--stone-200)", padding: "72px clamp(20px,5vw,64px) 40px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 40, maxWidth: 1320, margin: "0 auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Wordmark light={true} />
          <p style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", lineHeight: 1.2, color: "var(--stone-50)", maxWidth: 260, margin: 0 }}>Life Happens Here.</p>
          <p style={{ fontSize: "0.9rem", color: "var(--pine-200)", maxWidth: 280 }}>One premium ecosystem for buying, renting, living and managing a home.</p>
        </div>
        {Object.entries(cols).map(([head, items]) => (
          <div key={head} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <span style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--pine-300)" }}>{head}</span>
            {items.map((i) => <a key={i} href="#" onClick={(e) => e.preventDefault()} style={{ fontSize: "0.92rem", color: "var(--stone-200)", textDecoration: "none" }}>{i}</a>)}
          </div>
        ))}
      </div>
      <div style={{ maxWidth: 1320, margin: "48px auto 0", paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.12)", display: "flex", justifyContent: "space-between", fontSize: "0.82rem", color: "var(--pine-200)" }}>
        <span>© 2026 Living. All rights reserved.</span>
        <span style={{ display: "flex", gap: 20 }}><a href="#" onClick={(e)=>e.preventDefault()} style={{color:"var(--pine-200)"}}>Privacy</a><a href="#" onClick={(e)=>e.preventDefault()} style={{color:"var(--pine-200)"}}>Terms</a></span>
      </div>
    </footer>
  );
}

Object.assign(window, { Wordmark, SiteNav, SiteFooter });

/* Living — Website UI kit: Home page */
const { Button, PropertyCard, Tag, Badge, Card } = window.LivingDesignSystem_bba765;

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
      if (entry.isIntersecting) { setInView(true); io.disconnect(); }
    }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, inView];
}

function Reveal({ children, delay = 0, y = 22, as: Tag = "div", style }) {
  const [ref, inView] = useInView();
  return (
    <Tag ref={ref} style={{
      opacity: inView ? 1 : 0,
      transform: inView ? "translateY(0)" : `translateY(${y}px)`,
      transition: `opacity .7s cubic-bezier(.16,.8,.24,1) ${delay}s, transform .7s cubic-bezier(.16,.8,.24,1) ${delay}s`,
      ...style,
    }}>{children}</Tag>
  );
}

const HOMES = [
  { id: 1, image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&q=80&auto=format&fit=crop", title: "Riverside Greens", location: "Whitefield, Bengaluru", status: "Available", statusTone: "success", beds: 3, baths: 2, area: "1,840 sqft", price: "₹1.85 Cr" },
  { id: 2, image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=900&q=80&auto=format&fit=crop", title: "The Meadows Penthouse", location: "Koramangala, Bengaluru", status: "New", statusTone: "brand", beds: 4, baths: 4, area: "3,200 sqft", price: "₹4.20 Cr" },
  { id: 3, image: "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=900&q=80&auto=format&fit=crop", title: "Highgrove Studio", location: "Indiranagar, Bengaluru", status: "Pending", statusTone: "warning", beds: 1, baths: 1, area: "640 sqft", price: "₹85,000", period: "/month" },
  { id: 4, image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=900&q=80&auto=format&fit=crop", title: "Amber Court Villa", location: "Sarjapur, Bengaluru", status: "Available", statusTone: "success", beds: 4, baths: 5, area: "4,100 sqft", price: "₹6.75 Cr" },
  { id: 5, image: "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=900&q=80&auto=format&fit=crop", title: "The Linden Residences", location: "Hebbal, Bengaluru", status: "Available", statusTone: "success", beds: 3, baths: 3, area: "2,050 sqft", price: "₹2.40 Cr" },
  { id: 6, image: "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=900&q=80&auto=format&fit=crop", title: "Cedar Loft", location: "HSR Layout, Bengaluru", status: "New", statusTone: "brand", beds: 2, baths: 2, area: "1,180 sqft", price: "₹1.20 Cr" },
];

function Hero({ openDetail }) {
  const reduced = prefersReducedMotion();
  const [loaded, setLoaded] = React.useState(reduced);
  React.useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => setLoaded(true), 80);
    return () => clearTimeout(t);
  }, []);
  const rise = (delay) => ({
    opacity: loaded ? 1 : 0,
    transform: loaded ? "translateY(0)" : "translateY(20px)",
    transition: `opacity .8s cubic-bezier(.16,.8,.24,1) ${delay}s, transform .8s cubic-bezier(.16,.8,.24,1) ${delay}s`,
  });
  return (
    <section style={{ position: "relative", minHeight: 640, display: "flex", alignItems: "flex-end", marginTop: -84, paddingTop: 84, overflow: "hidden" }}>
      <div style={{
        position: "absolute", inset: 0,
        background: "url('https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=1800&q=80&auto=format&fit=crop') center/cover",
        transform: loaded ? "scale(1)" : "scale(1.08)",
        transition: "transform 5s cubic-bezier(.16,.8,.24,1)",
      }} />
      {/* Top scrim keeps the floating nav readable regardless of photo brightness */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 170, background: "linear-gradient(to bottom, rgba(15,33,26,0.55), rgba(15,33,26,0))" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(15,33,26,0.72) 0%, rgba(15,33,26,0.15) 45%, rgba(15,33,26,0.25) 100%)" }} />
      <div style={{ position: "relative", width: "100%", maxWidth: 1320, margin: "0 auto", padding: "0 clamp(20px,5vw,64px) 64px" }}>
        <div style={{ maxWidth: 640 }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--clay-200)", marginBottom: 16, ...rise(0) }}>Premium homes ·</div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: "clamp(3rem, 6vw, 5rem)", lineHeight: 1.02, letterSpacing: "-0.02em", color: "var(--stone-50)", margin: 0, ...rise(0.08) }}>Life Happens Here.</h1>
          <p style={{ fontSize: "1.15rem", lineHeight: 1.6, color: "rgba(250,248,244,0.9)", maxWidth: 480, marginTop: 20, ...rise(0.16) }}>Discover considered homes in the city's most liveable communities — and everything that comes after you move in.</p>
        </div>
        {/* Search bar */}
        <div style={{ marginTop: 36, background: "var(--surface-glass)", backdropFilter: "blur(18px) saturate(1.4)", WebkitBackdropFilter: "blur(18px) saturate(1.4)", border: "1px solid rgba(255,255,255,0.4)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-lg)", padding: 10, display: "flex", alignItems: "center", gap: 8, maxWidth: 760, ...rise(0.26) }}>
          {[["Location", "Bengaluru"], ["Type", "Buy · Apartment"], ["Budget", "Up to ₹3 Cr"]].map(([k, v], i) => (
            <React.Fragment key={k}>
              <div style={{ flex: 1, padding: "8px 14px" }}>
                <div style={{ fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-subtle)" }}>{k}</div>
                <div style={{ fontSize: "0.98rem", fontWeight: 500, color: "var(--text-strong)", marginTop: 2 }}>{v}</div>
              </div>
              {i < 2 ? <div style={{ width: 1, height: 34, background: "var(--border-default)" }} /> : null}
            </React.Fragment>
          ))}
          <Button variant="primary" size="lg" onClick={() => openDetail(HOMES[0])}>Search</Button>
        </div>
      </div>
    </section>
  );
}

function StatStrip() {
  const stats = [["12,400+", "Homes listed"], ["68", "Communities"], ["9,200", "Families living"], ["4.9★", "Resident rating"]];
  return (
    <section style={{ background: "var(--surface-card)", borderBottom: "1px solid var(--border-subtle)" }}>
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "40px clamp(20px,5vw,64px)", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 24 }}>
        {stats.map(([n, l], i) => (
          <Reveal key={l} delay={i * 0.08} y={14} style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: "2.75rem", lineHeight: 1, color: "var(--text-strong)" }}>{n}</div>
            <div style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginTop: 6 }}>{l}</div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function FeaturedListings({ openDetail }) {
  const [filter, setFilter] = React.useState("All");
  const filters = ["All", "Apartments", "Villas", "New", "Rentals"];
  return (
    <section style={{ maxWidth: 1320, margin: "0 auto", padding: "88px clamp(20px,5vw,64px)" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, flexWrap: "wrap", marginBottom: 32 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Curated for you</div>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: "2.75rem", lineHeight: 1.05, letterSpacing: "-0.015em", color: "var(--text-strong)", margin: 0 }}>Featured residences</h2>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {filters.map((f) => <Tag key={f} selected={filter === f} onClick={() => setFilter(f)}>{f}</Tag>)}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 28 }}>
        {HOMES.map((h, i) => (
          <Reveal key={h.id} delay={(i % 3) * 0.1}>
            <PropertyCard {...h} onClick={() => openDetail(h)} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function EcosystemBand() {
  const items = [
    ["Property Sales", "Buy and sell with editorial listings and honest guidance."],
    ["Community Living", "A calm app for residents — payments, bookings, notices."],
    ["Home Services", "Vetted vendors for everything a home needs."],
    ["Facility Management", "Owners and managers, one refined dashboard."],
  ];
  return (
    <section style={{ background: "var(--surface-tint)" }}>
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "88px clamp(20px,5vw,64px)" }}>
        <div style={{ maxWidth: 620, marginBottom: 44 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>One ecosystem</div>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: "2.75rem", lineHeight: 1.05, letterSpacing: "-0.015em", color: "var(--text-strong)", margin: 0 }}>Everything a home needs, in one place.</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20 }}>
          {items.map(([t, d], i) => (
            <Reveal key={t} delay={i * 0.09}>
              <Card variant="elevated" interactive>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", color: "var(--brand-accent)", marginBottom: 12 }}>0{i + 1}</div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text-strong)", marginBottom: 8 }}>{t}</h3>
                <p style={{ fontSize: "0.92rem", color: "var(--text-muted)", lineHeight: 1.55, margin: 0 }}>{d}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTABand() {
  return (
    <section style={{ maxWidth: 1320, margin: "0 auto", padding: "0 clamp(20px,5vw,64px) 88px" }}>
      <Reveal y={30}>
      <div style={{ position: "relative", overflow: "hidden", borderRadius: "var(--radius-2xl)", padding: "72px 56px", background: "url('https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1600&q=80&auto=format&fit=crop') center/cover" }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(120deg, rgba(21,46,36,0.86), rgba(21,46,36,0.35))" }} />
        <div style={{ position: "relative", maxWidth: 520 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: "3rem", lineHeight: 1.05, color: "var(--stone-50)", margin: 0 }}>Ready to find where life happens?</h2>
          <p style={{ fontSize: "1.1rem", color: "rgba(250,248,244,0.88)", marginTop: 16, marginBottom: 28 }}>Talk to a Living advisor, or start browsing homes tonight.</p>
          <div style={{ display: "flex", gap: 14 }}>
            <Button variant="accent" size="lg">Book a consultation</Button>
            <Button variant="secondary" size="lg" style={{ background: "rgba(255,255,255,0.14)", color: "var(--stone-50)", borderColor: "rgba(255,255,255,0.4)" }}>Browse homes</Button>
          </div>
        </div>
      </div>
      </Reveal>
    </section>
  );
}

function HomePage({ openDetail }) {
  return (
    <div>
      <Hero openDetail={openDetail} />
      <StatStrip />
      <FeaturedListings openDetail={openDetail} />
      <EcosystemBand />
      <CTABand />
    </div>
  );
}

Object.assign(window, { HomePage, HOMES });

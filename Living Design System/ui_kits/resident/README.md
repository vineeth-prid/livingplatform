# Living — Resident Mobile App (UI kit)

A premium lifestyle application for residents — simple, friendly, fast.

## Screens (`app.jsx`)
- **Home** — Pine gradient header with greeting, glass balance card + Pay CTA, quick-action grid, community notice cards.
- **Services** — Home-services catalogue grid with a Living Care+ membership promo.
- **Shell** — a phone bezel (`Phone`), iOS-style `StatusBar`, and a glass `BottomNav`.

## Interaction
`index.html` renders the phone; tap the bottom nav (Home / Services / Pay / You) to switch tabs.

## Components used
`Button`, `Card`, `Badge`, `Avatar`, `IconButton`, `Tag`.

## Notes
Bezel and status bar are lightweight local helpers (no external device frame). Glyphs stand in for Lucide icons per the readme's iconography rules.

# Living — Community Admin Portal (UI kit)

A premium SaaS dashboard for facility managers and associations — calibre of Linear, Stripe and Vercel, never an ERP.

## Screens
- **Overview** (`dashboard.jsx`) — greeting, KPI `StatCard` row with sparklines, a tabbed tickets table, and an amenity-bookings panel.
- **Residents** (`residents.jsx`) — filterable resident table with Avatars, unit codes, type/billing Badges, pagination.
- **Shell** (`AdminShell` in `dashboard.jsx`) — `SidebarNav` with a community switcher and user footer, plus a glass top bar with search and quick actions.

## Interaction
`index.html` mounts the shell; click **Overview** / **Residents** in the sidebar to switch views.

## Components used
`SidebarNav`, `Tabs`, `StatCard`, `Card`, `Badge`, `Button`, `IconButton`, `Avatar`, `Tag`, `Input`.

## Notes
Sparklines are a tiny inline SVG helper local to the kit — production should use the brand's charting approach. Glyphs (◈ ◎ ✦) are placeholders for Lucide icons per the readme's iconography rules.

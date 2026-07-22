# Living — Design System

> **Life Happens Here.**
> The official design bible for Living, a premium PropTech ecosystem.

Living is not apartment-management software. It is a complete, premium ecosystem connecting home buyers, sellers, apartment communities, residents, facility managers, vendors, property owners and NRI owners — across Property Sales, Rentals, Management, a Community platform, Home Services, Facility Management, a Marketplace and Analytics.

Everything in this system is built to feel like **one calm, luxurious ecosystem** — closer to Apple, Airbnb and Aman than to any ERP.

## Sources
This system was authored **from a written creative brief only** — no codebase, Figma file, or existing brand assets were provided. All tokens, components and kits are original work derived from the brief's direction (premium, minimal, warm, timeless luxury real estate). The **logo** is original work authored to the brief — *The Threshold* mark (see *Iconography & Logo*). If a codebase or Figma exists, re-attach it and this system can be reconciled against it.

---

## The system at a glance
- **Entry stylesheet:** `styles.css` (consumers link only this). It `@import`s the token layer + base.
- **Tokens:** `tokens/` — `colors.css`, `typography.css`, `spacing.css`, `radius.css`, `elevation.css`, `motion.css`, `fonts.css`, `base.css`.
- **Components:** `components/` — grouped `forms/`, `display/`, `property/`, `feedback/`, `navigation/`.
- **Foundation cards:** `guidelines/` — specimen cards for the Design System tab.
- **UI kits:** `ui_kits/` — full-screen product recreations.
- **Skill:** `SKILL.md` — makes this portable as an Agent Skill.

---

## Brand strategy

**Positioning.** Living is a premium lifestyle brand that happens to run on technology. It should make someone think: *"I trust this company. This feels effortless. I would trust them with my home."*

**Personality.** Luxury, modern, minimal, warm, human, refined, calm, confident, trustworthy, innovative — never corporate, never loud, never templated.

**Design philosophy.** Luxury is simplicity. Luxury is confidence. Luxury is whitespace. Luxury never shouts. Every screen should feel effortless; every interaction intentional; every detail a signal of quality.

**The four principles** (see the *Principles* brand card): **Calm · Warm · Refined · Effortless.**

---

## CONTENT FUNDAMENTALS — how Living writes

The voice is **warm, confident, and quiet**. It speaks like a considerate concierge, not a salesperson or a software manual.

- **Person & address.** Speak to the reader as **"you"**; the company is **"we"** used sparingly. "We'll hold Saturday 11:00 AM for you." Never "the user," never "click here."
- **Tone.** Reassuring and effortless. State things plainly and let whitespace carry the confidence. Short declaratives beat superlatives — *"An elevated home in Whitefield,"* not *"The most luxurious home you'll ever see!!!"*
- **Casing.** **Sentence case everywhere** — buttons, headings, labels, menu items ("Book a tour," "Saved homes"). Reserve ALL-CAPS only for the tracked **eyebrow** label (e.g. `COMMUNITY · SINCE 2024`). Never Title Case UI.
- **Headlines.** Editorial and human, often a fragment or a quiet promise: **"Life Happens Here." / "A calm home to manage." / "Everything in its place."** Set in the Cormorant display serif.
- **Punctuation.** Full stops are welcome in headlines — they feel deliberate and print-like ("Life Happens Here."). Em dashes for asides. No exclamation marks in product UI.
- **Numbers & money.** Indian formatting — `₹1.85 Cr`, `₹85,000/month`, `1,840 sqft`, `94.2%`. Set money and data in IBM Plex Mono with tabular figures so columns align.
- **Microcopy.** Encouraging, never a dead end. Empty state: *"No saved homes yet — tap the heart on any listing to keep it here."* Errors are calm and specific: *"At least 8 characters."*
- **Emoji.** **Never** in product or marketing copy. Warmth comes from typography, imagery and space — not emoji.
- **Words we like:** home, community, calm, effortless, considered, refined, welcome, belong. **Words we avoid:** units, assets, leverage, synergy, disrupt, ERP, portal (internally fine, never customer-facing).

---

## VISUAL FOUNDATIONS

**Palette & vibe.** A warm-cool luxury triad: deep **Pine** green (trust, growth, home, calm — the primary), warm **Stone** neutrals running ivory→ink (the canvas; every grey is warm-tinted, never blue-grey), and a single **Clay** terracotta accent (life, warmth, the human touch — used sparingly for one CTA or highlight per view). Generic corporate blue is banned. Semantic hues are muted and earthy, never neon. Backgrounds are the ivory `--surface-page` (#FAF8F4), with pure-white cards floating on top.

**Type.** Display = **Cormorant** (high-contrast editorial serif) for hero lines, headlines, KPI values and dialog titles — always ≥ 32px, weight 300–500, tracking −0.015em. UI/body = **Schibsted Grotesk** (warm humanist grotesque), semibold for headings/labels, regular for body at 1.66 line-height. Data/money = **IBM Plex Mono**, tabular figures. The serif/grotesque contrast is the core typographic signature.

**Spacing & layout.** Strict **8-point** system; whitespace is a feature, not a gap to fill. Generous section padding (`--pad-section-y` = 96px). Editorial, asymmetric layouts over dense grids. Page gutters scale fluidly (`--page-margin`). One idea per region; one thousand no's for every yes.

**Backgrounds.** Predominantly flat warm ivory or white. **Large photography** is the hero surface — full-bleed architecture and lifestyle imagery, never clip-art. No busy gradients; the only gradients are (a) a subtle Pine gradient as a *placeholder* when a property photo is missing, and (b) **protection gradients** — a soft top-down `rgba(20,17,15,0.34)→transparent` scrim over images so overlaid chips/text stay legible. No repeating patterns or textures.

**Corners & cards.** One unified radius system, soft not bubbly: controls `12px`, cards `16px`, media/panels `22px`, hero surfaces `32px`, pills for chips/avatars/badges. Cards = white surface + `1px` warm hairline border (`--border-subtle`) + a **soft, warm, low-opacity layered shadow** (`--shadow-sm`/`md`). Shadows are warm-tinted ink at 4–14% opacity, never harsh black. Glass (subtle 18px blur) is reserved for panels floating over photography only.

**Borders.** Hairline, warm, quiet — `--border-subtle` for dividers inside calm surfaces, `--border-default` for input/edge definition. Focus is a soft 3px Pine ring (`--ring-focus-shadow`), never a hard outline.

**Motion.** Calm and intentional. Entrances fade + rise with `--ease-out`; interactive feedback uses `--ease-settle` (a *gentle* overshoot, never a springy bounce). Durations 140–360ms. Respect `prefers-reduced-motion` (tokens collapse to 0ms). No infinite decorative animation in product UI.

**Hover / press states.** Hover: primary/accent buttons **darken one step + lift 2px + deepen shadow**; quiet surfaces get a `--surface-sunken`/`--surface-tint` wash; cards lift 3–4px with a slow image zoom on property cards. Press: **scale to 0.98** (never a color flash). Links shift to `--brand-primary-hover`.

**Transparency & blur.** Used deliberately, not decoratively — scrims behind dialogs (soft blur + warm scrim), glass favourite buttons over photos, glass cards over hero imagery. Never frosted chrome for its own sake.

**Imagery grade.** Warm, natural, softly lit — golden-hour and daylight, real materials (wood, stone, linen, greenery), real people living unposed. No cold blue-grey stock, no heavy HDR, no aggressive grain. Architecture shot wide and calm; lifestyle shot intimate.

---

## ICONOGRAPHY & LOGO

**Logo — "The Threshold."** The brand mark is an **open doorway drawn as a calm architectural arch** (`assets/living-mark.svg`, ivory reverse `assets/living-mark-light.svg`) — home, welcome and belonging without literal house clip-art. The Pine arch frames an opening in which the single **Clay full-stop** stands: the one permitted brand device, echoing the tagline "Life Happens Here." See the *Logo* brand card for lockups, scale and clearspace. The **type lockup** pairs the mark with the wordmark *Living* set in Cormorant Medium + Clay full-stop — *Living·* — optionally over the tagline in a tracked grotesque eyebrow (see the *Wordmark* card). Rules: never recolour the arch outside the Pine · Stone · Clay triad, never rotate it, never wrap it in a container ring; reverse to ivory on Pine, Clay or photographic surfaces. Do **not** draw buildings, roofs, skylines or house clip-art elsewhere.

**Icons.** Living uses **[Lucide](https://lucide.dev)** — a consistent, open-source stroked icon set — as the recommended system, linked from CDN. Rationale: **1.5px stroke, ~2px rounded corners, minimal and calm**, which matches the brand's refined line quality. Rules:
- **Outline (stroked) by default**; reserve filled glyphs for a single active/selected state (e.g. a filled heart on a favourited listing).
- Stroke `1.5px`, rounded caps/joins, `24px` default box (20px in dense UI). Never mix icon families.
- Icons are quiet — `--text-muted` at rest, `--text-strong`/`--text-brand` when active. Never multicolor.
- **No emoji** anywhere. The specimen cards and kits in this repo use simple Unicode geometric glyphs (◈ ◎ ✦ ♥) as lightweight placeholders; **production should swap these for Lucide** (`heart`, `map-pin`, `bell`, `sparkles`, `home`, etc.).

**Assets folder.** `assets/` holds the brand mark (`living-mark.svg`, `living-mark-light.svg`). Add real illustrations and photography here as they are produced.

---

## Illustration & Photography (direction)
- **Illustration** — used sparingly, only for empty states, onboarding and error moments. Language: fine single-weight line work in Pine/Clay on ivory, generous negative space, warm and human — never flat corporate "blob" people, never 3D gradients. Most surfaces should prefer **photography over illustration**.
- **Photography** — the primary visual voice. Warm natural light, real materials and greenery, unposed people, calm wide architecture. Consistent warm grade; avoid cold/blue stock and heavy filters.

---

## Components

React primitives, grouped by concern. Each is `<Name>.jsx` + `<Name>.d.ts` + `<Name>.prompt.md`, consumed via `window.LivingDesignSystem_bba765`.

**Forms** (`components/forms/`)
- **Button** — primary (Pine) / accent (Clay) / secondary / outline / ghost, three sizes, hover-lift + press-scale.
- **IconButton** — square icon-only control (ghost / soft / outline / solid).
- **Input** — labelled field with hint, error and leading/trailing adornments.
- **Select** — native select styled to match Input.
- **Checkbox** — with label + description, controlled/uncontrolled.
- **Switch** — soft settings toggle with gentle knob glide.

**Display** (`components/display/`)
- **Card** — calm content surface (elevated / outline / quiet / glass).
- **Badge** — status pill across semantic tones (soft / solid / outline).
- **Tag** — selectable, removable filter/attribute chip.
- **StatCard** — dashboard KPI widget with Cormorant value and delta.
- **Avatar** — image with initials fallback and status dot.

**Property** (`components/property/`)
- **PropertyCard** — the signature listing card: editorial photo, specs, glass favourite, hover lift + slow zoom.

**Feedback** (`components/feedback/`)
- **Dialog** — centred modal over a soft blurred scrim, fade + rise.
- **Tooltip** — quiet ink label on hover/focus.
- **EmptyState** — calm placeholder for empty/first-run screens.

**Navigation** (`components/navigation/`)
- **Tabs** — quiet underline tabs with counts.
- **SidebarNav** — dashboard sidebar with sections, icons, badges.

### Intentional additions
Because no source defined a component inventory, a standard premium set was authored to the brief. `PropertyCard` and `StatCard` are brand-specific additions justified by Living's core surfaces (listings, dashboards).

---

## UI kits
Full-screen product recreations in `ui_kits/`, each with its own `README.md`, interactive `index.html`, and screen JSX:
- **`website/`** — Property Sales marketing site. Full-bleed hero + glass search, curated `PropertyCard` grid with filters, ecosystem band, and an editorial property-detail page. *Starting point.*
- **`admin/`** — Community Admin Portal. Premium-SaaS dashboard (KPI `StatCard`s with sparklines, tickets table, amenity bookings) + a filterable Residents table. *Starting point.*
- **`resident/`** — Resident Mobile App. Phone-framed home (balance card, quick actions, community notices) and a home-services catalogue with bottom-nav tabs.

## Accessibility standards
- Text contrast targets WCAG AA: body ≥ 4.5:1, large display ≥ 3:1. Pine-600 on ivory and Stone-50 on Pine-600 both pass.
- Never signal state with colour alone — pair Badges with a label/dot, inputs with an error message.
- Visible focus everywhere via the soft Pine ring; hit targets ≥ 44px (44/48px controls).
- Honour `prefers-reduced-motion` (motion tokens collapse to 0ms).

## Dark mode
Full dark theme via `[data-theme="dark"]` — warm ink surfaces (#100E0C→#1C1915), luminous Pine accents, Stone text inverted. All semantic aliases are redefined; components need no changes.

## Future brand evolution
Keep the serif/grotesque contrast and the Pine·Stone·Clay triad as fixed anchors. Evolve through photography, motion refinement and a real logo — not by adding colours or trend effects. When a wordmark is commissioned, it should honour the Clay full-stop device.

---
*Namespace for `_ds_bundle.js`: `LivingDesignSystem_bba765`.*

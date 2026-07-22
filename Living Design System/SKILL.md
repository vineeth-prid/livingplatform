---
name: living-design
description: Use this skill to generate well-branded interfaces and assets for Living, a premium PropTech ecosystem, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

# Living — Design System

**Life Happens Here.** Living is a premium PropTech ecosystem (property sales, rentals, community living, home services, facility management). The brand is luxury real estate meets calm modern software — warm, minimal, editorial, never corporate.

Read `readme.md` for the full design bible, then explore the other files.

## Fast facts
- **Palette:** deep **Pine** green (primary), warm **Stone** neutrals ivory→ink (canvas), single **Clay** terracotta accent (used sparingly). No corporate blue.
- **Type:** **Cormorant** display serif (headlines, KPI values, ≥32px) + **Schibsted Grotesk** grotesque (UI/body) + **IBM Plex Mono** (data/money). Serif/grotesque contrast is the signature.
- **Feel:** 8-pt spacing, generous whitespace, soft warm shadows, unified radius (12/16/22/32), calm ease-out motion, sentence-case copy, "you"/"we", no emoji.
- **Entry stylesheet:** `styles.css` (link only this). Components live on `window.LivingDesignSystem_bba765` after loading `_ds_bundle.js`.

## Working with this skill
- **Visual artifacts** (slides, mocks, throwaway prototypes): copy the assets/tokens you need and produce static HTML. Link `styles.css`, reference the CSS custom properties, and reuse the component patterns in `components/` and `ui_kits/`.
- **Production code:** read the tokens and component/prompt files to become an expert, and design with the real brand rules.

## Where things are
- `tokens/` — colors, typography, spacing, radius, elevation, motion, fonts, base.
- `components/` — forms, display, property, feedback, navigation (each with `.jsx` + `.d.ts` + `.prompt.md`).
- `ui_kits/` — `website/` (property sales), `admin/` (community dashboard), `resident/` (mobile app).
- `guidelines/` — foundation specimen cards.

If invoked without guidance, ask what the user wants to build, ask a few sharp questions, then act as an expert Living designer and output HTML artifacts _or_ production code as needed.

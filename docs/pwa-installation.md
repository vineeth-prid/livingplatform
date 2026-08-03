# Resident PWA — installation

The Resident app is an installable Progressive Web App. This is what makes it
installable, and how residents install it on each platform.

---

## 1. What was missing

The app already had a service worker and a manifest, but shipped only an SVG
icon. **Chrome requires a raster icon of at least 192px** to consider a web app
installable — with SVG alone the `beforeinstallprompt` event never fires, so
there was nothing to prompt with and no way to install except a hidden browser
menu.

Fixed by:

| | |
| --- | --- |
| Icons | Real PNGs at 192, 512, a 512 maskable, and a 180 `apple-touch-icon` |
| Manifest | Added `id`, `scope`, `lang`, `categories`, `shortcuts`; PNG icons with explicit `purpose` |
| Install UI | `beforeinstallprompt` captured and replayed from a user gesture |
| iOS | Detected and given Share-sheet instructions (iOS has no install API) |
| Detection | Already-installed and unsupported-browser states render nothing / an explanation |

---

## 2. Icons

Generated, not hand-drawn:

```bash
pnpm --filter @living/resident icons
```

`apps/resident/scripts/generate-icons.mjs` rasterises the Living mark (rounded
square, serif "L", accent dot) and encodes PNG with `node:zlib` — no `sharp`,
no `canvas`, no build dependency for four flat shapes. Re-run it if the brand
colours change.

| File | Size | `purpose` | Used by |
| --- | --- | --- | --- |
| `pwa-192x192.png` | 192 | `any` | Chrome install criteria |
| `pwa-512x512.png` | 512 | `any` | Splash screen |
| `pwa-maskable-512x512.png` | 512 | `maskable` | Android adaptive icons (mark inside the 80% safe zone, background bleeds to the edge) |
| `apple-touch-icon.png` | 180 | — | iOS home screen (iOS ignores manifest icons) |
| `icon.svg` | any | `any` | Crisp favicon |

---

## 3. Install UI

`src/pwa/use-install-prompt.ts` resolves one of five states:

| State | Meaning | UI |
| --- | --- | --- |
| `available` | Chromium fired `beforeinstallprompt` | **Install** button + banner |
| `manual-ios` | iOS Safari | Banner → Share-sheet instructions dialog |
| `installed` | Running standalone | Nothing (Profile confirms it is installed) |
| `pending` | Chromium, criteria not met yet (usually first visit) | Disabled button, becomes live on a later visit |
| `unsupported` | Firefox desktop, Chrome/Firefox on iOS, in-app browsers | Short explanation, no dead-end button |

Two surfaces, one hook:

- **`InstallBanner`** — above the tab bar, dismissible for 14 days
  (`localStorage`), suppresses Chrome's own mini-infobar so there is one prompt.
- **`InstallButton`** — Profile → App, so someone who dismissed the banner can
  still install.

The deferred event can only be used once; declining re-arms the banner after the
dismissal window.

---

## 4. Installing

### Android (Chrome, Edge, Samsung Internet)
1. Open the Resident app.
2. Tap **Install** in the banner, or Profile → App → **Install Living**.
3. Confirm. Living appears in the app drawer with a maskable adaptive icon.

### iOS / iPadOS (Safari only)
1. Open the app in **Safari** — Chrome and Firefox on iOS cannot add to the
   home screen.
2. Tap **Install** in the banner for the steps, or directly:
   **Share → Add to Home Screen → Add**.
3. Living opens full screen from the home screen.

### Desktop (Chrome, Edge)
1. Open the app.
2. Click **Install** in the banner, or the install icon in the address bar.
3. Living opens in its own window.

---

## 5. Offline

Unchanged: `vite-plugin-pwa` in `generateSW` mode precaches the app shell
(`js`, `css`, `html`, `svg`, `png`, `woff2`) with `navigateFallback` to
`index.html`. API calls stay network-first through TanStack Query.

Razorpay Checkout is **deliberately not** precached — it is a third-party
payment widget that must always be the live version, so it loads on demand
(`src/payments/razorpay.ts`).

`registerType: 'autoUpdate'` means a new deployment activates on the next launch.

---

## 6. Verifying

```bash
pnpm --filter @living/resident build
npx serve apps/resident/dist    # a service worker needs https or localhost
```

Chrome DevTools → **Application**:

| Panel | Expect |
| --- | --- |
| Manifest | No errors; `id`, `scope`, `start_url`, 192 + 512 icons, maskable preview fills the circle |
| Service workers | `sw.js` activated |
| Install | Address-bar install icon present |

Lighthouse → *Installable* should pass.

Unit tests for the platform detection:

```bash
pnpm --filter @living/resident test
```

Covers iPhone, iPadOS-as-Macintosh, Chrome-on-iOS (unsupported), Android
Chrome, desktop Chrome/Firefox, and standalone precedence.

Living's primary action button — deep Pine by default, Clay for high-emphasis lifestyle CTAs, quiet secondary/ghost/outline for supporting actions.

```jsx
<Button variant="primary" size="md" onClick={handleTour}>Book a tour</Button>
<Button variant="accent" iconRight={<span>→</span>}>Get started</Button>
<Button variant="secondary">Save</Button>
<Button variant="ghost">Cancel</Button>
```

Variants: `primary` (Pine), `accent` (Clay), `secondary` (raised + border), `ghost` (tinted hover), `outline`. Sizes `sm | md | lg`. Hover lifts + darkens; press scales down. Pass `iconLeft` / `iconRight` as elements; use `fullWidth` in forms and mobile.

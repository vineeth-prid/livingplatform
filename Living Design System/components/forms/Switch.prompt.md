Soft toggle for settings and preferences. Pine track when on, gentle knob glide.

```jsx
<Switch label="Email notifications" defaultChecked />
<Switch label="Dark mode" checked={dark} onChange={e => setDark(e.target.checked)} />
```

Sizes `sm | md`. Controlled or uncontrolled.

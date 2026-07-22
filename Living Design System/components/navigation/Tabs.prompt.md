Quiet underline tabs with optional icons and counts. Controlled or uncontrolled.

```jsx
<Tabs defaultValue="overview" onChange={setTab} items={[
  { value: "overview", label: "Overview" },
  { value: "residents", label: "Residents", count: 248 },
  { value: "tickets", label: "Tickets", count: 12 },
]} />
```

Pass plain strings for simple cases. Active tab shows a Pine underline.

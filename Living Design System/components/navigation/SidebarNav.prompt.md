Vertical navigation for admin and dashboard shells. Active item gets a tinted Pine pill.

```jsx
<SidebarNav value={route} onChange={setRoute} items={[
  { section: "Manage" },
  { value: "overview", label: "Overview", icon: <span>◈</span> },
  { value: "residents", label: "Residents", icon: <span>◎</span>, badge: 248 },
  { value: "tickets", label: "Tickets", icon: <span>✦</span>, badge: 12 },
]} />
```

Use `{ section: "…" }` items to group links under uppercase headings.

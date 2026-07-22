Dashboard KPI widget with label, large display-serif value, delta and optional chart slot.

```jsx
<StatCard label="Occupancy" value="94%" delta="2.1%" trend="up" icon={<span>◈</span>} />
<StatCard label="Open tickets" value="18" delta="4" trend="down" hint="vs. last week" />
```

Use in dashboard grids. The value renders in Cormorant for an editorial feel. Pass a sparkline as `children`.

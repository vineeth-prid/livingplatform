Native select styled to match `Input`, with a soft chevron. Accepts string or `{value,label}` options.

```jsx
<Select label="Community" placeholder="Choose one"
  options={["Riverside", "The Meadows", "Highgrove"]} />
<Select label="Sort" options={[{value:"new",label:"Newest"},{value:"price",label:"Price"}]} />
```

Sizes and error handling mirror `Input`.

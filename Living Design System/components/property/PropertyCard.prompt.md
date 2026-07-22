The signature Living listing card — large editorial photography, restrained meta, a glass favourite button, and a calm hover lift + slow image zoom.

```jsx
<PropertyCard
  image="/homes/riverside.jpg"
  title="Riverside Greens"
  location="Whitefield, Bengaluru"
  status="Available" statusTone="success"
  beds={3} baths={2} area="1,840 sqft"
  price="₹1.85 Cr"
/>
```

Composes `Badge` and `IconButton`. Use in responsive grids (`minmax(300px, 1fr)`). Omit specs/price for a minimal editorial variant.

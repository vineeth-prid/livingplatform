Centred modal over a soft blurred scrim. Title renders in Cormorant. Closes on Escape or scrim click.

```jsx
<Dialog open={open} onClose={close}
  title="Confirm your tour"
  description="We'll hold Saturday 11:00 AM at Riverside Greens."
  footer={<>
    <Button variant="ghost" onClick={close}>Not now</Button>
    <Button variant="primary" onClick={confirm}>Confirm</Button>
  </>}>
  <p>A host will meet you at the clubhouse.</p>
</Dialog>
```

Sizes `sm | md | lg`. Compose action Buttons in `footer`.

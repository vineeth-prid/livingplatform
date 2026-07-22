Quiet text field with warm border and soft Pine focus ring. Supports label, hint, error, and leading/trailing adornments.

```jsx
<Input label="Email" type="email" placeholder="you@living.co" hint="We never share this." />
<Input label="Budget" leading="₹" trailing="/mo" />
<Input label="Password" error="At least 8 characters" />
```

Sizes `sm | md | lg`. Passing `error` swaps to danger styling and shows the message in place of `hint`.

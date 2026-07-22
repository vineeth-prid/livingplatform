# Living Frontend — Developer Guide

Practical how-to for building on the Product Experience Foundation.

## Run

```bash
pnpm install

# Backend must be up for real data (see root README):
#   pnpm infra:up && pnpm --filter @living/api db:migrate && db:seed && dev

cp apps/portal/.env.example apps/portal/.env   # set VITE_API_BASE_URL

pnpm --filter @living/portal dev      # http://localhost:5173
pnpm --filter @living/resident dev    # http://localhost:5174
pnpm --filter @living/workforce dev   # http://localhost:5175
```

Sign in with the seeded admin: `admin@living.local` / `Living!2024`.

Per-app scripts: `dev`, `build`, `typecheck`. Packages expose `typecheck`.

## Where things live

| I need to… | Use |
| --- | --- |
| Call the backend | `living.<engine>.<method>()` — never `fetch` |
| Fetch data in a component | `useQuery` + `qk.*` key + the SDK |
| Read the current user / permissions | `useAuth()`, `usePermissions()` |
| Gate UI by permission | `<Can perm="ticket:create">…</Can>` |
| Gate a route | `<RequireAuth>` / `<RequirePermission>` |
| A component (button, table, dialog…) | import from `@living/ui` |
| Brand color / spacing / radius | Tailwind utility from the preset (`bg-brand`, `rounded-card`) |
| Animate something | `@living/ui/motion` variants + `useReducedMotion()` |
| Toast / confirm | `toast.*`, `useConfirm()` |
| A command-palette action | `useCommandPalette().register([...])` |
| Theme switch | `<ThemeSwitch/>` / `useTheme()` |

## Adding a feature screen (the pattern)

```tsx
function TicketsPage() {
  const [params, setParams] = useState({ page: 1 });
  const q = useQuery({
    queryKey: qk.tickets(communityId, params),
    queryFn: () => living.ticket.list(communityId, params),
  });

  if (q.isError) return <ErrorState error={q.error} onRetry={q.refetch} />;

  return (
    <PageContainer>
      <PageHeader title="Tickets" actions={
        <Can perm="ticket:create"><Button>New ticket</Button></Can>
      } />
      <DataTable
        loading={q.isLoading}
        rows={q.data?.items ?? []}
        rowKey={(t) => t.id}
        columns={[
          { key: 'number', header: 'Ticket', cell: (t) => t.ticketNumber },
          { key: 'status', header: 'Status', cell: (t) => <Badge dot>{t.status}</Badge> },
        ]}
      />
      {q.data && <Pagination meta={q.data.meta} onPageChange={(page) => setParams({ page })} />}
    </PageContainer>
  );
}
```

Register the route under the portal's `dashboardRoute` in `src/router.tsx`. Done —
no package changes.

## Conventions

- **Never call `fetch`.** Add a method to the relevant SDK resource instead.
- **Never hardcode a color/space value.** Use a token utility.
- **New shared component?** It goes in `@living/ui`, not in an app.
- **Permission strings** must match the backend catalog (`resource:action`).
- Motion is opt-in and reduced-motion-aware; keep it purposeful.
```

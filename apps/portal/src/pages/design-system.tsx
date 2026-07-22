import { useState } from 'react';
import { Bell, Plus } from 'lucide-react';
import {
  Badge, Button, Card, CardDescription, CardHeader, CardTitle,
  DataTable, Dialog, DialogContent, DialogFooter, DialogTrigger,
  EmptyState, Input, PageContainer, PageHeader, PageTransition,
  StatCard, Timeline, toast, Tooltip, useConfirm, type Column,
} from '@living/ui';

interface DemoRow {
  id: string;
  unit: string;
  status: string;
  tone: 'success' | 'warning' | 'danger' | 'info';
}

const rows: DemoRow[] = [
  { id: '1', unit: 'A-1203', status: 'Open', tone: 'info' },
  { id: '2', unit: 'B-0402', status: 'In progress', tone: 'warning' },
  { id: '3', unit: 'A-0101', status: 'Resolved', tone: 'success' },
];

const columns: Column<DemoRow>[] = [
  { key: 'unit', header: 'Unit', cell: (r) => <span className="font-mono" data-numeric>{r.unit}</span> },
  { key: 'status', header: 'Status', cell: (r) => <Badge tone={r.tone} dot>{r.status}</Badge> },
];

/** Living component-library showcase — proves every primitive renders on-brand
 *  in both themes. Not a business page; a foundation reference. */
export function DesignSystemPage() {
  const confirm = useConfirm();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <PageTransition>
      <PageContainer>
        <PageHeader
          eyebrow="Foundation"
          title="Component library"
          description="Buttons, inputs, cards, tables, overlays, states — all on Living tokens, theme-aware."
        />

        <Section title="Stat cards">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Open tickets" value="24" delta={{ value: '12%', direction: 'up' }} icon={Bell} />
            <StatCard label="Resolved today" value="18" delta={{ value: '4%', direction: 'down', positive: false }} />
            <StatCard label="Critical" value="2" />
          </div>
        </Section>

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Primary</Button>
            <Button variant="accent">Accent</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button loading>Loading</Button>
            <Button size="icon" aria-label="Add"><Plus className="h-4 w-4" /></Button>
          </div>
        </Section>

        <Section title="Badges & tooltip">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">Neutral</Badge>
            <Badge tone="brand" dot>Brand</Badge>
            <Badge tone="success" dot>Success</Badge>
            <Badge tone="warning" dot>Warning</Badge>
            <Badge tone="danger" dot>Danger</Badge>
            <Badge tone="info" dot>Info</Badge>
            <Tooltip content="A quiet ink label">
              <Button variant="secondary" size="sm">Hover me</Button>
            </Tooltip>
          </div>
        </Section>

        <Section title="Input & feedback">
          <div className="grid max-w-md gap-4">
            <Input label="Community name" placeholder="The Arbour" hint="Shown across the portal." />
            <Input label="Code" placeholder="ARB" error="At least 2 characters." />
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => toast.success('Saved changes')}>Toast</Button>
              <Button
                variant="danger"
                onClick={async () => {
                  if (await confirm({ title: 'Delete this record?', tone: 'danger', confirmLabel: 'Delete' })) {
                    toast.success('Deleted');
                  }
                }}
              >
                Confirm dialog
              </Button>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">Open dialog</Button>
                </DialogTrigger>
                <DialogContent open={dialogOpen} title="A calm modal" description="Fade + rise over a soft scrim.">
                  <p className="text-sm text-muted">Radix handles focus trapping and escape; Framer supplies the motion.</p>
                  <DialogFooter>
                    <Button variant="secondary" onClick={() => setDialogOpen(false)}>Close</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </Section>

        <Section title="Data table">
          <Card variant="elevated" padded={false} className="overflow-hidden">
            <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />
          </Card>
        </Section>

        <div className="grid gap-4 md:grid-cols-2">
          <Section title="Timeline">
            <Timeline
              items={[
                { id: '1', title: 'Ticket created', timestamp: '2h ago' },
                { id: '2', title: 'Assigned to Suresh', meta: 'Facility Manager', timestamp: '1h ago' },
                { id: '3', title: 'Marked in progress', timestamp: '20m ago' },
              ]}
            />
          </Section>
          <Section title="Empty state">
            <EmptyState
              title="No saved views yet"
              description="Create a filter and save it to see it here."
              action={<Button size="sm" variant="secondary">Create view</Button>}
            />
          </Section>
        </div>
      </PageContainer>
    </PageTransition>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <Card variant="quiet" className="bg-transparent p-0">
        <CardHeader className="mb-3">
          <CardTitle className="text-sm uppercase tracking-wider text-subtle">{title}</CardTitle>
          <CardDescription className="sr-only">{title}</CardDescription>
        </CardHeader>
      </Card>
      {children}
    </section>
  );
}

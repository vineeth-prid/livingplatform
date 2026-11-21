import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Palette } from 'lucide-react';
import { contrast, type CommunityTheme } from '@living/design-system';
import { Button, Card, toast, useConfirm } from '@living/ui';

import { living } from '../../lib/living';
import { FormGrid, SelectField } from '../shared/form-kit';

const COLOURS: { key: keyof CommunityTheme; label: string; hint: string }[] = [
  { key: 'primary', label: 'Primary', hint: 'Buttons, active tabs, links' },
  { key: 'secondary', label: 'Secondary', hint: 'Soft tinted surfaces' },
  { key: 'accent', label: 'Accent', hint: 'Highlights' },
  { key: 'background', label: 'Background', hint: 'Page' },
  { key: 'surface', label: 'Surface', hint: 'Cards and dialogs' },
  { key: 'textPrimary', label: 'Primary text', hint: 'Headings and body' },
  { key: 'textSecondary', label: 'Secondary text', hint: 'Captions and hints' },
];
const HEX = /^#[0-9a-f]{6}$/i;
const WEIGHTS = [300, 400, 500, 600, 700, 800].map((w) => ({ value: String(w), label: String(w) }));

/**
 * The community's app theme — colours, font and weights applied across the
 * admin portal and the resident and workforce apps. Empty = Living's theme.
 * Contrast is checked as you type, and the apps refuse unreadable text colours
 * anyway (see design-system/community-theme).
 */
export function ThemeCard({ communityId, theme, canEdit }: { communityId: string; theme: CommunityTheme | null; canEdit: boolean }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [t, setT] = useState<CommunityTheme>(theme ?? {});
  const [saving, setSaving] = useState(false);
  useEffect(() => setT(theme ?? {}), [theme]);

  const set = (k: keyof CommunityTheme, v: string | number | undefined) =>
    setT((cur) => {
      const next = { ...cur, [k]: v === '' ? undefined : v } as CommunityTheme;
      if (next[k] === undefined) delete next[k];
      return next;
    });
  const valid = COLOURS.every(({ key }) => !t[key] || HEX.test(String(t[key])));
  const page = t.background ?? '#faf8f4';
  const warnings = [
    t.textPrimary && contrast(t.textPrimary, page) < 4.5 ? 'Primary text is hard to read on the background — the apps will keep Living’s text colour.' : null,
    t.textSecondary && contrast(t.textSecondary, page) < 4.5 ? 'Secondary text is hard to read on the background — the apps will keep Living’s.' : null,
  ].filter(Boolean) as string[];

  async function save(next: CommunityTheme | null) {
    setSaving(true);
    try {
      await living.community.updateSettings(communityId, { theme: next && Object.keys(next).length ? next : null });
      await qc.invalidateQueries({ queryKey: ['community', communityId] });
      toast.success(next ? 'Theme saved — the apps update on their next load' : 'Living theme restored');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const primary = t.primary ?? 'var(--brand-primary)';
  return (
    <Card variant="elevated" className="mb-6">
      <div className="mb-4 flex items-start gap-3">
        <Palette className="mt-0.5 h-5 w-5 text-muted" />
        <div>
          <h2 className="font-display text-h4 tracking-tight text-strong">App theme</h2>
          <p className="text-sm text-muted">Your brand colours and font across the admin portal, the resident app and the staff &amp; vendor app. Leave a colour empty to keep Living’s.</p>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {COLOURS.map(({ key, label, hint }) => (
              <label key={key} className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-strong">{label} <span className="font-normal text-subtle">· {hint}</span></span>
                <span className="flex items-center gap-2">
                  <input type="color" aria-label={`${label} colour picker`} disabled={!canEdit}
                    value={HEX.test(String(t[key] ?? '')) ? String(t[key]) : '#ffffff'}
                    onChange={(e) => set(key, e.target.value)}
                    className="h-11 w-12 shrink-0 cursor-pointer rounded-control border border-border bg-raised p-1" />
                  <input value={String(t[key] ?? '')} placeholder="Living default" disabled={!canEdit}
                    onChange={(e) => set(key, e.target.value.trim())}
                    className={`h-11 w-full min-w-0 rounded-control border bg-raised px-3 font-mono text-sm text-strong outline-none focus-visible:shadow-ring ${t[key] && !HEX.test(String(t[key])) ? 'border-danger-fg' : 'border-border'}`} />
                </span>
              </label>
            ))}
          </div>
          <FormGrid>
            <SelectField label="Font" value={t.fontFamily ?? ''} disabled={!canEdit} onChange={(v) => set('fontFamily', v || undefined)} placeholder="Living default (Geist)"
              options={[{ value: 'geist', label: 'Geist' }, { value: 'lexend', label: 'Lexend (rounded geometric)' }]} />
            <div className="grid grid-cols-2 gap-3">
              <SelectField label="Heading weight" value={t.headingWeight ? String(t.headingWeight) : ''} disabled={!canEdit} onChange={(v) => set('headingWeight', v ? Number(v) : undefined)} options={WEIGHTS} placeholder="Default" />
              <SelectField label="Body weight" value={t.bodyWeight ? String(t.bodyWeight) : ''} disabled={!canEdit} onChange={(v) => set('bodyWeight', v ? Number(v) : undefined)} options={WEIGHTS} placeholder="Default" />
            </div>
          </FormGrid>
          {warnings.map((w) => <p key={w} className="text-sm text-warning-fg">{w}</p>)}
        </div>

        {/* Live preview with the chosen values (inline — it never touches the page's theme). */}
        <div className="rounded-card border border-border-subtle p-4" aria-label="Theme preview"
          style={{ background: t.background ?? 'var(--surface-page)', fontFamily: t.fontFamily === 'lexend' ? '"Lexend Variable", sans-serif' : undefined }}>
          <p className="text-2xs font-semibold uppercase tracking-wider" style={{ color: t.textSecondary ?? 'var(--text-muted)' }}>Preview</p>
          <p className="mt-1 text-h4" style={{ color: t.textPrimary ?? 'var(--text-strong)', fontWeight: t.headingWeight }}>Good afternoon.</p>
          <div className="mt-3 rounded-card p-3 shadow-sm" style={{ background: t.surface ?? 'var(--surface-card)' }}>
            <p className="text-sm" style={{ color: t.textPrimary ?? 'var(--text-body)', fontWeight: t.bodyWeight }}>Maintenance due ₹5,330</p>
            <p className="text-xs" style={{ color: t.textSecondary ?? 'var(--text-muted)' }}>Due 10 December</p>
          </div>
          <div className="mt-3 flex gap-2">
            <span className="rounded-control px-3 py-1.5 text-sm font-medium" style={{ background: primary, color: t.primary ? (contrast('#ffffff', t.primary) >= contrast('#111111', t.primary) ? '#fff' : '#111') : 'var(--brand-on-primary)' }}>Pay now</span>
            {t.accent && <span className="rounded-control px-3 py-1.5 text-sm" style={{ border: `1px solid ${t.accent}`, color: t.accent }}>New</span>}
          </div>
        </div>
      </div>
      {canEdit && (
        <div className="mt-4 flex flex-wrap justify-end gap-3">
          {theme && (
            <Button variant="ghost" disabled={saving} onClick={async () => {
              if (await confirm({ title: 'Restore the Living theme?', description: 'Your colours and font are removed from every app.', confirmLabel: 'Restore' })) await save(null);
            }}>Restore Living theme</Button>
          )}
          <Button loading={saving} disabled={!valid} onClick={() => void save(t)}>Save theme</Button>
        </div>
      )}
    </Card>
  );
}

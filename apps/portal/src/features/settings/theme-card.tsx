import { useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown } from 'lucide-react';
import { contrast, type CommunityTheme } from '@living/design-system';
import { Button, Card, CommunityLogo, toast, useConfirm } from '@living/ui';
import { cn } from '@living/utils';

import { living } from '../../lib/living';
import { useCommunity } from '../community/community-context';

type ColourKey = 'primary' | 'secondary' | 'accent' | 'background' | 'surface' | 'textPrimary' | 'textSecondary';

const MAIN: { key: ColourKey; label: string; hint: string }[] = [
  { key: 'primary', label: 'Primary', hint: 'Buttons & headers' },
  { key: 'secondary', label: 'Secondary', hint: 'Soft tints' },
  { key: 'accent', label: 'Accent', hint: 'Highlights' },
];
const ADVANCED: { key: ColourKey; label: string }[] = [
  { key: 'background', label: 'Page background' },
  { key: 'surface', label: 'Cards' },
  { key: 'textPrimary', label: 'Text' },
  { key: 'textSecondary', label: 'Muted text' },
];
// Living's own values — what an empty field means, so swatches never look blank.
const LIVING: Record<ColourKey, string> = {
  primary: '#234b39', secondary: '#e7e1d5', accent: '#b96a43',
  background: '#faf8f4', surface: '#ffffff', textPrimary: '#14110f', textSecondary: '#6a6255',
};
const PRESETS: { name: string; colours: Partial<Record<'primary' | 'secondary' | 'accent', string>> }[] = [
  { name: 'Living', colours: {} },
  { name: 'Harbour', colours: { primary: '#002A44', secondary: '#33C4ED', accent: '#EF3F35' } },
  { name: 'Forest', colours: { primary: '#1F5133', secondary: '#A8D5BA', accent: '#E0A526' } },
  { name: 'Ocean', colours: { primary: '#0B5D7A', secondary: '#BFE6F0', accent: '#FF7A59' } },
  { name: 'Plum', colours: { primary: '#4B2A59', secondary: '#D9C3E3', accent: '#E36F5A' } },
  { name: 'Terracotta', colours: { primary: '#9A4A2E', secondary: '#F1D3C2', accent: '#2F6F73' } },
  { name: 'Slate', colours: { primary: '#2B3A4A', secondary: '#C9D6E3', accent: '#F2A541' } },
];
const FONTS = [
  { value: undefined, label: 'Geist', hint: 'Clean & neutral', family: '"Geist Variable", sans-serif' },
  { value: 'lexend' as const, label: 'Lexend', hint: 'Rounded & friendly', family: '"Lexend Variable", sans-serif' },
];
const HEX = /^#[0-9a-f]{6}$/i;
const WEIGHTS = [300, 400, 500, 600, 700, 800];
const readable = (bg: string) => (contrast('#ffffff', bg) >= contrast('#111111', bg) ? '#ffffff' : '#111111');
const tint = (hex: string) => `color-mix(in srgb, ${hex} 20%, white)`; // as the apps derive secondary

/**
 * The community's brand — logo, palette and typeface — for the admin portal and
 * the resident and workforce apps. Three colours and a font cover it; the
 * finer colours and weights sit under "Advanced". Empty = Living's value.
 * The apps still refuse unreadable text colours (design-system/community-theme).
 */
export function ThemeCard({
  communityId, theme, canEdit, logo,
}: { communityId: string; theme: CommunityTheme | null; canEdit: boolean; logo: ReactNode }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { community } = useCommunity();
  const logoUrl = (community as { logoUrl?: string | null } | null)?.logoUrl ?? null;
  const [t, setT] = useState<CommunityTheme>(theme ?? {});
  const [saving, setSaving] = useState(false);
  useEffect(() => setT(theme ?? {}), [theme]);

  const set = (patch: Partial<CommunityTheme>) =>
    setT((cur) => {
      const next = { ...cur, ...patch } as Record<string, unknown>;
      for (const k of Object.keys(next)) if (next[k] === undefined || next[k] === '') delete next[k];
      return next as CommunityTheme;
    });
  const value = (k: ColourKey) => (HEX.test(String(t[k] ?? '')) ? String(t[k]) : LIVING[k]);
  const allKeys = [...MAIN, ...ADVANCED].map((c) => c.key);
  const valid = allKeys.every((k) => !t[k] || HEX.test(String(t[k])));
  const dirty = JSON.stringify(t) !== JSON.stringify(theme ?? {});
  const activePreset = PRESETS.find((p) =>
    MAIN.every(({ key }) => (p.colours[key as 'primary'] ?? '').toLowerCase() === String(t[key] ?? '').toLowerCase()),
  )?.name;
  const textWarning = (['textPrimary', 'textSecondary'] as const).some(
    (k) => t[k] && HEX.test(String(t[k])) && contrast(String(t[k]), value('background')) < 4.5,
  );

  async function save(next: CommunityTheme | null) {
    setSaving(true);
    try {
      await living.community.updateSettings(communityId, { theme: next && Object.keys(next).length ? next : null });
      await qc.invalidateQueries({ queryKey: ['community', communityId] });
      toast.success(next ? 'Brand saved — the apps update on their next load' : 'Living theme restored');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const font = FONTS.find((f) => f.value === t.fontFamily) ?? FONTS[0]!;
  const primary = value('primary');

  return (
    <Card variant="elevated" className="mb-6 overflow-hidden p-0">
      <div className="border-b border-border-subtle px-6 py-5">
        <h2 className="font-display text-h4 tracking-tight text-strong">Brand</h2>
        <p className="mt-0.5 text-sm text-muted">Your logo, colours and typeface — across the admin portal, the resident app and the staff &amp; vendor app.</p>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px]">
        <div className="divide-y divide-border-subtle">
          <Section title="Logo" hint="PNG, JPG or WebP up to 2 MB. Transparent works best.">{logo}</Section>

          <Section title="Colour palette" hint="Start from a palette, then fine-tune.">
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => {
                const on = activePreset === p.name;
                return (
                  <button
                    key={p.name}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => set({ primary: p.colours.primary, secondary: p.colours.secondary, accent: p.colours.accent })}
                    className={cn(
                      'group flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 text-sm transition-colors disabled:opacity-60',
                      on ? 'border-transparent bg-strong/5 text-strong ring-2 ring-[var(--brand-primary)]' : 'border-border-subtle text-body hover:bg-sunken',
                    )}
                  >
                    <span className="flex -space-x-1.5">
                      {MAIN.map(({ key }) => (
                        <span key={key} className="h-5 w-5 rounded-full ring-2 ring-[var(--surface-card)]"
                          style={{ background: p.colours[key as 'primary'] ?? LIVING[key] }} />
                      ))}
                    </span>
                    {p.name}
                    {on && <Check className="h-3.5 w-3.5" />}
                  </button>
                );
              })}
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              {MAIN.map(({ key, label, hint }) => (
                <Swatch key={key} label={label} hint={hint} value={value(key)} custom={!!t[key]} disabled={!canEdit}
                  onChange={(v) => set({ [key]: v })} />
              ))}
            </div>
          </Section>

          <Section title="Typeface">
            <div className="grid grid-cols-2 gap-3">
              {FONTS.map((f) => {
                const on = font.label === f.label;
                return (
                  <button
                    key={f.label}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => set({ fontFamily: f.value })}
                    className={cn(
                      'flex items-center gap-3 rounded-card border p-3 text-left transition-colors disabled:opacity-60',
                      on ? 'border-transparent ring-2 ring-[var(--brand-primary)]' : 'border-border-subtle hover:bg-sunken',
                    )}
                  >
                    <span className="text-[1.75rem] leading-none text-strong" style={{ fontFamily: f.family }}>Aa</span>
                    <span>
                      <span className="block text-sm font-medium text-strong">{f.label}{!f.value && <span className="font-normal text-subtle"> · default</span>}</span>
                      <span className="block text-xs text-muted">{f.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Section>

          <details className="group px-6 py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-strong">
              Advanced
              <span className="flex items-center gap-1 text-xs font-normal text-muted">
                Page, card and text colours · weights
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
              </span>
            </summary>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {ADVANCED.map(({ key, label }) => (
                <Swatch key={key} label={label} value={value(key)} custom={!!t[key]} disabled={!canEdit} compact
                  onChange={(v) => set({ [key]: v })} />
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:max-w-sm">
              {(['headingWeight', 'bodyWeight'] as const).map((k) => (
                <label key={k} className="flex flex-col gap-1 text-xs text-muted">
                  {k === 'headingWeight' ? 'Heading weight' : 'Body weight'}
                  <select
                    value={t[k] ? String(t[k]) : ''}
                    disabled={!canEdit}
                    onChange={(e) => set({ [k]: e.target.value ? Number(e.target.value) : undefined })}
                    className="h-9 rounded-control border border-border bg-raised px-2 text-sm text-strong"
                  >
                    <option value="">Default</option>
                    {WEIGHTS.map((w) => <option key={w} value={w}>{w}</option>)}
                  </select>
                </label>
              ))}
            </div>
            {textWarning && (
              <p className="mt-3 text-xs text-warning-fg">A text colour is hard to read on the page background — the apps will keep Living’s.</p>
            )}
          </details>
        </div>

        {/* Live preview with the chosen values (inline — it never touches the page's theme). */}
        <div className="flex items-center justify-center border-t border-border-subtle bg-sunken/60 p-6 lg:border-l lg:border-t-0">
          <div aria-label="Theme preview" className="w-[248px] overflow-hidden rounded-[2rem] border-[6px] border-[#1c1917] shadow-xl"
            style={{ background: value('background'), fontFamily: font.family }}>
            <div className="px-4 pb-5 pt-4" style={{ background: primary, color: readable(primary) }}>
              <div className="flex items-center gap-2">
                <span className="flex h-8 items-center rounded-lg bg-white px-1.5">
                  {logoUrl ? <img src={logoUrl} alt="" className="h-6 max-w-[90px] object-contain" />
                    : <CommunityLogo name={community?.name} className="h-6 w-6 text-xs" />}
                </span>
                <span className="truncate text-xs opacity-80">{community?.name ?? 'Your community'}</span>
              </div>
              <p className="mt-4 text-lg" style={{ fontWeight: t.headingWeight ?? 600 }}>Good afternoon.</p>
            </div>
            <div className="space-y-2.5 p-3">
              <div className="rounded-xl p-3 shadow-sm" style={{ background: value('surface') }}>
                <div className="flex items-center justify-between">
                  <p className="text-[13px]" style={{ color: value('textPrimary'), fontWeight: t.bodyWeight }}>Maintenance due</p>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: value('accent'), color: readable(value('accent')) }}>Due soon</span>
                </div>
                <p className="mt-1 text-lg font-semibold" style={{ color: value('textPrimary') }}>₹5,330</p>
                <p className="text-[11px]" style={{ color: value('textSecondary') }}>Due 10 December</p>
                <span className="mt-2.5 block rounded-lg py-2 text-center text-xs font-semibold" style={{ background: primary, color: readable(primary) }}>Pay now</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {['Visitors', 'Services', 'Clubhouse'].map((s) => (
                  <div key={s} className="rounded-xl py-2.5 text-center text-[10px] font-medium" style={{ background: t.secondary ? tint(value('secondary')) : LIVING.secondary, color: value('textPrimary') }}>{s}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle px-6 py-3">
          <span className="text-xs text-muted">{dirty ? 'Unsaved changes' : theme ? 'Custom brand in use' : 'Using the Living theme'}</span>
          <div className="flex gap-2">
            {dirty && <Button variant="ghost" size="sm" disabled={saving} onClick={() => setT(theme ?? {})}>Discard</Button>}
            {theme && !dirty && (
              <Button variant="ghost" size="sm" disabled={saving} onClick={async () => {
                if (await confirm({ title: 'Restore the Living theme?', description: 'Your colours and font are removed from every app.', confirmLabel: 'Restore' })) await save(null);
              }}>Restore Living theme</Button>
            )}
            <Button size="sm" loading={saving} disabled={!valid || !dirty} onClick={() => void save(t)}>Save brand</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="px-6 py-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium text-strong">{title}</h3>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/** A colour: the swatch opens the native picker; the hex is editable beside it. */
function Swatch({
  label, hint, value, custom, disabled, compact, onChange,
}: { label: string; hint?: string; value: string; custom: boolean; disabled: boolean; compact?: boolean; onChange: (v: string | undefined) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <div className={cn('rounded-card border border-border-subtle', compact ? 'p-2' : 'p-3')}>
      <label className="relative block cursor-pointer">
        <span className={cn('block w-full rounded-control ring-1 ring-inset ring-black/10', compact ? 'h-8' : 'h-14')} style={{ background: value }} />
        <input type="color" aria-label={`${label} colour`} disabled={disabled} value={value}
          onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
      </label>
      <p className={cn('mt-2 text-strong', compact ? 'text-xs' : 'text-sm font-medium')}>{label}</p>
      {hint && <p className="text-xs text-subtle">{hint}</p>}
      <div className="mt-1 flex items-center gap-1">
        <input
          aria-label={`${label} hex`}
          value={draft.toUpperCase()}
          disabled={disabled}
          onChange={(e) => {
            const v = e.target.value.trim();
            setDraft(v);
            if (HEX.test(v)) onChange(v);
          }}
          onBlur={() => setDraft(value)}
          className="w-full min-w-0 bg-transparent font-mono text-xs text-muted outline-none focus:text-strong"
        />
        {custom && !disabled && (
          <button type="button" onClick={() => onChange(undefined)} className="shrink-0 text-2xs text-subtle hover:text-strong" title="Use the Living default">
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

import { useId } from 'react';

/**
 * Lightweight, dependency-free SVG charts for the Platform Admin portal. They
 * scale to their container (viewBox + preserveAspectRatio) and read the Living
 * design tokens through `currentColor` / CSS vars, so they theme automatically.
 *
 * ponytail: hand-rolled SVG — no charting library for a handful of read-only
 * charts. Swap in a real lib only if interactive tooltips/zoom become a need.
 */

export interface Point { label: string; value: number }

const PALETTE = [
  'var(--brand-primary)', '#6A9C89', '#C4A35A', '#8C6A9C', '#5A8CC4', '#C46A6A', '#6AC4A3', '#9C8C6A',
];

const niceMax = (max: number) => {
  if (max <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  return Math.ceil(max / pow) * pow;
};

/** Filled area line chart with an x-axis of labels. */
export function AreaChart({ data, height = 180 }: { data: Point[]; height?: number }) {
  const gid = useId();
  if (data.length === 0) return <Empty height={height} />;
  const w = 600;
  const h = height;
  const pad = { top: 12, right: 8, bottom: 22, left: 8 };
  const max = niceMax(Math.max(...data.map((d) => d.value)));
  const iw = w - pad.left - pad.right;
  const ih = h - pad.top - pad.bottom;
  const x = (i: number) => pad.left + (data.length === 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v: number) => pad.top + ih - (v / max) * ih;
  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d.value)}`).join(' ');
  const area = `${line} L ${x(data.length - 1)} ${pad.top + ih} L ${x(0)} ${pad.top + ih} Z`;
  const step = Math.ceil(data.length / 6);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full text-brand" preserveAspectRatio="none" role="img">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      {data.map((d, i) => (i % step === 0 || i === data.length - 1) && (
        <text key={i} x={x(i)} y={h - 6} textAnchor="middle" className="fill-[var(--text-subtle)]" style={{ fontSize: 10 }}>
          {d.label}
        </text>
      ))}
    </svg>
  );
}

/** Vertical or horizontal bar chart. Horizontal is better for many categories. */
export function BarChart({ data, height = 200, horizontal = false }: { data: Point[]; height?: number; horizontal?: boolean }) {
  if (data.length === 0) return <Empty height={height} />;
  const max = niceMax(Math.max(...data.map((d) => d.value)));

  if (horizontal) {
    return (
      <div className="flex flex-col gap-2.5">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-3">
            <span className="w-28 shrink-0 truncate text-sm text-muted" title={d.label}>{d.label}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-sunken">
              <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(d.value / max) * 100}%` }} />
            </div>
            <span className="w-10 shrink-0 text-right text-sm font-medium text-strong" data-numeric>{d.value}</span>
          </div>
        ))}
      </div>
    );
  }

  const w = 600;
  const h = height;
  const pad = { top: 10, right: 8, bottom: 24, left: 8 };
  const iw = w - pad.left - pad.right;
  const ih = h - pad.top - pad.bottom;
  const bw = (iw / data.length) * 0.6;
  const gap = (iw / data.length) * 0.4;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" role="img">
      {data.map((d, i) => {
        const bh = (d.value / max) * ih;
        const bx = pad.left + i * (bw + gap) + gap / 2;
        return (
          <g key={d.label}>
            <rect x={bx} y={pad.top + ih - bh} width={bw} height={bh} rx={3} className="fill-brand" />
            <text x={bx + bw / 2} y={h - 8} textAnchor="middle" className="fill-[var(--text-subtle)]" style={{ fontSize: 10 }}>
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Donut chart with a legend — for category/type distributions. */
export function DonutChart({ data, height = 200 }: { data: Point[]; height?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <Empty height={height} />;
  const r = 70;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 180 180" style={{ height, width: height }} role="img">
        <g transform="translate(90 90) rotate(-90)">
          {data.map((d, i) => {
            const frac = d.value / total;
            const dash = frac * c;
            const seg = (
              <circle key={d.label} r={r} fill="none" strokeWidth={22}
                stroke={PALETTE[i % PALETTE.length]}
                strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-offset} />
            );
            offset += dash;
            return seg;
          })}
        </g>
        <text x="90" y="86" textAnchor="middle" className="fill-[var(--text-strong)] font-display" style={{ fontSize: 26 }} data-numeric>{total}</text>
        <text x="90" y="104" textAnchor="middle" className="fill-[var(--text-subtle)]" style={{ fontSize: 11 }}>total</text>
      </svg>
      <ul className="flex flex-col gap-1.5">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="text-muted">{d.label}</span>
            <span className="font-medium text-strong" data-numeric>{d.value}</span>
            <span className="text-subtle">({Math.round((d.value / total) * 100)}%)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Empty({ height }: { height: number }) {
  return (
    <div className="flex items-center justify-center text-sm text-subtle" style={{ height }}>
      No data yet
    </div>
  );
}

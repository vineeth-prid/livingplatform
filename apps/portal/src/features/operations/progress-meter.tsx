/** A calm horizontal progress meter (0–100). Shared by any execution entity. */
export function ProgressMeter({ percent, label }: { percent: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm text-body">{label ?? 'Progress'}</span>
        <span className="font-mono text-sm font-medium text-strong" data-numeric>{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-pill bg-sunken">
        <div
          className="h-full rounded-pill bg-brand transition-[width] duration-slow ease-out motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

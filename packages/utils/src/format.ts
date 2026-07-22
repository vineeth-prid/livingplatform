/** Formatting helpers — Indian locale, tabular-friendly. No date library. */

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/** ₹1,85,000 — Indian digit grouping. */
export function formatINR(amount: number): string {
  return INR.format(amount);
}

/** 1,840 — Indian digit grouping, no currency. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value);
}

function toDate(value: string | number | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/** 20 Jul 2026 */
export function formatDate(value: string | number | Date): string {
  return toDate(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** 20 Jul 2026, 11:00 AM */
export function formatDateTime(value: string | number | Date): string {
  return toDate(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const RELATIVE = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
  ['second', 1],
];

/** "2 hours ago" / "in 3 days" */
export function timeAgo(value: string | number | Date): string {
  const seconds = Math.round((toDate(value).getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  for (const [unit, secs] of UNITS) {
    if (abs >= secs || unit === 'second') {
      return RELATIVE.format(Math.round(seconds / secs), unit);
    }
  }
  return 'just now';
}

/** Up to two initials from a name. */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

/** 248 KB */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = bytes / 1024;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(size >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

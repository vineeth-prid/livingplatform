/**
 * Parse a short duration string (`"15m"`, `"7d"`, `"30s"`, `"12h"`) into
 * milliseconds. Used to turn config TTLs into concrete expiry Dates.
 */
const UNIT_MS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

export function durationToMs(value: string): number {
  const match = /^(\d+)\s*([smhd])$/.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid duration: "${value}" (expected e.g. 15m, 7d)`);
  }
  const amount = Number(match[1]);
  const unit = match[2] as keyof typeof UNIT_MS;
  return amount * UNIT_MS[unit];
}

export function expiryFrom(value: string, from: Date = new Date()): Date {
  return new Date(from.getTime() + durationToMs(value));
}

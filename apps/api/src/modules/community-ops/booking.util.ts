import { BadRequestException } from '@nestjs/common';

/**
 * Pure amenity-booking rules — no I/O. Time-range validity, the future/booking-
 * window guard, operating-hours checks and slot overlap. The service layers the
 * DB checks (capacity count, amenity active) on top.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export function assertValidTimeRange(start: Date, end: Date): void {
  if (end.getTime() <= start.getTime()) {
    throw new BadRequestException('endTime must be after startTime');
  }
}

/** Bookings must be in the future and within the amenity's booking window. */
export function assertFutureWithinWindow(start: Date, windowDays: number, now: Date): void {
  if (start.getTime() <= now.getTime()) {
    throw new BadRequestException('Bookings must be for a future time');
  }
  if (start.getTime() > now.getTime() + windowDays * DAY_MS) {
    throw new BadRequestException(`Bookings can be made at most ${windowDays} day(s) in advance`);
  }
}

export interface OperatingHours { openingTime?: string | null; closingTime?: string | null }

function parseHhMm(value?: string | null): number | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Wall-clock minutes past midnight, read in the community's own timezone.
 *
 * This used to be `d.getHours() * 60 + d.getMinutes()`, which reads the clock of
 * whatever machine the API happens to run on. Bookings arrive as absolute UTC
 * instants and opening hours are stored as local wall-clock strings ("06:00"),
 * so on a UTC server every Indian morning was shifted back 5h30m: a 10:00 IST
 * booking was evaluated as 04:30, landed before a 06:00 opening, and came back
 * as "outside the amenity operating hours". The resident's own client-side
 * check passed, because it compared the local strings — so the app said the
 * slot was fine and the server then refused it.
 */
function minutesOfDay(d: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  // 24:00 is a legal en-GB rendering of midnight; normalise it to 0.
  return (hour % 24) * 60 + minute;
}

/**
 * Enforce the slot sits within the amenity's opening hours (no-op if unset).
 *
 * `timezone` is the community's (schema default `Asia/Kolkata`) — the hours are
 * that community's wall clock, not the server's.
 */
export function assertWithinOperatingHours(
  start: Date,
  end: Date,
  hours?: OperatingHours | null,
  timezone = 'Asia/Kolkata',
): void {
  const open = parseHhMm(hours?.openingTime);
  const close = parseHhMm(hours?.closingTime);
  if (open == null || close == null) return; // unrestricted
  if (minutesOfDay(start, timezone) < open || minutesOfDay(end, timezone) > close) {
    throw new BadRequestException('Booking falls outside the amenity operating hours');
  }
}

/**
 * Enforce the amenity's maximum booking length (no-op when unset).
 *
 * Separate from the operating-hours check: a facility open 06:00–22:00 with a
 * two-hour cap should reject a 16-hour booking that technically sits inside
 * those hours. Without this one resident could hold a shared facility all day.
 */
export function assertWithinMaxDuration(
  start: Date,
  end: Date,
  maxMinutes?: number | null,
): void {
  if (!maxMinutes || maxMinutes <= 0) return; // unrestricted
  const minutes = (end.getTime() - start.getTime()) / 60000;
  if (minutes > maxMinutes) {
    throw new BadRequestException(
      `A booking can be at most ${formatMinutes(maxMinutes)} for this amenity`,
    );
  }
}

/** "2h 30m" / "45m" — an error message in raw minutes is hard to act on. */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Two half-open intervals [aStart,aEnd) and [bStart,bEnd) overlap. */
export function bookingsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

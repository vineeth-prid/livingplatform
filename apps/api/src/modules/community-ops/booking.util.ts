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

const minutesOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes();

/** Enforce the slot sits within the amenity's opening hours (no-op if unset). */
export function assertWithinOperatingHours(start: Date, end: Date, hours?: OperatingHours | null): void {
  const open = parseHhMm(hours?.openingTime);
  const close = parseHhMm(hours?.closingTime);
  if (open == null || close == null) return; // unrestricted
  if (minutesOfDay(start) < open || minutesOfDay(end) > close) {
    throw new BadRequestException('Booking falls outside the amenity operating hours');
  }
}

/** Two half-open intervals [aStart,aEnd) and [bStart,bEnd) overlap. */
export function bookingsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

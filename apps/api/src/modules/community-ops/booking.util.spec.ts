import { BadRequestException } from '@nestjs/common';

import {
  assertFutureWithinWindow, assertValidTimeRange, assertWithinMaxDuration,
  assertWithinOperatingHours, bookingsOverlap,
} from './booking.util';

const at = (h: number, m = 0) => { const d = new Date('2026-08-01T00:00:00'); d.setHours(h, m, 0, 0); return d; };

describe('assertValidTimeRange', () => {
  it('accepts end after start; rejects otherwise', () => {
    expect(() => assertValidTimeRange(at(10), at(11))).not.toThrow();
    expect(() => assertValidTimeRange(at(11), at(10))).toThrow(BadRequestException);
    expect(() => assertValidTimeRange(at(10), at(10))).toThrow(BadRequestException);
  });
});

describe('assertFutureWithinWindow', () => {
  const now = new Date('2026-07-22T09:00:00Z');
  it('rejects past bookings', () => {
    expect(() => assertFutureWithinWindow(new Date('2026-07-22T08:00:00Z'), 30, now)).toThrow(BadRequestException);
  });
  it('rejects beyond the window', () => {
    expect(() => assertFutureWithinWindow(new Date('2026-09-30T09:00:00Z'), 30, now)).toThrow(BadRequestException);
  });
  it('accepts a future booking inside the window', () => {
    expect(() => assertFutureWithinWindow(new Date('2026-07-25T09:00:00Z'), 30, now)).not.toThrow();
  });
});

describe('assertWithinOperatingHours', () => {
  it('is a no-op when hours are unset', () => {
    expect(() => assertWithinOperatingHours(at(2), at(4), null)).not.toThrow();
    expect(() => assertWithinOperatingHours(at(2), at(4), { openingTime: 'bad', closingTime: null })).not.toThrow();
  });
  it('enforces opening/closing bounds', () => {
    expect(() => assertWithinOperatingHours(at(7), at(9), { openingTime: '06:00', closingTime: '22:00' })).not.toThrow();
    expect(() => assertWithinOperatingHours(at(5), at(7), { openingTime: '06:00', closingTime: '22:00' })).toThrow(BadRequestException);
    expect(() => assertWithinOperatingHours(at(21), at(23), { openingTime: '06:00', closingTime: '22:00' })).toThrow(BadRequestException);
  });
});

describe('bookingsOverlap', () => {
  it('detects overlap and abutment correctly', () => {
    expect(bookingsOverlap(at(10), at(12), at(11), at(13))).toBe(true);
    expect(bookingsOverlap(at(10), at(12), at(12), at(13))).toBe(false); // touching, not overlapping
    expect(bookingsOverlap(at(10), at(12), at(8), at(9))).toBe(false);
    expect(bookingsOverlap(at(10), at(12), at(9), at(11))).toBe(true);
  });
});

describe('assertWithinMaxDuration', () => {
  it('is a no-op when no ceiling is configured', () => {
    // Null/0 must mean "unlimited" — that is what every existing amenity has,
    // so treating it as a limit would break bookings that work today.
    expect(() => assertWithinMaxDuration(at(9), at(20), null)).not.toThrow();
    expect(() => assertWithinMaxDuration(at(9), at(20), 0)).not.toThrow();
    expect(() => assertWithinMaxDuration(at(9), at(20), undefined)).not.toThrow();
  });

  it('allows a booking exactly at the limit', () => {
    expect(() => assertWithinMaxDuration(at(9), at(11), 120)).not.toThrow();
  });

  it('rejects a booking longer than the limit', () => {
    expect(() => assertWithinMaxDuration(at(9), at(12), 120)).toThrow(BadRequestException);
  });

  /**
   * The case the ceiling exists for: a slot that sits happily inside opening
   * hours but hogs the facility for the whole day.
   */
  it('rejects an all-day booking inside opening hours', () => {
    const hours = { openingTime: '06:00', closingTime: '22:00' };
    expect(() => assertWithinOperatingHours(at(6), at(22), hours)).not.toThrow();
    expect(() => assertWithinMaxDuration(at(6), at(22), 120)).toThrow(BadRequestException);
  });

  it('reports the limit in a form a resident can act on', () => {
    expect(() => assertWithinMaxDuration(at(9), at(12), 90)).toThrow(/1h 30m/);
    expect(() => assertWithinMaxDuration(at(9), at(12), 45)).toThrow(/45m/);
    expect(() => assertWithinMaxDuration(at(9), at(12), 120)).toThrow(/2h/);
  });
});

import { BadRequestException } from '@nestjs/common';

import { assertWithinOperatingHours } from './booking.util';

/**
 * Opening hours are a community's wall clock; bookings arrive as absolute UTC
 * instants. Reading the hour off the server's clock silently subtracts the
 * offset, so on a UTC host every Indian morning booking was judged against the
 * wrong time and refused as "outside the amenity operating hours" — while the
 * resident's own client-side check, comparing local strings, said it was fine.
 *
 * These cases are written in UTC on purpose: they must hold whatever timezone
 * the test machine or the VPS happens to be in. The rest of booking.util.spec
 * builds local Dates, so it passes either way and could not catch this.
 */
const HOURS = { openingTime: '06:00', closingTime: '22:00' };
const IST = 'Asia/Kolkata';

/** An absolute instant, written as UTC. */
const utc = (iso: string) => new Date(`2026-08-01T${iso}Z`);

describe('operating hours are read in the community timezone', () => {
  it('accepts a 10:00–11:00 IST booking (04:30–05:30 UTC)', () => {
    // The exact case from the field: before the fix this read as 04:30 on a UTC
    // server, fell before the 06:00 opening, and was rejected.
    expect(() => assertWithinOperatingHours(utc('04:30:00'), utc('05:30:00'), HOURS, IST)).not.toThrow();
  });

  it('accepts a booking that ends at closing time, 22:00 IST (16:30 UTC)', () => {
    expect(() => assertWithinOperatingHours(utc('15:30:00'), utc('16:30:00'), HOURS, IST)).not.toThrow();
  });

  it('still rejects a genuinely out-of-hours slot — 04:00 IST (22:30 UTC prev day)', () => {
    expect(() => assertWithinOperatingHours(utc('22:30:00'), utc('23:00:00'), HOURS, IST))
      .toThrow(BadRequestException);
  });

  it('rejects a slot running past closing — 21:30–23:00 IST', () => {
    expect(() => assertWithinOperatingHours(utc('16:00:00'), utc('17:30:00'), HOURS, IST))
      .toThrow(BadRequestException);
  });

  it('applies the given zone, not one baked in', () => {
    // 04:30Z is 04:30 in London (inside hours) and 00:30 in New York (outside).
    expect(() => assertWithinOperatingHours(utc('06:30:00'), utc('07:30:00'), HOURS, 'Europe/London')).not.toThrow();
    expect(() => assertWithinOperatingHours(utc('04:30:00'), utc('05:30:00'), HOURS, 'America/New_York'))
      .toThrow(BadRequestException);
  });

  it('defaults to Asia/Kolkata when no zone is supplied', () => {
    expect(() => assertWithinOperatingHours(utc('04:30:00'), utc('05:30:00'), HOURS)).not.toThrow();
  });
});

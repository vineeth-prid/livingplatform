const DAY = 86_400_000;

/**
 * The package validity window, as pure arithmetic.
 *
 * Two rules the service depends on, kept here so they can be reasoned about
 * without a database:
 *
 *  1. A package becomes bookable `activationDelayDays` after PAYMENT — a bundle
 *     is a scheduling commitment, not an on-demand call-out.
 *  2. `durationDays` is counted from that point, NOT from payment. Counting it
 *     from payment would silently charge the resident for lead time they cannot
 *     use — a 90-day package with a 2-day delay would give 88 usable days.
 */
function activationWindow(paidAt: Date, activationDelayDays: number, durationDays: number) {
  const validFrom = new Date(paidAt.getTime() + activationDelayDays * DAY);
  const validUntil = new Date(validFrom.getTime() + durationDays * DAY);
  return { validFrom, validUntil };
}

const isBookable = (
  now: Date,
  window: { validFrom: Date; validUntil: Date },
): boolean => now >= window.validFrom && now <= window.validUntil;

const PAID = new Date('2026-08-01T10:00:00.000Z');

describe('package activation window', () => {
  it('opens two days after payment by default', () => {
    const { validFrom } = activationWindow(PAID, 2, 90);
    expect(validFrom.toISOString()).toBe('2026-08-03T10:00:00.000Z');
  });

  it('gives the resident the FULL duration they paid for', () => {
    const { validFrom, validUntil } = activationWindow(PAID, 2, 90);
    expect((validUntil.getTime() - validFrom.getTime()) / DAY).toBe(90);
  });

  it('is bookable immediately when the delay is zero', () => {
    const window = activationWindow(PAID, 0, 30);
    expect(window.validFrom.getTime()).toBe(PAID.getTime());
    expect(isBookable(PAID, window)).toBe(true);
  });

  it('refuses a redemption during the lead time', () => {
    const window = activationWindow(PAID, 2, 90);
    expect(isBookable(new Date('2026-08-01T11:00:00.000Z'), window)).toBe(false);
    expect(isBookable(new Date('2026-08-02T23:59:00.000Z'), window)).toBe(false);
  });

  it('allows a redemption once the window opens', () => {
    const window = activationWindow(PAID, 2, 90);
    expect(isBookable(new Date('2026-08-03T10:00:01.000Z'), window)).toBe(true);
    expect(isBookable(new Date('2026-09-15T00:00:00.000Z'), window)).toBe(true);
  });

  it('refuses a redemption after the window closes', () => {
    const window = activationWindow(PAID, 2, 90);
    expect(isBookable(new Date('2026-11-05T00:00:00.000Z'), window)).toBe(false);
  });
});

/**
 * Property-type scoping. An empty `propertyTypes` array means "offered to
 * everyone"; a populated one restricts the package. Getting this backwards is
 * how a 1BHK-only bundle ended up in every resident's app.
 */
function isOfferedTo(packagePropertyTypes: string[], residentType: string | null): boolean {
  if (packagePropertyTypes.length === 0) return true;
  if (!residentType) return false;
  return packagePropertyTypes.includes(residentType);
}

describe('package property-type scoping', () => {
  it('offers an unrestricted package to everyone', () => {
    expect(isOfferedTo([], '2BHK')).toBe(true);
    expect(isOfferedTo([], null)).toBe(true);
  });

  it('offers a restricted package only to a matching unit', () => {
    expect(isOfferedTo(['1BHK'], '1BHK')).toBe(true);
    expect(isOfferedTo(['1BHK'], '2BHK')).toBe(false);
    expect(isOfferedTo(['1BHK', '2BHK'], '2BHK')).toBe(true);
  });

  /**
   * The actual bug: the resident app sent no property type, the filter was
   * skipped, and every package was returned. A resident whose type cannot be
   * resolved must see only unrestricted packages — never everything.
   */
  it('hides a restricted package when the resident type is unknown', () => {
    expect(isOfferedTo(['1BHK'], null)).toBe(false);
  });
});

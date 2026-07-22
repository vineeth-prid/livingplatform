import { durationToMs, expiryFrom } from './duration';

describe('durationToMs', () => {
  it('parses each unit', () => {
    expect(durationToMs('30s')).toBe(30_000);
    expect(durationToMs('15m')).toBe(900_000);
    expect(durationToMs('12h')).toBe(43_200_000);
    expect(durationToMs('7d')).toBe(604_800_000);
  });

  it('tolerates surrounding whitespace', () => {
    expect(durationToMs(' 1d ')).toBe(86_400_000);
  });

  it('rejects malformed input', () => {
    expect(() => durationToMs('')).toThrow();
    expect(() => durationToMs('10')).toThrow();
    expect(() => durationToMs('5w')).toThrow();
    expect(() => durationToMs('abc')).toThrow();
  });

  it('expiryFrom adds the duration to the base time', () => {
    const base = new Date('2026-01-01T00:00:00.000Z');
    expect(expiryFrom('1d', base).toISOString()).toBe(
      '2026-01-02T00:00:00.000Z',
    );
  });
});

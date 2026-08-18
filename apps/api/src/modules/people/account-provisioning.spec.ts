import { normalizePhone } from './account-provisioning.service';

describe('normalizePhone', () => {
  it('reduces a number to the 10 digits that identify it', () => {
    expect(normalizePhone('9876543210')).toBe('9876543210');
    expect(normalizePhone('(987) 654-3210')).toBe('9876543210');
  });

  /**
   * The reason this exists. The number IS the login username, so every spelling
   * of one person's mobile has to reduce to the same key — otherwise the same
   * person gets a second account the first time someone types a country code.
   * This previously kept the country code, and did exactly that.
   */
  it.each(['+91 98765 43210', '0091-9876543210', '09876543210', '98765 43210'])(
    '%s is the same person as 9876543210',
    (spelling) => {
      expect(normalizePhone(spelling)).toBe('9876543210');
    },
  );

  it('leaves a too-short value alone rather than padding it into a valid-looking key', () => {
    // Rejected upstream as a username; reshaping it here would hide a bad input.
    expect(normalizePhone('12345')).toBe('12345');
  });
});

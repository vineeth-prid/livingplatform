import { normalizePhone, ONE_TIME_PASSWORD } from './account-provisioning.service';

describe('normalizePhone', () => {
  it('strips spaces, symbols and country-code punctuation to a digit key', () => {
    expect(normalizePhone('+91 98765 43210')).toBe('919876543210');
    expect(normalizePhone('9876543210')).toBe('9876543210');
    expect(normalizePhone('(987) 654-3210')).toBe('9876543210');
  });

  it('makes two spellings of the same number collide', () => {
    expect(normalizePhone('98765 43210')).toBe(normalizePhone('9876543210'));
  });

  it('the one-time password is the documented shared secret', () => {
    expect(ONE_TIME_PASSWORD).toBe('Living@123');
  });
});

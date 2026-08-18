import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { IsString, validateSync } from 'class-validator';

import { IsMobileNumber } from './is-mobile-number.decorator';

class Person {
  @IsString() @IsMobileNumber()
  mobile!: string;
}

const check = (mobile: string) =>
  validateSync(plainToInstance(Person, { mobile })).length === 0;

/**
 * The number IS the login username — it is reduced to its last 10 digits and
 * becomes the account. `@MinLength(4)` therefore accepted values that could
 * never be a login: a 4-digit extension, or an over-long typo that silently
 * truncated onto somebody else's number.
 */
describe('IsMobileNumber', () => {
  it.each([
    '9876543210',
    '+91 98765 43210',
    '+919876543210',
    '0091-9876543210',
    '09876543210',
    '98765-43210',
  ])('accepts %s — all the ways one number gets typed', (value) => {
    expect(check(value)).toBe(true);
  });

  it.each([
    ['1234', 'too short to be a mobile'],
    ['98765432101234', 'over-long — used to truncate onto another number'],
    ['987654321', 'nine digits'],
    ['5876543210', 'starts 5 — not a mobile range, cannot receive the OTP'],
    ['0000000000', 'starts 0 after the trunk prefix is consumed'],
    ['abcdefghij', 'not digits at all'],
    ['', 'empty'],
  ])('rejects %s (%s)', (value) => {
    expect(check(value)).toBe(false);
  });

  it('rejects the 12-digit value from the report rather than truncating it', () => {
    // The reported bug: more than 10 digits was accepted, then normalisation
    // kept only the last 10 — quietly creating an account for a different number.
    expect(check('919876543210' + '99')).toBe(false);
  });
});

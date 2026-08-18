import { applyDecorators } from '@nestjs/common';
import { Matches, MaxLength } from 'class-validator';

/**
 * An Indian mobile number, in any spelling a person actually types.
 *
 * This number is not a contact detail — it IS the login username (it is reduced
 * to its last 10 digits and becomes the account). So `@MinLength(4)` accepted
 * things that could never be a login: a 4-digit extension, or a 15-digit typo
 * that silently truncated to a completely different person's number.
 *
 * Accepted: an optional +/0/91 country or trunk prefix, then exactly 10 digits
 * starting 6–9, with spaces or hyphens anywhere.
 *
 *   9876543210 · +91 98765 43210 · 0091-9876543210 · 09876543210
 *
 * Rejected: fewer or more than 10 significant digits, and numbers starting 0–5,
 * which are landline or invalid ranges and cannot receive the OTP the account
 * depends on.
 */
const INDIAN_MOBILE = /^(?:\+?0{0,2}91[\s-]?|0)?[6-9](?:[\s-]?\d){9}$/;

export const MOBILE_NUMBER_MESSAGE =
  'Enter a valid 10-digit mobile number (a +91 or 0 prefix is fine). ' +
  'This number becomes the login username.';

export function IsMobileNumber(): PropertyDecorator {
  return applyDecorators(
    MaxLength(20),
    Matches(INDIAN_MOBILE, { message: MOBILE_NUMBER_MESSAGE }),
  );
}

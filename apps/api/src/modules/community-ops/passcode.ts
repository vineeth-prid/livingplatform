import { randomInt } from 'node:crypto';

// Crockford-ish alphabet: no 0/O/1/I/L to keep gate codes easy to read aloud.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/** A short, human-readable gate pass code (uniqueness is enforced by the caller). */
export function generatePassCode(length = 6): string {
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

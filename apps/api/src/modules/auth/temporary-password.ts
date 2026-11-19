import { randomInt } from 'node:crypto';

// No 0/O/1/I/L — these are read out over the phone or the counter.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/**
 * A fresh one-time password for a provisioned or admin-reset account, e.g.
 * "K7QM-4TRX-9HPA" (~59 bits). Every account gets its OWN value: a single
 * shared one-time password let anyone who knew it sign in as any neighbour
 * whose phone number they knew, before that neighbour ever did.
 */
export function generateTemporaryPassword(): string {
  const group = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  return `${group()}-${group()}-${group()}`;
}

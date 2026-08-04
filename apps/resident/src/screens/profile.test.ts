import { describe, expect, it } from 'vitest';

import { contactLine } from './profile';

describe('contactLine', () => {
  it('prefers the resident record mobile over anything on the user', () => {
    expect(contactLine('9876543210@living.local', '+91 98765 43210')).toBe('+91 98765 43210');
    expect(contactLine('aisha@example.com', '+91 98765 43210')).toBe('+91 98765 43210');
  });

  it('unwraps the synthetic phone-derived email a provisioned account carries', () => {
    expect(contactLine('9876543210@living.local')).toBe('9876543210');
    expect(contactLine('9876543210@LIVING.LOCAL')).toBe('9876543210');
  });

  it('shows a genuine email as-is', () => {
    expect(contactLine('aisha@example.com')).toBe('aisha@example.com');
    // …including a real address that merely lives on the local domain.
    expect(contactLine('association@living.local')).toBe('association@living.local');
  });

  it('renders nothing rather than "undefined" when there is no contact at all', () => {
    expect(contactLine(undefined, null)).toBe('');
  });
});

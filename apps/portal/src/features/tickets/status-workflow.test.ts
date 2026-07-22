import { describe, expect, it } from 'vitest';

import { allowedStatusActions, isTerminal, permissionForStatus } from './status-workflow';

const ALL = ['ticket:update', 'ticket:resolve', 'ticket:close'];

describe('status-workflow', () => {
  it('offers only valid transitions from a status', () => {
    const tos = allowedStatusActions('OPEN', ALL).map((a) => a.to);
    expect(tos).toEqual(['ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'CANCELLED']);
    expect(tos).not.toContain('CLOSED'); // OPEN can't jump to CLOSED
  });

  it('gates resolve/close behind their permissions', () => {
    const withoutResolve = allowedStatusActions('IN_PROGRESS', ['ticket:update']);
    expect(withoutResolve.map((a) => a.to)).not.toContain('RESOLVED');
    const withResolve = allowedStatusActions('IN_PROGRESS', ['ticket:update', 'ticket:resolve']);
    expect(withResolve.map((a) => a.to)).toContain('RESOLVED');
  });

  it('close requires ticket:close', () => {
    expect(permissionForStatus('CLOSED')).toBe('ticket:close');
    expect(allowedStatusActions('RESOLVED', ['ticket:update']).map((a) => a.to)).not.toContain('CLOSED');
    expect(allowedStatusActions('RESOLVED', ['ticket:close']).map((a) => a.to)).toContain('CLOSED');
  });

  it('labels a reopen distinctly', () => {
    const reopen = allowedStatusActions('CLOSED', ALL).find((a) => a.to === 'IN_PROGRESS');
    expect(reopen?.label).toBe('Reopen');
  });

  it('treats CANCELLED as terminal', () => {
    expect(isTerminal('CANCELLED')).toBe(true);
    expect(allowedStatusActions('CANCELLED', ALL)).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';

import { isActive, workerActions } from './execution';

const ALL = [
  'workorder:start', 'workorder:complete', 'workorder:update',
  'service:complete', 'service:update', 'ticket:resolve', 'ticket:update',
];

describe('workerActions', () => {
  it('offers accept + start on an assigned work order, complete hidden until in progress', () => {
    const a = workerActions('work-order', 'ASSIGNED', ALL);
    const intents = a.map((x) => x.intent);
    expect(intents).toContain('accept');
    expect(intents).toContain('start');
    expect(intents).not.toContain('complete');
  });

  it('makes complete the primary action while a work order is in progress', () => {
    const a = workerActions('work-order', 'IN_PROGRESS', ALL);
    const primary = a.find((x) => x.primary);
    expect(primary?.intent).toBe('complete');
    expect(a.map((x) => x.intent)).toContain('pause');
  });

  it('resumes (not starts) from ON_HOLD', () => {
    const a = workerActions('work-order', 'ON_HOLD', ALL);
    expect(a.map((x) => x.intent)).toContain('resume');
    expect(a.map((x) => x.intent)).not.toContain('start');
  });

  it('never offers admin-only moves (verify/close/cancel/assign)', () => {
    const a = workerActions('work-order', 'COMPLETED', ALL);
    // COMPLETED → VERIFIED/IN_PROGRESS/CANCELLED: only the reopen (start) is a worker verb.
    expect(a.every((x) => x.intent !== 'complete')).toBe(true);
    expect(a.map((x) => x.to)).not.toContain('VERIFIED');
    expect(a.map((x) => x.to)).not.toContain('CLOSED');
    expect(a.map((x) => x.to)).not.toContain('CANCELLED');
  });

  it('hides actions the worker lacks permission for', () => {
    const a = workerActions('work-order', 'IN_PROGRESS', ['workorder:update']);
    // No workorder:complete → no complete button, but pause (update) stays.
    expect(a.map((x) => x.intent)).not.toContain('complete');
    expect(a.map((x) => x.intent)).toContain('pause');
  });

  it('service request: accept then start then complete; reject available early', () => {
    expect(workerActions('service-request', 'ASSIGNED', ALL).map((x) => x.intent)).toEqual(
      expect.arrayContaining(['accept', 'reject']),
    );
    expect(workerActions('service-request', 'ACCEPTED', ALL).map((x) => x.intent)).toContain('start');
    const inProg = workerActions('service-request', 'IN_PROGRESS', ALL);
    expect(inProg.find((x) => x.primary)?.intent).toBe('complete');
  });

  it('ticket: resolve is the finishing worker move, not close', () => {
    const a = workerActions('ticket', 'IN_PROGRESS', ALL);
    expect(a.find((x) => x.primary)?.intent).toBe('resolve');
    expect(a.map((x) => x.to)).not.toContain('CLOSED');
  });

  it('terminal states yield no worker actions', () => {
    expect(workerActions('service-request', 'COMPLETED', ALL)).toHaveLength(0);
    expect(workerActions('work-order', 'CLOSED', ALL)).toHaveLength(0);
  });
});

describe('isActive', () => {
  it('marks finished jobs inactive', () => {
    expect(isActive('work-order', 'IN_PROGRESS')).toBe(true);
    expect(isActive('work-order', 'COMPLETED')).toBe(false);
    expect(isActive('service-request', 'REJECTED')).toBe(false);
    expect(isActive('ticket', 'RESOLVED')).toBe(false);
  });
});

/**
 * Terminal states are terminal for a WORKER.
 *
 * The map used to offer IN_PROGRESS from COMPLETED / VERIFIED / CLOSED, which
 * rendered a "Start work" button on finished jobs. The API then refused the
 * transition, so the only thing the button produced was an error message.
 * Reopening is a manager decision made in the portal.
 */
describe('finished jobs offer a worker nothing', () => {
  const all = ['workorder:start', 'workorder:complete', 'workorder:update',
    'ticket:resolve', 'ticket:update', 'service:complete', 'service:update'];

  it('offers no action on a completed or verified work order', () => {
    expect(workerActions('work-order', 'COMPLETED', all)).toEqual([]);
    expect(workerActions('work-order', 'VERIFIED', all)).toEqual([]);
    expect(workerActions('work-order', 'CLOSED', all)).toEqual([]);
  });

  it('offers no action on a resolved or closed ticket', () => {
    expect(workerActions('ticket', 'RESOLVED', all)).toEqual([]);
    expect(workerActions('ticket', 'CLOSED', all)).toEqual([]);
  });

  /** In-flight work is unaffected — the worker can still act on it. */
  it('still offers the normal moves on live work', () => {
    expect(workerActions('work-order', 'IN_PROGRESS', all).map((a) => a.intent))
      .toContain('complete');
    expect(workerActions('ticket', 'IN_PROGRESS', all).map((a) => a.intent))
      .toContain('resolve');
  });
});

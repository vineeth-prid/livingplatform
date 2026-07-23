import { BadRequestException } from '@nestjs/common';
import { WorkOrderStatus as W } from '@prisma/client';

import { WorkOrderStatusService } from './work-order-status.service';
import { formatWorkOrderNumber } from './work-order.service';

describe('WorkOrderStatusService (transitions)', () => {
  const svc = new WorkOrderStatusService();

  it('routes the approval lane (recommend → approve → execution)', () => {
    expect(svc.canTransition(W.PENDING_APPROVAL, W.APPROVED)).toBe(true);
    expect(svc.canTransition(W.PENDING_APPROVAL, W.REJECTED)).toBe(true);
    expect(svc.canTransition(W.APPROVED, W.ASSIGNED)).toBe(true);
    // A recommendation cannot jump straight into execution.
    expect(svc.canTransition(W.PENDING_APPROVAL, W.ASSIGNED)).toBe(false);
    expect(svc.canTransition(W.APPROVED, W.IN_PROGRESS)).toBe(false);
    // REJECTED is terminal.
    expect(svc.isTerminal(W.REJECTED)).toBe(true);
  });

  it('allows the happy-path lifecycle', () => {
    expect(svc.canTransition(W.DRAFT, W.ASSIGNED)).toBe(true);
    expect(svc.canTransition(W.ASSIGNED, W.ACCEPTED)).toBe(true);
    expect(svc.canTransition(W.ACCEPTED, W.IN_PROGRESS)).toBe(true);
    expect(svc.canTransition(W.IN_PROGRESS, W.COMPLETED)).toBe(true);
    expect(svc.canTransition(W.COMPLETED, W.VERIFIED)).toBe(true);
    expect(svc.canTransition(W.VERIFIED, W.CLOSED)).toBe(true);
  });

  it('enforces verify-before-close (COMPLETED cannot go straight to CLOSED)', () => {
    expect(svc.canTransition(W.COMPLETED, W.CLOSED)).toBe(false);
    expect(() => svc.assertTransition(W.COMPLETED, W.CLOSED)).toThrow(
      BadRequestException,
    );
  });

  it('allows on-hold detours and resume', () => {
    expect(svc.canTransition(W.IN_PROGRESS, W.ON_HOLD)).toBe(true);
    expect(svc.canTransition(W.ON_HOLD, W.IN_PROGRESS)).toBe(true);
  });

  it('allows redo/reopen back to in-progress', () => {
    expect(svc.canTransition(W.COMPLETED, W.IN_PROGRESS)).toBe(true);
    expect(svc.canTransition(W.VERIFIED, W.IN_PROGRESS)).toBe(true);
  });

  it('rejects illegal jumps', () => {
    expect(svc.canTransition(W.DRAFT, W.IN_PROGRESS)).toBe(false);
    expect(svc.canTransition(W.ASSIGNED, W.COMPLETED)).toBe(false);
  });

  it('treats CLOSED / CANCELLED as terminal', () => {
    expect(svc.isTerminal(W.CLOSED)).toBe(true);
    expect(svc.isTerminal(W.CANCELLED)).toBe(true);
    expect(svc.allowedNext(W.CLOSED)).toEqual([]);
  });
});

describe('formatWorkOrderNumber', () => {
  it('zero-pads to a stable display number', () => {
    expect(formatWorkOrderNumber(1)).toBe('WO-000001');
    expect(formatWorkOrderNumber(90210)).toBe('WO-090210');
  });
});

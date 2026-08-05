import { BadRequestException } from '@nestjs/common';
import { TicketStatus } from '@prisma/client';

import { TicketStatusService } from './ticket-status.service';
import { formatTicketNumber } from './ticket.service';

describe('TicketStatusService (transitions)', () => {
  const svc = new TicketStatusService();

  it('allows the happy-path lifecycle', () => {
    expect(svc.canTransition(TicketStatus.OPEN, TicketStatus.ASSIGNED)).toBe(true);
    expect(svc.canTransition(TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS)).toBe(true);
    expect(svc.canTransition(TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED)).toBe(true);
    expect(svc.canTransition(TicketStatus.RESOLVED, TicketStatus.CLOSED)).toBe(true);
  });

  it('allows reopening a RESOLVED ticket — it has not been closed out yet', () => {
    expect(svc.canTransition(TicketStatus.RESOLVED, TicketStatus.IN_PROGRESS)).toBe(true);
  });

  /**
   * CLOSED is terminal, matching work orders.
   *
   * It used to be reopenable — commented "privileged" but gated by nothing — so
   * a closed ticket could be restarted from the portal and the staff app alike
   * and closure meant nothing. Work that resurfaces belongs in a NEW ticket
   * referencing the old one, not in a closed one coming back to life with its
   * resolution timestamps still attached.
   */
  it('treats CLOSED as terminal — no reopening from anywhere', () => {
    expect(svc.canTransition(TicketStatus.CLOSED, TicketStatus.IN_PROGRESS)).toBe(false);
    expect(svc.canTransition(TicketStatus.CLOSED, TicketStatus.OPEN)).toBe(false);
    expect(svc.canTransition(TicketStatus.CLOSED, TicketStatus.ASSIGNED)).toBe(false);
    expect(svc.canTransition(TicketStatus.CLOSED, TicketStatus.RESOLVED)).toBe(false);
  });

  it('rejects illegal jumps', () => {
    expect(svc.canTransition(TicketStatus.OPEN, TicketStatus.RESOLVED)).toBe(false);
    expect(svc.canTransition(TicketStatus.OPEN, TicketStatus.CLOSED)).toBe(false);
    expect(svc.canTransition(TicketStatus.CLOSED, TicketStatus.OPEN)).toBe(false);
  });

  it('rejects a no-op transition', () => {
    expect(svc.canTransition(TicketStatus.OPEN, TicketStatus.OPEN)).toBe(false);
  });

  it('treats CANCELLED as terminal', () => {
    expect(svc.isTerminal(TicketStatus.CANCELLED)).toBe(true);
    expect(svc.allowedNext(TicketStatus.CANCELLED)).toEqual([]);
  });

  it('assertTransition throws on an invalid transition', () => {
    expect(() =>
      svc.assertTransition(TicketStatus.OPEN, TicketStatus.CLOSED),
    ).toThrow(BadRequestException);
    expect(() =>
      svc.assertTransition(TicketStatus.OPEN, TicketStatus.ASSIGNED),
    ).not.toThrow();
  });
});

describe('formatTicketNumber', () => {
  it('zero-pads to a stable display number', () => {
    expect(formatTicketNumber(1)).toBe('TKT-000001');
    expect(formatTicketNumber(123)).toBe('TKT-000123');
    expect(formatTicketNumber(1234567)).toBe('TKT-1234567');
  });
});

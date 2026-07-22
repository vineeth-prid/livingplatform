import { BadRequestException } from '@nestjs/common';
import { ServiceRequestStatus as S } from '@prisma/client';

import { ServiceRequestStatusService } from './service-request-status.service';
import { formatServiceRequestNumber } from './service-request.service';

describe('ServiceRequestStatusService (workflow)', () => {
  const svc = new ServiceRequestStatusService();

  it('allows the happy-path lifecycle', () => {
    expect(svc.canTransition(S.REQUESTED, S.ASSIGNED)).toBe(true);
    expect(svc.canTransition(S.ASSIGNED, S.ACCEPTED)).toBe(true);
    expect(svc.canTransition(S.ACCEPTED, S.SCHEDULED)).toBe(true);
    expect(svc.canTransition(S.SCHEDULED, S.IN_PROGRESS)).toBe(true);
    expect(svc.canTransition(S.IN_PROGRESS, S.COMPLETED)).toBe(true);
  });

  it('allows accepting straight into in-progress (no scheduling)', () => {
    expect(svc.canTransition(S.ACCEPTED, S.IN_PROGRESS)).toBe(true);
  });

  it('allows cancelling from active states', () => {
    expect(svc.canTransition(S.REQUESTED, S.CANCELLED)).toBe(true);
    expect(svc.canTransition(S.IN_PROGRESS, S.CANCELLED)).toBe(true);
    expect(svc.canTransition(S.ASSIGNED, S.REJECTED)).toBe(true);
  });

  it('rejects illegal jumps', () => {
    expect(svc.canTransition(S.REQUESTED, S.COMPLETED)).toBe(false);
    expect(svc.canTransition(S.ASSIGNED, S.COMPLETED)).toBe(false);
    expect(svc.canTransition(S.REQUESTED, S.IN_PROGRESS)).toBe(false);
  });

  it('treats COMPLETED / CANCELLED / REJECTED as terminal', () => {
    expect(svc.isTerminal(S.COMPLETED)).toBe(true);
    expect(svc.isTerminal(S.CANCELLED)).toBe(true);
    expect(svc.isTerminal(S.REJECTED)).toBe(true);
    expect(svc.allowedNext(S.COMPLETED)).toEqual([]);
  });

  it('assertTransition throws on an invalid transition', () => {
    expect(() => svc.assertTransition(S.REQUESTED, S.COMPLETED)).toThrow(
      BadRequestException,
    );
    expect(() => svc.assertTransition(S.REQUESTED, S.ASSIGNED)).not.toThrow();
  });
});

describe('formatServiceRequestNumber', () => {
  it('zero-pads to a stable display number', () => {
    expect(formatServiceRequestNumber(1)).toBe('SRQ-000001');
    expect(formatServiceRequestNumber(4321)).toBe('SRQ-004321');
  });
});

import { BadRequestException } from '@nestjs/common';
import { WorkOrderStatus } from '@prisma/client';

/**
 * The approval flow, as rules rather than plumbing.
 *
 * Staff review a ticket. If the fix costs money it needs a manager's decision,
 * and the ticket is parked meanwhile — leaving it IN_PROGRESS would tell the
 * resident somebody is working while nobody can. Either answer releases it:
 * approval because the work can now happen, rejection because the staff member
 * carries on WITHOUT the paid work. Rejection is a decision about the spending,
 * never about the problem.
 */
const W = WorkOrderStatus;

/** Cost decides the lane — that is the only branch. */
function laneFor(labour: number, material: number): WorkOrderStatus {
  return labour + material > 0 ? W.PENDING_APPROVAL : W.DRAFT;
}

/** What the originating ticket should read while / after the decision. */
function ticketStatusAfter(
  event: 'recommended' | 'approved' | 'rejected',
  current: string,
): string {
  if (event === 'recommended') {
    return ['OPEN', 'ASSIGNED', 'IN_PROGRESS'].includes(current) ? 'ON_HOLD' : current;
  }
  return current === 'ON_HOLD' ? 'IN_PROGRESS' : current;
}

/** Site evidence gate, mirroring assertEvidence. */
function assertEvidence(to: WorkOrderStatus, photos: { stage: string }[]): void {
  const need = to === W.IN_PROGRESS ? 'BEFORE' : to === W.COMPLETED ? 'AFTER' : null;
  if (!need) return;
  if (!photos.some((p) => p.stage === need)) {
    throw new BadRequestException(`${need} photo required`);
  }
}

describe('work order approval flow', () => {
  it('costs money → goes for approval', () => {
    expect(laneFor(4000, 0)).toBe(W.PENDING_APPROVAL);
    expect(laneFor(0, 12000)).toBe(W.PENDING_APPROVAL);
  });

  it('costs nothing → no approval, staff carry on', () => {
    expect(laneFor(0, 0)).toBe(W.DRAFT);
  });

  it('parks the ticket while a manager decides', () => {
    expect(ticketStatusAfter('recommended', 'IN_PROGRESS')).toBe('ON_HOLD');
    expect(ticketStatusAfter('recommended', 'ASSIGNED')).toBe('ON_HOLD');
  });

  it('does not park a ticket that is already finished', () => {
    expect(ticketStatusAfter('recommended', 'RESOLVED')).toBe('RESOLVED');
    expect(ticketStatusAfter('recommended', 'CLOSED')).toBe('CLOSED');
  });

  it('approval releases the ticket', () => {
    expect(ticketStatusAfter('approved', 'ON_HOLD')).toBe('IN_PROGRESS');
  });

  it('REJECTION also releases it — staff continue without the paid work', () => {
    expect(ticketStatusAfter('rejected', 'ON_HOLD')).toBe('IN_PROGRESS');
  });

  it('leaves a ticket alone that was never parked', () => {
    expect(ticketStatusAfter('approved', 'IN_PROGRESS')).toBe('IN_PROGRESS');
  });
});

describe('site evidence gate', () => {
  it('refuses to start without a before photo', () => {
    expect(() => assertEvidence(W.IN_PROGRESS, [])).toThrow(/BEFORE/);
    expect(() => assertEvidence(W.IN_PROGRESS, [{ stage: 'AFTER' }])).toThrow(/BEFORE/);
  });

  it('refuses to complete without an after photo', () => {
    expect(() => assertEvidence(W.COMPLETED, [{ stage: 'BEFORE' }])).toThrow(/AFTER/);
  });

  it('allows the transition once the right photo exists', () => {
    expect(() => assertEvidence(W.IN_PROGRESS, [{ stage: 'BEFORE' }])).not.toThrow();
    expect(() =>
      assertEvidence(W.COMPLETED, [{ stage: 'BEFORE' }, { stage: 'AFTER' }]),
    ).not.toThrow();
  });

  it('does not gate transitions that are not start or complete', () => {
    expect(() => assertEvidence(W.ON_HOLD, [])).not.toThrow();
    expect(() => assertEvidence(W.CANCELLED, [])).not.toThrow();
  });
});

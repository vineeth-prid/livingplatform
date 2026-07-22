import { BadRequestException } from '@nestjs/common';
import { MaintenanceFrequency } from '@prisma/client';
import parser from 'cron-parser';

/**
 * Pure recurrence math for the Preventive Maintenance engine — the one piece of
 * logic worth unit-testing. No I/O, no Prisma. Given a plan's frequency it
 * computes the next due instant; the scheduler and services use these helpers so
 * cadence never drifts and CUSTOM (cron) plans are handled by a real parser
 * rather than hand-rolled cron logic.
 */

export interface RecurrenceSpec {
  frequencyType: MaintenanceFrequency;
  frequencyInterval: number;
  cronExpression: string | null;
}

const F = MaintenanceFrequency;

/** Add months, clamping the day so Jan 31 + 1mo → Feb 28/29 (never rolls over). */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const targetMonth = d.getMonth() + months;
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(targetMonth);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Validate a CUSTOM plan's cron expression (throws 400 on a syntax error). */
export function assertValidCron(expression: string): void {
  try {
    parser.parseExpression(expression);
  } catch {
    throw new BadRequestException(`Invalid cron expression: "${expression}"`);
  }
}

/** The next occurrence strictly after `from`, per the plan's recurrence. */
export function nextRunFrom(from: Date, spec: RecurrenceSpec): Date {
  const n = Math.max(1, spec.frequencyInterval || 1);
  switch (spec.frequencyType) {
    case F.DAILY: return addDays(from, n);
    case F.WEEKLY: return addDays(from, 7 * n);
    case F.MONTHLY: return addMonths(from, n);
    case F.QUARTERLY: return addMonths(from, 3 * n);
    case F.HALF_YEARLY: return addMonths(from, 6 * n);
    case F.YEARLY: return addMonths(from, 12 * n);
    case F.CUSTOM: {
      if (!spec.cronExpression) {
        throw new BadRequestException('A CUSTOM plan requires a cronExpression');
      }
      return parser.parseExpression(spec.cronExpression, { currentDate: from }).next().toDate();
    }
  }
}

/**
 * Roll the schedule forward from a just-consumed occurrence to the next due
 * instant strictly after `now` — so a plan whose start date was long ago
 * generates ONE work order (not a per-minute backlog) and lands on its next
 * real slot. Capped to avoid pathological tiny intervals looping forever.
 */
export function advanceNextRun(consumedAt: Date, spec: RecurrenceSpec, now: Date): Date {
  let next = nextRunFrom(consumedAt, spec);
  for (let i = 0; i < 10_000 && next.getTime() <= now.getTime(); i++) {
    next = nextRunFrom(next, spec);
  }
  return next;
}

/** The first due instant for a new plan. */
export function computeInitialNextRun(spec: RecurrenceSpec, startDate: Date): Date {
  if (spec.frequencyType === F.CUSTOM) {
    if (!spec.cronExpression) {
      throw new BadRequestException('A CUSTOM plan requires a cronExpression');
    }
    return parser.parseExpression(spec.cronExpression, { currentDate: startDate }).next().toDate();
  }
  return startDate;
}

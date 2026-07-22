import { BadRequestException } from '@nestjs/common';

/**
 * Pure AMC rules — the contract-domain logic worth unit-testing, no I/O. Date
 * validity, SLA consistency, and the time-based status predicates the daily
 * expiry sweep uses.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** A contract's term must be a positive interval. */
export function assertContractDates(startDate: Date, endDate: Date): void {
  if (endDate.getTime() <= startDate.getTime()) {
    throw new BadRequestException('endDate must be after startDate');
  }
}

/** SLA targets must be positive and internally consistent (resolution ≥ response). */
export function assertSlaConsistent(rule: {
  responseTimeMinutes: number;
  resolutionTimeMinutes: number;
  escalationAfterMinutes?: number | null;
}): void {
  if (rule.responseTimeMinutes <= 0 || rule.resolutionTimeMinutes <= 0) {
    throw new BadRequestException('SLA response and resolution times must be positive');
  }
  if (rule.resolutionTimeMinutes < rule.responseTimeMinutes) {
    throw new BadRequestException('resolutionTimeMinutes cannot be less than responseTimeMinutes');
  }
  if (rule.escalationAfterMinutes != null && rule.escalationAfterMinutes < rule.responseTimeMinutes) {
    throw new BadRequestException('escalationAfterMinutes cannot be less than responseTimeMinutes');
  }
}

interface ContractLifecycle {
  status: string;
  endDate: Date;
  renewalReminderDays?: number;
}

/** An active contract whose end date has passed. */
export function isExpired(contract: ContractLifecycle, now: Date): boolean {
  return contract.status === 'ACTIVE' && contract.endDate.getTime() < now.getTime();
}

/** An active contract within its renewal-reminder window (due, not yet expired). */
export function isRenewalDue(contract: ContractLifecycle, now: Date): boolean {
  if (contract.status !== 'ACTIVE') return false;
  const end = contract.endDate.getTime();
  if (end < now.getTime()) return false; // already expired, not "due"
  const windowMs = (contract.renewalReminderDays ?? 30) * DAY_MS;
  return end - now.getTime() <= windowMs;
}

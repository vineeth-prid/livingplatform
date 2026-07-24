import { Injectable, Logger } from '@nestjs/common';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

import { PrismaService } from '../../prisma/prisma.service';
import type { NotificationChannelName } from './notification-channel.interface';

export interface RecipientRef {
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  /** Resolve contact details from one of these people records. */
  residentId?: string;
  staffId?: string;
  vendorId?: string;
  userId?: string;
  /** REQUIRED to resolve a community-scoped person (resident/staff/vendor) —
   *  prevents addressing another community's people by id. Users are platform-
   *  level and resolve without it. */
  communityId?: string;
}

/**
 * Resolves a recipient reference to a concrete channel address. For email that's
 * the email; for whatsapp the phone normalized to E.164. Can also look up
 * contact details from resident/staff/vendor/user records. Channel-independent
 * (roadmap: role/group/AI recipients).
 */
@Injectable()
export class RecipientResolver {
  private readonly logger = new Logger(RecipientResolver.name);
  /** Default region for parsing local phone numbers without a country code. */
  private readonly defaultRegion = 'IN';

  constructor(private readonly prisma: PrismaService) {}

  /** Normalize a phone number to E.164 ("+919876543210"), or null if invalid. */
  toE164(phone?: string | null): string | null {
    if (!phone) return null;
    const parsed = parsePhoneNumberFromString(phone, this.defaultRegion);
    return parsed?.isValid() ? parsed.number : null;
  }

  /** The address to send to on a channel, or null when the recipient lacks it. */
  addressFor(channel: NotificationChannelName, ref: RecipientRef): string | null {
    switch (channel) {
      case 'email':
        return ref.email?.trim() || null;
      case 'whatsapp':
        return this.toE164(ref.phone);
      default:
        return null;
    }
  }

  /** Hydrate a reference from a people record, then resolve the channel address. */
  async resolve(channel: NotificationChannelName, ref: RecipientRef): Promise<string | null> {
    const hydrated = await this.hydrate(ref);
    return this.addressFor(channel, hydrated);
  }

  private async hydrate(ref: RecipientRef): Promise<RecipientRef> {
    if (ref.email || ref.phone) return ref;
    // Community-scoped people (resident/staff/vendor) MUST be resolved within a
    // known community, or one community could address another's people by id.
    const scopedPersonRequested = ref.residentId || ref.staffId || ref.vendorId;
    if (scopedPersonRequested && !ref.communityId) {
      this.logger.warn('Refusing to resolve a community-scoped recipient without a communityId');
      return ref;
    }
    try {
      if (ref.residentId) {
        const r = await this.prisma.resident.findFirst({ where: { id: ref.residentId, communityId: ref.communityId }, select: { email: true, mobile: true, firstName: true } });
        if (r) return { ...ref, email: r.email, phone: r.mobile, name: r.firstName };
      }
      if (ref.staffId) {
        const s = await this.prisma.staff.findFirst({ where: { id: ref.staffId, communityId: ref.communityId }, select: { email: true, phone: true, firstName: true } });
        if (s) return { ...ref, email: s.email, phone: s.phone, name: s.firstName };
      }
      if (ref.vendorId) {
        // Vendors span communities via communityIds[]; scope to the caller's community.
        const v = await this.prisma.vendor.findFirst({ where: { id: ref.vendorId, communityIds: { has: ref.communityId! } }, select: { email: true, phone: true, name: true } });
        if (v) return { ...ref, email: v.email, phone: v.phone, name: v.name };
      }
      if (ref.userId) {
        const u = await this.prisma.user.findUnique({ where: { id: ref.userId }, select: { email: true, firstName: true } });
        if (u) return { ...ref, email: u.email, name: u.firstName };
      }
    } catch (e) {
      this.logger.warn(`Recipient hydration failed: ${(e as Error).message}`);
    }
    return ref;
  }
}

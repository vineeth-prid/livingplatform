import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

export interface EmailSender {
  from?: string;
  replyTo?: string;
}

/**
 * Resolves the per-community SENDER identity for a notification, so a community's
 * mail goes out as that community rather than one shared platform address. Reads
 * CommunitySettings.customSettings.sender (the schema's Json escape hatch — no
 * migration): `{ email, name, replyTo }`. Falls back to the global provider
 * default (returns {}), so platform-level notifications are unaffected.
 *
 * ponytail: email From only. Per-community WhatsApp sender needs a distinct Meta
 * phone-number id per community — a Meta onboarding feature, not a config lookup;
 * until then WhatsApp uses the single configured number. Upgrade path: add a
 * whatsappPhoneNumberId to the sender config + a per-community MetaCloudProvider.
 */
@Injectable()
export class SenderResolver {
  private readonly logger = new Logger(SenderResolver.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Email From/Reply-To for a community, or {} to use the global default. */
  async emailFor(communityId?: string | null): Promise<EmailSender> {
    if (!communityId) return {};
    try {
      const row = await this.prisma.communitySettings.findUnique({
        where: { communityId },
        select: { customSettings: true },
      });
      const sender = (row?.customSettings as { sender?: { email?: string; name?: string; replyTo?: string } } | null)?.sender;
      if (!sender?.email) return {};
      return {
        from: sender.name ? `${sender.name} <${sender.email}>` : sender.email,
        replyTo: sender.replyTo || undefined,
      };
    } catch (e) {
      this.logger.warn(`Sender resolution failed for community ${communityId}: ${(e as Error).message}`);
      return {};
    }
  }
}

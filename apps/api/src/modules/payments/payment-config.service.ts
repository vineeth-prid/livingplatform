import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentPurpose, type CommunityPaymentConfig } from '@prisma/client';

import { maskSecret, SecretCipher } from '../../common/crypto/secret-cipher';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { AppConfig } from '../../config/configuration';
import { DomainEventName } from '../events/domain-events';
import { DomainEventsService } from '../events/domain-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { CommunityAccessService } from '../tenancy/community-access.service';
import type { PaymentConfigStatus, UpsertPaymentConfigDto } from './dto/payment-config.dto';
import type { RazorpayCredentials } from './razorpay.client';
import { RazorpayClient } from './razorpay.client';

/**
 * The ONE owner of community gateway credentials.
 *
 * Every community configures two independent Razorpay accounts — MAINTENANCE
 * and SERVICE — and they are never shared between communities or between rails.
 * Secrets are AES-256-GCM encrypted on write and decrypted ONLY here, only to
 * hand to RazorpayClient. Nothing this class returns to a controller contains a
 * secret: `status()` is deliberately the only read shape.
 */
@Injectable()
export class PaymentConfigService {
  private readonly logger = new Logger(PaymentConfigService.name);
  private readonly razorpay = new RazorpayClient();

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
    private readonly cipher: SecretCipher,
    private readonly events: DomainEventsService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /** Both rails for a community, always both rows (unconfigured ones included). */
  async list(communityId: string): Promise<PaymentConfigStatus[]> {
    await this.access.assert(communityId);
    const rows = await this.prisma.communityPaymentConfig.findMany({
      where: { communityId, deletedAt: null },
    });
    return Object.values(PaymentPurpose).map((purpose) =>
      toStatus(
        purpose,
        rows.find((r) => r.purpose === purpose) ?? null,
        this.config.get('payments', { infer: true }).gateway,
      ),
    );
  }

  async get(communityId: string, purpose: PaymentPurpose): Promise<PaymentConfigStatus> {
    const all = await this.list(communityId);
    const found = all.find((c) => c.purpose === purpose);
    if (!found) throw new NotFoundException('Payment configuration not found');
    return found;
  }

  async upsert(
    communityId: string,
    purpose: PaymentPurpose,
    dto: UpsertPaymentConfigDto,
    actor: AuthenticatedUser,
  ): Promise<PaymentConfigStatus> {
    await this.access.assert(communityId);
    if ((dto.keySecret || dto.webhookSecret) && !this.cipher.isConfigured) {
      throw new BadRequestException(
        'Secret encryption is not configured on this deployment (APP_ENCRYPTION_KEY)',
      );
    }

    const data = {
      mode: dto.mode,
      accountName: dto.accountName,
      merchantId: dto.merchantId,
      keyId: dto.keyId,
      enabled: dto.enabled,
      // Omitted secret → keep what is stored. An explicit empty string clears it.
      ...(dto.keySecret !== undefined
        ? { keySecretEnc: dto.keySecret ? this.cipher.encrypt(dto.keySecret) : null }
        : {}),
      ...(dto.webhookSecret !== undefined
        ? { webhookSecretEnc: dto.webhookSecret ? this.cipher.encrypt(dto.webhookSecret) : null }
        : {}),
    };

    const row = await this.prisma.communityPaymentConfig.upsert({
      where: { communityId_purpose: { communityId, purpose } },
      create: {
        communityId,
        purpose,
        provider: this.config.get('payments', { infer: true }).gateway,
        ...data,
        createdById: actor.id,
        updatedById: actor.id,
      },
      update: { ...data, updatedById: actor.id, deletedAt: null },
    });

    this.events.publish({
      name: DomainEventName.PaymentConfigUpdated,
      ...this.events.from(actor, communityId),
      entityId: row.id,
      // Never put credentials in an event payload — it lands in the audit log.
      data: { purpose },
    });
    this.logger.log(`Payment config updated: community=${communityId} purpose=${purpose}`);

    return toStatus(purpose, row, row.provider);
  }

  /** Live credential check against the gateway (no charge, no side effects). */
  async verify(communityId: string, purpose: PaymentPurpose): Promise<{ ok: boolean; reason?: string }> {
    await this.access.assert(communityId);
    const creds = await this.credentialsOrNull(communityId, purpose);
    if (!creds) return { ok: false, reason: 'This rail is not configured' };
    const ok = await this.razorpay.verify(creds);
    return ok ? { ok } : { ok, reason: 'The gateway rejected these credentials' };
  }

  /**
   * Decrypted credentials for a rail. INTERNAL — only PaymentService and the
   * webhook verifier call this, and neither returns the result to a client.
   */
  async credentials(communityId: string, purpose: PaymentPurpose): Promise<RazorpayCredentials> {
    const creds = await this.credentialsOrNull(communityId, purpose);
    if (!creds) {
      throw new BadRequestException(
        `This community has not configured a ${purpose.toLowerCase()} payment account yet`,
      );
    }
    return creds;
  }

  private async credentialsOrNull(
    communityId: string,
    purpose: PaymentPurpose,
  ): Promise<RazorpayCredentials | null> {
    const row = await this.prisma.communityPaymentConfig.findFirst({
      where: { communityId, purpose, deletedAt: null, enabled: true },
    });
    if (!row?.keyId || !row.keySecretEnc) return null;
    const rz = this.config.get('payments', { infer: true }).razorpay;
    return {
      keyId: row.keyId,
      keySecret: this.cipher.decrypt(row.keySecretEnc),
      baseUrl: rz.baseUrl,
      timeoutMs: rz.timeoutMs,
    };
  }

  /** The row + its decrypted webhook secret, for signature verification. */
  async webhookSecret(communityId: string, purpose: PaymentPurpose): Promise<string | null> {
    const row = await this.prisma.communityPaymentConfig.findFirst({
      where: { communityId, purpose, deletedAt: null },
      select: { webhookSecretEnc: true },
    });
    return this.cipher.decryptOrNull(row?.webhookSecretEnc);
  }

  /** The config row id + public key id used to open a checkout. */
  async checkoutIdentity(
    communityId: string,
    purpose: PaymentPurpose,
  ): Promise<{ configId: string; keyId: string }> {
    const row = await this.prisma.communityPaymentConfig.findFirst({
      where: { communityId, purpose, deletedAt: null, enabled: true },
      select: { id: true, keyId: true, keySecretEnc: true },
    });
    if (!row?.keyId || !row.keySecretEnc) {
      throw new BadRequestException(
        `This community has not configured a ${purpose.toLowerCase()} payment account yet`,
      );
    }
    return { configId: row.id, keyId: row.keyId };
  }

  /**
   * Platform-Admin view: configuration STATUS across communities, never
   * secrets. Answers "which communities are ready to collect?".
   */
  async platformOverview(): Promise<
    Array<{
      communityId: string;
      communityName: string;
      maintenanceReady: boolean;
      serviceReady: boolean;
    }>
  > {
    const communities = await this.prisma.community.findMany({
      where: { deletedAt: null, ...this.access.tenantWhere() },
      select: {
        id: true,
        name: true,
        paymentConfigs: {
          where: { deletedAt: null },
          select: { purpose: true, enabled: true, keyId: true, keySecretEnc: true },
        },
      },
      orderBy: { name: 'asc' },
    });
    const ready = (
      configs: Array<{ purpose: PaymentPurpose; enabled: boolean; keyId: string | null; keySecretEnc: string | null }>,
      purpose: PaymentPurpose,
    ) => {
      const c = configs.find((x) => x.purpose === purpose);
      return Boolean(c?.enabled && c.keyId && c.keySecretEnc);
    };
    return communities.map((c) => ({
      communityId: c.id,
      communityName: c.name,
      maintenanceReady: ready(c.paymentConfigs, PaymentPurpose.MAINTENANCE),
      serviceReady: ready(c.paymentConfigs, PaymentPurpose.SERVICE),
    }));
  }
}

function toStatus(
  purpose: PaymentPurpose,
  row: CommunityPaymentConfig | null,
  defaultProvider: string,
): PaymentConfigStatus {
  return {
    purpose,
    provider: row?.provider ?? defaultProvider,
    mode: row?.mode ?? 'TEST',
    accountName: row?.accountName ?? null,
    merchantId: row?.merchantId ?? null,
    keyIdMasked: maskSecret(row?.keyId),
    hasKeySecret: Boolean(row?.keySecretEnc),
    hasWebhookSecret: Boolean(row?.webhookSecretEnc),
    enabled: row?.enabled ?? false,
    ready: Boolean(row?.enabled && row.keyId && row.keySecretEnc),
    updatedAt: row?.updatedAt ?? null,
  };
}

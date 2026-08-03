import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  InvoiceStatus,
  PaymentPurpose,
  PaymentStatus,
  Prisma,
  type Payment,
} from '@prisma/client';

import { resolveSort } from '../../common/dto/list-query.dto';
import { paginate, type Paginated } from '../../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { AppConfig } from '../../config/configuration';
import { receiptNumber, round2 } from '../billing/billing.math';
import { InvoiceService } from '../billing/invoice.service';
import { myResidentIds } from '../community-ops/resident-access';
import { DomainEventName } from '../events/domain-events';
import { DomainEventsService } from '../events/domain-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSIONS } from '../rbac/rbac.constants';
import { SettingsService } from '../settings/settings.service';
import { CommunityAccessService } from '../tenancy/community-access.service';
import type {
  CheckoutSession,
  CreateCheckoutDto,
  QueryPaymentDto,
  RefundPaymentDto,
  VerifyPaymentDto,
} from './dto/payment.dto';
import { PaymentConfigService } from './payment-config.service';
import { RazorpayClient } from './razorpay.client';

const SORTABLE = ['createdAt', 'paidAt', 'amount', 'status'] as const;

export interface PaymentView {
  id: string;
  communityId: string;
  purpose: PaymentPurpose;
  invoiceId: string | null;
  invoiceNumber: string | null;
  serviceRequestId: string | null;
  unitId: string | null;
  residentId: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  gateway: string;
  method: string | null;
  receiptNumber: string | null;
  gatewayOrderId: string | null;
  gatewayPaymentId: string | null;
  failureReason: string | null;
  paidAt: Date | null;
  refundedAt: Date | null;
  refundAmount: number | null;
  createdAt: Date;
}

/**
 * Payment collection over the community's own Razorpay accounts.
 *
 * The flow is deliberately server-authoritative: the client never sends an
 * amount that is trusted, never sees a key secret, and a payment only becomes
 * PAID after either (a) the checkout signature verifies against the community's
 * key secret, or (b) the community's signed webhook says so. Both paths funnel
 * through `settle()`, so an invoice is credited exactly once.
 */
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly razorpay = new RazorpayClient();

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
    private readonly configs: PaymentConfigService,
    private readonly invoices: InvoiceService,
    private readonly events: DomainEventsService,
    private readonly settings: SettingsService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  // ── Checkout ───────────────────────────────────────────────────────────────

  async createCheckout(
    communityId: string,
    dto: CreateCheckoutDto,
    actor: AuthenticatedUser,
  ): Promise<CheckoutSession> {
    await this.access.assert(communityId);
    const currency = this.config.get('payments', { infer: true }).currency;

    const target = await this.resolveTarget(communityId, dto, actor);
    const { configId, keyId } = await this.configs.checkoutIdentity(communityId, dto.purpose);
    const creds = await this.configs.credentials(communityId, dto.purpose);

    const payment = await this.prisma.payment.create({
      data: {
        communityId,
        purpose: dto.purpose,
        configId,
        invoiceId: target.invoiceId,
        serviceRequestId: target.serviceRequestId,
        unitId: target.unitId,
        residentId: target.residentId,
        userId: actor.id,
        amount: target.amount,
        currency,
        status: PaymentStatus.CREATED,
        createdById: actor.id,
      },
    });

    // Receipt id must be ≤40 chars for Razorpay; our cuid fits comfortably.
    const order = await this.razorpay.createOrder(creds, {
      amount: target.amount,
      currency,
      receipt: payment.id,
      notes: {
        communityId,
        purpose: dto.purpose,
        ...(target.invoiceId ? { invoiceId: target.invoiceId } : {}),
        ...(target.serviceRequestId ? { serviceRequestId: target.serviceRequestId } : {}),
      },
    });

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { gatewayOrderId: order.id, status: PaymentStatus.PENDING },
    });

    // A package purchase records which payment settles it, so the packages
    // module can activate it from the `payment.succeeded` event. This is a
    // plain column write — the payment engine still knows nothing about how
    // packages work, only that a purchase row wants a payment id.
    if (dto.packagePurchaseId) {
      await this.prisma.servicePackagePurchase.update({
        where: { id: dto.packagePurchaseId },
        data: { paymentId: payment.id },
      });
    }

    this.events.publish({
      name: DomainEventName.PaymentInitiated,
      ...this.events.from(actor, communityId),
      entityId: payment.id,
      data: {
        purpose: dto.purpose,
        amount: target.amount,
        invoiceId: target.invoiceId,
        serviceRequestId: target.serviceRequestId,
        gatewayOrderId: order.id,
      },
    });

    return {
      paymentId: payment.id,
      orderId: order.id,
      keyId,
      amount: target.amount,
      amountMinor: RazorpayClient.toMinorUnits(target.amount),
      currency,
      purpose: dto.purpose,
      description: target.description,
      prefill: target.prefill,
    };
  }

  /**
   * Verify the checkout handshake and settle. The signature is computed with
   * the COMMUNITY's key secret — a signature minted with any other community's
   * key fails here, which is what keeps the rails isolated.
   */
  async verify(
    communityId: string,
    dto: VerifyPaymentDto,
    actor: AuthenticatedUser,
  ): Promise<PaymentView> {
    await this.access.assert(communityId);
    const payment = await this.prisma.payment.findFirst({
      where: { communityId, gatewayOrderId: dto.razorpayOrderId, deletedAt: null },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    const creds = await this.configs.credentials(communityId, payment.purpose);
    const ok = RazorpayClient.verifyCheckoutSignature({
      orderId: dto.razorpayOrderId,
      paymentId: dto.razorpayPaymentId,
      signature: dto.razorpaySignature,
      keySecret: creds.keySecret,
    });
    if (!ok) {
      await this.markFailed(payment.id, 'Signature verification failed');
      this.logger.warn(
        `Rejected payment ${payment.id}: bad checkout signature (community=${communityId})`,
      );
      throw new BadRequestException('Payment verification failed');
    }

    const settled = await this.settle(payment.id, {
      gatewayPaymentId: dto.razorpayPaymentId,
      signature: dto.razorpaySignature,
      actorId: actor.id,
    });
    return toView(settled, null);
  }

  // ── Webhook (server-to-server, the source of truth) ─────────────────────────

  /**
   * Handle a Razorpay webhook for one community rail. The raw body is required
   * for signature verification — never re-serialize the parsed object.
   */
  async handleWebhook(input: {
    communityId: string;
    purpose: PaymentPurpose;
    rawBody: string;
    signature: string;
  }): Promise<{ handled: boolean; event?: string }> {
    const secret = await this.configs.webhookSecret(input.communityId, input.purpose);
    if (!secret) {
      // No secret configured → we cannot authenticate the caller. Refuse.
      throw new ForbiddenException('Webhook is not configured for this community');
    }
    if (!RazorpayClient.verifyWebhookSignature(input.rawBody, input.signature, secret)) {
      this.logger.warn(`Rejected webhook for community=${input.communityId}: bad signature`);
      throw new ForbiddenException('Invalid webhook signature');
    }

    const body = JSON.parse(input.rawBody) as {
      event?: string;
      payload?: { payment?: { entity?: Record<string, unknown> } };
    };
    const entity = body.payload?.payment?.entity;
    const orderId = entity?.order_id as string | undefined;
    const paymentId = entity?.id as string | undefined;
    if (!body.event || !orderId) return { handled: false };

    const payment = await this.prisma.payment.findFirst({
      where: { communityId: input.communityId, gatewayOrderId: orderId, deletedAt: null },
    });
    if (!payment) return { handled: false, event: body.event };

    if (body.event === 'payment.captured' || body.event === 'order.paid') {
      await this.settle(payment.id, {
        gatewayPaymentId: paymentId ?? null,
        method: entity?.method as string | undefined,
        raw: entity,
      });
    } else if (body.event === 'payment.failed') {
      await this.markFailed(
        payment.id,
        (entity?.error_description as string) ?? 'Payment failed at the gateway',
      );
    }
    return { handled: true, event: body.event };
  }

  // ── Settlement (the single credit path) ────────────────────────────────────

  /**
   * Mark a payment PAID and credit its invoice — exactly once. A payment
   * already in PAID short-circuits, so the checkout callback and the webhook
   * racing each other cannot double-credit an invoice.
   */
  private async settle(
    paymentId: string,
    input: {
      gatewayPaymentId?: string | null;
      signature?: string;
      method?: string;
      raw?: unknown;
      actorId?: string;
    },
  ): Promise<Payment> {
    const paidAt = new Date();
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
      if (payment.status === PaymentStatus.PAID) return payment;

      const sequence = await tx.payment.count({
        where: { communityId: payment.communityId, status: PaymentStatus.PAID },
      });
      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.PAID,
          gatewayPaymentId: input.gatewayPaymentId ?? payment.gatewayPaymentId,
          gatewaySignature: input.signature ?? payment.gatewaySignature,
          method: input.method ?? payment.method,
          gatewayResponse: (input.raw ?? undefined) as Prisma.InputJsonValue | undefined,
          receiptNumber: payment.receiptNumber ?? receiptNumber(paidAt, sequence + 1),
          paidAt,
          updatedById: input.actorId,
        },
      });

      if (updated.invoiceId) {
        await this.invoices.applyPayment(updated.invoiceId, Number(updated.amount), paidAt, tx);
      }

      this.events.publish({
        name: DomainEventName.PaymentSucceeded,
        tenantId: null,
        communityId: updated.communityId,
        actorId: input.actorId ?? null,
        entityId: updated.id,
        data: {
          purpose: updated.purpose,
          amount: Number(updated.amount),
          invoiceId: updated.invoiceId,
          serviceRequestId: updated.serviceRequestId,
          gatewayPaymentId: updated.gatewayPaymentId,
        },
      });
      this.logger.log(`Payment settled: ${updated.id} ₹${Number(updated.amount)} ${updated.purpose}`);
      return updated;
    });
  }

  private async markFailed(paymentId: string, reason: string): Promise<void> {
    const payment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.FAILED, failureReason: reason },
    });
    this.events.publish({
      name: DomainEventName.PaymentFailed,
      tenantId: null,
      communityId: payment.communityId,
      actorId: null,
      entityId: payment.id,
      data: { purpose: payment.purpose, amount: Number(payment.amount), reason },
    });
  }

  // ── Refunds ────────────────────────────────────────────────────────────────

  async refund(
    communityId: string,
    paymentId: string,
    dto: RefundPaymentDto,
    actor: AuthenticatedUser,
  ): Promise<PaymentView> {
    await this.access.assert(communityId);
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, communityId, deletedAt: null },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== PaymentStatus.PAID) {
      throw new BadRequestException('Only a settled payment can be refunded');
    }
    if (!payment.gatewayPaymentId) {
      throw new BadRequestException('This payment has no gateway reference to refund');
    }
    const amount = dto.amount ?? Number(payment.amount);
    if (amount > Number(payment.amount)) {
      throw new BadRequestException('A refund cannot exceed the payment amount');
    }

    const creds = await this.configs.credentials(communityId, payment.purpose);
    await this.razorpay.refund(creds, payment.gatewayPaymentId, amount);

    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.REFUNDED,
        refundAmount: amount,
        refundedAt: new Date(),
        failureReason: dto.reason,
        updatedById: actor.id,
      },
    });
    this.events.publish({
      name: DomainEventName.PaymentRefunded,
      ...this.events.from(actor, communityId),
      entityId: updated.id,
      data: { purpose: updated.purpose, amount, reason: dto.reason },
    });
    return toView(updated, null);
  }

  // ── History ────────────────────────────────────────────────────────────────

  async findMany(
    communityId: string,
    query: QueryPaymentDto,
    actor: AuthenticatedUser,
  ): Promise<Paginated<PaymentView>> {
    await this.access.assert(communityId);
    const where: Prisma.PaymentWhereInput = {
      communityId,
      deletedAt: null,
      ...(query.purpose ? { purpose: query.purpose } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.invoiceId ? { invoiceId: query.invoiceId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { receiptNumber: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
              { gatewayPaymentId: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
              { invoice: { invoiceNumber: { contains: query.search, mode: Prisma.QueryMode.insensitive } } },
            ],
          }
        : {}),
      ...(await this.residentScope(communityId, query.residentId, actor)),
    };

    const [rows, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        orderBy: resolveSort(query, SORTABLE, 'createdAt'),
        skip: query.skip,
        take: query.take,
        include: { invoice: { select: { invoiceNumber: true } } },
      }),
      this.prisma.payment.count({ where }),
    ]);
    return paginate(
      rows.map((r) => toView(r, r.invoice?.invoiceNumber ?? null)),
      total,
      query,
    );
  }

  async findOne(communityId: string, id: string, actor: AuthenticatedUser): Promise<PaymentView> {
    await this.access.assert(communityId);
    const row = await this.prisma.payment.findFirst({
      where: { id, communityId, deletedAt: null },
      include: { invoice: { select: { invoiceNumber: true } } },
    });
    if (!row) throw new NotFoundException('Payment not found');
    if (!actor.permissions.includes(PERMISSIONS.BILLING_DASHBOARD_READ)) {
      const mine = await myResidentIds(this.prisma, actor, communityId);
      if (!row.residentId || !mine.includes(row.residentId)) {
        throw new ForbiddenException('You can only view your own payments');
      }
    }
    return toView(row, row.invoice?.invoiceNumber ?? null);
  }

  /** Printable receipt payload for a settled payment. */
  async receipt(communityId: string, id: string, actor: AuthenticatedUser) {
    const payment = await this.findOne(communityId, id, actor);
    if (payment.status !== PaymentStatus.PAID) {
      throw new BadRequestException('A receipt is only available for a settled payment');
    }
    const [community, invoice, resident] = await Promise.all([
      this.prisma.community.findUnique({
        where: { id: communityId },
        select: { name: true, addressLine1: true, city: true, contactEmail: true, contactPhone: true },
      }),
      payment.invoiceId
        ? this.prisma.maintenanceInvoice.findUnique({
            where: { id: payment.invoiceId },
            select: {
              invoiceNumber: true,
              periodStart: true,
              periodEnd: true,
              cycle: true,
              unit: { select: { unitNumber: true } },
            },
          })
        : null,
      payment.residentId
        ? this.prisma.resident.findUnique({
            where: { id: payment.residentId },
            select: { firstName: true, lastName: true, mobile: true, email: true },
          })
        : null,
    ]);
    return { payment, community, invoice, resident };
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  /**
   * Work out what is being paid, how much, and whether the caller is allowed to
   * pay it. The amount is ALWAYS derived server-side for maintenance.
   */
  private async resolveTarget(
    communityId: string,
    dto: CreateCheckoutDto,
    actor: AuthenticatedUser,
  ): Promise<{
    amount: number;
    invoiceId: string | null;
    serviceRequestId: string | null;
    unitId: string | null;
    residentId: string | null;
    description: string;
    prefill: { name?: string; email?: string; contact?: string };
  }> {
    const mine = await myResidentIds(this.prisma, actor, communityId);
    const isManager = actor.permissions.includes(PERMISSIONS.BILLING_DASHBOARD_READ);
    const prefill = await this.prefillFor(mine[0]);

    if (dto.purpose === PaymentPurpose.MAINTENANCE) {
      // A community that has switched maintenance billing off takes no new
      // maintenance money. Settlement of payments ALREADY in flight is
      // deliberately not gated (see handleWebhook) — turning the module off
      // must never strand a resident's money mid-transaction.
      await this.settings.assertMaintenanceBillingEnabled(communityId);
      if (!dto.invoiceId) throw new BadRequestException('invoiceId is required for a maintenance payment');
      const invoice = await this.prisma.maintenanceInvoice.findFirst({
        where: { id: dto.invoiceId, communityId, deletedAt: null },
        include: { unit: { select: { unitNumber: true } } },
      });
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (invoice.status === InvoiceStatus.CANCELLED) {
        throw new BadRequestException('This invoice is cancelled');
      }
      if (!isManager && (!invoice.residentId || !mine.includes(invoice.residentId))) {
        throw new ForbiddenException('You can only pay your own invoices');
      }
      const balance = round2(Number(invoice.totalAmount) - Number(invoice.paidAmount));
      if (balance <= 0) throw new BadRequestException('This invoice is already settled');
      // A partial payment is allowed, but never more than the balance.
      const amount = dto.amount ? Math.min(dto.amount, balance) : balance;
      return {
        amount,
        invoiceId: invoice.id,
        serviceRequestId: null,
        unitId: invoice.unitId,
        residentId: invoice.residentId,
        description: `Maintenance ${invoice.invoiceNumber} · Unit ${invoice.unit.unitNumber}`,
        prefill,
      };
    }

    // SERVICE rail — either a package purchase or an individual request.
    if (dto.packagePurchaseId) {
      const purchase = await this.prisma.servicePackagePurchase.findFirst({
        where: { id: dto.packagePurchaseId, communityId, deletedAt: null },
        include: { package: { select: { name: true } } },
      });
      if (!purchase) throw new NotFoundException('Package purchase not found');
      if (purchase.status !== 'PENDING') {
        throw new BadRequestException('This package purchase is no longer awaiting payment');
      }
      if (!isManager && (!purchase.residentId || !mine.includes(purchase.residentId))) {
        throw new ForbiddenException('You can only pay for your own package purchases');
      }
      return {
        // Server-side amount, exactly as for maintenance: the client never
        // names the price of a package.
        amount: Number(purchase.amount),
        invoiceId: null,
        serviceRequestId: null,
        unitId: purchase.unitId,
        residentId: purchase.residentId,
        description: `Package · ${purchase.package.name}`,
        prefill,
      };
    }

    if (!dto.serviceRequestId) {
      throw new BadRequestException(
        'serviceRequestId or packagePurchaseId is required for a service payment',
      );
    }
    if (!dto.amount) throw new BadRequestException('amount is required for a service payment');
    const sr = await this.prisma.serviceRequest.findFirst({
      where: { id: dto.serviceRequestId, communityId, deletedAt: null },
      select: { id: true, number: true, unitId: true, residentId: true },
    });
    if (!sr) throw new NotFoundException('Service request not found');
    if (!isManager && (!sr.residentId || !mine.includes(sr.residentId))) {
      throw new ForbiddenException('You can only pay for your own service requests');
    }
    return {
      amount: dto.amount,
      invoiceId: null,
      serviceRequestId: sr.id,
      unitId: sr.unitId,
      residentId: sr.residentId,
      // Same display convention as the Service Request Engine: SRQ-000123.
      description: `Service SRQ-${String(sr.number).padStart(6, '0')}`,
      prefill,
    };
  }

  private async prefillFor(residentId: string | undefined) {
    if (!residentId) return {};
    const r = await this.prisma.resident.findUnique({
      where: { id: residentId },
      select: { firstName: true, lastName: true, email: true, mobile: true },
    });
    if (!r) return {};
    return {
      name: `${r.firstName} ${r.lastName}`,
      email: r.email ?? undefined,
      contact: r.mobile,
    };
  }

  private async residentScope(
    communityId: string,
    requestedResidentId: string | undefined,
    actor: AuthenticatedUser,
  ): Promise<Prisma.PaymentWhereInput> {
    if (actor.permissions.includes(PERMISSIONS.BILLING_DASHBOARD_READ)) {
      return requestedResidentId ? { residentId: requestedResidentId } : {};
    }
    const mine = await myResidentIds(this.prisma, actor, communityId);
    return { residentId: { in: mine.length ? mine : ['__none__'] } };
  }
}

function toView(row: Payment, invoiceNumber: string | null): PaymentView {
  return {
    id: row.id,
    communityId: row.communityId,
    purpose: row.purpose,
    invoiceId: row.invoiceId,
    invoiceNumber,
    serviceRequestId: row.serviceRequestId,
    unitId: row.unitId,
    residentId: row.residentId,
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status,
    gateway: row.gateway,
    method: row.method,
    receiptNumber: row.receiptNumber,
    gatewayOrderId: row.gatewayOrderId,
    gatewayPaymentId: row.gatewayPaymentId,
    failureReason: row.failureReason,
    paidAt: row.paidAt,
    refundedAt: row.refundedAt,
    refundAmount: row.refundAmount === null ? null : Number(row.refundAmount),
    createdAt: row.createdAt,
  };
}

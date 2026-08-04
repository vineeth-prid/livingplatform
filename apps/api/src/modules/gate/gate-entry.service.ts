import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  GateEntryAction,
  GateEntryStatus,
  GateEntryType,
  Prisma,
} from '@prisma/client';

import { paginate, type Paginated } from '../../common/dto/pagination.dto';
import { resolveSort } from '../../common/dto/list-query.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { DomainEventName, type GateEntryEvent } from '../events/domain-events';
import { DomainEventsService } from '../events/domain-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import {
  RealtimeEventType,
  RealtimeRoom,
  type RealtimeEventTypeName,
} from '../realtime/realtime.types';
import { PERMISSIONS } from '../rbac/rbac.constants';
import { StorageService } from '../storage/storage.service';
import { CommunityAccessService } from '../tenancy/community-access.service';
import {
  CreateGateEntryDto,
  GateDecisionDto,
  QueryGateEntryDto,
  UpdateGateEntryDto,
} from './dto/gate-entry.dto';

const SORTABLE = ['createdAt', 'status', 'personName', 'vendorName', 'decidedAt'] as const;

/** Statuses that still need the resident to act. */
const AWAITING: GateEntryStatus[] = [GateEntryStatus.CREATED, GateEntryStatus.NOTIFIED];

const DETAIL_INCLUDE = {
  gate: { select: { id: true, name: true } },
  timeline: { orderBy: { createdAt: 'asc' } },
  attachments: true,
} satisfies Prisma.GateEntryInclude;

/**
 * Gate Management — the register of everyone arriving at a community gate.
 *
 * ONE service handles every `entryType`; DELIVERY is simply the first one the
 * UI exposes. Nothing below branches on the type except the human-facing copy,
 * which is why turning on VISITOR / SERVICE_PERSONNEL / VEHICLE later is a UI
 * change plus a notification template, not a new engine.
 *
 * This service owns the lifecycle and the audit trail. It does NOT own
 * notification: it publishes domain events and the Notification Engine decides
 * who hears about them, on which channels. The only thing it talks to directly
 * is the realtime hub, and only to mirror a state change to an already-open
 * screen — never as the primary delivery path.
 */
@Injectable()
export class GateEntryService {
  private readonly logger = new Logger(GateEntryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
    private readonly storage: StorageService,
    private readonly events: DomainEventsService,
    private readonly realtime: RealtimeService,
  ) {}

  // ── Creation ───────────────────────────────────────────────────────────────

  async create(communityId: string, dto: CreateGateEntryDto, actor: AuthenticatedUser) {
    const community = await this.access.assert(communityId);

    const unit = await this.prisma.unit.findFirst({
      where: { id: dto.unitId, communityId, deletedAt: null },
      select: { id: true, unitNumber: true },
    });
    if (!unit) throw new BadRequestException('Unit does not belong to this community');

    // Resolve who to notify. An explicit residentId wins; otherwise the unit's
    // primary occupant. An unoccupied unit still records the arrival — security
    // needs the log even when there is nobody to ask.
    const residentId = dto.residentId
      ? await this.assertResidentInUnit(dto.residentId, unit.id)
      : await this.primaryResidentFor(unit.id);

    if (dto.gateId) {
      const gate = await this.prisma.gate.findFirst({
        where: { id: dto.gateId, communityId, deletedAt: null },
        select: { id: true },
      });
      if (!gate) throw new BadRequestException('Gate does not belong to this community');
    }

    const entry = await this.prisma.gateEntry.create({
      data: {
        tenantId: community.tenantId,
        communityId,
        gateId: dto.gateId ?? (await this.defaultGateId(communityId)),
        entryType: dto.entryType ?? GateEntryType.DELIVERY,
        status: GateEntryStatus.CREATED,
        entryNumber: await this.nextEntryNumber(communityId),
        unitId: unit.id,
        residentId,
        vendorName: dto.vendorName?.trim() || null,
        deliveryType: dto.deliveryType?.trim() || null,
        personName: dto.personName.trim(),
        mobileNumber: dto.mobileNumber?.trim() || null,
        vehicleNumber: dto.vehicleNumber?.trim() || null,
        remarks: dto.remarks?.trim() || null,
        photoKey: dto.photoKey || null,
        createdById: actor.id,
        updatedById: actor.id,
      },
    });

    await this.addTimeline(entry.id, {
      action: GateEntryAction.CREATED,
      status: GateEntryStatus.CREATED,
      actorId: actor.id,
      note: `${entry.personName}${entry.vendorName ? ` (${entry.vendorName})` : ''} at the gate for ${unit.unitNumber}`,
    });

    if (dto.photoKey) {
      await this.prisma.gateEntryAttachment.create({
        data: { entryId: entry.id, storageKey: dto.photoKey, createdById: actor.id },
      });
    }

    // The Notification Engine takes it from here. Both the generic and the
    // delivery-specific event are published so consumers can bind to either.
    this.publish(DomainEventName.GateEntryCreated, entry, actor);
    if (entry.entryType === GateEntryType.DELIVERY) {
      this.publish(DomainEventName.DeliveryEntryCreated, entry, actor);
    }

    // Mirror to the gate desk so a second guard's screen shows it at once.
    this.broadcastToGate(communityId, RealtimeEventType.GateEntryUpdated, entry);

    return this.findOne(entry.id, actor);
  }

  /**
   * Called by the notification listener once the engine has attempted delivery.
   * Moves CREATED → NOTIFIED and records which channels carried the message, so
   * the gate desk can see at a glance whether the resident was actually reached.
   */
  async markNotified(
    entryId: string,
    outcome: { channels: string[]; failed: boolean },
  ): Promise<void> {
    const entry = await this.prisma.gateEntry.findUnique({
      where: { id: entryId },
      select: { id: true, communityId: true, status: true },
    });
    // Only the initial state advances: a resident who approved before the
    // notification job drained must not be dragged back to NOTIFIED.
    if (!entry || entry.status !== GateEntryStatus.CREATED) return;

    const updated = await this.prisma.gateEntry.update({
      where: { id: entryId },
      data: {
        status: outcome.failed ? GateEntryStatus.CREATED : GateEntryStatus.NOTIFIED,
        notifiedAt: outcome.failed ? null : new Date(),
        notificationFailed: outcome.failed,
      },
    });

    await this.addTimeline(entryId, {
      action: outcome.failed
        ? GateEntryAction.NOTIFICATION_FAILED
        : GateEntryAction.NOTIFICATION_SENT,
      status: updated.status,
      channel: outcome.channels.join(',') || null,
      note: outcome.failed
        ? 'Could not reach the resident on any channel'
        : `Resident notified via ${outcome.channels.join(', ')}`,
    });

    this.broadcastToGate(entry.communityId, RealtimeEventType.GateEntryUpdated, updated);
  }

  /**
   * Who lives in a unit — name and mobile only.
   *
   * Exists so the gate desk never needs `resident:read`. That permission
   * returns the whole resident record (email, date of birth, emergency
   * contacts) and lets the holder page through the entire register; a guard
   * confirming "is this the right flat?" needs neither. Scoped to one unit per
   * call, so it cannot be walked to enumerate the community.
   */
  async unitOccupants(communityId: string, unitId: string) {
    await this.access.assert(communityId);
    const unit = await this.prisma.unit.findFirst({
      where: { id: unitId, communityId, deletedAt: null },
      select: { id: true, unitNumber: true },
    });
    if (!unit) throw new BadRequestException('Unit does not belong to this community');

    const residents = await this.prisma.resident.findMany({
      where: { communityId, deletedAt: null, status: 'ACTIVE', unitAssignment: { unitId } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        mobile: true,
        unitAssignment: { select: { role: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });

    return {
      unit,
      residents: residents.map((r) => ({
        id: r.id,
        firstName: r.firstName,
        lastName: r.lastName,
        mobile: r.mobile,
        role: r.unitAssignment?.role ?? null,
      })),
    };
  }

  /**
   * A signed target for the gate photo. Same StorageService flow the documents
   * module uses: the client PUTs the bytes, then sends back the `key`.
   */
  async photoUploadUrl(communityId: string, fileName: string, contentType?: string) {
    await this.access.assert(communityId);
    const key = this.storage.buildKey(`communities/${communityId}/gate`, fileName);
    const signed = await this.storage.signUpload(key, { contentType });
    return { key, uploadUrl: signed.url, expiresAt: signed.expiresAt };
  }

  // ── Resident decisions ─────────────────────────────────────────────────────

  approve(id: string, dto: GateDecisionDto, actor: AuthenticatedUser) {
    return this.decide(id, GateEntryStatus.APPROVED, dto, actor);
  }

  reject(id: string, dto: GateDecisionDto, actor: AuthenticatedUser) {
    return this.decide(id, GateEntryStatus.REJECTED, dto, actor);
  }

  /**
   * Record the resident's decision and echo it to the gate in real time.
   *
   * Authorisation is ownership-first: the resident the entry is FOR may always
   * decide it, with no RBAC permission needed (same posture as /residents/me).
   * A manager holding `gate:entry:update` may decide on their behalf — the
   * desk needs a way to unblock an unreachable resident.
   */
  private async decide(
    id: string,
    decision: typeof GateEntryStatus.APPROVED | typeof GateEntryStatus.REJECTED,
    dto: GateDecisionDto,
    actor: AuthenticatedUser,
  ) {
    const entry = await this.loadOrThrow(id);
    await this.assertMayDecide(entry, actor);

    if (!AWAITING.includes(entry.status)) {
      throw new BadRequestException(
        `This ${entry.entryType.toLowerCase().replace(/_/g, ' ')} is already ${entry.status.toLowerCase()}`,
      );
    }

    const updated = await this.prisma.gateEntry.update({
      where: { id },
      data: {
        status: decision,
        decidedAt: new Date(),
        decidedById: actor.id,
        decisionNote: dto.note?.trim() || null,
        updatedById: actor.id,
      },
    });

    await this.addTimeline(id, {
      action:
        decision === GateEntryStatus.APPROVED
          ? GateEntryAction.APPROVED
          : GateEntryAction.REJECTED,
      status: decision,
      actorId: actor.id,
      // The principal carries no name, only an email — enough to attribute a
      // decision in the timeline without another lookup.
      actorName: actor.email,
      note: dto.note?.trim() || null,
    });

    this.publish(
      decision === GateEntryStatus.APPROVED
        ? DomainEventName.GateEntryApproved
        : DomainEventName.GateEntryRejected,
      updated,
      actor,
    );

    // THIS is the "security sees it instantly" path: the desk is subscribed to
    // the community gate room, so the decision lands without a refresh.
    this.broadcastToGate(entry.communityId, RealtimeEventType.GateEntryDecided, updated);

    return this.findOne(id, actor);
  }

  /** The resident opened the popup — recorded for the audit trail only. */
  async markViewed(id: string, actor: AuthenticatedUser): Promise<{ id: string; viewedAt: Date }> {
    const entry = await this.loadOrThrow(id);
    await this.assertMayDecide(entry, actor);
    if (entry.viewedAt) return { id, viewedAt: entry.viewedAt };

    const updated = await this.prisma.gateEntry.update({
      where: { id },
      data: { viewedAt: new Date() },
      select: { id: true, viewedAt: true },
    });
    await this.addTimeline(id, {
      action: GateEntryAction.VIEWED,
      actorId: actor.id,
      note: 'Resident opened the notification',
    });
    this.broadcastToGate(entry.communityId, RealtimeEventType.GateEntryUpdated, {
      ...entry,
      viewedAt: updated.viewedAt,
    });
    return { id, viewedAt: updated.viewedAt! };
  }

  // ── Gate-side actions ──────────────────────────────────────────────────────

  /** Security hands the delivery over and closes the entry. */
  async complete(id: string, actor: AuthenticatedUser) {
    const entry = await this.loadOrThrow(id);
    if (entry.status !== GateEntryStatus.APPROVED) {
      throw new BadRequestException('Only an approved entry can be completed');
    }
    const updated = await this.prisma.gateEntry.update({
      where: { id },
      data: { status: GateEntryStatus.COMPLETED, completedAt: new Date(), updatedById: actor.id },
    });
    await this.addTimeline(id, {
      action: GateEntryAction.COMPLETED,
      status: GateEntryStatus.COMPLETED,
      actorId: actor.id,
    });
    this.publish(DomainEventName.GateEntryCompleted, updated, actor);
    this.broadcastToGate(entry.communityId, RealtimeEventType.GateEntryUpdated, updated);
    return this.findOne(id, actor);
  }

  /** Cancel an entry recorded in error, or one the visitor abandoned. */
  async cancel(id: string, dto: GateDecisionDto, actor: AuthenticatedUser) {
    const entry = await this.loadOrThrow(id);
    if (entry.status === GateEntryStatus.COMPLETED) {
      throw new BadRequestException('A completed entry cannot be cancelled');
    }
    const updated = await this.prisma.gateEntry.update({
      where: { id },
      data: {
        status: GateEntryStatus.CANCELLED,
        decisionNote: dto.note?.trim() || entry.decisionNote,
        updatedById: actor.id,
      },
    });
    await this.addTimeline(id, {
      action: GateEntryAction.CANCELLED,
      status: GateEntryStatus.CANCELLED,
      actorId: actor.id,
      note: dto.note?.trim() || null,
    });
    this.publish(DomainEventName.GateEntryCancelled, updated, actor);
    this.broadcastToGate(entry.communityId, RealtimeEventType.GateEntryUpdated, updated);
    return this.findOne(id, actor);
  }

  async update(id: string, dto: UpdateGateEntryDto, actor: AuthenticatedUser) {
    const entry = await this.loadOrThrow(id);
    if (entry.status === GateEntryStatus.COMPLETED || entry.status === GateEntryStatus.CANCELLED) {
      throw new BadRequestException('A closed entry can no longer be edited');
    }
    await this.prisma.gateEntry.update({
      where: { id },
      data: {
        vendorName: dto.vendorName,
        deliveryType: dto.deliveryType,
        personName: dto.personName,
        mobileNumber: dto.mobileNumber,
        vehicleNumber: dto.vehicleNumber,
        remarks: dto.remarks,
        photoKey: dto.photoKey,
        updatedById: actor.id,
      },
    });
    await this.addTimeline(id, {
      action: GateEntryAction.NOTE,
      actorId: actor.id,
      note: 'Entry details corrected',
    });
    return this.findOne(id, actor);
  }

  // ── Reads ──────────────────────────────────────────────────────────────────

  async findMany(
    communityId: string,
    query: QueryGateEntryDto,
    actor: AuthenticatedUser,
  ): Promise<Paginated<unknown>> {
    await this.access.assert(communityId);
    const where = await this.buildWhere(communityId, query, actor);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.gateEntry.findMany({
        where,
        include: { gate: { select: { id: true, name: true } } },
        orderBy: resolveSort(query, SORTABLE, 'createdAt'),
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.gateEntry.count({ where }),
    ]);

    const hydrated = await this.attachContext(items);
    return paginate(
      await Promise.all(hydrated.map((entry) => this.present(entry))),
      total,
      query,
    );
  }

  /**
   * The signed-in resident's own entries. Self-scoped, so it carries no RBAC
   * permission — a resident holds none of the gate permissions by design.
   */
  async findMine(query: QueryGateEntryDto, actor: AuthenticatedUser): Promise<Paginated<unknown>> {
    const residentIds = await this.myResidentIds(actor);
    if (residentIds.length === 0) return paginate([], 0, query);

    const where: Prisma.GateEntryWhereInput = {
      deletedAt: null,
      residentId: { in: residentIds },
      ...(query.status ? { status: query.status } : {}),
      ...(query.pendingOnly ? { status: { in: AWAITING } } : {}),
      ...(query.entryType ? { entryType: query.entryType } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.gateEntry.findMany({
        where,
        include: { gate: { select: { id: true, name: true } } },
        orderBy: resolveSort(query, SORTABLE, 'createdAt'),
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.gateEntry.count({ where }),
    ]);

    const hydrated = await this.attachContext(items);
    return paginate(await Promise.all(hydrated.map((e) => this.present(e))), total, query);
  }

  async findOne(id: string, actor: AuthenticatedUser) {
    const entry = await this.prisma.gateEntry.findFirst({
      where: { id, deletedAt: null },
      include: DETAIL_INCLUDE,
    });
    if (!entry) throw new NotFoundException('Gate entry not found');
    await this.access.assert(entry.communityId);
    await this.assertMayView(entry, actor);
    const [hydrated] = await this.attachContext([entry]);
    return this.present(hydrated!);
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private async buildWhere(
    communityId: string,
    query: QueryGateEntryDto,
    actor: AuthenticatedUser,
  ): Promise<Prisma.GateEntryWhereInput> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const where: Prisma.GateEntryWhereInput = {
      communityId,
      deletedAt: null,
      ...(query.entryType ? { entryType: query.entryType } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.pendingOnly ? { status: { in: AWAITING } } : {}),
      ...(query.unitId ? { unitId: query.unitId } : {}),
      ...(query.residentId ? { residentId: query.residentId } : {}),
      ...(query.gateId ? { gateId: query.gateId } : {}),
      ...(query.createdById ? { createdById: query.createdById } : {}),
      ...(query.vendorName
        ? { vendorName: { equals: query.vendorName, mode: 'insensitive' } }
        : {}),
      ...(query.todayOnly ? { createdAt: { gte: startOfToday } } : {}),
      ...(!query.todayOnly && (query.dateFrom || query.dateTo)
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: query.dateFrom } : {}),
              ...(query.dateTo ? { lte: query.dateTo } : {}),
            },
          }
        : {}),
      ...(query.search ? await this.searchWhere(communityId, query.search) : {}),
    };

    // Someone without register-wide read only ever sees their own entries.
    if (!actor.permissions.includes(PERMISSIONS.GATE_ENTRY_VIEW)) {
      const residentIds = await this.myResidentIds(actor);
      where.residentId = { in: residentIds.length ? residentIds : ['__none__'] };
    }
    return where;
  }

  /**
   * Free-text across the fields a guard would actually type — including the
   * apartment and the resident's name, which live on other tables. `unitId` and
   * `residentId` are deliberately plain scalars (the AuditLog pattern), so those
   * two are resolved to id sets first and matched by `in`.
   */
  private async searchWhere(
    communityId: string,
    search: string,
  ): Promise<Prisma.GateEntryWhereInput> {
    const contains = { contains: search, mode: 'insensitive' as const };

    const [units, residents] = await Promise.all([
      this.prisma.unit.findMany({
        where: { communityId, deletedAt: null, unitNumber: contains },
        select: { id: true },
        take: 200,
      }),
      this.prisma.resident.findMany({
        where: {
          communityId,
          deletedAt: null,
          OR: [{ firstName: contains }, { lastName: contains }, { mobile: { contains: search } }],
        },
        select: { id: true },
        take: 200,
      }),
    ]);

    const or: Prisma.GateEntryWhereInput[] = [
      { personName: contains },
      { vendorName: contains },
      { mobileNumber: { contains: search } },
      { vehicleNumber: contains },
      { entryNumber: contains },
      { remarks: contains },
    ];
    if (units.length) or.push({ unitId: { in: units.map((u) => u.id) } });
    if (residents.length) or.push({ residentId: { in: residents.map((r) => r.id) } });
    return { OR: or };
  }

  /**
   * Attach unit + resident context. `unitId`/`residentId` are plain scalars (no
   * FK), matching how AuditLog and ServicePackagePurchase reference people —
   * the gate register must survive a unit or resident being reorganised.
   */
  private async attachContext<T extends { unitId: string; residentId: string | null }>(
    entries: T[],
  ): Promise<(T & { unit: UnitRef | null; resident: ResidentRef | null })[]> {
    if (entries.length === 0) return [];
    const unitIds = [...new Set(entries.map((e) => e.unitId))];
    const residentIds = [...new Set(entries.map((e) => e.residentId).filter((v): v is string => !!v))];

    const [units, residents] = await Promise.all([
      this.prisma.unit.findMany({
        where: { id: { in: unitIds } },
        select: { id: true, unitNumber: true, blockId: true, floorId: true },
      }),
      residentIds.length
        ? this.prisma.resident.findMany({
            where: { id: { in: residentIds } },
            select: { id: true, firstName: true, lastName: true, mobile: true, userId: true },
          })
        : Promise.resolve([]),
    ]);

    const unitById = new Map(units.map((u) => [u.id, u]));
    const residentById = new Map(residents.map((r) => [r.id, r]));
    return entries.map((e) => ({
      ...e,
      unit: unitById.get(e.unitId) ?? null,
      resident: e.residentId ? residentById.get(e.residentId) ?? null : null,
    }));
  }

  /** Sign the gate photo so it is actually viewable (private bucket). */
  private async present<T extends { photoKey: string | null }>(entry: T) {
    if (!entry.photoKey) return { ...entry, photoUrl: null };
    const signed = await this.storage.signDownload(entry.photoKey);
    return { ...entry, photoUrl: signed.url };
  }

  private async loadOrThrow(id: string) {
    const entry = await this.prisma.gateEntry.findFirst({ where: { id, deletedAt: null } });
    if (!entry) throw new NotFoundException('Gate entry not found');
    await this.access.assert(entry.communityId);
    return entry;
  }

  /** Read access: register-wide permission, or it is the caller's own entry. */
  private async assertMayView(
    entry: { residentId: string | null; communityId: string },
    actor: AuthenticatedUser,
  ): Promise<void> {
    if (actor.permissions.includes(PERMISSIONS.GATE_ENTRY_VIEW)) return;
    const residentIds = await this.myResidentIds(actor);
    if (!entry.residentId || !residentIds.includes(entry.residentId)) {
      throw new ForbiddenException('Not your gate entry');
    }
  }

  /** Decide access: the resident it is for, or a manager acting for them. */
  private async assertMayDecide(
    entry: { residentId: string | null },
    actor: AuthenticatedUser,
  ): Promise<void> {
    if (actor.permissions.includes(PERMISSIONS.GATE_ENTRY_UPDATE)) return;
    const residentIds = await this.myResidentIds(actor);
    if (!entry.residentId || !residentIds.includes(entry.residentId)) {
      throw new ForbiddenException('Only the resident this entry is for can decide it');
    }
  }

  private async myResidentIds(actor: AuthenticatedUser): Promise<string[]> {
    const rows = await this.prisma.resident.findMany({
      where: { userId: actor.id, deletedAt: null },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  private async assertResidentInUnit(residentId: string, unitId: string): Promise<string> {
    const resident = await this.prisma.resident.findFirst({
      where: { id: residentId, deletedAt: null, unitAssignment: { unitId } },
      select: { id: true },
    });
    if (!resident) throw new BadRequestException('That resident does not live in this unit');
    return resident.id;
  }

  /** The occupant to notify: PRIMARY/OWNER first, else whoever is assigned. */
  private async primaryResidentFor(unitId: string): Promise<string | null> {
    const assignment = await this.prisma.residentUnit.findFirst({
      where: { unitId, status: 'ACTIVE', resident: { deletedAt: null, status: 'ACTIVE' } },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      select: { residentId: true },
    });
    return assignment?.residentId ?? null;
  }

  private async defaultGateId(communityId: string): Promise<string | null> {
    const gate = await this.prisma.gate.findFirst({
      where: { communityId, isActive: true, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    });
    return gate?.id ?? null;
  }

  /** Sequential per-community reference: GE-000001. Gaps are acceptable. */
  private async nextEntryNumber(communityId: string): Promise<string> {
    const count = await this.prisma.gateEntry.count({ where: { communityId } });
    return `GE-${String(count + 1).padStart(6, '0')}`;
  }

  private async addTimeline(
    entryId: string,
    row: {
      action: GateEntryAction;
      status?: GateEntryStatus | null;
      note?: string | null;
      actorId?: string | null;
      actorName?: string | null;
      channel?: string | null;
    },
  ): Promise<void> {
    try {
      await this.prisma.gateEntryTimeline.create({
        data: {
          entryId,
          action: row.action,
          status: row.status ?? null,
          note: row.note ?? null,
          actorId: row.actorId ?? null,
          actorName: row.actorName ?? null,
          channel: row.channel ?? null,
        },
      });
    } catch (err) {
      // The audit trail must never take down the action it describes.
      this.logger.error(`Failed to write gate timeline for ${entryId}`, err as Error);
    }
  }

  /** Mirror a state change to the security desk's open screens. Best-effort by
   *  contract — the hub never throws, and the desk also polls as a fallback. */
  private broadcastToGate(
    communityId: string,
    type: RealtimeEventTypeName,
    entry: unknown,
  ): void {
    this.realtime.publish(type, { communityRoom: { communityId, room: RealtimeRoom.Gate } }, entry);
  }

  private publish(
    name: GateEntryEvent['name'],
    entry: {
      id: string;
      tenantId: string;
      communityId: string;
      entryNumber: string;
      entryType: GateEntryType;
      status: GateEntryStatus;
      unitId: string;
      residentId: string | null;
      personName: string;
      vendorName: string | null;
      decisionNote?: string | null;
    },
    actor: AuthenticatedUser,
  ): void {
    this.events.publish({
      name,
      tenantId: entry.tenantId,
      communityId: entry.communityId,
      actorId: actor.id,
      entityId: entry.id,
      data: {
        entryNumber: entry.entryNumber,
        entryType: entry.entryType,
        status: entry.status,
        unitId: entry.unitId,
        residentId: entry.residentId,
        personName: entry.personName,
        vendorName: entry.vendorName,
        decisionNote: entry.decisionNote ?? null,
      },
    } satisfies Omit<GateEntryEvent, 'occurredAt'>);
  }
}

interface UnitRef {
  id: string;
  unitNumber: string;
  blockId: string | null;
  floorId: string | null;
}
interface ResidentRef {
  id: string;
  firstName: string;
  lastName: string;
  mobile: string;
  userId: string | null;
}

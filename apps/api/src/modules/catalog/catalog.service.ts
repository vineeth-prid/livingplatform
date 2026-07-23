import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenancy/tenant-context.service';

/** Valid catalog kinds + the seed defaults used when a tenant has none yet. */
export const CATALOG_KINDS = {
  STAFF_ROLE: [
    'FACILITY_MANAGER', 'SUPERVISOR', 'SECURITY', 'HOUSEKEEPING',
    'ELECTRICIAN', 'PLUMBER', 'TECHNICIAN', 'ADMIN',
  ],
  VENDOR_CATEGORY: [
    'ELECTRICAL', 'PLUMBING', 'CIVIL', 'HOUSEKEEPING', 'SECURITY', 'GARDENING',
    'PEST_CONTROL', 'LIFT', 'DG', 'STP', 'HVAC', 'PAINTING', 'GENERAL',
  ],
} as const;

export type CatalogKind = keyof typeof CATALOG_KINDS;

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  private tenantId(): string {
    const id = this.tenant.tenantId;
    if (!id) throw new BadRequestException('A tenant context is required for catalog options');
    return id;
  }

  private assertKind(kind: string): CatalogKind {
    if (!(kind in CATALOG_KINDS)) throw new BadRequestException(`Unknown catalog kind "${kind}"`);
    return kind as CatalogKind;
  }

  /** Tenant options merged with the built-in defaults (defaults first, deduped). */
  async list(kind: string): Promise<{ name: string; id: string | null }[]> {
    const k = this.assertKind(kind);
    const tenantId = this.tenantId();
    const rows = await this.prisma.catalogOption.findMany({
      where: { tenantId, kind: k },
      orderBy: { name: 'asc' },
    });
    const seen = new Set(rows.map((r) => r.name));
    const defaults = CATALOG_KINDS[k]
      .filter((name) => !seen.has(name))
      .map((name) => ({ name, id: null as string | null }));
    return [...defaults, ...rows.map((r) => ({ name: r.name, id: r.id }))];
  }

  async create(kind: string, name: string, actor: AuthenticatedUser) {
    const k = this.assertKind(kind);
    const tenantId = this.tenantId();
    const clean = name.trim();
    if (!clean) throw new BadRequestException('Name is required');
    const existing = await this.prisma.catalogOption.findFirst({
      where: { tenantId, kind: k, name: clean },
      select: { id: true },
    });
    if (existing) throw new ConflictException('That option already exists');
    return this.prisma.catalogOption.create({
      data: { tenantId, kind: k, name: clean, createdById: actor.id },
    });
  }

  async remove(id: string) {
    const tenantId = this.tenantId();
    const row = await this.prisma.catalogOption.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!row) throw new NotFoundException('Option not found');
    await this.prisma.catalogOption.delete({ where: { id } });
    return { id, deleted: true };
  }
}

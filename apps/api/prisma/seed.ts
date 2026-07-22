/**
 * Idempotent seed. Safe to run repeatedly (upserts everywhere).
 *
 *   - Permission catalog  (system permissions)
 *   - System roles        (Platform Admin … Vendor) + their grants
 *   - A demo tenant + community
 *   - A platform admin and an association admin for local sign-in
 *
 * Run: pnpm --filter @living/api db:seed
 */
import { PrismaClient, RoleScope } from '@prisma/client';
import * as argon2 from 'argon2';

import {
  PERMISSION_CATALOG,
  SYSTEM_ROLES,
} from '../src/modules/rbac/rbac.constants';
import { DEFAULT_TICKET_CATEGORIES } from '../src/modules/ticket/ticket-category.constants';
import { DEFAULT_SERVICES } from '../src/modules/service-request/service.constants';
import { DEFAULT_ASSET_CATEGORIES } from '../src/modules/asset/asset.constants';

const prisma = new PrismaClient();

// Local-dev credentials only. Overridable via env; never used in production.
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'Living!2024';
const PLATFORM_ADMIN_EMAIL =
  process.env.SEED_PLATFORM_ADMIN_EMAIL ?? 'admin@living.local';
const ASSOCIATION_ADMIN_EMAIL =
  process.env.SEED_ASSOCIATION_ADMIN_EMAIL ?? 'association@living.local';

async function seedPermissions() {
  for (const p of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: { key: p.key },
      create: {
        key: p.key,
        resource: p.resource,
        action: p.action,
        description: p.description,
        isSystem: true,
      },
      update: { resource: p.resource, action: p.action, description: p.description },
    });
  }
  console.log(`✓ ${PERMISSION_CATALOG.length} permissions`);
}

async function seedRoles() {
  const allPermissions = await prisma.permission.findMany({ select: { id: true, key: true } });
  const idByKey = new Map(allPermissions.map((p) => [p.key, p.id]));

  for (const role of SYSTEM_ROLES) {
    // System roles have tenantId = null. Prisma cannot upsert on a composite
    // unique with a null member, so we find-or-create explicitly.
    const existing = await prisma.role.findFirst({
      where: { tenantId: null, key: role.key },
    });
    const record = existing
      ? await prisma.role.update({
          where: { id: existing.id },
          data: { name: role.name, description: role.description, scope: role.scope, isSystem: true },
        })
      : await prisma.role.create({
          data: {
            key: role.key,
            name: role.name,
            description: role.description,
            scope: role.scope as RoleScope,
            isSystem: true,
          },
        });

    const grantedKeys =
      role.permissions === '*'
        ? allPermissions.map((p) => p.key)
        : role.permissions;

    for (const key of grantedKeys) {
      const permissionId = idByKey.get(key);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: record.id, permissionId } },
        create: { roleId: record.id, permissionId },
        update: {},
      });
    }
  }
  console.log(`✓ ${SYSTEM_ROLES.length} system roles + grants`);
}

async function seedDemoData() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'living-demo' },
    create: { name: 'Living Demo', slug: 'living-demo', status: 'ACTIVE' },
    update: {},
  });

  const community = await prisma.community.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: 'the-arbour' } },
    create: {
      tenantId: tenant.id,
      name: 'The Arbour',
      slug: 'the-arbour',
      code: 'ARB',
      type: 'APARTMENT',
      status: 'ACTIVE',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      timezone: 'Asia/Kolkata',
      settings: { create: {} },
    },
    update: {},
  });

  const passwordHash = await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id });

  const platformRole = await prisma.role.findFirstOrThrow({
    where: { tenantId: null, key: 'PLATFORM_ADMIN' },
  });
  const associationRole = await prisma.role.findFirstOrThrow({
    where: { tenantId: null, key: 'ASSOCIATION_ADMIN' },
  });

  // Idempotent platform/tenant-wide (communityId = null) role assignment.
  // Can't upsert on the composite unique because Postgres treats NULLs as
  // distinct, so find-or-create explicitly.
  const assignRole = async (userId: string, roleId: string) => {
    const existing = await prisma.userRole.findFirst({
      where: { userId, roleId, communityId: null },
    });
    if (!existing) await prisma.userRole.create({ data: { userId, roleId } });
  };

  // Platform admin — no tenant, platform-wide assignment.
  const platformAdmin = await prisma.user.upsert({
    where: { email: PLATFORM_ADMIN_EMAIL },
    create: {
      email: PLATFORM_ADMIN_EMAIL,
      passwordHash,
      firstName: 'Platform',
      lastName: 'Admin',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
    update: {},
  });
  await assignRole(platformAdmin.id, platformRole.id);

  // Association admin — scoped to the demo tenant.
  const associationAdmin = await prisma.user.upsert({
    where: { email: ASSOCIATION_ADMIN_EMAIL },
    create: {
      email: ASSOCIATION_ADMIN_EMAIL,
      tenantId: tenant.id,
      passwordHash,
      firstName: 'Association',
      lastName: 'Admin',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
    update: { tenantId: tenant.id },
  });
  await assignRole(associationAdmin.id, associationRole.id);

  await seedCommunityFoundation(community.id);
  await seedPeople(community.id, tenant.id);
  await seedAssetCategories(community.id, tenant.id);

  console.log(`✓ demo tenant "${tenant.name}", community "${community.name}"`);
  console.log(`  platform admin:    ${PLATFORM_ADMIN_EMAIL}`);
  console.log(`  association admin: ${ASSOCIATION_ADMIN_EMAIL}`);
  console.log(`  password:          ${DEMO_PASSWORD}`);
}

/** Idempotent demo hierarchy + amenities + a document for the demo community. */
async function seedCommunityFoundation(communityId: string) {
  const phase = await prisma.phase.upsert({
    where: { communityId_code: { communityId, code: 'P1' } },
    create: { communityId, name: 'Phase 1', code: 'P1', sortOrder: 1 },
    update: {},
  });

  const block = await prisma.block.upsert({
    where: { communityId_code: { communityId, code: 'A' } },
    create: {
      communityId,
      phaseId: phase.id,
      name: 'Tower A',
      code: 'A',
      type: 'TOWER',
      totalFloors: 3,
      sortOrder: 1,
    },
    update: {},
  });

  for (let level = 1; level <= 3; level++) {
    const floor = await prisma.floor.upsert({
      where: { blockId_level: { blockId: block.id, level } },
      create: {
        communityId,
        blockId: block.id,
        level,
        name: `Level ${level}`,
        sortOrder: level,
      },
      update: {},
    });
    for (const suffix of ['01', '02']) {
      const unitNumber = `A-${level}${suffix}`;
      await prisma.unit.upsert({
        where: { communityId_unitNumber: { communityId, unitNumber } },
        create: {
          communityId,
          phaseId: phase.id,
          blockId: block.id,
          floorId: floor.id,
          unitNumber,
          type: suffix === '01' ? '2BHK' : '3BHK',
          bedrooms: suffix === '01' ? 2 : 3,
          bathrooms: 2,
          parkingSlots: 1,
          builtUpArea: suffix === '01' ? 1180 : 1450,
          status: 'VACANT',
        },
        update: {},
      });
    }
  }

  const amenities = [
    { name: 'Swimming Pool', code: 'POOL', category: 'Recreation', capacity: 30 },
    { name: 'Gym', code: 'GYM', category: 'Fitness', capacity: 25 },
    { name: 'Club House', code: 'CLUB', category: 'Community', capacity: 120 },
  ];
  for (const [i, a] of amenities.entries()) {
    const existing = await prisma.amenity.findFirst({
      where: { communityId, code: a.code },
    });
    if (!existing) {
      await prisma.amenity.create({
        data: { communityId, sortOrder: i, ...a },
      });
    }
  }

  const doc = await prisma.communityDocument.findFirst({
    where: { communityId, title: 'Association Bylaws' },
  });
  if (!doc) {
    await prisma.communityDocument.create({
      data: {
        communityId,
        title: 'Association Bylaws',
        category: 'ASSOCIATION',
        status: 'PUBLISHED',
        version: 'v1.0',
        tags: ['bylaws', 'governance'],
      },
    });
  }

  console.log('✓ demo hierarchy (Phase 1 › Tower A › 3 floors › 6 units), 3 amenities, 1 document');
}

/** Idempotent demo people (1 resident on a unit, 1 vendor, 1 staff). */
async function seedPeople(communityId: string, tenantId: string) {
  const resident = await prisma.resident.upsert({
    where: { communityId_residentCode: { communityId, residentCode: 'R-A101-01' } },
    create: {
      communityId,
      residentCode: 'R-A101-01',
      firstName: 'Aisha',
      lastName: 'Khan',
      mobile: '+91 98765 43210',
      email: 'aisha.khan@example.com',
      status: 'ACTIVE',
      moveInDate: new Date('2025-06-01'),
    },
    update: {},
  });

  const unit = await prisma.unit.findFirst({
    where: { communityId, unitNumber: 'A-101' },
    select: { id: true },
  });
  if (unit) {
    const existing = await prisma.residentUnit.findUnique({
      where: { residentId: resident.id },
    });
    if (!existing) {
      await prisma.residentUnit.create({
        data: {
          residentId: resident.id,
          unitId: unit.id,
          role: 'PRIMARY',
          moveInDate: new Date('2025-06-01'),
          status: 'ACTIVE',
        },
      });
    }
  }

  const vendorExists = await prisma.vendor.findFirst({
    where: { tenantId, name: 'BrightSpark Electricals' },
  });
  if (!vendorExists) {
    await prisma.vendor.create({
      data: {
        tenantId,
        name: 'BrightSpark Electricals',
        companyName: 'BrightSpark Pvt Ltd',
        category: 'ELECTRICAL',
        serviceCategories: ['ELECTRICAL', 'GENERAL'],
        phone: '+91 90000 11111',
        communityIds: [communityId],
        status: 'ACTIVE',
      },
    });
  }

  await prisma.staff.upsert({
    where: { communityId_employeeId: { communityId, employeeId: 'EMP-1001' } },
    create: {
      communityId,
      employeeId: 'EMP-1001',
      firstName: 'Suresh',
      lastName: 'Raman',
      role: 'FACILITY_MANAGER',
      department: 'Operations',
      phone: '+91 90000 22222',
      status: 'ACTIVE',
    },
    update: {},
  });

  console.log('✓ demo people (1 resident on A-101, 1 vendor, 1 staff)');
}

/** System default ticket categories (tenantId = null), available to all tenants. */
async function seedTicketCategories() {
  for (const [i, c] of DEFAULT_TICKET_CATEGORIES.entries()) {
    const existing = await prisma.ticketCategory.findFirst({
      where: { tenantId: null, key: c.key },
    });
    if (existing) {
      await prisma.ticketCategory.update({
        where: { id: existing.id },
        data: { name: c.name, color: c.color, iconKey: c.iconKey, isSystem: true },
      });
    } else {
      await prisma.ticketCategory.create({
        data: {
          key: c.key,
          name: c.name,
          color: c.color,
          iconKey: c.iconKey,
          isSystem: true,
          sortOrder: i,
        },
      });
    }
  }
  console.log(`✓ ${DEFAULT_TICKET_CATEGORIES.length} system ticket categories`);
}

/** System default services (tenantId = null), available to all tenants. */
async function seedServices() {
  for (const [i, s] of DEFAULT_SERVICES.entries()) {
    const existing = await prisma.service.findFirst({
      where: { tenantId: null, key: s.key },
    });
    const data = {
      name: s.name,
      estimatedDurationMinutes: s.estimatedDurationMinutes,
      color: s.color,
      iconKey: s.iconKey,
      isSystem: true,
    };
    if (existing) {
      await prisma.service.update({ where: { id: existing.id }, data });
    } else {
      await prisma.service.create({ data: { key: s.key, sortOrder: i, ...data } });
    }
  }
  console.log(`✓ ${DEFAULT_SERVICES.length} system services`);
}

/** Default asset categories for the demo community (categories are community-scoped). */
async function seedAssetCategories(communityId: string, tenantId: string) {
  for (const [i, c] of DEFAULT_ASSET_CATEGORIES.entries()) {
    const existing = await prisma.assetCategory.findFirst({
      where: { communityId, code: c.code },
    });
    const data = { name: c.name, color: c.color, icon: c.icon, isActive: true };
    if (existing) {
      await prisma.assetCategory.update({ where: { id: existing.id }, data });
    } else {
      await prisma.assetCategory.create({
        data: { tenantId, communityId, code: c.code, sortOrder: i, ...data },
      });
    }
  }
  console.log(`✓ ${DEFAULT_ASSET_CATEGORIES.length} asset categories (demo community)`);
}

async function main() {
  console.log('Seeding Living Platform…');
  await seedPermissions();
  await seedRoles();
  await seedTicketCategories();
  await seedServices();
  await seedDemoData();
  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

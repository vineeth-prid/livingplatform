import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

import { getTenantStore } from '../../common/context/tenant-als';

/**
 * Single, shared Prisma client for the process. Connects on module init and
 * disconnects cleanly on shutdown so the pool is never leaked between reloads.
 *
 * Tenant isolation defense-in-depth (A1): when DB_RLS_ENABLED=true, every model
 * operation is wrapped in a transaction that sets the request's tenant GUCs
 * (app.tenant_id / app.bypass_rls), which the Postgres RLS policies enforce. The
 * flag defaults OFF — behavior is then byte-identical to a plain client. See
 * prisma/rls/ACTIVATE.sql for the staged activation + validation runbook.
 *
 * ponytail: raw queries ($queryRaw/$executeRaw) are NOT wrapped (infra/health
 * only); the wrapper turns each model op into a 2-statement transaction — the
 * cost of a DB-enforced backstop. Upgrade path: a dedicated non-owner DB role.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? ['warn', 'error']
          : ['error'],
    });
    if (process.env.DB_RLS_ENABLED === 'true') {
      return withTenantRls(this);
    }
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Database connection established');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

/**
 * Returns a Proxy over the client whose MODEL operations route through a Prisma
 * extension that sets the tenant GUCs transaction-locally. Lifecycle hooks and
 * everything else fall through to the real service, so $connect/$disconnect and
 * Nest's onModuleInit/onModuleDestroy behave normally. Only enabled under the
 * DB_RLS_ENABLED flag (see the constructor).
 */
function withTenantRls(base: PrismaService): PrismaService {
  const extended = base.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const store = getTenantStore();
          const bypass = !store || store.bypass;
          const tenantId = store?.tenantId ?? '';
          // Transaction-local GUCs so SET applies to the same connection as the op.
          const [, result] = await base.$transaction([
            base.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true), set_config('app.bypass_rls', ${bypass ? 'on' : 'off'}, true)`,
            query(args) as Prisma.PrismaPromise<unknown>,
          ]);
          return result;
        },
      },
    },
  });

  // Lifecycle + own members stay on the base; model access uses the extension.
  const ownToBase = new Set(['onModuleInit', 'onModuleDestroy', 'logger']);
  return new Proxy(base, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && !ownToBase.has(prop) && prop in extended) {
        const value = (extended as Record<string, unknown>)[prop];
        return typeof value === 'function' ? value.bind(extended) : value;
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as PrismaService;
}

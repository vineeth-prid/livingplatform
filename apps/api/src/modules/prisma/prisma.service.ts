import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Single, shared Prisma client for the process. Connects on module init and
 * disconnects cleanly on shutdown so the pool is never leaked between reloads.
 *
 * ponytail: no global soft-delete middleware yet — services filter
 * `deletedAt: null` explicitly. Add a client extension if the number of
 * soft-deletable models grows enough that per-query filtering gets error-prone.
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
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Database connection established');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

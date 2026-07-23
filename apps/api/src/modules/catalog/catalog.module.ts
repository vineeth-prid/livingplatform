import { Module } from '@nestjs/common';

import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

/** Tenant-managed option lists: staff roles, vendor categories, … */
@Module({
  controllers: [CatalogController],
  providers: [CatalogService],
})
export class CatalogModule {}

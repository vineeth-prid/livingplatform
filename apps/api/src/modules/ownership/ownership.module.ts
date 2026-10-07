import { Module } from '@nestjs/common';

import { ResidentModule } from '../resident/resident.module';
import { OwnershipCoreModule } from './ownership-core.module';
import { UnitOwnershipController } from './ownership.controller';
import { UnitOwnershipService } from './unit-ownership.service';

/**
 * Unit ownership — the financial relationship between a person and a flat.
 *
 * `OwnershipService` is exported because billing, payments and the Notification
 * Engine all have to answer "who is responsible for this unit?" the same way.
 * It depends on nothing but Prisma, so importing it cannot create a cycle.
 */
@Module({
  imports: [ResidentModule, OwnershipCoreModule],
  controllers: [UnitOwnershipController],
  providers: [UnitOwnershipService],
  exports: [OwnershipCoreModule, UnitOwnershipService],
})
export class OwnershipModule {}

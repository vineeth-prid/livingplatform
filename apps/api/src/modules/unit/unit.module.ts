import { Module } from '@nestjs/common';

import { OwnershipModule } from '../ownership/ownership.module';
import { UnitController } from './unit.controller';
import { UnitService } from './unit.service';

@Module({
  // A unit is created together with its owner (see UnitService.create).
  imports: [OwnershipModule],
  controllers: [UnitController],
  providers: [UnitService],
  exports: [UnitService],
})
export class UnitModule {}

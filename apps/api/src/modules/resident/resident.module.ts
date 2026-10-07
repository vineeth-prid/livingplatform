import { Module } from '@nestjs/common';

import { OwnershipCoreModule } from '../ownership/ownership-core.module';
import { ResidentController } from './resident.controller';
import { ResidentService } from './resident.service';

@Module({
  // The resolver only — see OwnershipCoreModule. Importing the full
  // OwnershipModule would close a cycle, since that one imports this.
  imports: [OwnershipCoreModule],
  controllers: [ResidentController],
  providers: [ResidentService],
  exports: [ResidentService],
})
export class ResidentModule {}

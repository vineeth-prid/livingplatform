import { Module } from '@nestjs/common';

import { AdminController } from './admin.controller';
import { ProvisioningService } from './provisioning.service';

@Module({
  controllers: [AdminController],
  providers: [ProvisioningService],
})
export class AdminModule {}

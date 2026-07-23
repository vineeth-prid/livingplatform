import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { AdminController } from './admin.controller';
import { ProvisioningService } from './provisioning.service';

@Module({
  imports: [AuthModule, RbacModule],
  controllers: [AdminController],
  providers: [ProvisioningService],
})
export class AdminModule {}

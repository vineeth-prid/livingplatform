import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { RbacModule } from '../rbac/rbac.module';
import { AdminController } from './admin.controller';
import { ProvisioningService } from './provisioning.service';

@Module({
  // MailModule supplies the temporary-password email on an admin reset.
  imports: [AuthModule, MailModule, RbacModule],
  controllers: [AdminController],
  providers: [ProvisioningService],
})
export class AdminModule {}

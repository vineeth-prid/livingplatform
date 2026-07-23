import { Global, Module } from '@nestjs/common';

import { AccountProvisioningService } from './account-provisioning.service';
import { UserLinkService } from './user-link.service';

/** Shared people utilities used by the resident/vendor/staff modules. */
@Global()
@Module({
  providers: [UserLinkService, AccountProvisioningService],
  exports: [UserLinkService, AccountProvisioningService],
})
export class PeopleModule {}

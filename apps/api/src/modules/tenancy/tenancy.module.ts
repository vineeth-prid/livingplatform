import { Global, Module } from '@nestjs/common';

import { CommunityAccessService } from './community-access.service';
import { TenantContextService } from './tenant-context.service';

@Global()
@Module({
  providers: [TenantContextService, CommunityAccessService],
  exports: [TenantContextService, CommunityAccessService],
})
export class TenancyModule {}

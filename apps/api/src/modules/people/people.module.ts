import { Global, Module } from '@nestjs/common';

import { UserLinkService } from './user-link.service';

/** Shared people utilities used by the resident/vendor/staff modules. */
@Global()
@Module({
  providers: [UserLinkService],
  exports: [UserLinkService],
})
export class PeopleModule {}

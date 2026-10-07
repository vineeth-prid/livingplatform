import { Module } from '@nestjs/common';

import { OwnershipService } from './ownership.service';

/**
 * The ownership RESOLVER on its own, with no dependency but Prisma.
 *
 * Split out from OwnershipModule so it can be imported by ResidentModule too.
 * OwnershipModule imports ResidentModule (an owner's login is provisioned
 * through the ordinary resident flow), so anything the resident side needs from
 * ownership has to live below that edge or the two would import each other.
 *
 * The point of the split is that there is still exactly ONE implementation of
 * "who is financially responsible for this unit" — billing, payments,
 * notifications and the resident's own profile all get the same answer.
 */
@Module({
  providers: [OwnershipService],
  exports: [OwnershipService],
})
export class OwnershipCoreModule {}

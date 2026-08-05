import { Module } from '@nestjs/common';

import { StaffAutoAssignService } from './staff-auto-assign.service';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';

@Module({
  controllers: [StaffController],
  providers: [StaffService, StaffAutoAssignService],
  // StaffAutoAssignService is exported for the Ticket Engine, which routes a
  // new request to in-house staff before falling through to vendors.
  exports: [StaffService, StaffAutoAssignService],
})
export class StaffModule {}

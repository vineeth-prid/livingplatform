import { Module } from '@nestjs/common';

import { VendorAutoAssignService } from './vendor-auto-assign.service';
import { VendorController } from './vendor.controller';
import { VendorService } from './vendor.service';

@Module({
  controllers: [VendorController],
  providers: [VendorService, VendorAutoAssignService],
  exports: [VendorService, VendorAutoAssignService],
})
export class VendorModule {}

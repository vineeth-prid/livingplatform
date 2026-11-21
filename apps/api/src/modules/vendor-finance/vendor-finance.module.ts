import { Module } from '@nestjs/common';

import { VendorFinanceController } from './vendor-finance.controllers';
import { VendorFinanceService } from './vendor-finance.service';

@Module({
  controllers: [VendorFinanceController],
  providers: [VendorFinanceService],
})
export class VendorFinanceModule {}

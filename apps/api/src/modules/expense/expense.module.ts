import { Module } from '@nestjs/common';

import { ExpenseCategoryController, ExpenseController } from './expense.controllers';
import { ExpenseService } from './expense.service';

/**
 * Community expense ledger. Exported so the Work Order Engine can keep a
 * verified work order's actual cost reflected here (ExpenseService.syncWorkOrder).
 */
@Module({
  controllers: [ExpenseCategoryController, ExpenseController],
  providers: [ExpenseService],
  exports: [ExpenseService],
})
export class ExpenseModule {}

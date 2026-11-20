import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PERMISSIONS } from '../rbac/rbac.constants';
import {
  CreateExpenseDto,
  ExpenseUploadUrlDto,
  QueryExpenseDto,
  UpdateExpenseDto,
  UpsertExpenseCategoryDto,
} from './dto/expense.dto';
import { ExpenseService } from './expense.service';

@ApiTags('Expenses · Categories')
@ApiBearerAuth()
@Controller('communities/:communityId/expense-categories')
export class ExpenseCategoryController {
  constructor(private readonly expenses: ExpenseService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.EXPENSE_READ)
  list(@Param('communityId') communityId: string) {
    return this.expenses.listCategories(communityId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.EXPENSE_MANAGE)
  create(@Param('communityId') communityId: string, @Body() dto: UpsertExpenseCategoryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.expenses.createCategory(communityId, dto, user);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.EXPENSE_MANAGE)
  update(
    @Param('communityId') communityId: string,
    @Param('id') id: string,
    @Body() dto: UpsertExpenseCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.expenses.updateCategory(communityId, id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.EXPENSE_MANAGE)
  @ApiOperation({ summary: 'Delete an UNUSED category (one with expenses is refused)' })
  remove(@Param('communityId') communityId: string, @Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.expenses.removeCategory(communityId, id, user);
  }
}

@ApiTags('Expenses')
@ApiBearerAuth()
@Controller('communities/:communityId/expenses')
export class ExpenseController {
  constructor(private readonly expenses: ExpenseService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.EXPENSE_READ)
  @ApiOperation({ summary: 'Expenses, filtered; includes the filtered total' })
  list(@Param('communityId') communityId: string, @Query() query: QueryExpenseDto) {
    return this.expenses.list(communityId, query);
  }

  @Get('summary')
  @RequirePermissions(PERMISSIONS.EXPENSE_READ)
  @ApiOperation({ summary: 'Summary cards for the same filters (months in the community timezone)' })
  summary(@Param('communityId') communityId: string, @Query() query: QueryExpenseDto) {
    return this.expenses.summary(communityId, query);
  }

  @Post('upload-url')
  @RequirePermissions(PERMISSIONS.EXPENSE_MANAGE)
  @ApiOperation({ summary: 'Signed upload for an invoice/receipt attachment' })
  uploadUrl(@Param('communityId') communityId: string, @Body() dto: ExpenseUploadUrlDto) {
    return this.expenses.attachmentUploadUrl(communityId, dto.fileName, dto.contentType);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.EXPENSE_READ)
  findOne(@Param('communityId') communityId: string, @Param('id') id: string) {
    return this.expenses.findOne(communityId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.EXPENSE_MANAGE)
  create(@Param('communityId') communityId: string, @Body() dto: CreateExpenseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.expenses.create(communityId, dto, user);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.EXPENSE_MANAGE)
  update(
    @Param('communityId') communityId: string,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.expenses.update(communityId, id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.EXPENSE_MANAGE)
  remove(@Param('communityId') communityId: string, @Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.expenses.remove(communityId, id, user);
  }
}

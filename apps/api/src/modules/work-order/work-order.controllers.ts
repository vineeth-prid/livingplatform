import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PERMISSIONS } from '../rbac/rbac.constants';
import {
  CreateWorkOrderAttachmentDto,
  RequestWorkOrderUploadUrlDto,
} from './dto/attachment.dto';
import { CreateWorkOrderUpdateDto } from './dto/update.dto';
import {
  ApproveWorkOrderDto,
  AssignWorkOrderDto,
  ChangeWorkOrderStatusDto,
  CreateWorkOrderDto,
  QueryWorkOrderDto,
  RejectWorkOrderDto,
  UpdateWorkOrderDto,
  VerifyWorkOrderDto,
} from './dto/work-order.dto';
import { WorkOrderAttachmentService } from './work-order-attachment.service';
import { WorkOrderUpdateService } from './work-order-update.service';
import { WorkOrderService } from './work-order.service';

@ApiTags('Work Orders')
@ApiBearerAuth()
@Controller()
export class WorkOrderController {
  constructor(private readonly workOrders: WorkOrderService) {}

  @Post('communities/:communityId/work-orders')
  @RequirePermissions(PERMISSIONS.WORKORDER_CREATE)
  @ApiOperation({ summary: 'Create a work order (originType/originId are loose links — no FK)' })
  create(
    @Param('communityId') communityId: string,
    @Body() dto: CreateWorkOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workOrders.create(communityId, dto, user);
  }

  @Post('communities/:communityId/work-orders/recommend')
  @RequirePermissions(PERMISSIONS.WORKORDER_RECOMMEND)
  @ApiOperation({ summary: 'Recommend a work order for approval (starts PENDING_APPROVAL)' })
  recommend(
    @Param('communityId') communityId: string,
    @Body() dto: CreateWorkOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workOrders.recommend(communityId, dto, user);
  }

  @Get('communities/:communityId/work-orders')
  @RequirePermissions(PERMISSIONS.WORKORDER_VIEW)
  @ApiOperation({ summary: 'List work orders (filter/search/sort/paginate)' })
  list(@Param('communityId') communityId: string, @Query() query: QueryWorkOrderDto) {
    return this.workOrders.findMany(communityId, query);
  }

  @Get('work-orders/:id')
  @RequirePermissions(PERMISSIONS.WORKORDER_VIEW)
  @ApiOperation({ summary: 'Work order details (updates, attachments, timeline, assignee)' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.workOrders.findOne(id, user);
  }

  @Patch('work-orders/:id')
  @RequirePermissions(PERMISSIONS.WORKORDER_UPDATE)
  @ApiOperation({ summary: 'Update fields (terminal work orders are read-only)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateWorkOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workOrders.update(id, dto, user);
  }

  @Patch('work-orders/:id/status')
  @RequirePermissions(PERMISSIONS.WORKORDER_UPDATE)
  @ApiOperation({ summary: 'Change status (start/complete/close need their permission; verify is separate)' })
  changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeWorkOrderStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workOrders.changeStatus(id, dto, user);
  }

  @Put('work-orders/:id/assignment')
  @RequirePermissions(PERMISSIONS.WORKORDER_ASSIGN)
  @ApiOperation({ summary: 'Assign to staff OR vendor (never both)' })
  assign(
    @Param('id') id: string,
    @Body() dto: AssignWorkOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workOrders.assign(id, dto, user);
  }

  @Post('work-orders/:id/approve')
  @RequirePermissions(PERMISSIONS.WORKORDER_APPROVE)
  @ApiOperation({ summary: 'Approve a recommended work order → APPROVED' })
  approve(
    @Param('id') id: string,
    @Body() dto: ApproveWorkOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workOrders.approve(id, dto, user);
  }

  @Post('work-orders/:id/reject')
  @RequirePermissions(PERMISSIONS.WORKORDER_APPROVE)
  @ApiOperation({ summary: 'Reject a recommended work order → REJECTED (reason required)' })
  reject(
    @Param('id') id: string,
    @Body() dto: RejectWorkOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workOrders.reject(id, dto, user);
  }

  @Post('work-orders/:id/verify')
  @RequirePermissions(PERMISSIONS.WORKORDER_VERIFY)
  @ApiOperation({ summary: 'Verify a completed work order (FM / Association Admin)' })
  verify(
    @Param('id') id: string,
    @Body() dto: VerifyWorkOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workOrders.verify(id, dto, user);
  }

  @Delete('work-orders/:id')
  @RequirePermissions(PERMISSIONS.WORKORDER_CLOSE)
  @ApiOperation({ summary: 'Soft-delete a work order' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.workOrders.remove(id, user);
  }

  @Get('work-orders/:id/timeline')
  @RequirePermissions(PERMISSIONS.WORKORDER_VIEW)
  @ApiOperation({ summary: 'Structured work order timeline' })
  timeline(@Param('id') id: string) {
    return this.workOrders.getTimeline(id);
  }
}

@ApiTags('Work Orders · Updates')
@ApiBearerAuth()
@Controller()
export class WorkOrderUpdateController {
  constructor(private readonly updates: WorkOrderUpdateService) {}

  @Get('work-orders/:id/updates')
  @RequirePermissions(PERMISSIONS.WORKORDER_VIEW)
  @ApiOperation({ summary: 'List progress updates (internal hidden from non-staff)' })
  list(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.updates.list(id, user);
  }

  @Post('work-orders/:id/updates')
  @RequirePermissions(PERMISSIONS.WORKORDER_UPDATE)
  @ApiOperation({ summary: 'Add a progress update' })
  add(
    @Param('id') id: string,
    @Body() dto: CreateWorkOrderUpdateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.updates.add(id, dto, user);
  }
}

@ApiTags('Work Orders · Attachments')
@ApiBearerAuth()
@Controller()
export class WorkOrderAttachmentController {
  constructor(private readonly attachments: WorkOrderAttachmentService) {}

  @Get('work-orders/:id/attachments')
  @RequirePermissions(PERMISSIONS.WORKORDER_VIEW)
  list(@Param('id') id: string) {
    return this.attachments.list(id);
  }

  @Post('work-orders/:id/attachments/upload-url')
  @RequirePermissions(PERMISSIONS.WORKORDER_UPDATE)
  @ApiOperation({ summary: 'Get a signed upload URL for an attachment (StorageService)' })
  uploadUrl(
    @Param('id') id: string,
    @Body() dto: RequestWorkOrderUploadUrlDto,
  ) {
    return this.attachments.requestUploadUrl(id, dto);
  }

  @Post('work-orders/:id/attachments')
  @RequirePermissions(PERMISSIONS.WORKORDER_UPDATE)
  @ApiOperation({ summary: 'Attach a file (metadata) to a work order' })
  add(
    @Param('id') id: string,
    @Body() dto: CreateWorkOrderAttachmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attachments.add(id, dto, user);
  }
}

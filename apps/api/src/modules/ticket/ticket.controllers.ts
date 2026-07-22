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
  CreateAttachmentDto,
  RequestAttachmentUploadUrlDto,
} from './dto/attachment.dto';
import {
  CreateTicketCategoryDto,
  QueryTicketCategoryDto,
  UpdateTicketCategoryDto,
} from './dto/category.dto';
import { CreateCommentDto } from './dto/comment.dto';
import {
  AssignTicketDto,
  ChangeTicketStatusDto,
  CreateTicketDto,
  QueryTicketDto,
  UpdateTicketDto,
} from './dto/ticket.dto';
import { TicketAttachmentService } from './ticket-attachment.service';
import { TicketCategoryService } from './ticket-category.service';
import { TicketCommentService } from './ticket-comment.service';
import { TicketDashboardService } from './ticket-dashboard.service';
import { TicketService } from './ticket.service';

@ApiTags('Tickets')
@ApiBearerAuth()
@Controller()
export class TicketController {
  constructor(
    private readonly tickets: TicketService,
    private readonly dashboard: TicketDashboardService,
  ) {}

  @Post('communities/:communityId/tickets')
  @RequirePermissions(PERMISSIONS.TICKET_CREATE)
  @ApiOperation({ summary: 'Raise a ticket' })
  create(
    @Param('communityId') communityId: string,
    @Body() dto: CreateTicketDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tickets.create(communityId, dto, user);
  }

  @Get('communities/:communityId/tickets')
  @RequirePermissions(PERMISSIONS.TICKET_VIEW)
  @ApiOperation({ summary: 'List tickets (filter/search/sort/paginate)' })
  list(@Param('communityId') communityId: string, @Query() query: QueryTicketDto) {
    return this.tickets.findMany(communityId, query);
  }

  @Get('communities/:communityId/tickets/dashboard')
  @RequirePermissions(PERMISSIONS.TICKET_VIEW)
  @ApiOperation({ summary: 'Ticket dashboard summary counts' })
  summary(@Param('communityId') communityId: string) {
    return this.dashboard.summary(communityId);
  }

  @Get('tickets/:id')
  @RequirePermissions(PERMISSIONS.TICKET_VIEW)
  @ApiOperation({ summary: 'Ticket details (category, unit, resident, comments, attachments, timeline)' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.tickets.findOne(id, user);
  }

  @Patch('tickets/:id')
  @RequirePermissions(PERMISSIONS.TICKET_UPDATE)
  @ApiOperation({ summary: 'Update ticket fields (closed tickets need ticket:close)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTicketDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tickets.update(id, dto, user);
  }

  @Patch('tickets/:id/status')
  @RequirePermissions(PERMISSIONS.TICKET_UPDATE)
  @ApiOperation({ summary: 'Change status (validated transition; resolve/close need their permission)' })
  changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeTicketStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tickets.changeStatus(id, dto, user);
  }

  @Put('tickets/:id/assignment')
  @RequirePermissions(PERMISSIONS.TICKET_ASSIGN)
  @ApiOperation({ summary: 'Assign to staff OR vendor (never both)' })
  assign(
    @Param('id') id: string,
    @Body() dto: AssignTicketDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tickets.assign(id, dto, user);
  }

  @Delete('tickets/:id')
  @RequirePermissions(PERMISSIONS.TICKET_DELETE)
  @ApiOperation({ summary: 'Soft-delete a ticket' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.tickets.remove(id, user);
  }

  @Get('tickets/:id/timeline')
  @RequirePermissions(PERMISSIONS.TICKET_VIEW)
  @ApiOperation({ summary: 'Structured ticket timeline' })
  timeline(@Param('id') id: string) {
    return this.tickets.getTimeline(id);
  }
}

@ApiTags('Tickets · Comments')
@ApiBearerAuth()
@Controller()
export class TicketCommentController {
  constructor(private readonly comments: TicketCommentService) {}

  @Get('tickets/:id/comments')
  @RequirePermissions(PERMISSIONS.TICKET_VIEW)
  @ApiOperation({ summary: 'List comments (internal comments hidden from non-staff)' })
  list(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.comments.list(id, user);
  }

  @Post('tickets/:id/comments')
  @RequirePermissions(PERMISSIONS.TICKET_COMMENT)
  @ApiOperation({ summary: 'Add a comment' })
  add(
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.comments.add(id, dto, user);
  }
}

@ApiTags('Tickets · Attachments')
@ApiBearerAuth()
@Controller()
export class TicketAttachmentController {
  constructor(private readonly attachments: TicketAttachmentService) {}

  @Get('tickets/:id/attachments')
  @RequirePermissions(PERMISSIONS.TICKET_VIEW)
  list(@Param('id') id: string) {
    return this.attachments.list(id);
  }

  @Post('tickets/:id/attachments/upload-url')
  @RequirePermissions(PERMISSIONS.TICKET_COMMENT)
  @ApiOperation({ summary: 'Get a signed upload URL for an attachment (StorageService)' })
  uploadUrl(
    @Param('id') id: string,
    @Body() dto: RequestAttachmentUploadUrlDto,
  ) {
    return this.attachments.requestUploadUrl(id, dto);
  }

  @Post('tickets/:id/attachments')
  @RequirePermissions(PERMISSIONS.TICKET_COMMENT)
  @ApiOperation({ summary: 'Attach a file (metadata) to a ticket' })
  add(
    @Param('id') id: string,
    @Body() dto: CreateAttachmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attachments.add(id, dto, user);
  }
}

@ApiTags('Tickets · Categories')
@ApiBearerAuth()
@Controller('ticket-categories')
export class TicketCategoryController {
  constructor(private readonly categories: TicketCategoryService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.TICKET_VIEW)
  @ApiOperation({ summary: 'List ticket categories (system + tenant)' })
  list(@Query() query: QueryTicketCategoryDto) {
    return this.categories.list(query);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.TICKET_UPDATE)
  @ApiOperation({ summary: 'Create a ticket category' })
  create(@Body() dto: CreateTicketCategoryDto) {
    return this.categories.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.TICKET_UPDATE)
  update(@Param('id') id: string, @Body() dto: UpdateTicketCategoryDto) {
    return this.categories.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.TICKET_UPDATE)
  remove(@Param('id') id: string) {
    return this.categories.remove(id);
  }
}

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
import { SubmitFeedbackDto } from './dto/feedback.dto';
import {
  CreateServiceDto,
  QueryServiceDto,
  UpdateServiceDto,
} from './dto/service.dto';
import {
  AssignServiceRequestDto,
  ChangeServiceRequestStatusDto,
  CreateServiceRequestDto,
  CreateTicketFromRequestDto,
  LinkTicketDto,
  QueryServiceRequestDto,
  ScheduleServiceRequestDto,
  UpdateServiceRequestDto,
} from './dto/service-request.dto';
import { ServiceCatalogService } from './service-catalog.service';
import { ServiceFeedbackService } from './service-feedback.service';
import { ServiceRequestService } from './service-request.service';

@ApiTags('Service Requests')
@ApiBearerAuth()
@Controller()
export class ServiceRequestController {
  constructor(private readonly requests: ServiceRequestService) {}

  @Post('communities/:communityId/service-requests')
  @RequirePermissions(PERMISSIONS.SERVICE_CREATE)
  @ApiOperation({ summary: 'Raise a service request' })
  create(
    @Param('communityId') communityId: string,
    @Body() dto: CreateServiceRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requests.create(communityId, dto, user);
  }

  @Get('communities/:communityId/service-requests')
  @RequirePermissions(PERMISSIONS.SERVICE_VIEW)
  @ApiOperation({ summary: 'List service requests (filter/search/sort/paginate)' })
  list(@Param('communityId') communityId: string, @Query() query: QueryServiceRequestDto) {
    return this.requests.findMany(communityId, query);
  }

  @Get('service-requests/:id')
  @RequirePermissions(PERMISSIONS.SERVICE_VIEW)
  @ApiOperation({ summary: 'Service request details (service, unit, resident, feedback, assignee)' })
  findOne(@Param('id') id: string) {
    return this.requests.findOne(id);
  }

  @Patch('service-requests/:id')
  @RequirePermissions(PERMISSIONS.SERVICE_UPDATE)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateServiceRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requests.update(id, dto, user);
  }

  @Patch('service-requests/:id/status')
  @RequirePermissions(PERMISSIONS.SERVICE_UPDATE)
  @ApiOperation({ summary: 'Change status (validated; complete/cancel need their permission)' })
  changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeServiceRequestStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requests.changeStatus(id, dto, user);
  }

  @Put('service-requests/:id/assignment')
  @RequirePermissions(PERMISSIONS.SERVICE_ASSIGN)
  @ApiOperation({ summary: 'Assign to staff OR vendor (never both)' })
  assign(
    @Param('id') id: string,
    @Body() dto: AssignServiceRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requests.assign(id, dto, user);
  }

  @Patch('service-requests/:id/schedule')
  @RequirePermissions(PERMISSIONS.SERVICE_UPDATE)
  @ApiOperation({ summary: 'Set preferred / actual scheduling fields' })
  schedule(
    @Param('id') id: string,
    @Body() dto: ScheduleServiceRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requests.schedule(id, dto, user);
  }

  @Post('service-requests/:id/ticket/link')
  @RequirePermissions(PERMISSIONS.SERVICE_UPDATE)
  @ApiOperation({ summary: 'Link an existing ticket to this request' })
  linkTicket(
    @Param('id') id: string,
    @Body() dto: LinkTicketDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requests.linkTicket(id, dto, user);
  }

  @Post('service-requests/:id/ticket')
  @RequirePermissions(PERMISSIONS.SERVICE_UPDATE, PERMISSIONS.TICKET_CREATE)
  @ApiOperation({ summary: 'Create a ticket from this request and link it (Ticket Engine)' })
  createTicket(
    @Param('id') id: string,
    @Body() dto: CreateTicketFromRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requests.createTicket(id, dto, user);
  }

  @Delete('service-requests/:id')
  @RequirePermissions(PERMISSIONS.SERVICE_CANCEL)
  @ApiOperation({ summary: 'Soft-delete a service request' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.requests.remove(id, user);
  }
}

@ApiTags('Service Requests · Feedback')
@ApiBearerAuth()
@Controller()
export class ServiceFeedbackController {
  constructor(private readonly feedback: ServiceFeedbackService) {}

  @Get('service-requests/:id/feedback')
  @RequirePermissions(PERMISSIONS.SERVICE_VIEW)
  get(@Param('id') id: string) {
    return this.feedback.get(id);
  }

  @Post('service-requests/:id/feedback')
  @RequirePermissions(PERMISSIONS.SERVICE_VIEW)
  @ApiOperation({ summary: 'Submit feedback (rating 1–5) after completion' })
  submit(
    @Param('id') id: string,
    @Body() dto: SubmitFeedbackDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.feedback.submit(id, dto, user);
  }
}

@ApiTags('Service Requests · Catalog')
@ApiBearerAuth()
@Controller('services')
export class ServiceCatalogController {
  constructor(private readonly catalog: ServiceCatalogService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SERVICE_VIEW)
  @ApiOperation({ summary: 'List services (system + tenant)' })
  list(@Query() query: QueryServiceDto) {
    return this.catalog.list(query);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SERVICE_UPDATE)
  @ApiOperation({ summary: 'Create a service' })
  create(@Body() dto: CreateServiceDto) {
    return this.catalog.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.SERVICE_UPDATE)
  update(@Param('id') id: string, @Body() dto: UpdateServiceDto) {
    return this.catalog.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.SERVICE_UPDATE)
  remove(@Param('id') id: string) {
    return this.catalog.remove(id);
  }
}

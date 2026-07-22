import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PERMISSIONS } from '../rbac/rbac.constants';
import {
  CreateDocumentDto,
  QueryDocumentDto,
  RequestUploadUrlDto,
  UpdateDocumentDto,
} from './dto/document.dto';
import { DocumentService } from './document.service';

@ApiTags('Community Documents')
@ApiBearerAuth()
@Controller()
export class DocumentController {
  constructor(private readonly documents: DocumentService) {}

  @Get('communities/:communityId/documents')
  @RequirePermissions(PERMISSIONS.DOCUMENT_READ)
  @ApiOperation({ summary: 'List community documents' })
  list(@Param('communityId') communityId: string, @Query() query: QueryDocumentDto) {
    return this.documents.findMany(communityId, query);
  }

  @Post('communities/:communityId/documents')
  @RequirePermissions(PERMISSIONS.DOCUMENT_CREATE)
  @ApiOperation({ summary: 'Add a document (metadata)' })
  create(
    @Param('communityId') communityId: string,
    @Body() dto: CreateDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documents.create(communityId, dto, user);
  }

  @Post('communities/:communityId/documents/upload-url')
  @RequirePermissions(PERMISSIONS.DOCUMENT_CREATE)
  @ApiOperation({ summary: 'Get a signed upload URL + storage key (storage abstraction)' })
  uploadUrl(
    @Param('communityId') communityId: string,
    @Body() dto: RequestUploadUrlDto,
  ) {
    return this.documents.requestUploadUrl(communityId, dto);
  }

  @Get('documents/:id')
  @RequirePermissions(PERMISSIONS.DOCUMENT_READ)
  findOne(@Param('id') id: string) {
    return this.documents.findOne(id);
  }

  @Patch('documents/:id')
  @RequirePermissions(PERMISSIONS.DOCUMENT_UPDATE)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documents.update(id, dto, user);
  }

  @Delete('documents/:id')
  @RequirePermissions(PERMISSIONS.DOCUMENT_DELETE)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.documents.remove(id, user);
  }
}

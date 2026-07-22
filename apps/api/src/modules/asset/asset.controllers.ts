import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PERMISSIONS } from '../rbac/rbac.constants';
import { AssetCategoryService } from './asset-category.service';
import { AssetDocumentService } from './asset-document.service';
import { AssetPhotoService } from './asset-photo.service';
import { AssetService } from './asset.service';
import {
  CreateAssetCategoryDto, QueryAssetCategoryDto, UpdateAssetCategoryDto,
} from './dto/asset-category.dto';
import { CreateAssetDto, QueryAssetDto, UpdateAssetDto } from './dto/asset.dto';
import {
  CreateAssetDocumentDto, CreateAssetPhotoDto, RequestAssetUploadUrlDto,
} from './dto/media.dto';

@ApiTags('Asset Categories')
@ApiBearerAuth()
@Controller('asset-categories')
export class AssetCategoryController {
  constructor(private readonly categories: AssetCategoryService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ASSET_READ)
  @ApiOperation({ summary: 'List asset categories for a community' })
  list(@Query() query: QueryAssetCategoryDto) {
    return this.categories.findMany(query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ASSET_READ)
  findOne(@Param('id') id: string) {
    return this.categories.findOne(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ASSET_CATEGORY_MANAGE)
  @ApiOperation({ summary: 'Create an asset category (self-nesting)' })
  create(@Body() dto: CreateAssetCategoryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.categories.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ASSET_CATEGORY_MANAGE)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAssetCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.categories.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.ASSET_CATEGORY_MANAGE)
  @ApiOperation({ summary: 'Delete an empty asset category (blocked if assets use it)' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.categories.remove(id, user);
  }
}

@ApiTags('Assets')
@ApiBearerAuth()
@Controller('assets')
export class AssetController {
  constructor(private readonly assets: AssetService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ASSET_READ)
  @ApiOperation({ summary: 'List assets (filter/search/sort/paginate — community-scoped)' })
  list(@Query() query: QueryAssetDto) {
    return this.assets.findMany(query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ASSET_READ)
  @ApiOperation({ summary: 'Asset details (category, location, documents, photos, recent events)' })
  findOne(@Param('id') id: string) {
    return this.assets.findOne(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ASSET_CREATE)
  @ApiOperation({ summary: 'Create an asset' })
  create(@Body() dto: CreateAssetDto, @CurrentUser() user: AuthenticatedUser) {
    return this.assets.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ASSET_UPDATE)
  @ApiOperation({ summary: 'Update an asset (emits status/moved events on those changes)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAssetDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assets.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.ASSET_DELETE)
  @ApiOperation({ summary: 'Archive an asset (soft-delete — history retained)' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.assets.archive(id, user);
  }

  @Get(':id/events')
  @RequirePermissions(PERMISSIONS.ASSET_READ)
  @ApiOperation({ summary: 'Immutable asset history (structured events)' })
  events(@Param('id') id: string) {
    return this.assets.getEvents(id);
  }
}

@ApiTags('Assets · Documents')
@ApiBearerAuth()
@Controller('assets')
export class AssetDocumentController {
  constructor(private readonly documents: AssetDocumentService) {}

  @Get(':id/documents')
  @RequirePermissions(PERMISSIONS.ASSET_READ)
  list(@Param('id') id: string) {
    return this.documents.list(id);
  }

  @Post(':id/documents/upload-url')
  @RequirePermissions(PERMISSIONS.ASSET_DOCUMENT_CREATE)
  @ApiOperation({ summary: 'Get a signed upload URL for an asset document (StorageService)' })
  uploadUrl(@Param('id') id: string, @Body() dto: RequestAssetUploadUrlDto) {
    return this.documents.requestUploadUrl(id, dto);
  }

  @Post(':id/documents')
  @RequirePermissions(PERMISSIONS.ASSET_DOCUMENT_CREATE)
  @ApiOperation({ summary: 'Register an asset document (metadata)' })
  add(
    @Param('id') id: string,
    @Body() dto: CreateAssetDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documents.add(id, dto, user);
  }
}

@ApiTags('Assets · Photos')
@ApiBearerAuth()
@Controller('assets')
export class AssetPhotoController {
  constructor(private readonly photos: AssetPhotoService) {}

  @Get(':id/photos')
  @RequirePermissions(PERMISSIONS.ASSET_READ)
  list(@Param('id') id: string) {
    return this.photos.list(id);
  }

  @Post(':id/photos/upload-url')
  @RequirePermissions(PERMISSIONS.ASSET_PHOTO_CREATE)
  @ApiOperation({ summary: 'Get a signed upload URL for an asset photo (StorageService)' })
  uploadUrl(@Param('id') id: string, @Body() dto: RequestAssetUploadUrlDto) {
    return this.photos.requestUploadUrl(id, dto);
  }

  @Post(':id/photos')
  @RequirePermissions(PERMISSIONS.ASSET_PHOTO_CREATE)
  @ApiOperation({ summary: 'Register an asset photo (metadata)' })
  add(
    @Param('id') id: string,
    @Body() dto: CreateAssetPhotoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.photos.add(id, dto, user);
  }
}

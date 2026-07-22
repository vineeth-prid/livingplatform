import { Module } from '@nestjs/common';

import {
  AssetCategoryController,
  AssetController,
  AssetDocumentController,
  AssetPhotoController,
} from './asset.controllers';
import { AssetCategoryService } from './asset-category.service';
import { AssetDocumentService } from './asset-document.service';
import { AssetEventService } from './asset-event.service';
import { AssetPhotoService } from './asset-photo.service';
import { AssetService } from './asset.service';

/**
 * The Asset Engine (Sprint 7) — an independent, first-class domain. Assets are
 * REFERENCED by Work Orders and Service Requests (loose scalar `assetId`, no FK)
 * but never owned by them. Reuses the platform's tenancy, storage, events and
 * audit infrastructure; introduces no new cross-cutting concerns. Its append-only
 * AssetEvent history is the foundation for future PM / AMC / inspections /
 * lifecycle / predictive-maintenance modules with no refactoring.
 */
@Module({
  controllers: [
    AssetCategoryController,
    AssetController,
    AssetDocumentController,
    AssetPhotoController,
  ],
  providers: [
    AssetService,
    AssetCategoryService,
    AssetDocumentService,
    AssetPhotoService,
    AssetEventService,
  ],
  exports: [AssetService],
})
export class AssetModule {}

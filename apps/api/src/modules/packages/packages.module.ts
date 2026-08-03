import { Module } from '@nestjs/common';

import { ServiceRequestModule } from '../service-request/service-request.module';
import { PackagePurchaseService } from './package-purchase.service';
import { PackageService } from './package.service';
import { PackageController, PackagePurchaseController } from './packages.controllers';

/**
 * Service Packages (Sprint 12).
 *
 * A merchandising layer over the Service catalog — NOT a second catalog and NOT
 * a second booking engine:
 *
 *   • a package references existing `Service` rows by id
 *   • buying one collects through the existing Payment Engine (SERVICE rail)
 *   • redeeming one creates an ordinary `ServiceRequest`
 *
 * It imports ServiceRequestModule for exactly that last point, and listens for
 * the payment engine's `payment.succeeded` domain event to activate a purchase —
 * so the payment module needs no knowledge of packages at all.
 */
@Module({
  imports: [ServiceRequestModule],
  controllers: [PackageController, PackagePurchaseController],
  providers: [PackageService, PackagePurchaseService],
  exports: [PackageService, PackagePurchaseService],
})
export class PackagesModule {}

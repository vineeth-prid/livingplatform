import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { TenantContextInterceptor } from './common/interceptors/tenant-context.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { configuration, type AppConfig } from './config/configuration';
import { validateEnv } from './config/env.validation';
import { AmenityModule } from './modules/amenity/amenity.module';
import { AdminModule } from './modules/admin/admin.module';
import { AmcModule } from './modules/amc/amc.module';
import { AssetModule } from './modules/asset/asset.module';
import { CommunityOpsModule } from './modules/community-ops/community-ops.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { AuditInterceptor } from './modules/audit/audit.interceptor';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CommunityModule } from './modules/community/community.module';
import { PlatformStatsModule } from './modules/platform-stats/platform-stats.module';
import { DocumentModule } from './modules/document/document.module';
import { NotificationModule } from './modules/notifications/notification.module';
import { EventsModule } from './modules/events/events.module';
import { HealthModule } from './modules/health/health.module';
import { HierarchyModule } from './modules/hierarchy/hierarchy.module';
import { MailModule } from './modules/mail/mail.module';
import { PeopleModule } from './modules/people/people.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { ProfileModule } from './modules/profile/profile.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { RedisModule } from './modules/redis/redis.module';
import { ResidentModule } from './modules/resident/resident.module';
import { SearchModule } from './modules/search/search.module';
import { ServiceRequestModule } from './modules/service-request/service-request.module';
import { SettingsModule } from './modules/settings/settings.module';
import { StaffModule } from './modules/staff/staff.module';
import { StorageModule } from './modules/storage/storage.module';
import { TenancyModule } from './modules/tenancy/tenancy.module';
import { TicketModule } from './modules/ticket/ticket.module';
import { UnitModule } from './modules/unit/unit.module';
import { UsersModule } from './modules/users/users.module';
import { VendorModule } from './modules/vendor/vendor.module';
import { WorkOrderModule } from './modules/work-order/work-order.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate: validateEnv,
    }),

    // In-process cron (Preventive Maintenance scheduler runs every minute).
    ScheduleModule.forRoot(),

    // Structured JSON logging (pretty in dev). Redacts auth headers.
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        redact: ['req.headers.authorization', 'req.headers.cookie'],
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true } },
        autoLogging: { ignore: (req) => req.url === '/api/v1/health' },
      },
    }),

    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const t = config.get('throttle', { infer: true });
        return { throttlers: [{ ttl: t.ttl * 1000, limit: t.limit }] };
      },
    }),

    // Global infrastructure
    PrismaModule,
    RedisModule,
    NotificationModule,
    MailModule,
    StorageModule,
    EventsModule,
    TenancyModule,
    AuditModule,
    PeopleModule,

    // Platform feature modules (Sprint 1)
    AuthModule,
    RbacModule,
    UsersModule,
    HealthModule,

    // Community Foundation (Sprint 2)
    CommunityModule,
    HierarchyModule,
    UnitModule,
    AmenityModule,
    SettingsModule,
    CatalogModule,
    PlatformStatsModule,
    DocumentModule,
    ProfileModule,
    SearchModule,

    // People Foundation (Sprint 3)
    ResidentModule,
    VendorModule,
    StaffModule,

    // Ticket Engine (Sprint 4)
    TicketModule,

    // Service Request Engine (Sprint 5)
    ServiceRequestModule,

    // Work Order Engine (Sprint 6)
    WorkOrderModule,

    // Asset Foundation (Sprint 7)
    AssetModule,

    // Preventive Maintenance Engine (Sprint 8)
    MaintenanceModule,

    // AMC Management Engine (Sprint 9)
    AmcModule,

    // Community Operations (Sprint 10)
    CommunityOpsModule,

    // Platform-Admin control plane (community provisioning)
    AdminModule,
  ],
  providers: [
    // Guard chain: rate-limit → authenticate → authorize (permissions, roles).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: RolesGuard },

    { provide: APP_FILTER, useClass: AllExceptionsFilter },

    // Tenant context first, so it is set before any DB work in the chain.
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },

    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    },
  ],
})
export class AppModule {}

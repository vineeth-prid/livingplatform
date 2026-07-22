import { Global, Module } from '@nestjs/common';

import { AuditInterceptor } from './audit.interceptor';
import { AuditService } from './audit.service';

/** Global so AuditService is injectable anywhere and the interceptor can bind. */
@Global()
@Module({
  providers: [AuditService, AuditInterceptor],
  exports: [AuditService, AuditInterceptor],
})
export class AuditModule {}

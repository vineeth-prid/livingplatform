import { Global, Module, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../config/configuration';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { STORAGE_PROVIDER, type StorageProvider } from './storage.interface';
import { StorageService } from './storage.service';

/**
 * Binds a StorageProvider based on STORAGE_DRIVER. Only the 'local' stub exists
 * this sprint; add cases (s3/azure/gcs) here as providers are implemented —
 * the token indirection keeps every consumer untouched.
 */
@Global()
@Module({
  providers: [
    LocalStorageProvider,
    {
      provide: STORAGE_PROVIDER,
      inject: [ConfigService, LocalStorageProvider],
      useFactory: (
        config: ConfigService<AppConfig, true>,
        local: LocalStorageProvider,
      ): StorageProvider => {
        const driver = config.get('storage', { infer: true }).driver;
        switch (driver) {
          case 'local':
            return local;
          // case 's3': return new S3StorageProvider(config);
          default:
            new Logger('StorageModule').warn(
              `Unknown STORAGE_DRIVER "${driver}", falling back to local stub`,
            );
            return local;
        }
      },
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}

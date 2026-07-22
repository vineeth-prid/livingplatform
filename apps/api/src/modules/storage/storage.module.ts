import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../config/configuration';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { STORAGE_PROVIDER, type StorageProvider } from './storage.interface';
import { StorageService } from './storage.service';

/**
 * Binds a StorageProvider based on STORAGE_DRIVER — the ONLY thing that changes
 * between environments. `local` is the metadata-only dev stub; `s3` is the
 * production S3/MinIO provider. The token indirection keeps every consumer
 * (attachments, photos, documents, asset images) untouched.
 *
 * The factory is async: for `s3` it constructs the provider and runs `init()`
 * (verify/create bucket + write probe) so a misconfigured store FAILS FAST on
 * boot rather than on the first upload.
 */
@Global()
@Module({
  providers: [
    LocalStorageProvider,
    {
      provide: STORAGE_PROVIDER,
      inject: [ConfigService, LocalStorageProvider],
      useFactory: async (
        config: ConfigService<AppConfig, true>,
        local: LocalStorageProvider,
      ): Promise<StorageProvider> => {
        const driver = config.get('storage', { infer: true }).driver;
        switch (driver) {
          case 's3': {
            const s3 = new S3StorageProvider(config);
            await s3.init();
            return s3;
          }
          case 'local':
            return local;
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

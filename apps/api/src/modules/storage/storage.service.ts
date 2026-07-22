import { Inject, Injectable } from '@nestjs/common';

import {
  STORAGE_PROVIDER,
  type SignedUrl,
  type SignedUrlOptions,
  type StorageProvider,
} from './storage.interface';

/**
 * The API business modules use for storage. Delegates to the bound provider and
 * adds small conveniences (key→public-URL resolution for nullable keys). No
 * module ever imports a concrete provider.
 */
@Injectable()
export class StorageService {
  constructor(
    @Inject(STORAGE_PROVIDER) private readonly provider: StorageProvider,
  ) {}

  get driver(): string {
    return this.provider.driver;
  }

  buildKey(scope: string, fileName: string): string {
    return this.provider.buildKey(scope, fileName);
  }

  signUpload(key: string, options?: SignedUrlOptions): Promise<SignedUrl> {
    return this.provider.getSignedUploadUrl(key, options);
  }

  signDownload(key: string, options?: SignedUrlOptions): Promise<SignedUrl> {
    return this.provider.getSignedDownloadUrl(key, options);
  }

  delete(key: string): Promise<void> {
    return this.provider.delete(key);
  }

  exists(key: string): Promise<boolean> {
    return this.provider.exists(key);
  }

  /** Resolve a stored key (or null) to a public URL (or null) for responses. */
  resolveUrl(key: string | null | undefined): string | null {
    return key ? this.provider.getPublicUrl(key) : null;
  }
}

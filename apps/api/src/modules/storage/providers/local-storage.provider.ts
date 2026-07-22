import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../../config/configuration';
import { buildObjectKey } from '../object-key';
import type {
  SignedUrl,
  SignedUrlOptions,
  StorageProvider,
} from '../storage.interface';

/**
 * Default stub provider. Generates deterministic keys and URL shapes so the
 * rest of the platform can store/resolve storage keys today — WITHOUT any
 * real object store wired (no file uploads this sprint). "Signed" URLs are
 * plain public URLs with a fake expiry; `delete`/`exists` are safe no-ops.
 *
 * ponytail: intentionally a stub. Replace with an S3 provider (same interface,
 * @aws-sdk/client-s3 + getSignedUrl) when uploads land — nothing else changes.
 */
@Injectable()
export class LocalStorageProvider implements StorageProvider {
  readonly driver = 'local';
  private readonly publicUrl: string;
  private readonly ttl: number;

  constructor(config: ConfigService<AppConfig, true>) {
    const storage = config.get('storage', { infer: true });
    this.publicUrl = storage.publicUrl.replace(/\/$/, '');
    this.ttl = storage.signedUrlTtl;
  }

  buildKey(scope: string, fileName: string): string {
    return buildObjectKey(scope, fileName);
  }

  getSignedUploadUrl(key: string, options?: SignedUrlOptions): Promise<SignedUrl> {
    return Promise.resolve(this.fakeSigned(key, options));
  }

  getSignedDownloadUrl(
    key: string,
    options?: SignedUrlOptions,
  ): Promise<SignedUrl> {
    return Promise.resolve(this.fakeSigned(key, options));
  }

  getPublicUrl(key: string): string {
    return `${this.publicUrl}/${key}`;
  }

  delete(): Promise<void> {
    return Promise.resolve();
  }

  exists(): Promise<boolean> {
    return Promise.resolve(false);
  }

  private fakeSigned(key: string, options?: SignedUrlOptions): SignedUrl {
    const ttl = options?.expiresInSeconds ?? this.ttl;
    return {
      url: `${this.getPublicUrl(key)}?X-Stub-Signature=local&expires=${ttl}`,
      expiresAt: new Date(Date.now() + ttl * 1000),
    };
  }
}

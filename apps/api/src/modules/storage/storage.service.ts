import { BadRequestException, Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../config/configuration';
import {
  STORAGE_PROVIDER,
  type SignedUrl,
  type SignedUrlOptions,
  type StorageProvider,
} from './storage.interface';

/**
 * Content types a browser would EXECUTE when the object is opened from the
 * storage origin (stored XSS / phishing pages). Everything else — images, PDFs,
 * office documents, octet-stream — is allowed, so no existing upload breaks.
 */
const ACTIVE_CONTENT = /^(text\/html|application\/xhtml\+xml|image\/svg\+xml|text\/xml|application\/xml|text\/javascript|application\/(x-)?javascript)\b/i;

const DEFAULT_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/**
 * The API business modules use for storage. Delegates to the bound provider and
 * adds small conveniences (key→public-URL resolution for nullable keys). No
 * module ever imports a concrete provider.
 */
@Injectable()
export class StorageService {
  private readonly maxUploadBytes: number;

  constructor(
    @Inject(STORAGE_PROVIDER) private readonly provider: StorageProvider,
    @Optional() config?: ConfigService<AppConfig, true>,
  ) {
    this.maxUploadBytes = config?.get('storage', { infer: true })?.maxUploadBytes ?? DEFAULT_MAX_UPLOAD_BYTES;
  }

  get driver(): string {
    return this.provider.driver;
  }

  buildKey(scope: string, fileName: string): string {
    return this.provider.buildKey(scope, fileName);
  }

  signUpload(key: string, options?: SignedUrlOptions): Promise<SignedUrl> {
    if (options?.contentType && ACTIVE_CONTENT.test(options.contentType)) {
      throw new BadRequestException(`Files of type ${options.contentType} cannot be uploaded`);
    }
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

  /**
   * A short-lived SIGNED link for a stored key (or null). Use this — not
   * resolveUrl — for anything served to users: the bucket is private, and a
   * public-read bucket would expose every document in it.
   */
  async signedUrl(key: string | null | undefined): Promise<string | null> {
    return key ? (await this.provider.getSignedDownloadUrl(key)).url : null;
  }

  /**
   * Accept a client-supplied object key only if the server could have issued
   * it for THIS record, and the uploaded object is acceptable.
   *
   * Keys come back from the client after the signed-upload round trip. Saving
   * them unchecked let anyone who learned another key (from a response, a log,
   * a former colleague) attach it to their own record and mint a fresh signed
   * download link for someone else's file — across communities. `scope` is the
   * prefix the matching upload-url endpoint builds keys under.
   *
   * `previous` lets an update re-send the key it already holds unchanged.
   * The object checks (exists / size / active content) run only where the
   * provider can stat objects (S3/MinIO); the local stub stores no bytes.
   */
  async assertOwnedKey(
    key: string | null | undefined,
    scope: string,
    previous?: string | null,
  ): Promise<void> {
    if (!key || key === previous) return;
    const prefix = `${scope.replace(/^\/+|\/+$/g, '')}/`;
    if (key.includes('..') || key.startsWith('/') || !key.startsWith(prefix)) {
      throw new BadRequestException('That file reference is not valid here — upload the file again');
    }
    if (!this.provider.stat) return;
    const stat = await this.provider.stat(key);
    if (!stat) throw new BadRequestException('The file was not uploaded — try again');
    const tooBig = stat.size > this.maxUploadBytes;
    const active = !!stat.contentType && ACTIVE_CONTENT.test(stat.contentType);
    if (tooBig || active) {
      await this.provider.delete(key).catch(() => undefined);
      throw new BadRequestException(
        tooBig
          ? `Files must be ${Math.round(this.maxUploadBytes / 1048576)} MB or smaller`
          : 'That type of file cannot be uploaded',
      );
    }
  }

  /** Internal readiness probe — delegates to the provider (no-op if unsupported). */
  ping(): Promise<void> {
    return this.provider.ping ? this.provider.ping() : Promise.resolve();
  }
}

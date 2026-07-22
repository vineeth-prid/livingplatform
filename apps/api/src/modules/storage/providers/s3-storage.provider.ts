import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import type { AppConfig } from '../../../config/configuration';
import { buildObjectKey } from '../object-key';
import type {
  SignedUrl,
  SignedUrlOptions,
  StorageProvider,
} from '../storage.interface';

/**
 * Production object storage backed by S3-compatible storage (MinIO). Implements
 * the SAME StorageProvider contract as the local stub, so the rest of the
 * platform (attachments, photos, documents, asset images) is unaware of the
 * backend — only the DI binding changes (STORAGE_DRIVER=s3).
 *
 * Endpoint / credentials / bucket come from config (env), never hardcoded, and
 * are validated at startup. `init()` ensures the bucket exists (creating it if
 * missing) and verifies write access — called from the module factory so a
 * misconfigured store fails fast on boot.
 */
export class S3StorageProvider implements StorageProvider {
  readonly driver = 's3';
  private readonly logger = new Logger(S3StorageProvider.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;
  private readonly ttl: number;

  constructor(config: ConfigService<AppConfig, true>) {
    const storage = config.get('storage', { infer: true });
    const s3 = storage.s3;
    this.bucket = s3.bucket;
    this.publicUrl = storage.publicUrl.replace(/\/$/, '');
    this.ttl = storage.signedUrlTtl;
    this.client = new S3Client({
      endpoint: `${s3.ssl ? 'https' : 'http'}://${s3.endpoint}:${s3.port}`,
      region: s3.region,
      credentials: { accessKeyId: s3.accessKey, secretAccessKey: s3.secretKey },
      forcePathStyle: s3.forcePathStyle,
    });
  }

  /** Ensure the bucket exists (create if missing) and confirm write access. */
  async init(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (err) {
      if (this.isNotFound(err)) {
        this.logger.log(`Bucket "${this.bucket}" not found — creating it`);
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      } else {
        throw new Error(`S3 storage unreachable or credentials invalid: ${(err as Error).message}`);
      }
    }
    // Write probe — proves the credentials can write (fail fast on boot).
    const probe = '.living/health-probe';
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: probe, Body: 'ok', ContentType: 'text/plain' }));
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: probe }));
    this.logger.log(`S3 storage ready (bucket "${this.bucket}")`);
  }

  buildKey(scope: string, fileName: string): string {
    return buildObjectKey(scope, fileName);
  }

  async getSignedUploadUrl(key: string, options?: SignedUrlOptions): Promise<SignedUrl> {
    const expiresIn = options?.expiresInSeconds ?? this.ttl;
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: options?.contentType }),
      { expiresIn },
    );
    return { url, expiresAt: new Date(Date.now() + expiresIn * 1000) };
  }

  async getSignedDownloadUrl(key: string, options?: SignedUrlOptions): Promise<SignedUrl> {
    const expiresIn = options?.expiresInSeconds ?? this.ttl;
    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn },
    );
    return { url, expiresAt: new Date(Date.now() + expiresIn * 1000) };
  }

  getPublicUrl(key: string): string {
    return `${this.publicUrl}/${key}`;
  }

  /** Idempotent — deleting a missing object is a success. */
  async delete(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (err) {
      if (!this.isNotFound(err)) throw err;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch (err) {
      if (this.isNotFound(err)) return false;
      throw err;
    }
  }

  /** Health probe — bucket reachable + credentials valid (lightweight). */
  async ping(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
  }

  private isNotFound(err: unknown): boolean {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    return e?.name === 'NotFound' || e?.name === 'NoSuchKey' || e?.name === 'NoSuchBucket' || e?.$metadata?.httpStatusCode === 404;
  }
}

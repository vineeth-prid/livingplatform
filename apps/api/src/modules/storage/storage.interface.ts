/**
 * Provider-agnostic object storage contract. Business modules depend on this
 * interface (via StorageService), never on a concrete backend — so MinIO / S3 /
 * Azure Blob / GCS are swappable by binding a different provider, with zero
 * changes to community/document/profile code.
 */

export interface SignedUrl {
  url: string;
  expiresAt: Date;
}

export interface SignedUrlOptions {
  /** Override the default TTL (seconds). */
  expiresInSeconds?: number;
  contentType?: string;
}

export interface StorageProvider {
  /** Identifier for the active backend, e.g. 'local', 's3'. */
  readonly driver: string;

  /**
   * Build a namespaced, collision-resistant object key.
   * e.g. buildKey('communities/abc/logos', 'logo.png')
   *   → 'communities/abc/logos/2026/01/uuid-logo.png'
   */
  buildKey(scope: string, fileName: string): string;

  /** A time-limited URL a client can PUT bytes to. */
  getSignedUploadUrl(key: string, options?: SignedUrlOptions): Promise<SignedUrl>;

  /** A time-limited URL a client can GET bytes from. */
  getSignedDownloadUrl(
    key: string,
    options?: SignedUrlOptions,
  ): Promise<SignedUrl>;

  /** A stable public URL (for non-sensitive assets served publicly). */
  getPublicUrl(key: string): string;

  delete(key: string): Promise<void>;

  exists(key: string): Promise<boolean>;
}

/** DI token for the bound StorageProvider implementation. */
export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');

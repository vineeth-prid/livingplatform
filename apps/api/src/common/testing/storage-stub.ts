import type { StorageProvider } from '../../modules/storage/storage.interface';

/**
 * A StorageProvider that answers without a store behind it.
 *
 * `StorageModule` binds `STORAGE_PROVIDER` through an ASYNC factory, and for
 * `s3` that factory constructs the provider and awaits `init()` — a HeadBucket
 * call plus a write probe — so a misconfigured store fails fast on boot rather
 * than on the first upload. That is right for the application and wrong for a
 * boot smoke test: merely compiling the DI graph reached the real object store.
 * On a deployment with `STORAGE_DRIVER=s3` the spec failed with a TLS handshake
 * error against a plaintext endpoint, while the running API was perfectly
 * healthy against the same config.
 *
 * Overriding the token bypasses the factory entirely, so `init()` never runs.
 * This is the same shape as the Prisma, Redis, Realtime and BullMQ-Worker
 * overrides those specs already carry: every edge that opens a connection at
 * boot is stubbed, and everything in between is constructed for real.
 *
 * Deliberately not a storage simulation — it exists so the graph can
 * initialise. Anything asserting real signing or key behaviour belongs in the
 * provider's own spec.
 */
// Typed as StorageProvider with NO cast: the compiler checks this against the
// real interface, so a method added there fails here rather than at boot.
export function createStorageStub(): StorageProvider {
  const expiresAt = new Date(Date.now() + 900_000);
  return {
    driver: 'stub',
    buildKey: (scope: string, fileName: string) => `${scope}/${fileName}`,
    getSignedUploadUrl: (key: string) =>
      Promise.resolve({ url: `https://storage.invalid/${key}?upload`, expiresAt }),
    getSignedDownloadUrl: (key: string) =>
      Promise.resolve({ url: `https://storage.invalid/${key}?download`, expiresAt }),
    getPublicUrl: (key: string) => `https://storage.invalid/${key}`,
    delete: () => Promise.resolve(),
    exists: () => Promise.resolve(false),
    // Optional on the interface, but the readiness indicator calls it — a stub
    // that omits it turns a health check into a TypeError.
    ping: () => Promise.resolve(),
  };
}

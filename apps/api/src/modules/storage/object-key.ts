import { randomUUID } from 'node:crypto';

/**
 * Build a namespaced, collision-safe object key — shared by every storage
 * provider so keys never drift between local and S3/MinIO.
 *
 *   buildObjectKey('communities/abc/logos', 'My Logo.PNG')
 *     → 'communities/abc/logos/2026/07/<uuid>-my-logo.png'
 *
 * The client filename is NEVER trusted for the path: it is sanitised (only
 * word chars, dot, dash), lower-cased, and prefixed with a random UUID, so the
 * key is unguessable and safe as an object path.
 */
export function buildObjectKey(scope: string, fileName: string): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const safeScope = scope.replace(/^\/+|\/+$/g, '');
  const safeName = fileName.replace(/[^\w.-]+/g, '-').toLowerCase();
  return `${safeScope}/${yyyy}/${mm}/${randomUUID()}-${safeName}`;
}

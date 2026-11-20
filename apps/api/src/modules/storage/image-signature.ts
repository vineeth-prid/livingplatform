/** Raster formats accepted for branding images (logos). */
export type ImageKind = 'png' | 'jpeg' | 'webp';

/**
 * Identify an image by its first bytes — the file's own signature, not the
 * extension or the content type the uploader claimed. Returns null for
 * anything else (SVG, PDF, a renamed executable…).
 */
export function detectImageKind(bytes: Uint8Array): ImageKind | null {
  const b = (i: number) => bytes[i];
  if (bytes.length >= 8 && b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47 && b(4) === 0x0d && b(5) === 0x0a && b(6) === 0x1a && b(7) === 0x0a) {
    return 'png';
  }
  if (bytes.length >= 3 && b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return 'jpeg';
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp';
  return null;
}

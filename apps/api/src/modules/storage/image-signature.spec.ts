import { detectImageKind } from './image-signature';

describe('detectImageKind', () => {
  it('recognises PNG, JPEG and WebP by their bytes', () => {
    expect(detectImageKind(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('png');
    expect(detectImageKind(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpeg');
    expect(detectImageKind(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 '))).toBe('webp');
  });

  it('rejects anything else, whatever it is called', () => {
    expect(detectImageKind(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull();
    expect(detectImageKind(new TextEncoder().encode('%PDF-1.4'))).toBeNull();
    expect(detectImageKind(new Uint8Array())).toBeNull();
  });
});

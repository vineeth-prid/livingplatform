import { BadRequestException } from '@nestjs/common';

import { createStorageStub } from '../../common/testing/storage-stub';
import type { StorageProvider } from './storage.interface';
import { StorageService } from './storage.service';

describe('StorageService.assertOwnedKey', () => {
  const scope = 'tickets/t-1/attachments';

  it('accepts a key issued under the record scope, and an unchanged previous key', async () => {
    const svc = new StorageService(createStorageStub());
    await expect(svc.assertOwnedKey(`${scope}/2026/11/uuid-photo.jpg`, scope)).resolves.toBeUndefined();
    await expect(svc.assertOwnedKey('legacy/whatever', scope, 'legacy/whatever')).resolves.toBeUndefined();
    await expect(svc.assertOwnedKey(undefined, scope)).resolves.toBeUndefined();
  });

  it.each([
    ['another ticket', 'tickets/t-2/attachments/2026/11/x.jpg'],
    ['another community', 'communities/c-9/documents/2026/11/lease.pdf'],
    ['path traversal', `${scope}/../../../communities/c-9/x.pdf`],
    ['prefix lookalike', 'tickets/t-1/attachments-evil/x.jpg'],
  ])('rejects a key from %s', async (_label, key) => {
    const svc = new StorageService(createStorageStub());
    await expect(svc.assertOwnedKey(key, scope)).rejects.toThrow(BadRequestException);
  });

  it('rejects (and deletes) oversized or active-content objects when the driver can stat', async () => {
    const del = jest.fn().mockResolvedValue(undefined);
    const provider: StorageProvider = {
      ...createStorageStub(),
      delete: del,
      stat: jest.fn()
        .mockResolvedValueOnce({ size: 500 * 1024 * 1024, contentType: 'image/jpeg' })
        .mockResolvedValueOnce({ size: 100, contentType: 'text/html' })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ size: 100, contentType: 'image/jpeg' }),
    };
    const svc = new StorageService(provider);
    const key = `${scope}/a.jpg`;
    await expect(svc.assertOwnedKey(key, scope)).rejects.toThrow(/MB or smaller/);
    await expect(svc.assertOwnedKey(key, scope)).rejects.toThrow(/cannot be uploaded/);
    await expect(svc.assertOwnedKey(key, scope)).rejects.toThrow(/not uploaded/);
    await expect(svc.assertOwnedKey(key, scope)).resolves.toBeUndefined();
    expect(del).toHaveBeenCalledTimes(2);
  });

  it('refuses to sign uploads of executable content types', () => {
    const svc = new StorageService(createStorageStub());
    expect(() => svc.signUpload('k', { contentType: 'text/html' })).toThrow(BadRequestException);
    expect(() => svc.signUpload('k', { contentType: 'image/svg+xml' })).toThrow(BadRequestException);
  });
});

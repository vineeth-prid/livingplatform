import * as argon2 from 'argon2';

import { hashRefreshSecret, verifyRefreshSecret } from './tokens.service';

describe('refresh-token hashing', () => {
  it('verifies the right secret and rejects any other', async () => {
    const stored = hashRefreshSecret('s3cret-256-bits');
    await expect(verifyRefreshSecret(stored, 's3cret-256-bits')).resolves.toBe(true);
    await expect(verifyRefreshSecret(stored, 's3cret-256-bitz')).resolves.toBe(false);
    expect(stored).not.toContain('s3cret');
  });

  it('still accepts sessions hashed with argon2 before the change', async () => {
    const legacy = await argon2.hash('old-session-secret', { type: argon2.argon2id });
    await expect(verifyRefreshSecret(legacy, 'old-session-secret')).resolves.toBe(true);
    await expect(verifyRefreshSecret(legacy, 'wrong')).resolves.toBe(false);
  });
});

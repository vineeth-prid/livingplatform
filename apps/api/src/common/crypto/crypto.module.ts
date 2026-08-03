import { Global, Module } from '@nestjs/common';

import { SecretCipher } from './secret-cipher';

/**
 * Application-wide secret encryption. Global so payment configuration and the
 * WhatsApp session manager share one cipher (and one key) without re-importing.
 */
@Global()
@Module({
  providers: [SecretCipher],
  exports: [SecretCipher],
})
export class CryptoModule {}

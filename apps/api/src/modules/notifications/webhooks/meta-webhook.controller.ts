import { Body, Controller, Get, Headers, HttpCode, Post, Query, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';

import { Public } from '../../../common/decorators/public.decorator';
import { MetaWebhookService } from './meta-webhook.service';

/**
 * Meta WhatsApp webhook. GET verifies the subscription (echoes hub.challenge);
 * POST receives delivery/read/failed statuses and inbound messages after HMAC
 * signature validation. Public (Meta cannot present a JWT); responses are raw so
 * Meta sees exactly what it expects. Uses @Res() to bypass the transform
 * interceptor. The POST body arrives as a raw string (see the text() middleware
 * in main.ts) so the signature can be verified over the exact bytes.
 */
// Meta delivers status callbacks in bursts and is already HMAC-authenticated;
// the global per-IP rate limit would drop legitimate receipts, so skip it here.
@SkipThrottle()
@ApiExcludeController()
@Controller('notifications/webhooks')
export class MetaWebhookController {
  constructor(private readonly webhook: MetaWebhookService) {}

  @Public()
  @Get('whatsapp')
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ): void {
    const echoed = this.webhook.verifyChallenge(mode, token, challenge);
    if (echoed === null) { res.status(403).send('Forbidden'); return; }
    res.status(200).send(echoed);
  }

  @Public()
  @Post('whatsapp')
  @HttpCode(200)
  async receive(
    @Body() raw: unknown,
    @Headers('x-hub-signature-256') signature: string,
    @Res() res: Response,
  ): Promise<void> {
    const rawBody = typeof raw === 'string' ? raw : JSON.stringify(raw ?? {});
    if (!this.webhook.verifySignature(rawBody, signature)) { res.status(403).send('Invalid signature'); return; }
    try {
      const payload = typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw ?? {});
      await this.webhook.process(payload);
    } catch {
      // Never make Meta retry on our parse error; we already validated the signature.
    }
    res.status(200).send('EVENT_RECEIVED');
  }
}

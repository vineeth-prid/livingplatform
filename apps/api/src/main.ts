import 'reflect-metadata';

import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { text } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import type { AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  // Typed as the Express app so `set('trust proxy', …)` below is reachable;
  // the adapter is unchanged (Express is already the default).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService<AppConfig, true>);
  const port = config.get('port', { infer: true });
  const apiPrefix = config.get('apiPrefix', { infer: true });
  const corsOrigins = config.get('corsOrigins', { infer: true });
  const env = config.get('env', { infer: true });

  // Security headers.
  app.use(helmet());

  // Behind a reverse proxy, Express reports the PROXY's address as `req.ip`
  // unless it is told how many hops to skip. ThrottlerGuard keys its buckets on
  // `req.ip`, so without this every user on the platform shares ONE bucket:
  // 120 requests a minute across everybody, and five login attempts a minute
  // across everybody. The sixth person to sign in within a minute gets a 429.
  //
  // The value is the number of proxies in front of this process, counted from
  // the socket outwards — nginx alone is 1; Cloudflare in front of nginx is 2.
  // Too low and users share a bucket; too HIGH and a client can prepend a fake
  // X-Forwarded-For entry and be tracked as whatever address it likes, so this
  // must match the real chain rather than being set generously.
  app.set('trust proxy', config.get('trustProxy', { infer: true }));

  // WhatsApp webhook: capture the RAW body so the Meta HMAC signature can be
  // verified over the exact bytes (runs before the global JSON body parser).
  // Path is derived from the API prefix so a prefix change can't silently
  // disable signature verification (the body must stay raw for this route).
  app.use(`/${apiPrefix}/v1/notifications/webhooks/whatsapp`, text({ type: '*/*', limit: '512kb' }));

  // Same rule for the Razorpay webhooks (one path per community rail) and the
  // OpenWA gateway callbacks — both authenticate by HMAC over the raw bytes.
  app.use(`/${apiPrefix}/v1/payments/webhooks/razorpay`, text({ type: '*/*', limit: '512kb' }));
  app.use(`/${apiPrefix}/v1/notifications/webhooks/openwa`, text({ type: '*/*', limit: '512kb' }));

  // CORS — explicit allow-list from config; credentials on for cookie support.
  // Reflecting any origin WITH credentials is unsafe, so fail closed in
  // production when no allow-list is configured rather than opening up.
  if (env === 'production' && corsOrigins.length === 0) {
    throw new Error('CORS_ORIGINS must be set in production (refusing to reflect any origin with credentials)');
  }
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  });

  // /api/v1/... URI versioning so future breaking changes ship as v2 in parallel.
  app.setGlobalPrefix(apiPrefix);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.enableShutdownHooks();

  // OpenAPI / Swagger at /<prefix>/docs. Disabled in production — publishing the
  // full API schema there is an attack aid; set SWAGGER_ENABLED=true to override.
  const swaggerEnabled = env !== 'production' || process.env.SWAGGER_ENABLED === 'true';
  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Living Platform API')
      .setDescription('Multi-tenant PropTech platform foundation. Life Happens Here.')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(port, '0.0.0.0');

  const logger = app.get(Logger);
  logger.log(`Living API [${env}] listening on http://localhost:${port}/${apiPrefix}`);
  if (swaggerEnabled) logger.log(`Swagger docs at http://localhost:${port}/${apiPrefix}/docs`);
}

/**
 * Node terminates the process on an unhandled rejection, and by default prints
 * little more than the rejection value — which is how a service ends up
 * restarting on a schedule nobody can explain. These handlers do not keep the
 * process alive (state after an unhandled throw is not trustworthy); they exist
 * so the crash names itself in the log before it goes, and so PM2's restart
 * counter can be tied to a cause.
 */
function installCrashHandlers(): void {
  const die = (kind: string) => (err: unknown) => {
    const e = err instanceof Error ? err : new Error(String(err));
    // console, not the Nest logger: this may fire before or after Nest exists.
    console.error(
      JSON.stringify({
        level: 'fatal',
        kind,
        message: e.message,
        stack: e.stack,
        rss_mb: Math.round(process.memoryUsage().rss / 1048576),
        heap_used_mb: Math.round(process.memoryUsage().heapUsed / 1048576),
        uptime_s: Math.round(process.uptime()),
        at: new Date().toISOString(),
      }),
    );
    process.exit(1);
  };
  process.on('unhandledRejection', die('unhandledRejection'));
  process.on('uncaughtException', die('uncaughtException'));
}

installCrashHandlers();

// `void bootstrap()` swallowed startup failures into an unhandled rejection,
// which is the least informative way for a boot problem to present itself.
bootstrap().catch((err: unknown) => {
  const e = err instanceof Error ? err : new Error(String(err));
  console.error(JSON.stringify({ level: 'fatal', kind: 'bootstrap', message: e.message, stack: e.stack }));
  process.exit(1);
});

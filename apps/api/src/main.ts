import 'reflect-metadata';

import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { text } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import type { AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService<AppConfig, true>);
  const port = config.get('port', { infer: true });
  const apiPrefix = config.get('apiPrefix', { infer: true });
  const corsOrigins = config.get('corsOrigins', { infer: true });
  const env = config.get('env', { infer: true });

  // Security headers.
  app.use(helmet());

  // WhatsApp webhook: capture the RAW body so the Meta HMAC signature can be
  // verified over the exact bytes (runs before the global JSON body parser).
  app.use('/api/v1/notifications/webhooks/whatsapp', text({ type: '*/*', limit: '512kb' }));

  // CORS — explicit allow-list from config; credentials on for cookie support.
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  });

  // /api/v1/... URI versioning so future breaking changes ship as v2 in parallel.
  app.setGlobalPrefix(apiPrefix);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.enableShutdownHooks();

  // OpenAPI / Swagger at /<prefix>/docs.
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

  await app.listen(port, '0.0.0.0');

  const logger = app.get(Logger);
  logger.log(`Living API [${env}] listening on http://localhost:${port}/${apiPrefix}`);
  logger.log(`Swagger docs at http://localhost:${port}/${apiPrefix}/docs`);
}

void bootstrap();

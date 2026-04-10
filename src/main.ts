/* eslint-disable @typescript-eslint/no-unsafe-call */
import { NestFactory } from '@nestjs/core';
import passport from 'passport';
import { AppModule } from './app.module';
import { PinoLoggerService } from './logging/pino-logger.service';
import { RequestLoggingExceptionFilter } from './logging/request-logging-exception.filter';
import { RequestLoggingInterceptor } from './logging/request-logging.interceptor';
import { createRequestLoggingMiddleware } from './logging/request-logging.middleware';

const defaultCorsOrigins = [
  'https://pls-blog-manager.web.app',
  'https://pls-blog-manager.firebaseapp.com',
  'https://blogmanager.plssistemas.com.br',
];

const localhostOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function getAllowedCorsOrigins() {
  const configuredOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configuredOrigins?.includes('*')) {
    return '*';
  }

  return Array.from(
    new Set([...(configuredOrigins ?? []), ...defaultCorsOrigins]),
  );
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = app.get(PinoLoggerService);
  const allowedCorsOrigins = getAllowedCorsOrigins();

  app.useLogger(logger);
  app.enableCors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedCorsOrigins === '*' ||
        allowedCorsOrigins.includes(origin) ||
        localhostOriginPattern.test(origin)
      ) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    optionsSuccessStatus: 204,
  });
  app.use(createRequestLoggingMiddleware(logger));
  app.useGlobalInterceptors(app.get(RequestLoggingInterceptor));
  app.useGlobalFilters(app.get(RequestLoggingExceptionFilter));
  app.use(passport.initialize());
  const port = process.env.PORT ?? 3000;

  await app.listen(port, '0.0.0.0');

  logger.getLogger().info({ port }, 'Application started');
}
void bootstrap();

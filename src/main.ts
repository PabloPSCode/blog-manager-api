/* eslint-disable @typescript-eslint/no-unsafe-call */
import { NestFactory } from '@nestjs/core';
import passport from 'passport';
import { AppModule } from './app.module';

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
  const app = await NestFactory.create(AppModule);
  const allowedCorsOrigins = getAllowedCorsOrigins();

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
  app.use(passport.initialize());
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
void bootstrap();

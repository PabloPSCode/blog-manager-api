import { NestFactory } from '@nestjs/core';
import passport from 'passport';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: '*',
  });
  app.use(passport.initialize());
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();

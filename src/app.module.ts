import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import type { SignOptions } from 'jsonwebtoken';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { JwtAuthMiddleware } from './auth/jwt-auth.middleware';
import { JwtStrategy } from './auth/jwt.strategy';
import { FirebaseService } from './firebase/firebase.service';
import { SitesController } from './sites/sites.controller';
import { SitesService } from './sites/sites.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        const expiresIn = configService.get<string>('JWT_EXPIRES_IN') ?? '7d';

        if (!secret) {
          throw new Error(
            'Missing JWT_SECRET. Fill the value in .env and restart the API.',
          );
        }

        return {
          secret,
          signOptions: {
            expiresIn: expiresIn as SignOptions['expiresIn'],
          },
        };
      },
    }),
  ],
  controllers: [AppController, AuthController, SitesController],
  providers: [
    AppService,
    AuthService,
    FirebaseService,
    JwtStrategy,
    SitesService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(JwtAuthMiddleware)
      .forRoutes({ path: 'auth/me', method: RequestMethod.GET });
  }
}

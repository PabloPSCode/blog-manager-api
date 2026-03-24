import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import type { SignOptions } from 'jsonwebtoken';
import { SitesModule } from '../sites/sites.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthMiddleware } from './jwt-auth.middleware';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    SitesModule,
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
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(JwtAuthMiddleware)
      .forRoutes({ path: 'auth/me', method: RequestMethod.GET });
  }
}

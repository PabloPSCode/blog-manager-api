/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import passport from 'passport';

@Injectable()
export class JwtAuthMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction) {
    passport.authenticate(
      'jwt',
      { session: false },
      (error: unknown, user: unknown) => {
        if (error) {
          next(error);
          return;
        }

        if (!user) {
          next(
            new UnauthorizedException(
              'Sua sessão expirou. Faça login novamente.',
            ),
          );
          return;
        }

        request.user = user as Express.User;
        next();
      },
    )(request, response, next);
  }
}

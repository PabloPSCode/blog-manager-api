import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import type {
  IAuthenticatedSiteDTO,
  ISiteLoginDTO,
} from '../domain/dtos/auth.dto';
import type { ISite } from '../domain/dtos/site.dto';
import { AuthService } from './auth.service';

type AuthenticatedRequest = Request & {
  user: ISite;
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() credentials: ISiteLoginDTO): Promise<IAuthenticatedSiteDTO> {
    return this.authService.login(credentials);
  }

  @Get('me')
  getMe(@Req() request: AuthenticatedRequest): ISite {
    return request.user;
  }
}

import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import type {
  IAuthenticatedSiteDTO,
  ICreateSitePasswordRecoveryTokenResponseDTO,
  ICreateSitePasswordRecoveryTokenDTO,
  IRecoverSitePasswordDTO,
  IRecoverSitePasswordResponseDTO,
  ISiteLoginDTO,
  IValidateSitePasswordRecoveryTokenDTO,
  IValidateSitePasswordRecoveryTokenResponseDTO,
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

  @Post('recovery-password-token')
  createRecoveryPasswordToken(
    @Body() payload: ICreateSitePasswordRecoveryTokenDTO,
  ): Promise<ICreateSitePasswordRecoveryTokenResponseDTO> {
    return this.authService.createRecoveryPasswordToken(payload);
  }

  @Post('recovery-password')
  recoveryPassword(
    @Body() payload: IRecoverSitePasswordDTO,
  ): Promise<IRecoverSitePasswordResponseDTO> {
    return this.authService.recoveryPassword(payload);
  }

  @Post('validate-recovery-password-token')
  validateRecoveryPasswordToken(
    @Body() payload: IValidateSitePasswordRecoveryTokenDTO,
  ): Promise<IValidateSitePasswordRecoveryTokenResponseDTO> {
    return this.authService.validateRecoveryPasswordToken(payload);
  }

  @Get('me')
  getMe(@Req() request: AuthenticatedRequest): ISite {
    return request.user;
  }
}

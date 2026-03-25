import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { IAuthenticatedSiteDTO, ISiteLoginDTO } from '../domain/dtos/auth.dto';
import { ISite } from '../domain/dtos/site.dto';
import { SitesService } from '../sites/sites.service';

type JwtPayload = {
  sub: string;
  domain: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly sitesService: SitesService,
  ) {}

  async login(credentials: ISiteLoginDTO): Promise<IAuthenticatedSiteDTO> {
    const domain = this.requireValue(credentials.domain, 'domain');
    const password = this.requireValue(credentials.password, 'password');
    const site = this.requireAuthenticatedSite(
      await this.sitesService.findActiveByDomain(domain),
      'Invalid domain or password.',
    );

    if (site.password !== password) {
      throw new UnauthorizedException('Invalid domain or password.');
    }

    const jwt = await this.jwtService.signAsync({
      sub: site.id,
      domain: site.domain,
    } satisfies JwtPayload);

    return {
      ...site,
      jwt,
    };
  }

  async validateJwtPayload(payload: JwtPayload): Promise<ISite> {
    const siteId = this.requireValue(payload.sub, 'sub');
    const site = this.requireAuthenticatedSite(
      await this.sitesService.findActiveById(siteId),
      'Invalid JWT.',
    );

    return site;
  }

  private requireAuthenticatedSite(
    site: ISite | null,
    errorMessage: string,
  ): ISite & { id: string } {
    if (!site || !site.id) {
      throw new UnauthorizedException(errorMessage);
    }

    return site as ISite & { id: string };
  }

  private requireValue(value: string | undefined, fieldName: string): string {
    const normalizedValue = value?.trim();

    if (!normalizedValue) {
      throw new UnauthorizedException(`${fieldName} is required.`);
    }

    return normalizedValue;
  }
}

import type { ISite } from './site.dto';

export interface ISiteLoginDTO {
  domain: string;
  password: string;
}

export interface IAuthenticatedSiteDTO extends ISite {
  id: string;
  jwt: string;
}

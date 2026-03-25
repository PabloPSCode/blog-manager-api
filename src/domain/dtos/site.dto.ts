import { IPost } from './post.dto';

export const SITE_PASSWORD_PREFIX = 'plssistemas';

export interface ISite {
  id?: string;
  url: string;
  domain: string;
  clientWhatsapp: string;
  posts?: IPost[];
  password: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ICreateSiteDTO {
  url: string;
  domain: string;
  clientWhatsapp: string;
  password?: string;
}

export interface IUpdateSiteDTO {
  id: string;
  url?: string;
  domain?: string;
  clientWhatsapp?: string;
  password?: string;
}

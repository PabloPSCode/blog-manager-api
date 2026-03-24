import { IPost } from './post.dto';

export const DEFAULT_SITE_PASSWORD = 'PLSSistemas7963';

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

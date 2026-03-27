import type { Request } from 'express';
import type { ISite } from '../domain/dtos/site.dto';

export type AuthenticatedRequest = Request & {
  user: ISite & { id: string };
};

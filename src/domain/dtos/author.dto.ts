export interface IAuthor {
  id?: string;
  name: string;
  bio: string;
  siteId: string;
  avatarUrl: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ICreateAuthorDTO {
  name: string;
  bio: string;
  siteId: string;
  avatarUrl: string;
}

export interface ICreateAuthorRequestDTO {
  name: string;
  bio: string;
}

export interface IUpdateAuthorDTO {
  id: string;
  name?: string;
  bio?: string;
  siteId?: string;
  avatarUrl?: string;
}

export interface IUpdateAuthorRequestDTO {
  name?: string;
  bio?: string;
}

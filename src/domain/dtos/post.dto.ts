export interface IPost {
  id?: string;
  siteId: string;
  title: string;
  htmlContent: string;
  backgroundUrl: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ICreatePostDTO {
  siteId: string;
  title: string;
  htmlContent: string;
  backgroundUrl: string;
  authorId: string;
}

export interface ICreatePostRequestDTO {
  title: string;
  htmlContent: string;
  authorId: string;
}

export interface IUpdatePostDTO {
  id: string;
  siteId?: string;
  title?: string;
  htmlContent?: string;
  backgroundUrl?: string;
  authorId?: string;
}

export interface IUpdatePostRequestDTO {
  title?: string;
  htmlContent?: string;
  authorId?: string;
}

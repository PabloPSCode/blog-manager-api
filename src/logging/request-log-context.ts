import type { Request } from 'express';

export type LoggedRequest = Request & {
  file?: UploadedRequestFile;
  files?:
    | UploadedRequestFile[]
    | Record<string, UploadedRequestFile[]>
    | undefined;
  route?: {
    path?: string;
  };
  user?: {
    id?: string;
  };
  requestId?: string;
  requestStartedAt?: number;
};

type UploadedRequestFile = {
  buffer?: Buffer;
  encoding?: string;
  fieldname?: string;
  mimetype?: string;
  originalname?: string;
  size?: number;
};

export function attachRequestContext(
  request: LoggedRequest,
  context: {
    requestId: string;
    requestStartedAt: number;
  },
): void {
  request.requestId = context.requestId;
  request.requestStartedAt = context.requestStartedAt;
}

export function getRequestContext(request: LoggedRequest): {
  requestId: string;
  requestStartedAt: number;
} {
  return {
    requestId: request.requestId ?? 'unknown',
    requestStartedAt: request.requestStartedAt ?? Date.now(),
  };
}

import type { Response } from 'express';
import { HttpException, HttpStatus } from '@nestjs/common';
import { getRequestContext, type LoggedRequest } from './request-log-context';

const MAX_STRING_LENGTH = 500;
const REDACTED_VALUE = '[Redacted]';
const SENSITIVE_KEYS = new Set([
  'authorization',
  'password',
  'token',
  'secret',
  'apikey',
  'jwt',
  'code',
  'accesstoken',
  'refreshtoken',
]);

export function buildRequestReceivedLog(request: LoggedRequest) {
  return {
    requestId: getRequestContext(request).requestId,
    request: buildRequestDetails(request, { includePayload: true }),
  };
}

export function buildRequestCompletedLog(
  request: LoggedRequest,
  response: Response,
  durationMs: number,
) {
  return {
    requestId: getRequestContext(request).requestId,
    durationMs,
    request: buildRequestDetails(request),
    response: buildResponseDetails(response),
  };
}

export function buildRequestFailedLog(
  request: LoggedRequest,
  response: Response,
  exception: unknown,
  durationMs: number,
) {
  return {
    requestId: getRequestContext(request).requestId,
    durationMs,
    request: buildRequestDetails(request, { includePayload: true }),
    response: buildResponseDetails(response, getStatusCode(exception)),
    error: buildErrorDetails(exception),
    err: shouldIncludeErrorStack(exception) ? exception : undefined,
  };
}

export function getRequestDurationMs(request: LoggedRequest): number {
  return Date.now() - getRequestContext(request).requestStartedAt;
}

function buildRequestDetails(
  request: LoggedRequest,
  options?: {
    includePayload?: boolean;
  },
) {
  return {
    method: request.method,
    path: request.originalUrl || request.url,
    route: getRoutePath(request),
    ip: request.ip,
    siteId: request.user?.id,
    headers: buildHeaderDetails(request),
    params: isEmptyObject(request.params)
      ? undefined
      : sanitizeValue(request.params),
    query: isEmptyObject(request.query)
      ? undefined
      : sanitizeValue(request.query),
    body:
      options?.includePayload && !isEmptyObject(request.body)
        ? sanitizeValue(request.body)
        : undefined,
    files:
      options?.includePayload && hasUploadedFiles(request)
        ? buildFileDetails(request)
        : undefined,
  };
}

function buildResponseDetails(response: Response, statusCode?: number) {
  return {
    statusCode: statusCode ?? response.statusCode,
    contentLength: response.getHeader('content-length') ?? undefined,
  };
}

function buildErrorDetails(exception: unknown) {
  if (exception instanceof HttpException) {
    return {
      name: exception.name,
      message: exception.message,
      statusCode: exception.getStatus(),
      response: sanitizeValue(exception.getResponse()),
    };
  }

  if (exception instanceof Error) {
    return {
      name: exception.name,
      message: exception.message,
    };
  }

  return {
    name: 'UnknownError',
    message: 'An unknown error was thrown.',
    response: sanitizeValue(exception),
  };
}

function buildHeaderDetails(request: LoggedRequest) {
  return sanitizeValue({
    host: request.headers.host,
    referer: request.headers.referer,
    'user-agent': request.headers['user-agent'],
    'content-type': request.headers['content-type'],
    'content-length': request.headers['content-length'],
    'x-forwarded-for': request.headers['x-forwarded-for'],
    'x-request-id': request.headers['x-request-id'],
  });
}

function buildFileDetails(request: LoggedRequest) {
  if (request.file) {
    return [serializeFile(request.file)];
  }

  if (Array.isArray(request.files)) {
    return request.files.map((file) => serializeFile(file));
  }

  if (request.files && typeof request.files === 'object') {
    return Object.fromEntries(
      Object.entries(request.files).map(([fieldName, files]) => [
        fieldName,
        files.map((file) => serializeFile(file)),
      ]),
    );
  }

  return undefined;
}

function serializeFile(file: LoggedRequest['file']) {
  return {
    fieldName: file?.fieldname,
    originalName: file?.originalname,
    mimeType: file?.mimetype,
    encoding: file?.encoding,
    size: file?.size ?? file?.buffer?.length,
  };
}

function sanitizeValue(
  value: unknown,
  currentKey?: string,
  seenObjects: WeakSet<object> = new WeakSet(),
): unknown {
  if (currentKey && isSensitiveKey(currentKey)) {
    return REDACTED_VALUE;
  }

  if (typeof value === 'string') {
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}...[truncated ${value.length - MAX_STRING_LENGTH} chars]`
      : value;
  }

  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null ||
    value === undefined
  ) {
    return value;
  }

  if (Buffer.isBuffer(value)) {
    return `[Buffer ${value.length} bytes]`;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry, undefined, seenObjects));
  }

  if (typeof value === 'object') {
    if (seenObjects.has(value)) {
      return '[Circular]';
    }

    seenObjects.add(value);

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        sanitizeValue(entry, key, seenObjects),
      ]),
    );
  }

  return String(value);
}

function hasUploadedFiles(request: LoggedRequest): boolean {
  return (
    !!request.file ||
    (Array.isArray(request.files) && request.files.length > 0) ||
    (!!request.files &&
      typeof request.files === 'object' &&
      Object.keys(request.files).length > 0)
  );
}

function getRoutePath(request: LoggedRequest): string | undefined {
  const routePath = request.route?.path;

  if (!routePath) {
    return undefined;
  }

  return `${request.baseUrl ?? ''}${routePath}`;
}

function getStatusCode(exception: unknown): number {
  if (exception instanceof HttpException) {
    return exception.getStatus();
  }

  return HttpStatus.INTERNAL_SERVER_ERROR;
}

function isEmptyObject(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return true;
  }

  return Object.keys(value).length === 0;
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(key.replace(/[-_]/g, '').toLowerCase());
}

function shouldIncludeErrorStack(exception: unknown): exception is Error {
  if (!(exception instanceof Error)) {
    return false;
  }

  if (!(exception instanceof HttpException)) {
    return true;
  }

  return exception.getStatus() >= HttpStatus.INTERNAL_SERVER_ERROR;
}

import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { buildRequestReceivedLog } from './request-log.helpers';
import {
  attachRequestContext,
  type LoggedRequest,
} from './request-log-context';
import { PinoLoggerService } from './pino-logger.service';

export function createRequestLoggingMiddleware(
  loggerService: PinoLoggerService,
): RequestHandler {
  return (request, response, next) => {
    const loggedRequest = request as LoggedRequest;
    const requestId = resolveRequestId(loggedRequest);

    attachRequestContext(loggedRequest, {
      requestId,
      requestStartedAt: Date.now(),
    });

    response.setHeader('x-request-id', requestId);

    loggerService
      .getLogger()
      .info(buildRequestReceivedLog(loggedRequest), 'Request received');

    next();
  };
}

function resolveRequestId(request: LoggedRequest): string {
  const requestIdHeader = request.headers['x-request-id'];

  if (Array.isArray(requestIdHeader)) {
    return requestIdHeader[0] || randomUUID();
  }

  return requestIdHeader || randomUUID();
}

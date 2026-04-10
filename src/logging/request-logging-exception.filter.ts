import {
  ArgumentsHost,
  Catch,
  Injectable,
} from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import type { Response } from 'express';
import {
  buildRequestFailedLog,
  getRequestDurationMs,
} from './request-log.helpers';
import type { LoggedRequest } from './request-log-context';
import { PinoLoggerService } from './pino-logger.service';

@Catch()
@Injectable()
export class RequestLoggingExceptionFilter extends BaseExceptionFilter {
  constructor(
    httpAdapterHost: HttpAdapterHost,
    private readonly loggerService: PinoLoggerService,
  ) {
    super(httpAdapterHost.httpAdapter);
  }

  override catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() === 'http') {
      const httpContext = host.switchToHttp();
      const request = httpContext.getRequest<LoggedRequest>();
      const response = httpContext.getResponse<Response>();

      this.loggerService
        .getLogger()
        .error(
          buildRequestFailedLog(
            request,
            response,
            exception,
            getRequestDurationMs(request),
          ),
          'Request failed',
        );
    }

    super.catch(exception, host);
  }
}

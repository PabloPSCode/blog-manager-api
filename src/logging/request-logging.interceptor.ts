import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs';
import {
  buildRequestCompletedLog,
  getRequestDurationMs,
} from './request-log.helpers';
import type { LoggedRequest } from './request-log-context';
import { PinoLoggerService } from './pino-logger.service';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(private readonly loggerService: PinoLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<LoggedRequest>();
    const response = httpContext.getResponse<Response>();

    return next.handle().pipe(
      tap(() => {
        this.loggerService
          .getLogger()
          .info(
            buildRequestCompletedLog(
              request,
              response,
              getRequestDurationMs(request),
            ),
            'Request completed',
          );
      }),
    );
  }
}

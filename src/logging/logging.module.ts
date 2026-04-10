import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PinoLoggerService } from './pino-logger.service';
import { RequestLoggingExceptionFilter } from './request-logging-exception.filter';
import { RequestLoggingInterceptor } from './request-logging.interceptor';

@Module({
  imports: [ConfigModule],
  providers: [
    PinoLoggerService,
    RequestLoggingInterceptor,
    RequestLoggingExceptionFilter,
  ],
  exports: [
    PinoLoggerService,
    RequestLoggingInterceptor,
    RequestLoggingExceptionFilter,
  ],
})
export class LoggingModule {}

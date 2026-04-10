import { Injectable, LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pino, { type Logger, type LoggerOptions } from 'pino';

@Injectable()
export class PinoLoggerService implements LoggerService {
  private readonly logger: Logger;

  constructor(private readonly configService: ConfigService) {
    this.logger = pino(this.buildLoggerOptions());
  }

  getLogger(): Logger {
    return this.logger;
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('info', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, optionalParams);
  }

  debug?(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  verbose?(message: unknown, ...optionalParams: unknown[]): void {
    this.write('trace', message, optionalParams);
  }

  fatal?(message: unknown, ...optionalParams: unknown[]): void {
    this.write('fatal', message, optionalParams);
  }

  private write(
    level: 'info' | 'error' | 'warn' | 'debug' | 'trace' | 'fatal',
    message: unknown,
    optionalParams: unknown[],
  ): void {
    const context =
      typeof optionalParams[optionalParams.length - 1] === 'string'
        ? (optionalParams[optionalParams.length - 1] as string)
        : undefined;
    const details = context ? optionalParams.slice(0, -1) : optionalParams;
    const bindings = details.length > 0 ? { details } : undefined;

    if (message instanceof Error) {
      this.logger[level](
        {
          context,
          ...bindings,
          err: message,
        },
        message.message,
      );
      return;
    }

    if (typeof message === 'object' && message !== null) {
      this.logger[level](
        {
          context,
          ...bindings,
          message,
        },
        'Structured log',
      );
      return;
    }

    this.logger[level](
      {
        context,
        ...bindings,
      },
      String(message),
    );
  }

  private buildLoggerOptions(): LoggerOptions {
    const nodeEnv = this.configService.get<string>('NODE_ENV')?.trim();
    const level =
      this.configService.get<string>('LOG_LEVEL')?.trim() ??
      (nodeEnv === 'production' ? 'info' : 'debug');

    return {
      level,
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label) => ({ level: label }),
      },
      redact: {
        paths: [
          'request.headers.authorization',
          'request.body.password',
          'request.body.code',
          'request.body.token',
          'request.body.jwt',
          'request.body.accessToken',
          'request.body.refreshToken',
          'error.response.password',
          'error.response.code',
          'error.response.token',
        ],
        censor: '[Redacted]',
      },
    };
  }
}

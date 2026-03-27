import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { formatDateTime } from 'src/utils/format';

type SendPasswordRecoveryCodePayload = {
  domain: string;
  clientWhatsapp: string;
  code: string;
  expiresAt: string;
};

type EvolutionSendTextResponse = {
  key?: {
    id?: string;
    remoteJid?: string;
  };
  status?: string;
};

type EvolutionSendTextError = {
  message?: string | string[];
  error?: string;
  response?: {
    message?: string | string[];
  };
};

@Injectable()
export class WhatsappService {
  constructor(private readonly configService: ConfigService) {}

  async sendPasswordRecoveryCode(
    payload: SendPasswordRecoveryCodePayload,
  ): Promise<void> {
    await this.sendTextMessage({
      number: this.normalizePhoneNumber(payload.clientWhatsapp),
      text: this.buildPasswordRecoveryMessage(payload),
    });
  }

  private async sendTextMessage(payload: {
    number: string;
    text: string;
  }): Promise<void> {
    const baseUrl = this.requireEnvValue('EVOLUTION_API_BASE_URL').replace(
      /\/+$/,
      '',
    );
    const apiKey = this.requireEnvValue('EVOLUTION_API_KEY');
    const instance = encodeURIComponent(
      this.requireEnvValue('EVOLUTION_API_INSTANCE'),
    );
    const response = await fetch(`${baseUrl}/message/sendText/${instance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: apiKey,
      },
      body: JSON.stringify({
        number: payload.number,
        text: payload.text,
      }),
    }).catch(() => {
      throw new BadGatewayException(
        'Failed to connect to the WhatsApp provider.',
      );
    });

    if (!response.ok) {
      const errorResponse = (await response.json().catch(() => undefined)) as
        | EvolutionSendTextError
        | undefined;

      throw new BadGatewayException(
        this.extractProviderErrorMessage(errorResponse) ??
          `WhatsApp provider returned HTTP ${response.status}.`,
      );
    }

    await response
      .json()
      .catch(() => undefined as EvolutionSendTextResponse | undefined);
  }

  private buildPasswordRecoveryMessage(
    payload: SendPasswordRecoveryCodePayload,
  ): string {
    return [
      `Seu código de recuperação de senha do Gerenciador de Blogs é ${payload.code}.`,
      `O código expira em 15 minutos.`,
      'Se você não solicitou essa alteração, ignore esta mensagem.',
    ].join(' ');
  }

  private normalizePhoneNumber(phoneNumber: string): string {
    const normalizedPhoneNumber = phoneNumber.replace(/\D/g, '');

    if (normalizedPhoneNumber.length < 10) {
      throw new InternalServerErrorException(
        'clientWhatsapp must contain a valid WhatsApp number with country code.',
      );
    }

    return normalizedPhoneNumber;
  }

  private requireEnvValue(key: string): string {
    const value = this.configService.get<string>(key)?.trim();

    if (!value) {
      throw new InternalServerErrorException(
        `Missing ${key}. Fill the value in .env and restart the API.`,
      );
    }

    return value;
  }

  private extractProviderErrorMessage(
    errorResponse: EvolutionSendTextError | undefined,
  ): string | undefined {
    if (!errorResponse) {
      return undefined;
    }

    if (typeof errorResponse.error === 'string' && errorResponse.error.trim()) {
      return errorResponse.error;
    }

    if (
      typeof errorResponse.message === 'string' &&
      errorResponse.message.trim()
    ) {
      return errorResponse.message;
    }

    if (
      Array.isArray(errorResponse.message) &&
      errorResponse.message.length > 0
    ) {
      return errorResponse.message.join(', ');
    }

    if (
      typeof errorResponse.response?.message === 'string' &&
      errorResponse.response.message.trim()
    ) {
      return errorResponse.response.message;
    }

    if (
      Array.isArray(errorResponse.response?.message) &&
      errorResponse.response.message.length > 0
    ) {
      return errorResponse.response.message.join(', ');
    }

    return undefined;
  }
}

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  DocumentData,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore';
import { randomInt } from 'node:crypto';
import type {
  ICreateSitePasswordRecoveryTokenDTO,
  ICreateSitePasswordRecoveryTokenResponseDTO,
  IRecoverSitePasswordDTO,
  IRecoverSitePasswordResponseDTO,
  ISitePasswordRecoveryTokenDTO,
  IValidateSitePasswordRecoveryTokenDTO,
  IValidateSitePasswordRecoveryTokenResponseDTO,
} from '../domain/dtos/auth.dto';
import type { ISite } from '../domain/dtos/site.dto';
import { FirebaseService } from '../firebase/firebase.service';
import { SitesService } from '../sites/sites.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

type RecoveryTokenDocument = Omit<ISitePasswordRecoveryTokenDTO, 'id'>;

const PASSWORD_RECOVERY_TOKENS_COLLECTION = 'sitePasswordRecoveryTokens';
const PASSWORD_RECOVERY_TOKEN_LENGTH = 6;
const PASSWORD_RECOVERY_TOKEN_TTL_IN_MINUTES = 15;

@Injectable()
export class PasswordRecoveryService {
  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly sitesService: SitesService,
    private readonly whatsappService: WhatsappService,
  ) {}

  async createToken(
    payload: ICreateSitePasswordRecoveryTokenDTO,
  ): Promise<ICreateSitePasswordRecoveryTokenResponseDTO> {
    const site = await this.requireActiveSite(payload.domain);
    const timestamp = new Date().toISOString();
    const expiresAt = new Date(
      Date.now() + PASSWORD_RECOVERY_TOKEN_TTL_IN_MINUTES * 60 * 1000,
    ).toISOString();

    await this.revokeActiveTokens(site.id, timestamp);

    const code = this.generateNumericCode();
    const tokenRef = this.firebaseService
      .getFirestore()
      .collection(PASSWORD_RECOVERY_TOKENS_COLLECTION)
      .doc();
    const token: RecoveryTokenDocument = {
      siteId: site.id,
      domain: site.domain,
      code,
      createdAt: timestamp,
      expiresAt,
      usedAt: null,
    };

    try {
      await tokenRef.set(token);
    } catch {
      throw new InternalServerErrorException(
        'Não foi possível gerar o código de recuperação.',
      );
    }

    try {
      await this.whatsappService.sendPasswordRecoveryCode({
        domain: site.domain,
        clientWhatsapp: site.clientWhatsapp,
        code,
        expiresAt,
      });
    } catch (error) {
      await tokenRef.delete().catch(() => undefined);
      throw error;
    }

    return {
      message:
        'Código de recuperação enviado com sucesso para o WhatsApp do site.',
      domain: site.domain,
      expiresAt,
    };
  }

  async recoverPassword(
    payload: IRecoverSitePasswordDTO,
  ): Promise<IRecoverSitePasswordResponseDTO> {
    const site = await this.requireActiveSite(payload.domain);
    const normalizedCode = this.requireCode(payload.code);
    const nextPassword = this.requireValue(payload.password, 'password');
    const token = await this.requireActiveToken(site.id, normalizedCode);
    const timestamp = new Date().toISOString();
    const firestore = this.firebaseService.getFirestore();
    const batch = firestore.batch();

    batch.update(firestore.collection('sites').doc(site.id), {
      password: nextPassword,
      updatedAt: timestamp,
    });
    batch.update(
      firestore.collection(PASSWORD_RECOVERY_TOKENS_COLLECTION).doc(token.id),
      {
        usedAt: timestamp,
      },
    );

    try {
      await batch.commit();
    } catch {
      throw new InternalServerErrorException(
        'Não foi possível atualizar a senha.',
      );
    }

    return {
      message: 'Senha atualizada com sucesso.',
    };
  }

  async validateToken(
    payload: IValidateSitePasswordRecoveryTokenDTO,
  ): Promise<IValidateSitePasswordRecoveryTokenResponseDTO> {
    const site = await this.requireActiveSite(payload?.domain);
    const normalizedCode = this.requireCode(payload?.code);

    await this.requireActiveToken(site.id, normalizedCode);

    return {
      message: 'Código de recuperação válido.',
      domain: site.domain,
    };
  }

  private async requireActiveSite(
    domain: string,
  ): Promise<ISite & { id: string }> {
    const normalizedDomain = this.requireValue(domain, 'domain');
    const site = await this.sitesService.findActiveByDomain(normalizedDomain);

    if (!site || !site.id) {
      throw new BadRequestException(
        `Nenhum site ativo foi encontrado para o domínio ${normalizedDomain}.`,
      );
    }

    return site as ISite & { id: string };
  }

  private async requireActiveToken(
    siteId: string,
    code: string,
  ): Promise<ISitePasswordRecoveryTokenDTO & { id: string }> {
    const snapshot = await this.firebaseService
      .getFirestore()
      .collection(PASSWORD_RECOVERY_TOKENS_COLLECTION)
      .where('siteId', '==', siteId)
      .get();

    const token = snapshot.docs
      .map((tokenSnapshot) => this.mapRecoveryTokenSnapshot(tokenSnapshot))
      .filter(
        (
          mappedToken,
        ): mappedToken is ISitePasswordRecoveryTokenDTO & { id: string } =>
          mappedToken !== null,
      )
      .find(
        (activeToken) =>
          activeToken.code === code &&
          activeToken.usedAt === null &&
          new Date(activeToken.expiresAt).getTime() > Date.now(),
      );

    if (!token) {
      throw new UnauthorizedException(
        'Código de recuperação inválido ou expirado.',
      );
    }

    return token;
  }

  private async revokeActiveTokens(
    siteId: string,
    usedAt: string,
  ): Promise<void> {
    const snapshot = await this.firebaseService
      .getFirestore()
      .collection(PASSWORD_RECOVERY_TOKENS_COLLECTION)
      .where('siteId', '==', siteId)
      .get();
    const activeTokens = snapshot.docs
      .map((tokenSnapshot) => this.mapRecoveryTokenSnapshot(tokenSnapshot))
      .filter(
        (
          mappedToken,
        ): mappedToken is ISitePasswordRecoveryTokenDTO & { id: string } =>
          mappedToken !== null,
      )
      .filter(
        (token) =>
          token.usedAt === null &&
          new Date(token.expiresAt).getTime() > Date.now(),
      );

    if (activeTokens.length === 0) {
      return;
    }

    const firestore = this.firebaseService.getFirestore();
    const batch = firestore.batch();

    activeTokens.forEach((token) => {
      batch.update(
        firestore.collection(PASSWORD_RECOVERY_TOKENS_COLLECTION).doc(token.id),
        {
          usedAt,
        },
      );
    });

    await batch.commit();
  }

  private mapRecoveryTokenSnapshot(
    snapshot: QueryDocumentSnapshot<DocumentData>,
  ): (ISitePasswordRecoveryTokenDTO & { id: string }) | null {
    if (!snapshot.exists) {
      return null;
    }

    const data = snapshot.data() as RecoveryTokenDocument;

    return {
      id: snapshot.id,
      ...data,
    };
  }

  private generateNumericCode(): string {
    return randomInt(0, 10 ** PASSWORD_RECOVERY_TOKEN_LENGTH)
      .toString()
      .padStart(PASSWORD_RECOVERY_TOKEN_LENGTH, '0');
  }

  private requireCode(code: string | undefined): string {
    const normalizedCode = this.requireValue(code, 'code');

    if (!/^\d{6}$/.test(normalizedCode)) {
      throw new BadRequestException(
        'O código deve conter exatamente 6 dígitos.',
      );
    }

    return normalizedCode;
  }

  private requireValue(value: string | undefined, fieldName: string): string {
    const normalizedValue = value?.trim();

    if (!normalizedValue) {
      const translatedFieldName =
        fieldName === 'domain'
          ? 'O domínio'
          : fieldName === 'password'
            ? 'A senha'
            : fieldName === 'code'
              ? 'O código'
              : 'Este campo';

      throw new BadRequestException(`${translatedFieldName} é obrigatório.`);
    }

    return normalizedValue;
  }
}

import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type {
  DocumentData,
  DocumentSnapshot,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore';
import {
  ICreateSiteDTO,
  ISite,
  SITE_PASSWORD_PREFIX,
} from '../domain/dtos/site.dto';
import { FirebaseService } from '../firebase/firebase.service';

type SiteDocument = Omit<ISite, 'id' | 'posts'>;
export type CreateSiteResult = {
  site: ISite;
  created: boolean;
};

const SITES_COLLECTION = 'sites';

@Injectable()
export class SitesService {
  constructor(private readonly firebaseService: FirebaseService) {}

  async findActiveByDomain(domain: string): Promise<ISite | null> {
    const normalizedDomain = this.requireDomain(domain);
    const snapshot = await this.firebaseService
      .getFirestore()
      .collection(SITES_COLLECTION)
      .where('domain', '==', normalizedDomain)
      .limit(1)
      .get();

    const site = snapshot.docs
      .map((siteSnapshot) => this.mapSiteSnapshot(siteSnapshot))
      .filter((site): site is ISite => site !== null)
      .find((activeSite) => activeSite.deletedAt === null);

    return site ?? null;
  }

  async findActiveById(siteId: string): Promise<ISite | null> {
    const normalizedSiteId = this.requireValue(siteId, 'id');
    const snapshot = await this.firebaseService
      .getFirestore()
      .collection(SITES_COLLECTION)
      .doc(normalizedSiteId)
      .get();
    const site = this.mapSiteSnapshot(snapshot);

    if (!site || site.deletedAt !== null) {
      return null;
    }

    return site;
  }

  async getById(siteId: string): Promise<ISite> {
    const normalizedSiteId = this.requireValue(siteId, 'id');
    const site = await this.findActiveById(normalizedSiteId);

    if (!site) {
      throw new NotFoundException('Site não encontrado.');
    }

    return site;
  }

  async list(): Promise<ISite[]> {
    const snapshot = await this.firebaseService
      .getFirestore()
      .collection(SITES_COLLECTION)
      .get();

    return snapshot.docs
      .map((siteSnapshot) => this.mapSiteSnapshot(siteSnapshot))
      .filter((site): site is ISite => site !== null)
      .filter((site) => site.deletedAt === null)
      .sort((leftSite, rightSite) =>
        rightSite.createdAt.localeCompare(leftSite.createdAt),
      );
  }

  async create(createSiteDto: ICreateSiteDTO): Promise<CreateSiteResult> {
    const siteRef = this.firebaseService
      .getFirestore()
      .collection(SITES_COLLECTION)
      .doc();
    const alreadyExistingSite = await this.findActiveByDomain(
      createSiteDto.domain,
    );

    if (alreadyExistingSite) {
      return {
        site: alreadyExistingSite,
        created: false,
      };
    }

    const site = this.buildSiteDocument(createSiteDto);

    try {
      await siteRef.set(site);
    } catch {
      throw new InternalServerErrorException(
        'Não foi possível cadastrar o site.',
      );
    }

    return {
      site: {
        id: siteRef.id,
        ...site,
      },
      created: true,
    };
  }

  private mapSiteSnapshot(
    snapshot:
      | DocumentSnapshot<DocumentData>
      | QueryDocumentSnapshot<DocumentData>,
  ): ISite | null {
    if (!snapshot.exists) {
      return null;
    }

    const data = snapshot.data() as SiteDocument;

    return {
      id: snapshot.id,
      ...data,
    };
  }

  private buildSiteDocument(createSiteDto: ICreateSiteDTO): SiteDocument {
    const timestamp = new Date().toISOString();
    const clientWhatsapp = this.requireValue(
      createSiteDto.clientWhatsapp,
      'clientWhatsapp',
    );

    return {
      url: this.requireValue(createSiteDto.url, 'url'),
      domain: this.requireDomain(createSiteDto.domain),
      clientWhatsapp,
      password:
        this.normalizeOptionalValue(createSiteDto.password) ??
        this.buildGeneratedPassword(clientWhatsapp),
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    };
  }

  private requireValue(value: string | undefined, fieldName: string): string {
    const normalizedValue = this.normalizeOptionalValue(value);

    if (!normalizedValue) {
      const translatedFieldName =
        fieldName === 'id'
          ? 'O identificador'
          : fieldName === 'clientWhatsapp'
            ? 'O WhatsApp do cliente'
            : fieldName === 'url'
              ? 'A URL do site'
              : 'Este campo';

      throw new BadRequestException(`${translatedFieldName} é obrigatório.`);
    }

    return normalizedValue;
  }

  private requireDomain(value: string | undefined): string {
    const normalizedValue = this.normalizeDomain(value);

    if (!normalizedValue) {
      throw new BadRequestException('O domínio é obrigatório.');
    }

    return normalizedValue;
  }

  private normalizeOptionalValue(value?: string): string | undefined {
    const normalizedValue = value?.trim();

    return normalizedValue ? normalizedValue : undefined;
  }

  private normalizeDomain(value?: string): string | undefined {
    const normalizedValue = this.normalizeOptionalValue(value);

    return normalizedValue?.toLowerCase();
  }

  private buildGeneratedPassword(clientWhatsapp: string): string {
    const clientWhatsappDigits = clientWhatsapp.replace(/\D/g, '');

    if (clientWhatsappDigits.length < 4) {
      throw new BadRequestException(
        'O WhatsApp do cliente deve conter ao menos 4 dígitos para gerar a senha.',
      );
    }

    return `${SITE_PASSWORD_PREFIX}${clientWhatsappDigits.slice(-4)}`;
  }
}

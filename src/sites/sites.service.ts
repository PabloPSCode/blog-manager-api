import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  where,
  type DocumentData,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from 'firebase/firestore/lite';
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
    const snapshot = await getDocs(
      query(
        collection(this.firebaseService.getFirestore(), SITES_COLLECTION),
        where('domain', '==', normalizedDomain),
        limit(1),
      ),
    );

    const site = snapshot.docs
      .map((siteSnapshot) => this.mapSiteSnapshot(siteSnapshot))
      .filter((site): site is ISite => site !== null)
      .find((activeSite) => activeSite.deletedAt === null);

    return site ?? null;
  }

  async findActiveById(siteId: string): Promise<ISite | null> {
    const normalizedSiteId = this.requireValue(siteId, 'id');
    const snapshot = await getDoc(
      doc(
        this.firebaseService.getFirestore(),
        SITES_COLLECTION,
        normalizedSiteId,
      ),
    );
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
      throw new NotFoundException(`Site ${normalizedSiteId} was not found.`);
    }

    return site;
  }

  async list(): Promise<ISite[]> {
    const snapshot = await getDocs(
      collection(this.firebaseService.getFirestore(), SITES_COLLECTION),
    );

    return snapshot.docs
      .map((siteSnapshot) => this.mapSiteSnapshot(siteSnapshot))
      .filter((site): site is ISite => site !== null)
      .filter((site) => site.deletedAt === null)
      .sort((leftSite, rightSite) =>
        rightSite.createdAt.localeCompare(leftSite.createdAt),
      );
  }

  async create(createSiteDto: ICreateSiteDTO): Promise<CreateSiteResult> {
    const sitesCollection = collection(
      this.firebaseService.getFirestore(),
      SITES_COLLECTION,
    );
    const siteRef = doc(sitesCollection);
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
      await setDoc(siteRef, site);
    } catch {
      throw new InternalServerErrorException(
        'Failed to create the site record.',
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
    if (!snapshot.exists()) {
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
      throw new BadRequestException(`${fieldName} is required.`);
    }

    return normalizedValue;
  }

  private requireDomain(value: string | undefined): string {
    const normalizedValue = this.normalizeDomain(value);

    if (!normalizedValue) {
      throw new BadRequestException('domain is required.');
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
        'clientWhatsapp must contain at least 4 digits to generate the password.',
      );
    }

    return `${SITE_PASSWORD_PREFIX}${clientWhatsappDigits.slice(-4)}`;
  }
}

import type { AccessTokenPayload } from '@living/types';

import { HttpClient } from './http';
import { AmcResource } from './resources/amc';
import { AssetCategoryResource, AssetResource } from './resources/assets';
import { AuthResource } from './resources/auth';
import { CatalogResource } from './resources/catalog';
import { CommunityResource } from './resources/community';
import {
  AmenitiesResource, AnnouncementsResource, BookingsResource, DocumentsResource, VisitorsResource,
} from './resources/community-ops';
import { MaintenanceResource } from './resources/maintenance';
import { PeopleResource } from './resources/people';
import { PlatformResource } from './resources/platform';
import { ServiceRequestResource } from './resources/service-requests';
import { TicketResource } from './resources/tickets';
import { WorkOrderResource } from './resources/work-orders';
import {
  createLocalStorageTokenStore,
  decodeAccessToken,
  type TokenStore,
} from './token-store';

export interface LivingClientConfig {
  /** API base, e.g. http://localhost:4000/api/v1 */
  baseUrl: string;
  /** Defaults to localStorage. Pass a memory store for SSR/tests. */
  tokenStore?: TokenStore;
  /** Invoked when a token refresh fails — the app should route to login. */
  onUnauthorized?: () => void;
}

/**
 * The single entry point the whole frontend uses to talk to the backend:
 *
 *   living.auth.login(...)      living.ticket.list(cid)
 *   living.workOrder.assign(id) living.serviceRequest.submitFeedback(id, …)
 *
 * Typed, framework-agnostic, and reusable by future mobile apps.
 */
export class LivingClient {
  readonly http: HttpClient;
  readonly tokenStore: TokenStore;

  readonly auth: AuthResource;
  readonly community: CommunityResource;
  readonly people: PeopleResource;
  readonly ticket: TicketResource;
  readonly serviceRequest: ServiceRequestResource;
  readonly workOrder: WorkOrderResource;
  readonly assets: AssetResource;
  readonly assetCategories: AssetCategoryResource;
  readonly maintenance: MaintenanceResource;
  readonly amc: AmcResource;
  readonly visitors: VisitorsResource;
  readonly bookings: BookingsResource;
  readonly announcements: AnnouncementsResource;
  readonly amenities: AmenitiesResource;
  readonly documents: DocumentsResource;
  readonly platform: PlatformResource;
  readonly catalog: CatalogResource;

  constructor(config: LivingClientConfig) {
    this.tokenStore = config.tokenStore ?? createLocalStorageTokenStore();
    this.http = new HttpClient({
      baseUrl: config.baseUrl,
      tokenStore: this.tokenStore,
      onUnauthorized: config.onUnauthorized,
    });

    this.auth = new AuthResource(this.http, this.tokenStore);
    this.community = new CommunityResource(this.http);
    this.people = new PeopleResource(this.http);
    this.ticket = new TicketResource(this.http);
    this.serviceRequest = new ServiceRequestResource(this.http);
    this.workOrder = new WorkOrderResource(this.http);
    this.assets = new AssetResource(this.http);
    this.assetCategories = new AssetCategoryResource(this.http);
    this.maintenance = new MaintenanceResource(this.http);
    this.amc = new AmcResource(this.http);
    this.visitors = new VisitorsResource(this.http);
    this.bookings = new BookingsResource(this.http);
    this.announcements = new AnnouncementsResource(this.http);
    this.amenities = new AmenitiesResource(this.http);
    this.documents = new DocumentsResource(this.http);
    this.platform = new PlatformResource(this.http);
    this.catalog = new CatalogResource(this.http);
  }

  /** Decoded access-token payload (roles/permissions/expiry) or null. */
  getTokenPayload(): AccessTokenPayload | null {
    const token = this.tokenStore.getAccess();
    return token ? decodeAccessToken(token) : null;
  }

  /** True if an unexpired access token is present. */
  isAuthenticated(): boolean {
    const payload = this.getTokenPayload();
    return !!payload && payload.exp * 1000 > Date.now();
  }
}

export function createLivingClient(config: LivingClientConfig): LivingClient {
  return new LivingClient(config);
}

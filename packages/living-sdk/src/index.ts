export { LivingClient, createLivingClient, type LivingClientConfig } from './client';
export { HttpClient, type HttpClientOptions } from './http';
export { LivingApiError } from './errors';
export {
  createLocalStorageTokenStore,
  createMemoryTokenStore,
  decodeAccessToken,
  type TokenStore,
  type StoredTokens,
} from './token-store';
export { AuthResource } from './resources/auth';
export { CommunityResource } from './resources/community';
export { PeopleResource } from './resources/people';
export { TicketResource } from './resources/tickets';
export { ServiceRequestResource } from './resources/service-requests';
export { WorkOrderResource } from './resources/work-orders';
export { AssetResource, AssetCategoryResource } from './resources/assets';
export { MaintenanceResource } from './resources/maintenance';
export { AmcResource } from './resources/amc';
export {
  VisitorsResource, BookingsResource, AnnouncementsResource, AmenitiesResource, DocumentsResource,
} from './resources/community-ops';
export {
  PlatformResource,
  type ProvisionCommunityInput,
  type ProvisionCommunityResult,
} from './resources/platform';
export { CatalogResource, type CatalogKind, type CatalogOption } from './resources/catalog';
export {
  NotificationsResource, EmailAdminResource, WhatsAppAdminResource,
  type EmailProviderName, type NotificationChannelName, type EmailProviderInfo,
  type ChannelHealth, type ChannelInfo, type TestResult,
  type NotificationStatistics, type NotificationDeliveryRow,
} from './resources/notifications';

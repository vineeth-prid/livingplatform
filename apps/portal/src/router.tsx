import { type FC, lazy } from 'react';
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from '@tanstack/react-router';
import { DashboardPage } from './features/dashboard/dashboard-page';
import { TicketsListPage } from './features/tickets/tickets-list';
import { TicketDetailPage } from './features/tickets/ticket-detail';
import { ServiceRequestsListPage } from './features/service-requests/sr-list';
import { ServiceRequestDetailPage } from './features/service-requests/sr-detail';
import { WorkOrdersListPage } from './features/work-orders/wo-list';
import { WorkOrderDetailPage } from './features/work-orders/wo-detail';
import { DashboardLayout } from './routes/dashboard-layout';
import { DesignSystemPage } from './pages/design-system';
import { LoginPage } from './pages/login';
import { NotFoundPage } from './pages/not-found';
import { parseListSearch } from './features/master-data';
import { CommunityOverviewPage } from './features/community/community-overview';
import { ResidentsListPage } from './features/residents/residents-list';
import { ResidentDetailPage } from './features/residents/resident-detail';
import { StaffListPage } from './features/staff/staff-list';
import { StaffDetailPage } from './features/staff/staff-detail';
import { VendorsListPage } from './features/vendors/vendors-list';
import { VendorDetailPage } from './features/vendors/vendor-detail';
import { UnitsListPage } from './features/units/units-list';
import { UnitDetailPage } from './features/units/unit-detail';

// Asset Management (Frontend Sprint 7) — route-level code splitting.
const AssetsListPage = lazy(() => import('./features/assets/assets-list').then((m) => ({ default: m.AssetsListPage })));
const AssetCreatePage = lazy(() => import('./features/assets/asset-create-page').then((m) => ({ default: m.AssetCreatePage })));
const AssetDetailPage = lazy(() => import('./features/assets/asset-detail').then((m) => ({ default: m.AssetDetailPage })));

// Preventive Maintenance & AMC (Frontend Sprint 8).
const MaintenancePlansPage = lazy(() => import('./features/maintenance/plans-list').then((m) => ({ default: m.MaintenancePlansPage })));
const PlanCreatePage = lazy(() => import('./features/maintenance/plan-create-page').then((m) => ({ default: m.PlanCreatePage })));
const PlanDetailPage = lazy(() => import('./features/maintenance/plan-detail').then((m) => ({ default: m.PlanDetailPage })));
const AmcContractsPage = lazy(() => import('./features/amc/contracts-list').then((m) => ({ default: m.AmcContractsPage })));
const ContractCreatePage = lazy(() => import('./features/amc/contract-create-page').then((m) => ({ default: m.ContractCreatePage })));
const ContractDetailPage = lazy(() => import('./features/amc/contract-detail').then((m) => ({ default: m.ContractDetailPage })));

// Platform-Admin control plane — community provisioning + executive portal.
const AdminCommunitiesPage = lazy(() => import('./features/admin/admin-communities').then((m) => ({ default: m.AdminCommunitiesPage })));
const PlatformDashboardPage = lazy(() => import('./features/platform-admin/platform-dashboard').then((m) => ({ default: m.PlatformDashboardPage })));
const PlatformAuditPage = lazy(() => import('./features/platform-admin/platform-audit').then((m) => ({ default: m.PlatformAuditPage })));
const PlatformSystemPage = lazy(() => import('./features/platform-admin/platform-system').then((m) => ({ default: m.PlatformSystemPage })));
const PlatformNotificationsPage = lazy(() => import('./features/platform-admin/platform-notifications').then((m) => ({ default: m.PlatformNotificationsPage })));
const PlatformWhatsAppPage = lazy(() => import('./features/platform-admin/platform-whatsapp').then((m) => ({ default: m.PlatformWhatsAppPage })));
const PlatformPaymentsPage = lazy(() => import('./features/platform-admin/platform-payments').then((m) => ({ default: m.PlatformPaymentsPage })));

// Payments & Maintenance Billing (Sprint 11).
const PaymentSettingsPage = lazy(() => import('./features/billing/payment-settings').then((m) => ({ default: m.PaymentSettingsPage })));
const MaintenanceConfigPage = lazy(() => import('./features/billing/maintenance-config').then((m) => ({ default: m.MaintenanceConfigPage })));
const CollectionDashboardPage = lazy(() => import('./features/billing/collection-dashboard').then((m) => ({ default: m.CollectionDashboardPage })));
const NotificationPreferencesPage = lazy(() => import('./features/billing/notification-preferences').then((m) => ({ default: m.NotificationPreferencesPage })));

// Community configuration, service catalog and packages (Sprint 12).
const CommunitySettingsPage = lazy(() => import('./features/settings/community-settings').then((m) => ({ default: m.CommunitySettingsPage })));
const ServicesPage = lazy(() => import('./features/services/services-page').then((m) => ({ default: m.ServicesPage })));
const CategoriesPage = lazy(() => import('./features/categories/categories-page').then((m) => ({ default: m.CategoriesPage })));
const ProfilePage = lazy(() => import('./features/profile/profile-page').then((m) => ({ default: m.ProfilePage })));
const PackagesPage = lazy(() => import('./features/packages/packages-page').then((m) => ({ default: m.PackagesPage })));
const PlatformBusinessPage = lazy(() => import('./features/platform-admin/platform-business').then((m) => ({ default: m.PlatformBusinessPage })));

// Community Operations (Frontend Sprint 9).
// Gate Management (Sprint 13) — delivery register, analytics and audit trail.
const GateDeliveriesPage = lazy(() => import('./features/gate/gate-list').then((m) => ({ default: m.GateDeliveriesPage })));
const GateAnalyticsPage = lazy(() => import('./features/gate/gate-analytics').then((m) => ({ default: m.GateAnalyticsPage })));
const GateEntryDetailPage = lazy(() => import('./features/gate/gate-detail').then((m) => ({ default: m.GateEntryDetailPage })));

const VisitorsPage = lazy(() => import('./features/visitors/visitors-list').then((m) => ({ default: m.VisitorsPage })));
const VisitorDetailPage = lazy(() => import('./features/visitors/visitor-detail').then((m) => ({ default: m.VisitorDetailPage })));
const AmenitiesPage = lazy(() => import('./features/amenities/amenities').then((m) => ({ default: m.AmenitiesPage })));
const BookingsPage = lazy(() => import('./features/bookings/bookings').then((m) => ({ default: m.BookingsPage })));
const DocumentsPage = lazy(() => import('./features/documents/documents').then((m) => ({ default: m.DocumentsPage })));
const AnnouncementsPage = lazy(() => import('./features/announcements/announcements').then((m) => ({ default: m.AnnouncementsPage })));

const editSearch = (s: Record<string, unknown>): { edit?: number } => (s.edit ? { edit: 1 } : {});

const rootRoute = createRootRoute({
  component: Outlet,
  notFoundComponent: NotFoundPage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
});

// Authenticated shell (layout route with no path).
const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'dashboard',
  component: DashboardLayout,
});

const page = (path: string, component: FC) =>
  createRoute({ getParentRoute: () => dashboardRoute, path, component });

/** A master-data list route with deep-linkable search state. */
const listPage = (path: string, component: FC) =>
  createRoute({ getParentRoute: () => dashboardRoute, path, component, validateSearch: parseListSearch });

/** A detail route with an `$id` param. */
const detailPage = (path: string, component: FC) =>
  createRoute({ getParentRoute: () => dashboardRoute, path, component });

const routeTree = rootRoute.addChildren([
  loginRoute,
  dashboardRoute.addChildren([
    page('/', DashboardPage),
    page('/design-system', DesignSystemPage),

    // Platform-Admin control plane
    createRoute({ getParentRoute: () => dashboardRoute, path: '/admin/dashboard', component: PlatformDashboardPage }),
    createRoute({ getParentRoute: () => dashboardRoute, path: '/admin/audit', component: PlatformAuditPage }),
    createRoute({ getParentRoute: () => dashboardRoute, path: '/admin/system', component: PlatformSystemPage }),
    createRoute({ getParentRoute: () => dashboardRoute, path: '/admin/notifications', component: PlatformNotificationsPage }),
    createRoute({ getParentRoute: () => dashboardRoute, path: '/admin/whatsapp', component: PlatformWhatsAppPage }),
    createRoute({ getParentRoute: () => dashboardRoute, path: '/admin/payments', component: PlatformPaymentsPage }),
    createRoute({ getParentRoute: () => dashboardRoute, path: '/admin/business', component: PlatformBusinessPage }),
    createRoute({ getParentRoute: () => dashboardRoute, path: '/admin/communities', component: AdminCommunitiesPage }),

    // Community & People Management (this sprint)
    page('/community', CommunityOverviewPage),
    listPage('/residents', ResidentsListPage),
    detailPage('/residents/$residentId', ResidentDetailPage),
    listPage('/staff', StaffListPage),
    detailPage('/staff/$staffId', StaffDetailPage),
    listPage('/vendors', VendorsListPage),
    detailPage('/vendors/$vendorId', VendorDetailPage),
    listPage('/units', UnitsListPage),
    detailPage('/units/$unitId', UnitDetailPage),

    // Asset Management (Frontend Sprint 7) — lazy, so declared directly.
    createRoute({ getParentRoute: () => dashboardRoute, path: '/assets', component: AssetsListPage, validateSearch: parseListSearch }),
    createRoute({ getParentRoute: () => dashboardRoute, path: '/assets/new', component: AssetCreatePage }),
    createRoute({
      getParentRoute: () => dashboardRoute,
      path: '/assets/$assetId',
      component: AssetDetailPage,
      validateSearch: editSearch,
    }),

    // Preventive Maintenance (Frontend Sprint 8)
    createRoute({ getParentRoute: () => dashboardRoute, path: '/maintenance', component: MaintenancePlansPage, validateSearch: parseListSearch }),
    createRoute({ getParentRoute: () => dashboardRoute, path: '/maintenance/new', component: PlanCreatePage }),
    createRoute({ getParentRoute: () => dashboardRoute, path: '/maintenance/$planId', component: PlanDetailPage, validateSearch: editSearch }),

    // AMC Management (Frontend Sprint 8)
    createRoute({ getParentRoute: () => dashboardRoute, path: '/amc', component: AmcContractsPage, validateSearch: parseListSearch }),
    createRoute({ getParentRoute: () => dashboardRoute, path: '/amc/new', component: ContractCreatePage }),
    createRoute({ getParentRoute: () => dashboardRoute, path: '/amc/$contractId', component: ContractDetailPage, validateSearch: editSearch }),

    // Community Operations (Frontend Sprint 9)
    createRoute({ getParentRoute: () => dashboardRoute, path: '/visitors', component: VisitorsPage, validateSearch: parseListSearch }),
    createRoute({ getParentRoute: () => dashboardRoute, path: '/visitors/$visitorId', component: VisitorDetailPage }),
    createRoute({ getParentRoute: () => dashboardRoute, path: '/amenities', component: AmenitiesPage, validateSearch: parseListSearch }),
    createRoute({ getParentRoute: () => dashboardRoute, path: '/bookings', component: BookingsPage, validateSearch: parseListSearch }),
    createRoute({ getParentRoute: () => dashboardRoute, path: '/documents', component: DocumentsPage, validateSearch: parseListSearch }),
    createRoute({ getParentRoute: () => dashboardRoute, path: '/announcements', component: AnnouncementsPage, validateSearch: parseListSearch }),

    // Gate Management (Sprint 13). `/gate/analytics` is declared BEFORE
    // `/gate/$entryId`, or the param route would capture it.
    createRoute({ getParentRoute: () => dashboardRoute, path: '/gate', component: GateDeliveriesPage, validateSearch: parseListSearch }),
    createRoute({ getParentRoute: () => dashboardRoute, path: '/gate/analytics', component: GateAnalyticsPage }),
    createRoute({ getParentRoute: () => dashboardRoute, path: '/gate/$entryId', component: GateEntryDetailPage }),

    // Payments & Maintenance Billing (Sprint 11)
    createRoute({ getParentRoute: () => dashboardRoute, path: '/billing', component: CollectionDashboardPage }),
    createRoute({ getParentRoute: () => dashboardRoute, path: '/billing/charges', component: MaintenanceConfigPage }),
    createRoute({ getParentRoute: () => dashboardRoute, path: '/billing/payment-settings', component: PaymentSettingsPage }),
    createRoute({ getParentRoute: () => dashboardRoute, path: '/billing/notifications', component: NotificationPreferencesPage }),

    // Community configuration, catalog and packages (Sprint 12)
    createRoute({ getParentRoute: () => dashboardRoute, path: '/settings', component: CommunitySettingsPage }),
    createRoute({ getParentRoute: () => dashboardRoute, path: '/services', component: ServicesPage }),
    createRoute({ getParentRoute: () => dashboardRoute, path: '/categories', component: CategoriesPage }),
    createRoute({ getParentRoute: () => dashboardRoute, path: '/profile', component: ProfilePage }),
    createRoute({ getParentRoute: () => dashboardRoute, path: '/packages', component: PackagesPage }),

    // Operations execution
    listPage('/tickets', TicketsListPage),
    detailPage('/tickets/$ticketId', TicketDetailPage),
    listPage('/service-requests', ServiceRequestsListPage),
    detailPage('/service-requests/$serviceRequestId', ServiceRequestDetailPage),
    listPage('/work-orders', WorkOrdersListPage),
    detailPage('/work-orders/$workOrderId', WorkOrderDetailPage),
  ]),
]);

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

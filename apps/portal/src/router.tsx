import { type FC } from 'react';
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

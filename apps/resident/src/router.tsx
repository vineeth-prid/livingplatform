import { type FC, lazy } from 'react';
import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router';

import { MobileShell } from './shell';
import { LoginScreen } from './screens/login';
import { HomeScreen } from './screens/home';

// Login and Home ship in the first download; every other screen loads the
// first time it is opened (and is preloaded on intent), so a phone parses far
// less JavaScript before the app is usable.
const ServicesScreen = lazy(() => import('./screens/services').then((m) => ({ default: m.ServicesScreen })));
const RequestsScreen = lazy(() => import('./screens/requests').then((m) => ({ default: m.RequestsScreen })));
const RequestDetailScreen = lazy(() => import('./screens/request-detail').then((m) => ({ default: m.RequestDetailScreen })));
const CommunityScreen = lazy(() => import('./screens/community').then((m) => ({ default: m.CommunityScreen })));
const ProfileScreen = lazy(() => import('./screens/profile').then((m) => ({ default: m.ProfileScreen })));
const AnnouncementsScreen = lazy(() => import('./screens/announcements').then((m) => ({ default: m.AnnouncementsScreen })));
const VisitorsScreen = lazy(() => import('./screens/visitors').then((m) => ({ default: m.VisitorsScreen })));
const BookingsScreen = lazy(() => import('./screens/bookings').then((m) => ({ default: m.BookingsScreen })));
const AmenitiesScreen = lazy(() => import('./screens/amenities').then((m) => ({ default: m.AmenitiesScreen })));
const MaintenanceScreen = lazy(() => import('./screens/maintenance').then((m) => ({ default: m.MaintenanceScreen })));
const MyPackagesScreen = lazy(() => import('./screens/my-packages').then((m) => ({ default: m.MyPackagesScreen })));
const GateHistoryScreen = lazy(() => import('./screens/gate').then((m) => ({ default: m.GateHistoryScreen })));
const GateEntryScreen = lazy(() => import('./screens/gate').then((m) => ({ default: m.GateEntryScreen })));

const rootRoute = createRootRoute({ component: Outlet });

const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: '/login', component: LoginScreen });

// The tab shell wraps every authenticated screen.
const shellRoute = createRoute({ getParentRoute: () => rootRoute, id: 'shell', component: MobileShell });
const tab = (path: string, component: FC) => createRoute({ getParentRoute: () => shellRoute, path, component });

const routeTree = rootRoute.addChildren([
  loginRoute,
  shellRoute.addChildren([
    tab('/', HomeScreen),
    tab('/services', ServicesScreen),
    tab('/requests', RequestsScreen),
    tab('/requests/$kind/$id', RequestDetailScreen),
    tab('/community', CommunityScreen),
    tab('/profile', ProfileScreen),
    // Community Operations (Frontend Sprint 9)
    tab('/announcements', AnnouncementsScreen),
    tab('/visitors', VisitorsScreen),
    tab('/bookings', BookingsScreen),
    tab('/amenities', AmenitiesScreen),
    // Maintenance billing (Sprint 11) — dues, invoices, payments, receipts.
    tab('/maintenance', MaintenanceScreen),
    // Service packages (Sprint 12) — prepaid visits and redemption.
    tab('/packages', MyPackagesScreen),
    // Gate Management (Sprint 13). `/gate/$entryId` is the deep link a push
    // notification opens — it must be declared after the list route.
    tab('/gate', GateHistoryScreen),
    tab('/gate/$entryId', GateEntryScreen),
  ]),
]);

export const router = createRouter({ routeTree, defaultPreload: 'intent', scrollRestoration: true });

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}

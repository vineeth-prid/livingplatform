import { type FC } from 'react';
import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router';

import { MobileShell } from './shell';
import { LoginScreen } from './screens/login';
import { HomeScreen } from './screens/home';
import { ServicesScreen } from './screens/services';
import { RequestsScreen } from './screens/requests';
import { RequestDetailScreen } from './screens/request-detail';
import { CommunityScreen } from './screens/community';
import { ProfileScreen } from './screens/profile';
import { AnnouncementsScreen } from './screens/announcements';
import { VisitorsScreen } from './screens/visitors';
import { BookingsScreen } from './screens/bookings';
import { AmenitiesScreen } from './screens/amenities';
import { MaintenanceScreen } from './screens/maintenance';
import { MyPackagesScreen } from './screens/my-packages';
import { GateEntryScreen, GateHistoryScreen } from './screens/gate';

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

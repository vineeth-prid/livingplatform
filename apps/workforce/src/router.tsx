import { type FC, lazy } from 'react';
import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router';

import { MobileShell } from './shell';
import { LoginScreen } from './screens/login';
import { TodayScreen } from './screens/today';

// Landing (Today) + login load eagerly; the heavier routes — especially job
// detail with its photo/progress panels — code-split so the first paint is lean.
const named = <K extends string>(key: K, load: () => Promise<Record<K, FC>>) =>
  lazy(() => load().then((m) => ({ default: m[key] })));
const JobsScreen = named('JobsScreen', () => import('./screens/jobs'));
const JobDetailScreen = named('JobDetailScreen', () => import('./screens/job-detail'));
const ActivityScreen = named('ActivityScreen', () => import('./screens/activity'));
const ProfileScreen = named('ProfileScreen', () => import('./screens/profile'));
const GateScreen = named('GateScreen', () => import('./screens/gate'));

const rootRoute = createRootRoute({ component: Outlet });

const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: '/login', component: LoginScreen });

// The tab shell wraps every authenticated screen.
const shellRoute = createRoute({ getParentRoute: () => rootRoute, id: 'shell', component: MobileShell });
const tab = (path: string, component: FC) => createRoute({ getParentRoute: () => shellRoute, path, component });

const routeTree = rootRoute.addChildren([
  loginRoute,
  shellRoute.addChildren([
    tab('/', TodayScreen),
    tab('/jobs', JobsScreen),
    tab('/jobs/$kind/$id', JobDetailScreen),
    tab('/gate', GateScreen),
    tab('/activity', ActivityScreen),
    tab('/profile', ProfileScreen),
  ]),
]);

export const router = createRouter({ routeTree, defaultPreload: 'intent', scrollRestoration: true });

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}

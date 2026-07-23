import { Suspense, useEffect, useMemo } from 'react';
import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import {
  Boxes, Building2, CalendarCheck, CalendarClock, DoorOpen, FileSignature, FileText,
  Hammer, HardHat, LayoutDashboard, LifeBuoy, Megaphone, ShieldCheck, Sparkles, Store, UserRound, Users, Wrench,
} from 'lucide-react';
import { useAuth } from '@living/hooks';
import {
  AppShell, LoadingState, ProfileMenu, ThemeSwitch, WorkspaceSwitcher,
  useCommandPalette, type NavSection,
} from '@living/ui';

import { useCommunity } from '../features/community/community-context';
import { RequireAuth } from './guards';

// Foundation nav — feature sprints extend these sections. Hrefs are illustrative;
// the pages themselves are built in later sprints (this sprint ships only the shell).
const sections: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, href: '/' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Tickets', icon: LifeBuoy, href: '/tickets' },
      { label: 'Service requests', icon: Wrench, href: '/service-requests' },
      { label: 'Work orders', icon: Hammer, href: '/work-orders' },
      { label: 'Assets', icon: Boxes, href: '/assets' },
      { label: 'Maintenance', icon: CalendarClock, href: '/maintenance' },
      { label: 'AMC', icon: FileSignature, href: '/amc' },
    ],
  },
  {
    title: 'Community',
    items: [
      { label: 'Community', icon: Building2, href: '/community' },
      { label: 'Units', icon: DoorOpen, href: '/units' },
      { label: 'Residents', icon: Users, href: '/residents' },
      { label: 'Staff', icon: HardHat, href: '/staff' },
      { label: 'Vendors', icon: Store, href: '/vendors' },
    ],
  },
  {
    title: 'Community ops',
    items: [
      { label: 'Visitors', icon: UserRound, href: '/visitors' },
      { label: 'Amenities', icon: Sparkles, href: '/amenities' },
      { label: 'Bookings', icon: CalendarCheck, href: '/bookings' },
      { label: 'Documents', icon: FileText, href: '/documents' },
      { label: 'Announcements', icon: Megaphone, href: '/announcements' },
    ],
  },
];

// Platform-Admin-only section — provisioning customers (communities + admins).
const adminSection: NavSection = {
  title: 'Administration',
  items: [{ label: 'Communities', icon: ShieldCheck, href: '/admin/communities' }],
};

/** The authenticated dashboard shell wrapping every protected route. */
export function DashboardLayout() {
  const { session, logout } = useAuth();
  const { communities, communityId, setCommunityId } = useCommunity();
  const navigate = useNavigate();
  const commandPalette = useCommandPalette();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Platform Admins run the control plane (provisioning) AND build out the
  // communities they provision. They get the admin section plus every
  // operational section, and pick which community to work in via the switcher
  // below (their community list spans all tenants).
  const isPlatform = (session?.roles ?? []).some((r) => r.scope === 'PLATFORM');
  const visibleSections = useMemo(
    () => (isPlatform ? [adminSection, ...sections] : sections),
    [isPlatform],
  );

  // Register global command-palette actions for navigation.
  useEffect(() => {
    const items = visibleSections.flatMap((s) => s.items);
    return commandPalette.register(
      items.map((item) => ({
        id: `nav:${item.href}`,
        label: item.label,
        group: 'Navigate',
        perform: () => navigate({ to: item.href }),
      })),
    );
  }, [commandPalette, navigate, visibleSections]);

  const user = session?.user;
  const fullName = user ? `${user.firstName} ${user.lastName}` : 'Living';

  return (
    <RequireAuth>
      <AppShell
        sections={visibleSections}
        activeHref={pathname}
        breadcrumbs={[{ label: 'Living' }, { label: 'Dashboard' }]}
        onSearchClick={commandPalette.open}
        renderLink={(item, content) => (
          <Link to={item.href} className="block">
            {content}
          </Link>
        )}
        sidebarHeader={
          <div className="flex flex-col gap-2">
            {isPlatform && (
              <div className="flex items-center gap-2 px-1 pt-0.5">
                <ShieldCheck className="h-4 w-4 text-brand" />
                <span className="text-2xs font-semibold uppercase tracking-wider text-subtle">Platform admin</span>
              </div>
            )}
            <WorkspaceSwitcher
              workspaces={communities.map((c) => ({
                id: c.id,
                name: c.name,
                subtitle: [c.city, c.state].filter(Boolean).join(', ') || undefined,
              }))}
              activeId={communityId ?? undefined}
              onSelect={setCommunityId}
            />
          </div>
        }
        headerRight={
          <div className="flex items-center gap-2">
            <ThemeSwitch />
            <ProfileMenu
              name={fullName}
              email={user?.email ?? ''}
              onSignOut={() => {
                void logout().then(() => navigate({ to: '/login' }));
              }}
            />
          </div>
        }
      >
        <Suspense fallback={<LoadingState className="h-[60vh]" />}>
          <Outlet />
        </Suspense>
      </AppShell>
    </RequireAuth>
  );
}

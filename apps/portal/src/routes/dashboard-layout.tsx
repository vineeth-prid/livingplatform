import { useEffect } from 'react';
import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import {
  Building2, DoorOpen, Hammer, HardHat, LayoutDashboard, LifeBuoy, Sparkles, Store, Users, Wrench,
} from 'lucide-react';
import { useAuth } from '@living/hooks';
import {
  AppShell, ProfileMenu, ThemeSwitch, WorkspaceSwitcher,
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
      { label: 'Design system', icon: Sparkles, href: '/design-system' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Tickets', icon: LifeBuoy, href: '/tickets' },
      { label: 'Service requests', icon: Wrench, href: '/service-requests' },
      { label: 'Work orders', icon: Hammer, href: '/work-orders' },
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
];

/** The authenticated dashboard shell wrapping every protected route. */
export function DashboardLayout() {
  const { session, logout } = useAuth();
  const { communities, communityId, setCommunityId } = useCommunity();
  const navigate = useNavigate();
  const commandPalette = useCommandPalette();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Register global command-palette actions for navigation.
  useEffect(() => {
    const items = sections.flatMap((s) => s.items);
    return commandPalette.register(
      items.map((item) => ({
        id: `nav:${item.href}`,
        label: item.label,
        group: 'Navigate',
        perform: () => navigate({ to: item.href }),
      })),
    );
  }, [commandPalette, navigate]);

  const user = session?.user;
  const fullName = user ? `${user.firstName} ${user.lastName}` : 'Living';

  return (
    <RequireAuth>
      <AppShell
        sections={sections}
        activeHref={pathname}
        breadcrumbs={[{ label: 'Living' }, { label: 'Dashboard' }]}
        onSearchClick={commandPalette.open}
        renderLink={(item, content) => (
          <Link to={item.href} className="block">
            {content}
          </Link>
        )}
        sidebarHeader={
          <WorkspaceSwitcher
            workspaces={communities.map((c) => ({
              id: c.id,
              name: c.name,
              subtitle: [c.city, c.state].filter(Boolean).join(', ') || undefined,
            }))}
            activeId={communityId ?? undefined}
            onSelect={setCommunityId}
          />
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
        <Outlet />
      </AppShell>
    </RequireAuth>
  );
}

import { Suspense, useEffect, useMemo } from 'react';
import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import {
  Activity, BellRing, Boxes, Building2, CalendarCheck, CalendarClock, CreditCard, DoorOpen,
  FileSignature, FileText, Hammer, HardHat, LayoutDashboard, LifeBuoy, Megaphone, MessageCircle,
  Package, Receipt, Server, Settings, ShieldCheck, Sparkles, Store, Tags, TrendingUp, Truck,
  UserRound, Users, Wallet, Wrench,
} from 'lucide-react';
import { useAuth, useCommunityFeatures } from '@living/hooks';
import {
  AppShell, LoadingState, ProfileMenu, ThemeSwitch, WorkspaceSwitcher,
  useCommandPalette, type NavSection,
} from '@living/ui';

import { useCommunity } from '../features/community/community-context';
import { exitImpersonation, getImpersonation } from '../features/admin/impersonation';
import { ChangePasswordGate } from '../pages/change-password';
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
      { label: 'Settings', icon: Settings, href: '/settings' },
    ],
  },
  {
    title: 'Billing',
    items: [
      { label: 'Collection', icon: Wallet, href: '/billing' },
      { label: 'Maintenance charges', icon: Receipt, href: '/billing/charges' },
      { label: 'Payment settings', icon: CreditCard, href: '/billing/payment-settings' },
      { label: 'Notifications', icon: BellRing, href: '/billing/notifications' },
    ],
  },
  {
    title: 'Catalog',
    items: [
      { label: 'Services', icon: Wrench, href: '/services' },
      { label: 'Categories', icon: Tags, href: '/categories' },
      { label: 'Packages', icon: Package, href: '/packages' },
    ],
  },
  {
    title: 'Community ops',
    items: [
      { label: 'Visitors', icon: UserRound, href: '/visitors' },
      { label: 'Gate', icon: Truck, href: '/gate' },
      { label: 'Gate analytics', icon: TrendingUp, href: '/gate/analytics' },
      { label: 'Amenities', icon: Sparkles, href: '/amenities' },
      { label: 'Bookings', icon: CalendarCheck, href: '/bookings' },
      { label: 'Documents', icon: FileText, href: '/documents' },
      { label: 'Announcements', icon: Megaphone, href: '/announcements' },
    ],
  },
];

// Platform-Admin-only portal — the executive command centre for Living itself.
// Deliberately excludes operational modules (tickets, residents, work orders …)
// which belong to the Community Admin, not the platform operator.
const adminSection: NavSection = {
  title: 'Platform admin',
  items: [
    { label: 'Dashboard', icon: LayoutDashboard, href: '/admin/dashboard' },
    { label: 'Audit & monitoring', icon: Activity, href: '/admin/audit' },
    { label: 'System', icon: Server, href: '/admin/system' },
    { label: 'Notifications', icon: Megaphone, href: '/admin/notifications' },
    { label: 'WhatsApp', icon: MessageCircle, href: '/admin/whatsapp' },
    { label: 'Payments', icon: CreditCard, href: '/admin/payments' },
    { label: 'Business', icon: TrendingUp, href: '/admin/business' },
    { label: 'Community management', icon: ShieldCheck, href: '/admin/communities' },
  ],
};

/**
 * Drop nav items whose community module is switched off.
 *
 * The API already 404s those routes, so this is not the security boundary — it
 * is what stops the portal advertising a module the community does not run.
 */
function applyModuleToggles(
  navSections: NavSection[],
  features: { maintenanceBilling: boolean; servicePackages: boolean },
): NavSection[] {
  const hidden = new Set<string>();
  if (!features.maintenanceBilling) {
    hidden.add('/billing');
    hidden.add('/billing/charges');
    hidden.add('/billing/payment-settings');
  }
  if (!features.servicePackages) hidden.add('/packages');
  if (hidden.size === 0) return navSections;

  return navSections
    .map((section) => ({ ...section, items: section.items.filter((i) => !hidden.has(i.href)) }))
    .filter((section) => section.items.length > 0);
}

/** The authenticated dashboard shell wrapping every protected route. */
export function DashboardLayout() {
  const { session, logout } = useAuth();
  const { communities, communityId, setCommunityId } = useCommunity();
  const navigate = useNavigate();
  const commandPalette = useCommandPalette();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Platform Admins run the control plane only — provisioning/config. The
  // operational sections (assets, AMC, tickets, community ops…) belong to the
  // association that runs each community, so a Platform Admin never sees them.
  const isPlatform = (session?.roles ?? []).some((r) => r.scope === 'PLATFORM');
  const features = useCommunityFeatures(isPlatform ? null : communityId);
  const visibleSections = useMemo(
    () => (isPlatform ? [adminSection] : applyModuleToggles(sections, features)),
    [isPlatform, features],
  );

  // A Platform Admin has no operational dashboard — land them on the executive one.
  useEffect(() => {
    if (isPlatform && pathname === '/') {
      navigate({ to: '/admin/dashboard', replace: true });
    }
  }, [isPlatform, pathname, navigate]);

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
  // Non-reactive (only changes across a full reload) — read once per render.
  const impersonating = getImpersonation();

  return (
    <RequireAuth>
      {user?.mustChangePassword ? (
        <ChangePasswordGate />
      ) : (
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
          isPlatform ? (
            <div className="flex items-center gap-2 px-1 py-1.5">
              <ShieldCheck className="h-5 w-5 text-brand" />
              <span className="text-sm font-semibold text-strong">Platform admin</span>
            </div>
          ) : (
            <WorkspaceSwitcher
              workspaces={communities.map((c) => ({
                id: c.id,
                name: c.name,
                subtitle: [c.city, c.state].filter(Boolean).join(', ') || undefined,
              }))}
              activeId={communityId ?? undefined}
              onSelect={setCommunityId}
            />
          )
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
        {impersonating && (
          <div className="flex items-center justify-between gap-3 bg-brand px-4 py-2 text-inverse">
            <span className="text-sm font-medium">
              Viewing <strong>{impersonating}</strong> as its admin — changes apply to this community.
            </span>
            <button
              type="button"
              onClick={exitImpersonation}
              className="rounded-control border border-white/30 px-3 py-1 text-sm font-medium transition-colors hover:bg-white/15"
            >
              Exit to platform admin
            </button>
          </div>
        )}
        <Suspense fallback={<LoadingState className="h-[60vh]" />}>
          <Outlet />
        </Suspense>
      </AppShell>
      )}
    </RequireAuth>
  );
}

import { useState, type ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useIsDesktop } from '@living/hooks';

import { drawer, reduce, scrim } from '../motion';
import { Header, type Breadcrumb } from './header';
import { Sidebar, type NavSection, type NavItem } from './sidebar';

const MotionContent = motion.create(DialogPrimitive.Content);

/**
 * The responsive application shell: a fixed sidebar on desktop, a slide-in
 * drawer on mobile, and a sticky header. One component drives every viewport —
 * no duplicate layouts. `onSearchClick` wires to the command palette.
 */
export function AppShell({
  sections,
  activeHref,
  breadcrumbs,
  renderLink,
  renderCrumb,
  sidebarHeader,
  sidebarFooter,
  headerRight,
  onSearchClick,
  notificationCount,
  children,
}: {
  sections: NavSection[];
  activeHref?: string;
  breadcrumbs?: Breadcrumb[];
  renderLink: (item: NavItem, content: ReactNode, active: boolean) => ReactNode;
  renderCrumb?: (crumb: Breadcrumb, content: ReactNode) => ReactNode;
  sidebarHeader?: ReactNode;
  sidebarFooter?: ReactNode;
  headerRight?: ReactNode;
  onSearchClick?: () => void;
  notificationCount?: number;
  children: ReactNode;
}) {
  const isDesktop = useIsDesktop();
  const [mobileOpen, setMobileOpen] = useState(false);
  const reduced = useReducedMotion() ?? false;

  const sidebar = (closeOnNav: boolean) => (
    <Sidebar
      sections={sections}
      activeHref={activeHref}
      header={sidebarHeader}
      footer={sidebarFooter}
      renderLink={(item, content, active) =>
        closeOnNav ? (
          <span onClick={() => setMobileOpen(false)}>{renderLink(item, content, active)}</span>
        ) : (
          renderLink(item, content, active)
        )
      }
    />
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-page">
      {isDesktop && <aside className="shrink-0">{sidebar(false)}</aside>}

      {!isDesktop && (
        <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
          <AnimatePresence>
            {mobileOpen && (
              <DialogPrimitive.Portal forceMount>
                <motion.div variants={reduce(scrim, reduced)} initial="initial" animate="animate" exit="exit">
                  <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[var(--surface-scrim)] backdrop-blur-sm" />
                </motion.div>
                <MotionContent
                  aria-label="Navigation"
                  variants={reduce(drawer('left'), reduced)}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="fixed inset-y-0 left-0 z-50 focus:outline-none"
                >
                  {sidebar(true)}
                </MotionContent>
              </DialogPrimitive.Portal>
            )}
          </AnimatePresence>
        </DialogPrimitive.Root>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          breadcrumbs={breadcrumbs}
          onMenuClick={() => setMobileOpen(true)}
          onSearchClick={onSearchClick}
          right={headerRight}
          renderCrumb={renderCrumb}
          notificationCount={notificationCount}
        />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

// ── Primitives ──
export { Button, buttonVariants, type ButtonProps } from './components/button';
export { Input, type InputProps } from './components/input';
export {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, cardVariants,
} from './components/card';
export { Badge, badgeVariants, type BadgeProps } from './components/badge';
export { Avatar, type AvatarProps } from './components/avatar';
export { Skeleton } from './components/skeleton';
export { Spinner } from './components/spinner';

// ── Overlays ──
export {
  Dialog, DialogTrigger, DialogClose, DialogContent, DialogFooter,
} from './components/dialog';
export { Sheet, SheetTrigger, SheetClose, SheetContent } from './components/sheet';
export {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuGroup,
} from './components/dropdown-menu';
export { Tooltip, TooltipProvider } from './components/tooltip';

// ── Data display ──
export { Table, THead, TBody, TR, TH, TD } from './components/table';
export { DataTable, type Column, type DataTableProps } from './components/data-table';
export { Pagination } from './components/pagination';
export { StatCard } from './components/stat-card';
export { Timeline, type TimelineItem } from './components/timeline';
export { ChartWrapper } from './components/chart-wrapper';

// ── Search / filters ──
export { SearchInput, type SearchInputProps } from './components/search-input';
export { FilterBar, FilterSelect } from './components/filter-bar';

// ── States ──
export { EmptyState } from './components/empty-state';
export { LoadingState, ErrorState } from './components/states';

// ── Providers ──
export { ToastProvider, toast } from './providers/toast';
export { ConfirmProvider, useConfirm } from './providers/confirm';
export { ErrorBoundary } from './providers/error-boundary';
export {
  CommandPaletteProvider, useCommandPalette, type CommandAction,
} from './providers/command-palette';

// ── Shell ──
export { AppShell } from './shell/app-shell';
export { Sidebar, type NavItem, type NavSection } from './shell/sidebar';
export { Header, type Breadcrumb } from './shell/header';
export { ThemeSwitch } from './shell/theme-switch';
export { ProfileMenu } from './shell/profile-menu';
export { WorkspaceSwitcher, type Workspace } from './shell/workspace-switcher';
export { PageContainer, PageHeader, PageTransition } from './shell/page';

// ── Motion library ──
export * as motion from './motion';

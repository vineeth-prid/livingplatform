import * as React from "react";

export interface SidebarNavItem {
  value?: string;
  label?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  /** When set, renders an uppercase section heading instead of a link. */
  section?: string;
}

/**
 * Vertical navigation for admin / dashboard shells.
 * @startingPoint section="Navigation" subtitle="Dashboard sidebar navigation" viewport="700x420"
 */
export interface SidebarNavProps {
  items: SidebarNavItem[];
  value?: string;
  onChange?: (value: string) => void;
  style?: React.CSSProperties;
}

export function SidebarNav(props: SidebarNavProps): JSX.Element;

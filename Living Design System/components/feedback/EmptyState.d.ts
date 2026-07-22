import * as React from "react";

/** Calm placeholder for empty lists, no-results and first-run screens. */
export interface EmptyStateProps {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  /** Primary action (usually a Button). */
  action?: React.ReactNode;
  style?: React.CSSProperties;
}

export function EmptyState(props: EmptyStateProps): JSX.Element;

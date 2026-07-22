import * as React from "react";

/**
 * Dashboard KPI widget — label, large value, delta and optional chart slot.
 * @startingPoint section="Display" subtitle="Dashboard KPI metric with delta" viewport="700x150"
 */
export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  /** Change indicator, e.g. "12%". */
  delta?: React.ReactNode;
  trend?: "up" | "down" | "flat";
  icon?: React.ReactNode;
  hint?: string;
  /** Slot for a sparkline / mini chart. */
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export function StatCard(props: StatCardProps): JSX.Element;

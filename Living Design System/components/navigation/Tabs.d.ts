import * as React from "react";

export interface TabItem {
  value: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
}

/** Quiet underline tabs. Controlled or uncontrolled. */
export interface TabsProps {
  /** Item objects, or plain strings used as both value and label. */
  items: (TabItem | string)[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  size?: "sm" | "md";
  style?: React.CSSProperties;
}

export function Tabs(props: TabsProps): JSX.Element;

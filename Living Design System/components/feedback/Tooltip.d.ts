import * as React from "react";

/** Quiet ink tooltip on hover/focus. Wrap any trigger element. */
export interface TooltipProps {
  label: string;
  placement?: "top" | "bottom" | "left" | "right";
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function Tooltip(props: TooltipProps): JSX.Element;

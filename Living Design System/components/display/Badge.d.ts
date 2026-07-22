import * as React from "react";

/** Small status pill with semantic tones. Soft, solid or outline. */
export interface BadgeProps {
  tone?: "neutral" | "brand" | "accent" | "success" | "warning" | "danger" | "info";
  variant?: "soft" | "solid" | "outline";
  size?: "sm" | "md";
  /** Show a leading status dot. */
  dot?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export function Badge(props: BadgeProps): JSX.Element;

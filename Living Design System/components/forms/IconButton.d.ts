import * as React from "react";

/** Icon-only square control for toolbars, cards and navigation. */
export interface IconButtonProps {
  variant?: "ghost" | "soft" | "outline" | "solid";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  /** Required for accessibility — describes the action. */
  "aria-label": string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  /** The icon glyph/element. */
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export function IconButton(props: IconButtonProps): JSX.Element;

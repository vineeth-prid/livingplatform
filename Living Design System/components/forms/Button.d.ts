import * as React from "react";

/**
 * Living primary action button. Deep Pine by default, Clay for
 * high-emphasis lifestyle CTAs, quiet secondary/ghost for the rest.
 *
 * @startingPoint section="Forms" subtitle="Primary / accent / secondary / ghost actions" viewport="700x150"
 */
export interface ButtonProps {
  /** Visual emphasis. */
  variant?: "primary" | "accent" | "secondary" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  disabled?: boolean;
  /** Icon element rendered before the label. */
  iconLeft?: React.ReactNode;
  /** Icon element rendered after the label. */
  iconRight?: React.ReactNode;
  type?: "button" | "submit" | "reset";
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export function Button(props: ButtonProps): JSX.Element;

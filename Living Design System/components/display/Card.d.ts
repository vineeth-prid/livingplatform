import * as React from "react";

/**
 * Calm content surface — the base container for most layouts.
 * @startingPoint section="Display" subtitle="Content surface: elevated, outline, glass" viewport="700x150"
 */
export interface CardProps {
  variant?: "elevated" | "outline" | "quiet" | "glass";
  padding?: "none" | "sm" | "md" | "lg";
  /** Enables hover lift + pointer cursor. */
  interactive?: boolean;
  as?: keyof JSX.IntrinsicElements;
  onClick?: (e: React.MouseEvent) => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export function Card(props: CardProps): JSX.Element;

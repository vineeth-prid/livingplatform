import * as React from "react";

/** Centred modal over a soft scrim, with calm fade + rise entrance. */
export interface DialogProps {
  open: boolean;
  onClose?: () => void;
  title?: string;
  description?: string;
  size?: "sm" | "md" | "lg";
  /** Footer actions row (usually Buttons). */
  footer?: React.ReactNode;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export function Dialog(props: DialogProps): JSX.Element | null;

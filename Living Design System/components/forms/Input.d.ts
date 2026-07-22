import * as React from "react";

/**
 * Text field with optional label, hint, error state and adornments.
 * @startingPoint section="Forms" subtitle="Labelled text field with hint & error" viewport="700x150"
 */
export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  hint?: string;
  /** Error message; also switches the field to danger styling. */
  error?: string;
  size?: "sm" | "md" | "lg";
  /** Leading adornment (icon, currency symbol). */
  leading?: React.ReactNode;
  /** Trailing adornment (icon, unit). */
  trailing?: React.ReactNode;
  style?: React.CSSProperties;
}

export function Input(props: InputProps): JSX.Element;

import * as React from "react";

export type SelectOption = string | { value: string; label: string };

/** Native select styled to match Input, with soft chevron. */
export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  label?: string;
  hint?: string;
  error?: string;
  size?: "sm" | "md" | "lg";
  options: SelectOption[];
  placeholder?: string;
  style?: React.CSSProperties;
}

export function Select(props: SelectProps): JSX.Element;

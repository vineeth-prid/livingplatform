import * as React from "react";

/** Soft toggle for settings and preferences. Pine track when on. */
export interface SwitchProps {
  label?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  size?: "sm" | "md";
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  id?: string;
  style?: React.CSSProperties;
}

export function Switch(props: SwitchProps): JSX.Element;

import * as React from "react";

/** Filter / attribute chip. Selectable and optionally removable. */
export interface TagProps {
  selected?: boolean;
  removable?: boolean;
  onRemove?: (e: React.MouseEvent) => void;
  icon?: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export function Tag(props: TagProps): JSX.Element;

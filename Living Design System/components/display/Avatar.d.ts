import * as React from "react";

/** Person or community image with initials fallback and optional status dot. */
export interface AvatarProps {
  src?: string;
  /** Used for the alt text and initials fallback. */
  name?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  shape?: "circle" | "square";
  status?: "online" | "away" | "busy" | "offline";
  style?: React.CSSProperties;
}

export function Avatar(props: AvatarProps): JSX.Element;

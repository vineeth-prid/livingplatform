import * as React from "react";

/**
 * The signature Living listing card — editorial photography, restrained meta,
 * favourite affordance, calm hover lift.
 * @startingPoint section="Property" subtitle="Signature real-estate listing card" viewport="700x460"
 */
export interface PropertyCardProps {
  /** Listing photo URL. Falls back to a Pine gradient. */
  image?: string;
  title: string;
  location?: string;
  /** Formatted price, e.g. "₹1.85 Cr" or "₹85,000". */
  price?: React.ReactNode;
  /** Suffix after price, e.g. "/month". */
  period?: string;
  /** Status label shown as a solid overlay badge. */
  status?: string;
  statusTone?: "success" | "warning" | "danger" | "brand" | "accent";
  beds?: React.ReactNode;
  baths?: React.ReactNode;
  area?: React.ReactNode;
  favourite?: boolean;
  onFavourite?: (next: boolean) => void;
  onClick?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}

export function PropertyCard(props: PropertyCardProps): JSX.Element;

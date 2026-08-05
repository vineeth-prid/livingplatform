import { BadRequestException } from '@nestjs/common';

/** The catalogue side of a price decision. */
export interface PriceableService {
  basePrice: unknown | null;
  estimatedDurationMinutes: number | null;
}

export interface PriceableVariant {
  id: string;
  name: string;
  price: unknown;
  durationMinutes: number | null;
  isActive: boolean;
}

export interface PricedRequest {
  variantId: string | null;
  quantity: number;
  /** Price for ONE unit. Null when the community charges nothing for it. */
  unitPrice: number | null;
  /** unitPrice × quantity. Null when there is no price. */
  totalPrice: number | null;
  /** Minutes for the whole request, variant duration × quantity when known. */
  estimatedMinutes: number | null;
}

export const MAX_QUANTITY = 20;

/**
 * What a service request costs, decided once at request time.
 *
 * Two rules that matter:
 *
 *  • A VARIANT's price wins over the service's base price. That is the whole
 *    point of a variant — an SUV wash is not a hatchback wash.
 *  • The result is FROZEN onto the request. A community editing its catalogue
 *    next month must not silently rewrite what a resident was quoted today,
 *    which is why the caller stores unitPrice/totalPrice rather than joining
 *    back to the service to display a price later.
 *
 * A service with no variants and no base price is free — a perfectly normal
 * arrangement for community-run services — and yields null prices, not zero.
 * Null and zero read differently in a total, and only one of them is honest.
 */
export function priceServiceRequest(input: {
  service: PriceableService;
  variants: PriceableVariant[];
  variantId?: string | null;
  quantity?: number | null;
}): PricedRequest {
  const quantity = normalizeQuantity(input.quantity);

  // A service that offers variants requires one: silently defaulting to the
  // cheapest (or to basePrice) would quote a hatchback price for an SUV.
  const active = input.variants.filter((v) => v.isActive);
  if (active.length > 0 && !input.variantId) {
    throw new BadRequestException(
      `Choose an option: ${active.map((v) => v.name).join(', ')}`,
    );
  }

  let variant: PriceableVariant | null = null;
  if (input.variantId) {
    variant = active.find((v) => v.id === input.variantId) ?? null;
    if (!variant) {
      throw new BadRequestException('That option is not available for this service');
    }
  }

  const unitPrice = variant ? toNumber(variant.price) : toNumber(input.service.basePrice);
  const minutes = variant?.durationMinutes ?? input.service.estimatedDurationMinutes;

  return {
    variantId: variant?.id ?? null,
    quantity,
    unitPrice,
    totalPrice: unitPrice === null ? null : round2(unitPrice * quantity),
    estimatedMinutes: minutes === null ? null : minutes * quantity,
  };
}

function normalizeQuantity(value?: number | null): number {
  const quantity = value ?? 1;
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new BadRequestException('Quantity must be a whole number of at least 1');
  }
  // A cap, because a typo'd 200 is a scheduling problem for the community, not
  // an order they want to honour.
  if (quantity > MAX_QUANTITY) {
    throw new BadRequestException(`Quantity cannot exceed ${MAX_QUANTITY} per request`);
  }
  return quantity;
}

/** Prisma Decimal, number, string or null → number | null. */
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Money to 2dp — floating multiplication otherwise yields 1499.9999999998. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

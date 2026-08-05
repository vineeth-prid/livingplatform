import { BadRequestException } from '@nestjs/common';

import { MAX_QUANTITY, priceServiceRequest } from './service-pricing';

const carWash = { basePrice: 300, estimatedDurationMinutes: 30 };
const VARIANTS = [
  { id: 'v-hatch', name: 'Hatchback', price: 300, durationMinutes: 30, isActive: true },
  { id: 'v-suv', name: 'SUV', price: 500, durationMinutes: 45, isActive: true },
  { id: 'v-old', name: 'Retired', price: 100, durationMinutes: 20, isActive: false },
];

describe('priceServiceRequest — variants', () => {
  it("uses the VARIANT's price, not the service base price", () => {
    const result = priceServiceRequest({
      service: carWash,
      variants: VARIANTS,
      variantId: 'v-suv',
    });

    expect(result.unitPrice).toBe(500);
    expect(result.totalPrice).toBe(500);
    expect(result.estimatedMinutes).toBe(45);
  });

  /**
   * The point of the whole feature: defaulting would quote a hatchback price
   * for an SUV, and the resident would find out at the gate.
   */
  it('refuses to guess when a service offers options', () => {
    expect(() => priceServiceRequest({ service: carWash, variants: VARIANTS })).toThrow(
      BadRequestException,
    );
  });

  it('names the options in the error so the app can act on it', () => {
    expect(() => priceServiceRequest({ service: carWash, variants: VARIANTS })).toThrow(
      /Hatchback, SUV/,
    );
  });

  it('ignores retired options', () => {
    expect(() =>
      priceServiceRequest({ service: carWash, variants: VARIANTS, variantId: 'v-old' }),
    ).toThrow(BadRequestException);
  });

  it('falls back to the base price when a service has no variants', () => {
    const result = priceServiceRequest({ service: carWash, variants: [] });

    expect(result.variantId).toBeNull();
    expect(result.unitPrice).toBe(300);
  });
});

describe('priceServiceRequest — quantity', () => {
  it('multiplies the unit price', () => {
    const result = priceServiceRequest({
      service: { basePrice: 250, estimatedDurationMinutes: 40 },
      variants: [],
      quantity: 2,
    });

    expect(result.quantity).toBe(2);
    expect(result.unitPrice).toBe(250);
    expect(result.totalPrice).toBe(500);
    // Two bathrooms take twice as long — the schedule has to know.
    expect(result.estimatedMinutes).toBe(80);
  });

  it('defaults to one', () => {
    expect(priceServiceRequest({ service: carWash, variants: [] }).quantity).toBe(1);
  });

  it('rejects nonsense quantities', () => {
    for (const quantity of [0, -1, 1.5]) {
      expect(() =>
        priceServiceRequest({ service: carWash, variants: [], quantity }),
      ).toThrow(BadRequestException);
    }
  });

  it('caps a typo rather than honouring it', () => {
    expect(() =>
      priceServiceRequest({ service: carWash, variants: [], quantity: MAX_QUANTITY + 1 }),
    ).toThrow(BadRequestException);
  });

  it('combines variant pricing with quantity', () => {
    const result = priceServiceRequest({
      service: carWash,
      variants: VARIANTS,
      variantId: 'v-suv',
      quantity: 3,
    });

    expect(result.totalPrice).toBe(1500);
    expect(result.estimatedMinutes).toBe(135);
  });
});

describe('priceServiceRequest — free services', () => {
  /**
   * Null and zero read differently in a total, and only one is honest: a
   * community-run service with no price is not "₹0", it is unpriced.
   */
  it('yields null, not zero, when nothing is charged', () => {
    const result = priceServiceRequest({
      service: { basePrice: null, estimatedDurationMinutes: 20 },
      variants: [],
      quantity: 3,
    });

    expect(result.unitPrice).toBeNull();
    expect(result.totalPrice).toBeNull();
    expect(result.estimatedMinutes).toBe(60);
  });

  it('handles a service with no duration either', () => {
    const result = priceServiceRequest({
      service: { basePrice: null, estimatedDurationMinutes: null },
      variants: [],
    });

    expect(result.estimatedMinutes).toBeNull();
  });
});

describe('priceServiceRequest — money arithmetic', () => {
  /** 149.99 × 3 is 449.96999999999997 in float. */
  it('rounds to 2dp instead of leaking float noise', () => {
    const result = priceServiceRequest({
      service: { basePrice: 149.99, estimatedDurationMinutes: null },
      variants: [],
      quantity: 3,
    });

    expect(result.totalPrice).toBe(449.97);
  });

  /** Prisma hands back Decimal objects, not numbers. */
  it('accepts a Decimal-like price', () => {
    const decimalLike = { toString: () => '750.50', valueOf: () => 750.5 };
    const result = priceServiceRequest({
      service: { basePrice: decimalLike, estimatedDurationMinutes: null },
      variants: [],
      quantity: 2,
    });

    expect(result.totalPrice).toBe(1501);
  });
});

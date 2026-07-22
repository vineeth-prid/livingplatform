import { BadRequestException } from '@nestjs/common';

import {
  ASSET_SORTABLE, DEFAULT_ASSET_CATEGORIES, assertAssetDatesConsistent,
} from './asset.constants';

const d = (s: string) => new Date(s);

describe('assertAssetDatesConsistent', () => {
  it('accepts a sensible purchase → install → warranty ordering', () => {
    expect(() =>
      assertAssetDatesConsistent({
        purchaseDate: d('2024-01-01'),
        installationDate: d('2024-01-15'),
        warrantyExpiry: d('2027-01-01'),
      }),
    ).not.toThrow();
  });

  it('rejects installing before purchase', () => {
    expect(() =>
      assertAssetDatesConsistent({ purchaseDate: d('2024-06-01'), installationDate: d('2024-01-01') }),
    ).toThrow(BadRequestException);
  });

  it('rejects a warranty that expires before purchase', () => {
    expect(() =>
      assertAssetDatesConsistent({ purchaseDate: d('2024-06-01'), warrantyExpiry: d('2024-01-01') }),
    ).toThrow(BadRequestException);
  });

  it('ignores checks when a date is missing (all optional)', () => {
    expect(() => assertAssetDatesConsistent({})).not.toThrow();
    expect(() => assertAssetDatesConsistent({ warrantyExpiry: d('2020-01-01') })).not.toThrow();
    expect(() => assertAssetDatesConsistent({ installationDate: d('2024-01-01') })).not.toThrow();
  });

  it('allows an already-expired warranty (past date is valid)', () => {
    expect(() =>
      assertAssetDatesConsistent({ purchaseDate: d('2015-01-01'), warrantyExpiry: d('2018-01-01') }),
    ).not.toThrow();
  });
});

describe('asset catalog constants', () => {
  it('ships the 10 seed categories with unique codes', () => {
    const codes = DEFAULT_ASSET_CATEGORIES.map((c) => c.code);
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
  });

  it('whitelists only safe sort fields', () => {
    expect(ASSET_SORTABLE).toContain('warrantyExpiry');
    expect(ASSET_SORTABLE).not.toContain('metadata');
  });
});

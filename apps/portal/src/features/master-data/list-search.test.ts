import { describe, expect, it } from 'vitest';

import { parseListSearch } from './list-search';

describe('parseListSearch', () => {
  it('parses page as a positive integer', () => {
    expect(parseListSearch({ page: '3' }).page).toBe(3);
    expect(parseListSearch({ page: '0' }).page).toBeUndefined();
    expect(parseListSearch({ page: 'abc' }).page).toBeUndefined();
  });

  it('only accepts valid sort directions', () => {
    expect(parseListSearch({ dir: 'asc' }).dir).toBe('asc');
    expect(parseListSearch({ dir: 'sideways' }).dir).toBeUndefined();
  });

  it('keeps arbitrary string filters and drops empties', () => {
    const s = parseListSearch({ q: 'khan', status: 'ACTIVE', blockId: '', page: '2' });
    expect(s.q).toBe('khan');
    expect(s.status).toBe('ACTIVE');
    expect('blockId' in s).toBe(false);
    expect(s.page).toBe(2);
  });
});

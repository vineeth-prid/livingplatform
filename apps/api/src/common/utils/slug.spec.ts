import { slugify } from './slug';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('The Arbour')).toBe('the-arbour');
  });

  it('collapses non-alphanumerics and trims hyphens', () => {
    expect(slugify('  Palm   Grove!! ')).toBe('palm-grove');
  });

  it('strips diacritics', () => {
    expect(slugify('Café Résidences')).toBe('cafe-residences');
  });

  it('handles empty-ish input', () => {
    expect(slugify('  ---  ')).toBe('');
  });
});

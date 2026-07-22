import { buildObjectKey } from './object-key';

describe('buildObjectKey', () => {
  it('namespaces under scope/yyyy/mm and prefixes a uuid', () => {
    const key = buildObjectKey('assets/abc/photos', 'photo.jpg');
    expect(key).toMatch(/^assets\/abc\/photos\/\d{4}\/\d{2}\/[0-9a-f-]{36}-photo\.jpg$/);
  });

  it('never trusts the client filename — no path injection, sanitised, lower-cased', () => {
    const key = buildObjectKey('docs', '../../etc/passwd; DROP TABLE.PDF');
    // The client filename becomes a SINGLE key segment: slashes/spaces/specials
    // collapse to '-', so it can never inject extra path segments.
    expect(key.split('/')).toHaveLength(4); // docs / yyyy / mm / <name>
    const name = key.split('/').pop()!;
    expect(name).not.toContain(' ');
    expect(name).not.toContain(';');
    expect(name).toMatch(/^[0-9a-f-]{36}-[\w.-]+$/);
    expect(name).toBe(name.toLowerCase());
  });

  it('trims leading/trailing slashes from the scope', () => {
    expect(buildObjectKey('/logos/', 'a.png')).toMatch(/^logos\/\d{4}\//);
  });

  it('is collision-safe — distinct keys for the same inputs', () => {
    expect(buildObjectKey('s', 'f.txt')).not.toBe(buildObjectKey('s', 'f.txt'));
  });
});

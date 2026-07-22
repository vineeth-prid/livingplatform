import { ListQueryDto, resolveSort, SortDirection } from './list-query.dto';

/** Sort whitelisting — a client must not be able to order by an arbitrary column. */
describe('resolveSort', () => {
  const allowed = ['name', 'createdAt', 'status'] as const;

  const q = (sortBy?: string, sortDir?: SortDirection): ListQueryDto =>
    Object.assign(new ListQueryDto(), { sortBy, sortDir });

  it('uses a whitelisted field + direction', () => {
    expect(resolveSort(q('name', SortDirection.Asc), allowed, 'createdAt')).toEqual({
      name: 'asc',
    });
  });

  it('falls back when the field is not whitelisted', () => {
    expect(
      resolveSort(q('passwordHash', SortDirection.Asc), allowed, 'createdAt'),
    ).toEqual({ createdAt: 'asc' });
  });

  it('defaults to descending', () => {
    expect(resolveSort(q('status'), allowed, 'createdAt')).toEqual({
      status: 'desc',
    });
  });

  it('falls back to the default field when none given', () => {
    expect(resolveSort(q(), allowed, 'createdAt')).toEqual({ createdAt: 'desc' });
  });
});

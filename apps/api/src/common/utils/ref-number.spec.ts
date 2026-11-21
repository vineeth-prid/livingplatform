import { refNumber } from './ref-number';

describe('refNumber', () => {
  it.each([
    ['101', 101], ['#101', 101], ['TKT-000101', 101], ['tkt 101', 101], [' 000042 ', 42],
  ])('reads %s as reference %i', (input, n) => expect(refNumber(input, 'TKT')).toBe(n));

  it.each(['A-101', 'B-1002', 'flat 101', 'leak in 101', 'SRQ-101'])('does not treat %s as a ticket number', (input) => {
    expect(refNumber(input, 'TKT')).toBeNull();
  });

  it('matches its own prefix', () => {
    expect(refNumber('SRQ-000007', 'SRQ')).toBe(7);
    expect(refNumber('WO-12', 'WO')).toBe(12);
  });
});

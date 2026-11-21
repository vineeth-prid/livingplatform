/**
 * The number in a reference search — "101", "#101", "TKT-000101", "tkt 101" —
 * or null when the search is something else (a flat like "A-101", a title).
 * Digits inside a flat number must NOT match a ticket/request/work-order
 * number: searching "A-101" should find flat A-101, not ticket #101.
 */
export function refNumber(search: string, prefix: string): number | null {
  const m = new RegExp(`^\\s*(?:${prefix}[\\s-]*|#)?0*(\\d{1,9})\\s*$`, 'i').exec(search);
  return m ? Number(m[1]) : null;
}

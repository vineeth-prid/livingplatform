/**
 * One renderer for every financial document Living produces — payment
 * receipts, vendor payout statements, payout receipts, commission statements.
 *
 * The platform has no server-side PDF engine: the document is laid out as
 * print-ready HTML and the browser's print dialog saves it as a PDF. The layout
 * is content-sized (no fixed heights): a one-line receipt stays compact, a long
 * statement flows onto further A4 pages with the table header repeated and no
 * row split across a page break.
 *
 * Every value is HTML-escaped — names and descriptions are user-entered.
 */
export interface PrintableDocument {
  /** "Payment receipt", "Vendor payout statement"… — always printed as the title. */
  title: string;
  number?: string | null;
  status?: string | null;
  issuer: {
    name: string;
    logoUrl?: string | null;
    address?: (string | null | undefined)[];
    contact?: (string | null | undefined)[];
  };
  /** Label/value pairs; empty values are dropped, never printed as blanks. */
  meta: [string, string | null | undefined][];
  /** e.g. { label: 'Received from', lines: ['Vineeth K', 'Unit A-101'] } */
  party?: { label: string; lines: (string | null | undefined)[] } | null;
  lines: { label: string; detail?: string | null; amount: number }[];
  /** Summary rows under the lines; the last `emphasis` row is the headline total. */
  totals: { label: string; amount: number; emphasis?: boolean }[];
  currency?: string;
  footer?: string | null;
}

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const present = (v: string | null | undefined): v is string => !!v && v.trim() !== '' && v.trim() !== '—';

export function money(amount: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
}

const CSS = `
@page { size: A4; margin: 14mm; }
* { box-sizing: border-box; }
body { margin: 0; background: #f4f4f2; color: #1c1c1c; font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
.doc { max-width: 720px; margin: 24px auto; background: #fff; border: 1px solid #e3e1dc; border-radius: 12px; padding: 36px 40px; }
.brand { text-align: center; padding-bottom: 20px; border-bottom: 1px solid #ecebe7; }
.brand img { max-height: 76px; max-width: 240px; object-fit: contain; display: block; margin: 0 auto 10px; }
.brand h1 { margin: 0; font-size: 20px; letter-spacing: -0.01em; }
.brand p { margin: 2px 0 0; color: #6b6b6b; font-size: 12px; overflow-wrap: anywhere; }
.head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin: 22px 0 6px; }
.head h2 { margin: 0; font-size: 18px; }
.head .no { color: #6b6b6b; font-size: 13px; margin-top: 2px; overflow-wrap: anywhere; }
.status { border: 1px solid #c9d9cf; color: #2f5d43; background: #eef5f0; border-radius: 999px; padding: 2px 10px; font-size: 12px; white-space: nowrap; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px 28px; margin: 18px 0 22px; }
.meta { width: 100%; border-collapse: collapse; font-size: 13px; }
.meta td { padding: 3px 0; vertical-align: top; }
.meta td:first-child { color: #6b6b6b; padding-right: 12px; white-space: nowrap; }
.meta td:last-child { text-align: right; font-weight: 600; overflow-wrap: anywhere; }
.party h3 { margin: 0 0 4px; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #8a8a8a; }
.party p { margin: 0; overflow-wrap: anywhere; }
table.items { width: 100%; border-collapse: collapse; font-size: 13px; }
table.items thead { display: table-header-group; }
table.items th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #8a8a8a; border-bottom: 1px solid #e3e1dc; padding: 8px 0; }
table.items th:last-child, table.items td.amt { text-align: right; white-space: nowrap; padding-left: 16px; }
table.items td { border-bottom: 1px solid #f0efeb; padding: 10px 0; vertical-align: top; overflow-wrap: anywhere; }
table.items tr { break-inside: avoid; page-break-inside: avoid; }
.detail { color: #6b6b6b; font-size: 12px; margin-top: 2px; }
.totals { margin-left: auto; width: min(100%, 320px); margin-top: 14px; border-collapse: collapse; break-inside: avoid; }
.totals td { padding: 4px 0; font-size: 13px; }
.totals td:last-child { text-align: right; white-space: nowrap; }
.totals tr.em td { border-top: 1px solid #1c1c1c; padding-top: 10px; font-size: 18px; font-weight: 700; }
.foot { margin-top: 28px; padding-top: 14px; border-top: 1px solid #ecebe7; text-align: center; color: #8a8a8a; font-size: 11px; }
[data-numeric] { font-variant-numeric: tabular-nums; }
@media (max-width: 560px) { .doc { margin: 0; border-radius: 0; border: 0; padding: 24px 18px; } .grid { grid-template-columns: 1fr; } }
@media print { body { background: #fff; } .doc { margin: 0; max-width: none; border: 0; border-radius: 0; padding: 0; } }
`;

/** The full HTML document (exported for tests). */
export function renderDocumentHtml(doc: PrintableDocument, livingLogoUrl = '/icon.svg'): string {
  const cur = doc.currency ?? 'INR';
  const address = (doc.issuer.address ?? []).filter(present);
  const contact = (doc.issuer.contact ?? []).filter(present);
  const meta = doc.meta.filter(([, v]) => present(v));
  const partyLines = (doc.party?.lines ?? []).filter(present);
  const logo = doc.issuer.logoUrl || livingLogoUrl;

  const metaHtml = meta.length
    ? `<table class="meta">${meta.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>`
    : '';
  const partyHtml = doc.party && partyLines.length
    ? `<div class="party"><h3>${esc(doc.party.label)}</h3>${partyLines.map((l) => `<p>${esc(l)}</p>`).join('')}</div>`
    : '';

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc([doc.title, doc.number].filter(Boolean).join(' '))}</title><style>${CSS}</style></head><body><main class="doc">
<header class="brand">
  <img src="${esc(logo)}" alt="${esc(doc.issuer.name)} logo" onerror="this.remove()">
  <h1>${esc(doc.issuer.name)}</h1>
  ${address.length ? `<p>${esc(address.join(', '))}</p>` : ''}
  ${contact.length ? `<p>${esc(contact.join(' · '))}</p>` : ''}
</header>
<section class="head">
  <div><h2>${esc(doc.title)}</h2>${present(doc.number) ? `<div class="no">${esc(doc.number)}</div>` : ''}</div>
  ${present(doc.status) ? `<span class="status">${esc(doc.status)}</span>` : ''}
</section>
${partyHtml || metaHtml ? `<section class="grid">${partyHtml || '<div></div>'}${metaHtml}</section>` : ''}
<table class="items"><thead><tr><th>Description</th><th>Amount</th></tr></thead><tbody>
${doc.lines.map((l) => `<tr><td>${esc(l.label)}${present(l.detail) ? `<div class="detail">${esc(l.detail)}</div>` : ''}</td><td class="amt" data-numeric>${esc(money(l.amount, cur))}</td></tr>`).join('')}
</tbody></table>
<table class="totals">${doc.totals.map((t) => `<tr class="${t.emphasis ? 'em' : ''}"><td>${esc(t.label)}</td><td data-numeric>${esc(money(t.amount, cur))}</td></tr>`).join('')}</table>
${present(doc.footer ?? null) ? `<footer class="foot">${esc(doc.footer)}</footer>` : ''}
</main></body></html>`;
}

/**
 * Open the document in a new window and bring up the print dialog (→ "Save as
 * PDF"). Waits for the logo to load so it is not missing from the PDF.
 * Returns false when the browser blocked the pop-up.
 */
export function printDocument(doc: PrintableDocument): boolean {
  const win = window.open('', '_blank', 'width=820,height=900');
  if (!win) return false;
  win.document.write(renderDocumentHtml(doc, `${window.location.origin}/icon.svg`));
  win.document.close();
  const images = Array.from(win.document.images);
  let printed = false;
  const go = () => {
    if (printed) return;
    printed = true;
    win.focus();
    win.print();
  };
  const pending = images.filter((img) => !img.complete);
  if (pending.length === 0) go();
  else {
    let left = pending.length;
    pending.forEach((img) => {
      const done = () => (--left <= 0 ? go() : undefined);
      img.addEventListener('load', done);
      img.addEventListener('error', done);
    });
    setTimeout(go, 4000); // never hang on a slow logo
  }
  return true;
}

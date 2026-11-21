import { describe, expect, it } from 'vitest';

import { renderDocumentHtml, type PrintableDocument } from './print-document';

const base: PrintableDocument = {
  title: 'Payment receipt',
  number: 'RCPT-20260808-000001',
  status: 'Paid',
  issuer: { name: 'Skyline', logoUrl: 'https://cdn.example/logo.png', address: ['Seaport–Airport Road', null, 'Kochi'] },
  meta: [['Date', '8/8/2026'], ['Reference', ''], ['Method', '—']],
  party: { label: 'Received from', lines: ['Vineeth K', 'Unit A-101'] },
  lines: [{ label: 'Maintenance charge', detail: '1,640 sq ft × ₹3.25', amount: 5330 }],
  totals: [{ label: 'Amount paid', amount: 5330, emphasis: true }],
};

describe('renderDocumentHtml', () => {
  it('centres the community logo and falls back to the Living mark without one', () => {
    expect(renderDocumentHtml(base)).toContain('src="https://cdn.example/logo.png"');
    expect(renderDocumentHtml({ ...base, issuer: { name: 'Skyline' } }, '/icon.svg')).toContain('src="/icon.svg"');
  });

  it('drops empty fields instead of printing blank labels', () => {
    const html = renderDocumentHtml(base);
    expect(html).toContain('>Date<');
    expect(html).not.toContain('>Reference<');
    expect(html).not.toContain('>Method<');
    expect(html).toContain('Seaport–Airport Road, Kochi');
  });

  it('escapes user-entered text', () => {
    const html = renderDocumentHtml({ ...base, party: { label: 'Received from', lines: ['<img src=x onerror=alert(1)>'] } });
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('grows with content: every line is a row, rows never split across pages, no fixed heights', () => {
    const lines = Array.from({ length: 60 }, (_, i) => ({ label: `Service ${i + 1}`, amount: 100 }));
    const html = renderDocumentHtml({ ...base, lines });
    expect(html.match(/<tr><td>Service /g)).toHaveLength(60);
    expect(html).toContain('break-inside: avoid');
    expect(html).toContain('display: table-header-group');
    expect(html).not.toMatch(/[^-]height:\s*\d/);
  });

  it('prints amounts as rupees from the values given', () => {
    expect(renderDocumentHtml(base)).toContain('₹5,330.00');
  });
});

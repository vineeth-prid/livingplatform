import { useRef, useState } from 'react';
import { LivingApiError } from '@living/living-sdk';
import { Button, Sheet, SheetContent, toast } from '@living/ui';
import { Download, Upload } from 'lucide-react';

import { living } from '../../lib/living';

type Kind = 'units' | 'residents';

/** Column spec per kind: CSV header → row field. Also drives the sample file. */
const SPEC: Record<Kind, { headers: string[]; sample: string; numeric: string[] }> = {
  units: {
    headers: ['unitNumber', 'type', 'block', 'phase', 'floorLevel', 'bedrooms', 'bathrooms', 'parkingSlots', 'builtUpArea', 'ownership', 'ownerName', 'ownerPhone'],
    sample: 'A-101,2BHK,Tower A,Phase 1,1,2,2,1,1150,OWNER_OCCUPIED,Ravi Kumar,9876543210',
    numeric: ['floorLevel', 'bedrooms', 'bathrooms', 'parkingSlots', 'builtUpArea'],
  },
  residents: {
    headers: ['firstName', 'lastName', 'mobile', 'email', 'occupiedBy', 'unit'],
    sample: 'Aisha,Khan,9876500001,aisha@example.com,OWNER,A-101',
    numeric: [],
  },
};

/** Minimal CSV parse — comma-separated, first row is a header. No quoted-comma
 *  support (ponytail: bump to a real CSV lib only if fields need embedded commas). */
/**
 * What has to be true of the file BEFORE it is uploaded.
 *
 * Each line here corresponds to a rule the importer enforces row by row. They
 * were only discoverable by uploading and reading the failures, which meant an
 * admin learned the format one rejected row at a time.
 */
const RULES: Record<Kind, string[]> = {
  units: [
    'The first row must be the column headers exactly as listed below.',
    '“unitNumber” is required and must be unique within the community — a repeat is rejected, not merged.',
    '“block” and “phase” must already exist. Create the hierarchy first; the importer never invents one.',
    '“floorLevel”, “bedrooms”, “bathrooms”, “parkingSlots” and “builtUpArea” must be plain numbers — no “sq ft”, no commas.',
    '“ownership” must be one of OWNER_OCCUPIED, RENTED or VACANT.',
    '“ownerPhone” is the 10-digit mobile. A country code is fine and is removed automatically.',
    'Leave a cell empty rather than writing “NA” or “-”; empty means “not set”, text means a value.',
  ],
  residents: [
    'The first row must be the column headers exactly as listed below.',
    '“mobile” is required — it becomes the login username, so it must be a valid 10-digit number.',
    '“unit” is matched by unit number and must already exist in this community.',
    'A unit already occupied by another resident is rejected. Add household members as FAMILY_MEMBER instead.',
    '“occupiedBy” must be one of OWNER, TENANT or FAMILY_MEMBER.',
    'A mobile already registered reuses that person’s existing login rather than creating a second one.',
    'Rows are imported independently: a bad row is reported and skipped, the rest still load.',
  ],
};

function parseCsv(text: string, spec: { headers: string[]; numeric: string[] }): Record<string, unknown>[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const header = lines[0]!.split(',').map((h) => h.trim());
  const useHeader = header.some((h) => spec.headers.includes(h)) ? header : spec.headers;
  const body = header.some((h) => spec.headers.includes(h)) ? lines.slice(1) : lines;
  return body.map((line) => {
    const cells = line.split(',');
    const row: Record<string, unknown> = {};
    useHeader.forEach((key, i) => {
      const val = (cells[i] ?? '').trim();
      if (val === '') return;
      row[key] = spec.numeric.includes(key) ? Number(val) : val;
    });
    return row;
  });
}

export function BulkUploadDrawer({
  open, onOpenChange, kind, communityId, onDone,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; kind: Kind; communityId: string; onDone: () => void;
}) {
  const spec = SPEC[kind];
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; failed: number; errors: { row: number; error: string }[] } | null>(null);

  const reset = () => { setRows([]); setFileName(''); setResult(null); };

  const onFile = async (file: File) => {
    setFileName(file.name);
    const text = await file.text();
    setRows(parseCsv(text, spec));
    setResult(null);
  };

  const downloadTemplate = () => {
    const blob = new Blob([`${spec.headers.join(',')}\n${spec.sample}\n`], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${kind}-template.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const upload = async () => {
    if (rows.length === 0) return;
    setBusy(true);
    try {
      const res = kind === 'units'
        ? await living.community.bulkCreateUnits(communityId, rows)
        : await living.people.bulkCreateResidents(communityId, rows);
      setResult(res);
      if (res.created > 0) { toast.success(`${res.created} ${kind} created`); onDone(); }
      if (res.failed > 0) toast.error(`${res.failed} row(s) failed`);
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <SheetContent open={open} side="right" title={`Bulk upload ${kind}`} className="w-[min(94vw,520px)]">
        <div className="flex flex-col gap-4">
          {/*
            The rules BEFORE the file picker, not after a failed upload.
            A bulk upload either works or returns a list of row errors, and every
            one of those errors is a rule the admin was never told. Stating them
            up front is the difference between one upload and four.
          */}
          <div className="rounded-card border border-border-subtle bg-sunken/50 p-3.5">
            <p className="text-sm font-medium text-strong">Before you upload</p>
            <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-4 text-xs text-muted">
              {RULES[kind].map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-subtle">
              Columns, in order:{' '}
              <span className="break-all font-mono text-2xs text-body">{spec.headers.join(', ')}</span>
            </p>
          </div>

          <Button variant="ghost" size="sm" className="self-start" onClick={downloadTemplate}>
            <Download className="h-4 w-4" /> Download template
          </Button>

          <input ref={inputRef} type="file" hidden accept=".csv,text/csv"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }} />
          <Button variant="secondary" onClick={() => inputRef.current?.click()}>
            <Upload className="h-4 w-4" /> {fileName || 'Choose CSV file'}
          </Button>

          {rows.length > 0 && !result && (
            <p className="text-sm text-strong">{rows.length} row(s) ready to upload.</p>
          )}

          {result && (
            <div className="rounded-card border border-border bg-sunken p-3 text-sm">
              <p className="font-medium text-strong">{result.created} created · {result.failed} failed</p>
              {result.errors.length > 0 && (
                <ul className="mt-2 max-h-48 overflow-y-auto text-xs text-danger-fg">
                  {result.errors.map((e) => <li key={e.row}>Row {e.row}: {e.error}</li>)}
                </ul>
              )}
            </div>
          )}

          <div className="mt-2 flex justify-end gap-3">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Close</Button>
            <Button onClick={upload} loading={busy} disabled={rows.length === 0}>Upload {rows.length || ''}</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

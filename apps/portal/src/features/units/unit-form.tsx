import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '@living/hooks';
import type { Floor, Unit } from '@living/types';

import { living } from '../../lib/living';
import { FormDrawer, type FieldDef } from '../master-data';
import { opt, UNIT_STATUS } from '../master-data/options';

/**
 * Floor picker scoped to the selected block.
 *
 * Also self-corrects: if the block changes and the floor already chosen belongs
 * to the old one, it clears rather than silently submitting a floor from
 * another tower.
 */
function FloorSelect({
  floors,
  blockId,
  value,
  onChange,
  error,
}: {
  floors: Floor[];
  blockId: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const available = blockId ? floors.filter((f) => f.blockId === blockId) : [];

  const valid = !value || available.some((f) => f.id === value);
  useEffect(() => {
    if (!valid) onChange('');
  }, [valid, onChange]);

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-strong">Floor</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={!blockId}
        className="h-11 rounded-control border border-border bg-raised px-3 text-base text-strong outline-none transition-shadow focus-visible:shadow-ring disabled:opacity-60"
      >
        <option value="">
          {!blockId
            ? 'Choose a block first'
            : available.length === 0
              ? 'No floors in this block'
              : 'Select…'}
        </option>
        {available.map((f) => (
          <option key={f.id} value={f.id}>{f.name ?? `Level ${f.level}`}</option>
        ))}
      </select>
      {error && <span className="text-sm text-danger-fg">{error}</span>}
    </label>
  );
}

export function UnitForm({
  open, onOpenChange, communityId, unit, onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communityId: string;
  unit?: Unit;
  onSaved?: () => void;
}) {
  const qc = useQueryClient();
  const editing = !!unit;

  // Block / floor options for the placement selects (community hierarchy).
  const { data: blocks } = useQuery({
    queryKey: [...qk.community(communityId), 'blocks', 'options'],
    queryFn: () => living.community.listBlocks(communityId, { limit: 100, sortBy: 'sortOrder', sortDir: 'asc' }),
    enabled: open,
  });
  const { data: floors } = useQuery({
    queryKey: [...qk.community(communityId), 'floors', 'options'],
    queryFn: () => living.community.listFloors(communityId, { limit: 100, sortBy: 'level', sortDir: 'asc' }),
    enabled: open,
  });

  const fields: FieldDef[] = [
    { name: 'unitNumber', label: 'Unit number', required: true, half: true, placeholder: 'A-1203' },
    { name: 'type', label: 'Type', half: true, placeholder: '2BHK' },
    {
      name: 'blockId', label: 'Block', type: 'select', half: true,
      options: (blocks?.items ?? []).map((b) => ({ value: b.id, label: `${b.name} (${b.code})` })),
    },
    {
      // Floors belong to a block, so the list must follow the block chosen
      // above. Showing every floor in the community let an admin place a unit
      // on a floor in a different tower entirely.
      name: 'floorId', label: 'Floor', type: 'custom', half: true,
      render: (value, setValue, error, values) => (
        <FloorSelect
          floors={floors?.items ?? []}
          blockId={values?.blockId ?? ''}
          value={value}
          onChange={setValue}
          error={error}
        />
      ),
    },
    { name: 'bedrooms', label: 'Bedrooms', type: 'number', half: true },
    { name: 'bathrooms', label: 'Bathrooms', type: 'number', half: true },
    { name: 'parkingSlots', label: 'Parking slots', type: 'number', half: true },
    { name: 'builtUpArea', label: 'Built-up area (sqft)', type: 'number', half: true },
    { name: 'status', label: 'Status', type: 'select', options: opt(UNIT_STATUS), half: true },
    // "Occupied By" removed: owner-vs-tenant is a property of the RESIDENT
    // mapped to the unit, not of the unit itself, and it is captured when a
    // resident is assigned. Two places to state the same fact meant they
    // disagreed. The owner's own details stay here.
    { name: 'ownerName', label: 'Owner name', half: true },
    { name: 'ownerPhone', label: 'Owner phone', type: 'tel', half: true },
  ];

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Edit unit' : 'Add unit'}
      fields={fields}
      submitLabel={editing ? 'Save changes' : 'Add unit'}
      initial={
        editing
          ? {
              unitNumber: unit.unitNumber, type: unit.type ?? '',
              blockId: unit.blockId ?? '', floorId: unit.floorId ?? '',
              bedrooms: unit.bedrooms != null ? String(unit.bedrooms) : '',
              bathrooms: unit.bathrooms != null ? String(unit.bathrooms) : '',
              parkingSlots: String(unit.parkingSlots ?? 0),
              builtUpArea: unit.builtUpArea != null ? String(unit.builtUpArea) : '',
              status: unit.status, ownership: unit.ownership,
              ownerName: unit.ownerName ?? '', ownerPhone: unit.ownerPhone ?? '',
            }
          : {}
      }
      onSubmit={async (values) => {
        const result = editing
          ? await living.community.updateUnit(unit.id, values)
          : await living.community.createUnit(communityId, values);
        await qc.invalidateQueries({ queryKey: ['units'] });
        if (editing) await qc.invalidateQueries({ queryKey: ['unit', unit.id] });
        onSaved?.();
        return result;
      }}
    />
  );
}

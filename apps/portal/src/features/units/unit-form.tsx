import { useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '@living/hooks';
import type { Unit } from '@living/types';

import { living } from '../../lib/living';
import { FormDrawer, type FieldDef } from '../master-data';
import { opt, OWNERSHIP, UNIT_STATUS } from '../master-data/options';

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
      name: 'floorId', label: 'Floor', type: 'select', half: true,
      options: (floors?.items ?? []).map((f) => ({ value: f.id, label: f.name ?? `Level ${f.level}` })),
    },
    { name: 'bedrooms', label: 'Bedrooms', type: 'number', half: true },
    { name: 'bathrooms', label: 'Bathrooms', type: 'number', half: true },
    { name: 'parkingSlots', label: 'Parking slots', type: 'number', half: true },
    { name: 'builtUpArea', label: 'Built-up area (sqft)', type: 'number', half: true },
    { name: 'status', label: 'Status', type: 'select', options: opt(UNIT_STATUS), half: true },
    { name: 'ownership', label: 'Ownership', type: 'select', options: opt(OWNERSHIP), half: true },
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

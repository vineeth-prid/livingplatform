import { useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '@living/hooks';
import type { Block, Floor, Phase } from '@living/types';

import { living } from '../../lib/living';
import { FormDrawer, type FieldDef } from '../master-data';
import { opt, BLOCK_TYPE, HIERARCHY_STATUS } from '../master-data/options';

/** Any hierarchy write invalidates every community-scoped sub-query (blocks,
 *  floors, phases, options maps) and the detail stats — all under one prefix. */
function useInvalidateHierarchy(communityId: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: qk.community(communityId) });
}

export function PhaseForm({
  open, onOpenChange, communityId, phase,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communityId: string;
  phase?: Phase;
}) {
  const editing = !!phase;
  const invalidate = useInvalidateHierarchy(communityId);

  const fields: FieldDef[] = [
    { name: 'name', label: 'Name', required: true, half: true, placeholder: 'Phase 1' },
    { name: 'code', label: 'Code', required: true, half: true, placeholder: 'P1' },
    { name: 'sortOrder', label: 'Sort order', type: 'number', half: true },
    { name: 'status', label: 'Status', type: 'select', options: opt(HIERARCHY_STATUS), half: true },
    { name: 'description', label: 'Description', type: 'textarea' },
  ];

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Edit phase' : 'Add phase'}
      fields={fields}
      submitLabel={editing ? 'Save changes' : 'Add phase'}
      initial={editing ? {
        name: phase.name, code: phase.code,
        sortOrder: String(phase.sortOrder ?? 0), status: phase.status,
      } : {}}
      onSubmit={async (values) => {
        const result = editing
          ? await living.community.updatePhase(phase.id, values)
          : await living.community.createPhase(communityId, values);
        await invalidate();
        return result;
      }}
    />
  );
}

export function BlockForm({
  open, onOpenChange, communityId, block,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communityId: string;
  block?: Block;
}) {
  const editing = !!block;
  const invalidate = useInvalidateHierarchy(communityId);

  const { data: phases } = useQuery({
    queryKey: [...qk.community(communityId), 'phases', 'options'],
    queryFn: () => living.community.listPhases(communityId, { limit: 100, sortBy: 'sortOrder', sortDir: 'asc' }),
    enabled: open,
  });

  const fields: FieldDef[] = [
    { name: 'name', label: 'Name', required: true, half: true, placeholder: 'Tower A' },
    { name: 'code', label: 'Code', required: true, half: true, placeholder: 'A' },
    { name: 'type', label: 'Type', type: 'select', required: true, half: true, options: opt(BLOCK_TYPE) },
    {
      name: 'phaseId', label: 'Phase', type: 'select', half: true, placeholder: 'None',
      options: (phases?.items ?? []).map((p) => ({ value: p.id, label: `${p.name} (${p.code})` })),
    },
    { name: 'totalFloors', label: 'Total floors', type: 'number', half: true },
    { name: 'sortOrder', label: 'Sort order', type: 'number', half: true },
    { name: 'status', label: 'Status', type: 'select', options: opt(HIERARCHY_STATUS), half: true },
    { name: 'description', label: 'Description', type: 'textarea' },
  ];

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Edit block' : 'Add block'}
      fields={fields}
      submitLabel={editing ? 'Save changes' : 'Add block'}
      initial={editing ? {
        name: block.name, code: block.code, type: block.type,
        phaseId: block.phaseId ?? '',
        totalFloors: block.totalFloors != null ? String(block.totalFloors) : '',
        sortOrder: String(block.sortOrder ?? 0), status: block.status,
      } : { type: 'TOWER' }}
      onSubmit={async (values) => {
        const result = editing
          ? await living.community.updateBlock(block.id, values)
          : await living.community.createBlock(communityId, values);
        await invalidate();
        return result;
      }}
    />
  );
}

export function FloorForm({
  open, onOpenChange, communityId, floor,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communityId: string;
  floor?: Floor;
}) {
  const editing = !!floor;
  const invalidate = useInvalidateHierarchy(communityId);

  const { data: blocks } = useQuery({
    queryKey: [...qk.community(communityId), 'blocks', 'options'],
    queryFn: () => living.community.listBlocks(communityId, { limit: 100, sortBy: 'sortOrder', sortDir: 'asc' }),
    enabled: open,
  });

  const fields: FieldDef[] = [
    {
      name: 'blockId', label: 'Block', type: 'select', required: true,
      options: (blocks?.items ?? []).map((b) => ({ value: b.id, label: `${b.name} (${b.code})` })),
    },
    { name: 'level', label: 'Level', type: 'number', required: true, half: true, placeholder: '0 = ground' },
    { name: 'name', label: 'Name', half: true, placeholder: 'Podium 1' },
    { name: 'sortOrder', label: 'Sort order', type: 'number', half: true },
    { name: 'status', label: 'Status', type: 'select', options: opt(HIERARCHY_STATUS), half: true },
    { name: 'description', label: 'Description', type: 'textarea' },
  ];

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Edit floor' : 'Add floor'}
      fields={fields}
      submitLabel={editing ? 'Save changes' : 'Add floor'}
      initial={editing ? {
        blockId: floor.blockId, level: String(floor.level),
        name: floor.name ?? '', status: floor.status,
      } : {}}
      onSubmit={async (values) => {
        const result = editing
          ? await living.community.updateFloor(floor.id, values)
          : await living.community.createFloor(values);
        await invalidate();
        return result;
      }}
    />
  );
}

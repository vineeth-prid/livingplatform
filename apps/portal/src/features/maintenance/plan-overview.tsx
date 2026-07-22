import { Link } from '@tanstack/react-router';
import { ArrowUpRight } from 'lucide-react';
import { formatDate } from '@living/utils';
import type { MaintenancePlan } from '@living/types';

import { DetailSection, Field, FieldGrid } from '../master-data';
import { PriorityPill } from '../operations';
import { frequencyLabel } from './config';

export function PlanOverview({ plan }: { plan: MaintenancePlan }) {
  return (
    <div className="flex flex-col gap-6">
      {plan.description && (
        <DetailSection title="About"><p className="whitespace-pre-wrap text-sm text-body">{plan.description}</p></DetailSection>
      )}

      <DetailSection title="Schedule">
        <FieldGrid cols={3}>
          <Field label="Frequency" value={frequencyLabel(plan.frequencyType, plan.frequencyInterval, plan.cronExpression)} />
          <Field label="Start date" value={formatDate(plan.startDate)} />
          <Field label="End date" value={plan.endDate ? formatDate(plan.endDate) : null} />
          <Field label="Next run" value={plan.isActive ? formatDate(plan.nextRunAt) : 'Paused'} />
          <Field label="Last run" value={plan.lastRunAt ? formatDate(plan.lastRunAt) : null} />
          <Field label="Priority" value={<PriorityPill priority={plan.priority} />} />
        </FieldGrid>
      </DetailSection>

      <DetailSection title="Execution">
        <FieldGrid cols={3}>
          <Field label="Estimated duration" value={plan.estimatedDurationMinutes ? `${plan.estimatedDurationMinutes} min` : null} />
          <Field label="Requires verification" value={plan.requiresVerification ? 'Yes' : 'No'} />
          <Field label="Runs generated" value={String(plan._count?.runs ?? plan.runs?.length ?? 0)} mono />
        </FieldGrid>
      </DetailSection>

      {plan.asset && (
        <DetailSection title="Asset" action={
          <Link to={`/assets/${plan.assetId}` as string} className="inline-flex items-center gap-1 text-sm text-brand hover:underline">
            Open asset <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        }>
          <FieldGrid cols={2}>
            <Field label="Name" value={plan.asset.name} />
            <Field label="Code" value={plan.asset.assetCode} mono />
          </FieldGrid>
        </DetailSection>
      )}
    </div>
  );
}

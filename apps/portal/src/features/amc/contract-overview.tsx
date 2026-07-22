import { Link } from '@tanstack/react-router';
import { ArrowUpRight } from 'lucide-react';
import { formatDate } from '@living/utils';
import type { AMCContract } from '@living/types';

import { DetailSection, Field, FieldGrid } from '../master-data';
import { formatMoney, humanize } from './config';

export function ContractOverview({ contract }: { contract: AMCContract }) {
  return (
    <div className="flex flex-col gap-6">
      {contract.description && (
        <DetailSection title="About"><p className="whitespace-pre-wrap text-sm text-body">{contract.description}</p></DetailSection>
      )}

      <DetailSection title="Contract" action={
        <Link to={`/vendors/${contract.vendorId}` as string} className="inline-flex items-center gap-1 text-sm text-brand hover:underline">
          Open vendor <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      }>
        <FieldGrid cols={3}>
          <Field label="Vendor" value={contract.vendor?.name} />
          <Field label="Contract number" value={contract.contractNumber} mono />
          <Field label="Status" value={humanize(contract.status)} />
          <Field label="Annual cost" value={formatMoney(contract.annualCost, contract.currency)} mono />
          <Field label="Payment frequency" value={humanize(contract.paymentFrequency)} />
          <Field label="Auto-renew" value={contract.autoRenew ? 'Yes' : 'No'} />
          <Field label="Start date" value={formatDate(contract.startDate)} />
          <Field label="End date" value={formatDate(contract.endDate)} />
          <Field label="Renewal reminder" value={`${contract.renewalReminderDays} days`} />
        </FieldGrid>
      </DetailSection>

      {(contract.contactPerson || contract.contactPhone || contract.contactEmail) && (
        <DetailSection title="Vendor contact">
          <FieldGrid cols={3}>
            <Field label="Person" value={contract.contactPerson} />
            <Field label="Phone" value={contract.contactPhone} />
            <Field label="Email" value={contract.contactEmail} />
          </FieldGrid>
        </DetailSection>
      )}
    </div>
  );
}

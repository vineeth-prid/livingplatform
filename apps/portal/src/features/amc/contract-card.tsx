import { Link } from '@tanstack/react-router';
import { motion, useReducedMotion } from 'framer-motion';
import { FileSignature, Package } from 'lucide-react';
import type { AMCContract } from '@living/types';

import { formatMoney } from './config';
import { AmcStatusBadge, RenewalIndicator } from './amc-badges';

export function ContractCard({ contract }: { contract: AMCContract }) {
  const reduced = useReducedMotion();
  const covered = contract._count?.coverages ?? contract.coverages?.length ?? 0;
  return (
    <Link to={`/amc/${contract.id}` as string} className="rounded-card focus-visible:outline-none focus-visible:shadow-ring">
      <motion.div
        whileHover={reduced ? undefined : { y: -2 }}
        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
        className="flex h-full flex-col gap-3 rounded-card border border-border-subtle bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tint text-brand"><FileSignature className="h-5 w-5" /></span>
          <AmcStatusBadge status={contract.status} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-strong">{contract.name}</p>
          <p className="mt-0.5 truncate text-xs text-muted"><span className="font-mono">{contract.contractNumber}</span> · {contract.vendor?.name ?? 'Vendor'}</p>
        </div>
        <p className="text-sm font-medium text-strong">{formatMoney(contract.annualCost, contract.currency)}<span className="text-xs font-normal text-subtle">/yr</span></p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <RenewalIndicator status={contract.status} endDate={contract.endDate} />
          <span className="inline-flex items-center gap-1 text-xs text-subtle"><Package className="h-3.5 w-3.5" /> {covered}</span>
        </div>
      </motion.div>
    </Link>
  );
}

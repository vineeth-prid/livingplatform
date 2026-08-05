import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';

import { living } from '../../lib/living';

/**
 * Which services a vendor delivers, taken from the community's ACTIVE services
 * catalog.
 *
 * Deliberately not a free-text option list: a vendor can only be auto-assigned
 * work for a service that actually exists, so the two must be the same
 * vocabulary. Withdrawn and platform-hidden services never appear here, because
 * `listServices({ activeOnly })` already resolves the tenant's overrides.
 */
export function ServicesMultiSelect({
  values,
  onChange,
  label = 'Services delivered',
}: {
  values: string[];
  onChange: (values: string[]) => void;
  label?: string;
}) {
  const services = useQuery({
    queryKey: ['services', 'active-for-picker'],
    queryFn: () => living.serviceRequest.listServices({ activeOnly: true }),
  });

  const rows = services.data ?? [];
  const toggle = (key: string) =>
    onChange(values.includes(key) ? values.filter((v) => v !== key) : [...values, key]);

  return (
    <div>
      <span className="text-sm font-medium text-strong">{label}</span>
      <div className="mt-1.5 flex flex-wrap gap-1.5 rounded-control border border-border bg-raised p-2">
        {services.isLoading ? (
          <span className="text-xs text-subtle">Loading services…</span>
        ) : rows.length === 0 ? (
          <span className="text-xs text-subtle">
            No active services yet —{' '}
            <Link to="/services" className="text-brand hover:underline">
              add one to the catalog
            </Link>
            .
          </span>
        ) : (
          rows.map((service) => {
            const on = values.includes(service.key);
            return (
              <button
                key={service.id}
                type="button"
                onClick={() => toggle(service.key)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  on ? 'bg-brand text-white' : 'bg-sunken text-muted hover:text-strong'
                }`}
              >
                {service.name}
              </button>
            );
          })
        )}
      </div>
      <p className="mt-1 text-xs text-subtle">
        Service requests are auto-assigned to a vendor who delivers that service.
      </p>
    </div>
  );
}

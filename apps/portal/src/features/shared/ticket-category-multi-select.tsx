import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';

import { living } from '../../lib/living';

/**
 * Which request categories a staff member handles, from the community's active
 * Categories catalogue.
 *
 * Same vocabulary a ticket is raised against, deliberately: auto-assignment
 * matches a request's category to a staff member's, so a free-text list here
 * would silently never match anything.
 */
export function TicketCategoryMultiSelect({
  values,
  onChange,
  label = 'Categories handled',
}: {
  values: string[];
  onChange: (values: string[]) => void;
  label?: string;
}) {
  const categories = useQuery({
    queryKey: ['ticket-categories', 'active-for-picker'],
    queryFn: () => living.ticket.listCategories({ activeOnly: true }),
  });

  const rows = categories.data ?? [];
  const toggle = (key: string) =>
    onChange(values.includes(key) ? values.filter((v) => v !== key) : [...values, key]);

  return (
    <div>
      <span className="text-sm font-medium text-strong">{label}</span>
      <div className="mt-1.5 flex flex-wrap gap-1.5 rounded-control border border-border bg-raised p-2">
        {categories.isLoading ? (
          <span className="text-xs text-subtle">Loading categories…</span>
        ) : rows.length === 0 ? (
          <span className="text-xs text-subtle">
            No categories yet —{' '}
            <Link to="/categories" className="text-brand hover:underline">
              add one to the catalogue
            </Link>
            .
          </span>
        ) : (
          rows.map((category) => {
            const on = values.includes(category.key);
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => toggle(category.key)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  on ? 'bg-brand text-white' : 'bg-sunken text-muted hover:text-strong'
                }`}
                style={on && category.color ? { backgroundColor: category.color } : undefined}
              >
                {category.name}
              </button>
            );
          })
        )}
      </div>
      <p className="mt-1 text-xs text-subtle">
        Requests in these categories are auto-assigned to this staff member. Leave empty for
        manual assignment only.
      </p>
    </div>
  );
}

import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@living/utils';

/** Status pill. Never signal state by color alone — pair with a label/dot. */
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-pill font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'bg-sunken text-body',
        brand: 'bg-tint text-[var(--text-on-tint)]',
        success: 'bg-[var(--success-bg)] text-success-fg',
        warning: 'bg-[var(--warning-bg)] text-warning-fg',
        danger: 'bg-[var(--danger-bg)] text-danger-fg',
        info: 'bg-[var(--info-bg)] text-info-fg',
      },
      size: {
        sm: 'text-2xs px-2 py-0.5',
        md: 'text-xs px-2.5 py-1',
      },
    },
    defaultVariants: { tone: 'neutral', size: 'md' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({ className, tone, size, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone, size }), className)} {...props}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden />}
      {children}
    </span>
  );
}

export { badgeVariants };

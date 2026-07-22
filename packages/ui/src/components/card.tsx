import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@living/utils';

const cardVariants = cva('rounded-card', {
  variants: {
    variant: {
      elevated: 'bg-card border border-border-subtle shadow-sm',
      outline: 'bg-card border border-border',
      quiet: 'bg-sunken',
      glass: 'bg-[var(--surface-glass)] backdrop-blur-[18px] border border-border-subtle',
    },
    padded: { true: 'p-6', false: '' },
  },
  defaultVariants: { variant: 'elevated', padded: true },
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padded, ...props }, ref) => (
    <div ref={ref} className={cn(cardVariants({ variant, padded }), className)} {...props} />
  ),
);
Card.displayName = 'Card';

export const CardHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-1', className)} {...props} />
);

export const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn('text-h4 font-semibold tracking-tight text-strong', className)} {...props} />
);

export const CardDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn('text-sm text-muted', className)} {...props} />
);

export const CardContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('mt-4', className)} {...props} />
);

export const CardFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('mt-5 flex items-center gap-3', className)} {...props} />
);

export { cardVariants };

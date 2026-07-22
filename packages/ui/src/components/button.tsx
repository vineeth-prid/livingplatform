import { forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@living/utils';

/**
 * Living button. Primary = Pine, accent = Clay (one per view). Calm hover
 * (darken + lift), gentle press (scale via active:), never a color flash.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control font-sans font-semibold tracking-tight ' +
    'transition-[background-color,box-shadow,transform] duration-fast ease-standard ' +
    'focus-visible:outline-none focus-visible:shadow-ring active:scale-[0.98] ' +
    'disabled:pointer-events-none disabled:opacity-[0.42] select-none',
  {
    variants: {
      variant: {
        primary: 'bg-brand text-brand-fg shadow-sm hover:bg-brand-hover hover:shadow-md',
        accent: 'bg-accent text-accent-fg shadow-sm hover:bg-accent-hover hover:shadow-md',
        secondary:
          'bg-raised text-strong border border-border shadow-xs hover:bg-sunken',
        outline: 'border border-brand text-brand hover:bg-tint',
        ghost: 'text-brand hover:bg-tint',
        danger: 'bg-danger-solid text-white shadow-sm hover:brightness-95',
      },
      size: {
        sm: 'h-9 px-4 text-sm',
        md: 'h-11 px-[22px] text-base',
        lg: 'h-[54px] px-[30px] text-lg',
        icon: 'h-10 w-10',
      },
      block: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, asChild, loading, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, block }), className)}
        disabled={disabled ?? loading}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {children}
      </Comp>
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };

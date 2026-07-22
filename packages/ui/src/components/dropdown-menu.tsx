import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu';
import { cn } from '@living/utils';

export const DropdownMenu = DropdownPrimitive.Root;
export const DropdownMenuTrigger = DropdownPrimitive.Trigger;
export const DropdownMenuGroup = DropdownPrimitive.Group;

export function DropdownMenuContent({
  className,
  align = 'end',
  sideOffset = 6,
  ...props
}: DropdownPrimitive.DropdownMenuContentProps) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-[200px] overflow-hidden rounded-lg border border-border-subtle bg-card p-1.5 shadow-floating',
          'data-[state=open]:animate-fade-in',
          className,
        )}
        {...props}
      />
    </DropdownPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  inset,
  ...props
}: DropdownPrimitive.DropdownMenuItemProps & { inset?: boolean }) {
  return (
    <DropdownPrimitive.Item
      className={cn(
        'flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-2 text-sm text-body outline-none',
        'transition-colors focus:bg-sunken focus:text-strong data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        inset && 'pl-8',
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({ className, ...props }: DropdownPrimitive.DropdownMenuLabelProps) {
  return (
    <DropdownPrimitive.Label
      className={cn('px-2.5 py-1.5 text-2xs font-semibold uppercase tracking-wider text-subtle', className)}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({ className, ...props }: DropdownPrimitive.DropdownMenuSeparatorProps) {
  return (
    <DropdownPrimitive.Separator
      className={cn('my-1 h-px bg-border-subtle', className)}
      {...props}
    />
  );
}

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemeMode } from '@living/design-system';
import { cn } from '@living/utils';

const modes: { value: ThemeMode; icon: typeof Sun; label: string }[] = [
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'system', icon: Monitor, label: 'System' },
  { value: 'dark', icon: Moon, label: 'Dark' },
];

/** Segmented light / system / dark control. */
export function ThemeSwitch({ className }: { className?: string }) {
  const { mode, setMode } = useTheme();
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn('inline-flex items-center gap-0.5 rounded-pill bg-sunken p-0.5', className)}
    >
      {modes.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          role="radio"
          aria-checked={mode === value}
          aria-label={label}
          onClick={() => setMode(value)}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-full transition-colors',
            mode === value
              ? 'bg-card text-strong shadow-xs'
              : 'text-subtle hover:text-body',
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}

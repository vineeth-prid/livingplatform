import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Command } from 'cmdk';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Search } from 'lucide-react';
import { cn } from '@living/utils';

import { dialogContent, reduce, scrim } from '../motion';

export interface CommandAction {
  id: string;
  label: string;
  group?: string;
  icon?: ReactNode;
  keywords?: string[];
  perform: () => void;
}

interface CommandPaletteContextValue {
  open: () => void;
  close: () => void;
  toggle: () => void;
  register: (actions: CommandAction[]) => () => void;
}

const Ctx = createContext<CommandPaletteContextValue | null>(null);
const MotionContent = motion.create(DialogPrimitive.Content);

/**
 * Global command palette (⌘K / Ctrl-K). Any part of the app registers actions;
 * they're grouped and fuzzy-searched by cmdk. Keyboard-first, accessible.
 */
export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [actions, setActions] = useState<CommandAction[]>([]);
  const reduced = useReducedMotion() ?? false;

  const register = useCallback((next: CommandAction[]) => {
    setActions((prev) => [...prev, ...next]);
    return () => setActions((prev) => prev.filter((a) => !next.some((n) => n.id === a.id)));
  }, []);

  const value = useMemo<CommandPaletteContextValue>(
    () => ({
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      toggle: () => setIsOpen((o) => !o),
      register,
    }),
    [register],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, CommandAction[]>();
    for (const a of actions) {
      const key = a.group ?? 'Actions';
      map.set(key, [...(map.get(key) ?? []), a]);
    }
    return [...map.entries()];
  }, [actions]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <DialogPrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
        <AnimatePresence>
          {isOpen && (
            <DialogPrimitive.Portal forceMount>
              <motion.div
                variants={reduce(scrim, reduced)}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[var(--surface-scrim)] backdrop-blur-sm" />
              </motion.div>
              <MotionContent
                variants={reduce(dialogContent, reduced)}
                initial="initial"
                animate="animate"
                exit="exit"
                aria-label="Command palette"
                className={cn(
                  'fixed left-1/2 top-[18vh] z-50 w-[min(92vw,600px)] -translate-x-1/2',
                  'overflow-hidden rounded-xl border border-border-subtle bg-card shadow-floating',
                )}
              >
                <Command
                  className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-subtle"
                  loop
                >
                  <div className="flex items-center gap-2 border-b border-border-subtle px-4">
                    <Search className="h-4 w-4 text-subtle" />
                    <Command.Input
                      autoFocus
                      placeholder="Type a command or search…"
                      className="h-12 w-full bg-transparent text-sm text-strong placeholder:text-subtle outline-none"
                    />
                  </div>
                  <Command.List className="max-h-[340px] overflow-y-auto p-2">
                    <Command.Empty className="py-8 text-center text-sm text-muted">
                      No results.
                    </Command.Empty>
                    {groups.map(([group, groupActions]) => (
                      <Command.Group key={group} heading={group}>
                        {groupActions.map((a) => (
                          <Command.Item
                            key={a.id}
                            value={`${a.label} ${(a.keywords ?? []).join(' ')}`}
                            onSelect={() => {
                              setIsOpen(false);
                              a.perform();
                            }}
                            className="flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2.5 text-sm text-body outline-none data-[selected=true]:bg-sunken data-[selected=true]:text-strong"
                          >
                            {a.icon && <span className="text-muted">{a.icon}</span>}
                            {a.label}
                          </Command.Item>
                        ))}
                      </Command.Group>
                    ))}
                  </Command.List>
                </Command>
              </MotionContent>
            </DialogPrimitive.Portal>
          )}
        </AnimatePresence>
      </DialogPrimitive.Root>
    </Ctx.Provider>
  );
}

export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCommandPalette must be used within a <CommandPaletteProvider>');
  return ctx;
}

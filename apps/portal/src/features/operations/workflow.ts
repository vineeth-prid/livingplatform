import type { Permission } from '@living/types';

export interface StatusAction<S extends string> {
  to: S;
  label: string;
  permission: Permission;
  tone: 'default' | 'primary' | 'danger';
}

export interface WorkflowConfig<S extends string> {
  transitions: Record<S, S[]>;
  permissionFor: (to: S) => Permission;
  label: (from: S, to: S) => string;
  tone?: (to: S) => StatusAction<S>['tone'];
  /** Statuses handled by a dedicated action (e.g. WO VERIFIED via verify) — not
   *  offered in the generic status menu. */
  excludeFromMenu?: S[];
}

export interface Workflow<S extends string> {
  transitions: Record<S, S[]>;
  isTerminal: (status: S) => boolean;
  canTransition: (from: S, to: S) => boolean;
  allowedActions: (from: S, permissions: readonly string[]) => StatusAction<S>[];
}

/**
 * Generic status-workflow builder shared by Service Requests and Work Orders
 * (and mirrors the Ticket workflow's shape). Given a transition map and a
 * permission-per-target, it yields the valid **and** permitted next-status
 * actions — so no module's UI can offer a transition the backend would reject.
 */
export function createWorkflow<S extends string>(config: WorkflowConfig<S>): Workflow<S> {
  const exclude = new Set<S>(config.excludeFromMenu ?? []);
  const defaultTone = (to: S): StatusAction<S>['tone'] =>
    config.tone ? config.tone(to) : 'default';

  return {
    transitions: config.transitions,
    isTerminal: (status) => config.transitions[status].length === 0,
    canTransition: (from, to) => from !== to && config.transitions[from].includes(to),
    allowedActions: (from, permissions) => {
      const held = new Set(permissions);
      return config.transitions[from]
        .filter((to) => !exclude.has(to))
        .map((to) => ({
          to,
          label: config.label(from, to),
          permission: config.permissionFor(to),
          tone: defaultTone(to),
        }))
        .filter((a) => held.has(a.permission));
    },
  };
}

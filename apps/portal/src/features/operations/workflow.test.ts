import { describe, expect, it } from 'vitest';

import { createWorkflow } from './workflow';

type S = 'A' | 'B' | 'C' | 'D';

const wf = createWorkflow<S>({
  transitions: { A: ['B', 'D'], B: ['C', 'D'], C: [], D: ['B'] },
  permissionFor: (to) => (to === 'C' ? 'x:complete' : 'x:update'),
  label: (_from, to) => `Go ${to}`,
  tone: (to) => (to === 'D' ? 'danger' : 'default'),
  excludeFromMenu: ['D'],
});

describe('createWorkflow', () => {
  it('reports terminal + valid transitions', () => {
    expect(wf.isTerminal('C')).toBe(true);
    expect(wf.canTransition('A', 'B')).toBe(true);
    expect(wf.canTransition('A', 'C')).toBe(false);
  });

  it('excludes menu-excluded targets (dedicated actions) even if valid', () => {
    const tos = wf.allowedActions('A', ['x:update']).map((a) => a.to);
    expect(tos).toContain('B');
    expect(tos).not.toContain('D'); // excluded from menu
  });

  it('filters by permission per target', () => {
    expect(wf.allowedActions('B', ['x:update']).map((a) => a.to)).not.toContain('C');
    expect(wf.allowedActions('B', ['x:update', 'x:complete']).map((a) => a.to)).toContain('C');
  });
});

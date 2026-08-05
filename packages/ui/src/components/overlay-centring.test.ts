import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Guards the bug that put every dialog in every app partly off-screen.
 *
 * Framer Motion writes its animations to the element's inline `transform`, and
 * an inline style beats a class. So a component that both animates (scale, y…)
 * and relies on Tailwind's `-translate-x-1/2 -translate-y-1/2` to centre itself
 * loses the centring the instant the animation runs: the element's TOP-LEFT
 * CORNER ends up at the viewport centre, and the content overflows the right
 * and bottom edges. On a phone most of the dialog is simply unreachable.
 *
 * It survived a previous round of popup fixes because nothing about the CSS
 * looks wrong when read on its own — the conflict is only visible if you know
 * what the animation does to the same property.
 *
 * The fix is to centre with LAYOUT (a flex wrapper), leaving `transform` to the
 * animation. This test asserts that, in source, because the failure cannot be
 * caught by rendering in a jsdom-less workspace and is invisible to typecheck
 * and lint.
 */
/**
 * Comments are stripped before matching — these files *explain* the bug by
 * naming the classes that caused it, and the guard must read the code rather
 * than the prose describing it.
 */
const read = (file: string) =>
  readFileSync(join(__dirname, '..', file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

const ANIMATED_OVERLAYS = [
  ['dialog', 'components/dialog.tsx'],
  ['command palette', 'providers/command-palette.tsx'],
  ['sheet', 'components/sheet.tsx'],
] as const;

describe('animated overlays never centre with transform', () => {
  it.each(ANIMATED_OVERLAYS)('%s does not use translate-* for positioning', (_name, file) => {
    const source = read(file);
    // `-translate-x-1/2` / `translate-y-1/2` etc. Any Tailwind translate utility
    // on an element whose transform is animated is the bug.
    expect(source).not.toMatch(/(?:^|["'\s])-?translate-[xy]-/);
  });

  it.each(ANIMATED_OVERLAYS)('%s still constrains itself to the viewport', (_name, file) => {
    const source = read(file);
    // Either a max-height bound or an explicit dvh/full cap — a dialog with no
    // ceiling grows past the screen and its buttons become unreachable.
    expect(source).toMatch(/max-h-/);
  });

  it('the dialog centres with flex layout instead', () => {
    const source = read('components/dialog.tsx');
    expect(source).toMatch(/flex items-center justify-center/);
    // The wrapper must not swallow outside clicks, or Radix cannot close.
    expect(source).toMatch(/pointer-events-none/);
    expect(source).toMatch(/pointer-events-auto/);
  });
});

import { describe, expect, it } from 'vitest';
import { createModalManager } from '../../src/services/modals.ts';

describe('modal manager', () => {
  it('starts empty', () => {
    const modals = createModalManager();
    expect(modals.stack).toEqual([]);
    expect(modals.top).toBeUndefined();
    expect(modals.isOpen('move')).toBe(false);
  });

  it('opens modals in order and reports the topmost', () => {
    const modals = createModalManager();
    modals.open('move');
    modals.open('selector');
    expect([...modals.stack]).toEqual(['move', 'selector']);
    expect(modals.top).toBe('selector');
    expect(modals.isOpen('move')).toBe(true);
  });

  it('keeps the destination selector on top of move and reveals move again on close (Q-32)', () => {
    const modals = createModalManager();
    modals.open('move');
    modals.open('selector');
    modals.close('selector');
    expect(modals.top).toBe('move');
    expect(modals.isOpen('selector')).toBe(false);
    modals.close('move');
    expect(modals.top).toBeUndefined();
  });

  it('opening an open modal keeps its place', () => {
    const modals = createModalManager();
    modals.open('move');
    modals.open('selector');
    modals.open('move');
    expect([...modals.stack]).toEqual(['move', 'selector']);
  });

  it('closes a modal below the top without touching the others', () => {
    const modals = createModalManager();
    modals.open('a');
    modals.open('b');
    modals.open('c');
    modals.close('b');
    expect([...modals.stack]).toEqual(['a', 'c']);
  });

  it('ignores closing a modal that is not open', () => {
    const modals = createModalManager();
    modals.open('a');
    modals.close('zzz');
    expect([...modals.stack]).toEqual(['a']);
  });
});

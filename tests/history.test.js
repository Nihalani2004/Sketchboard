import { beforeEach, describe, expect, it } from 'vitest';
import { canRedo, canUndo, clear, push, redo, undo } from '../src/history.js';

beforeEach(() => clear());

describe('history', () => {
  it('moves snapshots through undo and redo stacks', () => {
    const first = [{ id: 'first' }];
    const second = [{ id: 'second' }];

    push(first);
    expect(canUndo()).toBe(true);
    expect(undo(second)).toEqual(first);
    expect(canRedo()).toBe(true);
    expect(redo(first)).toEqual(second);
  });

  it('clears redo history after a new edit', () => {
    push([{ id: 'first' }]);
    undo([{ id: 'second' }]);
    push([{ id: 'third' }]);

    expect(canRedo()).toBe(false);
    expect(redo([{ id: 'third' }])).toBeNull();
  });

  it('retains the most recent 100 undo snapshots', () => {
    for (let index = 0; index < 101; index += 1) {
      push([{ id: String(index) }]);
    }

    expect(undo([{ id: 'current' }])).toEqual([{ id: '100' }]);
    for (let index = 99; index > 0; index -= 1) undo([{ id: 'current' }]);
    expect(canUndo()).toBe(false);
  });
});

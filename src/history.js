/**
 * history.js — Undo/redo stack using deep snapshots of scene.js state.
 */

const MAX_HISTORY = 100;

let past = [];   // array of snapshots (each is an array of elements)
let future = []; // for redo

/** Push a new snapshot onto the undo stack; clears the redo stack. */
export function push(snapshot) {
  past.push(snapshot);
  if (past.length > MAX_HISTORY) past.shift();
  future = [];
}

/**
 * Undo: pop from past, return the previous snapshot.
 * Caller must pass the current snapshot for redo storage.
 */
export function undo(currentSnapshot) {
  if (past.length === 0) return null;
  future.push(currentSnapshot);
  return past.pop();
}

/**
 * Redo: pop from future, return that snapshot.
 * Caller must pass the current snapshot for undo storage.
 */
export function redo(currentSnapshot) {
  if (future.length === 0) return null;
  past.push(currentSnapshot);
  return future.pop();
}

export function canUndo() { return past.length > 0; }
export function canRedo() { return future.length > 0; }

export function clear() {
  past = [];
  future = [];
}

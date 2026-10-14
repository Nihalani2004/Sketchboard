/**
 * history.js — Undo/redo stack using deep snapshots of scene.js state.
 */

import { getActivePageId } from './scene.js';

const MAX_HISTORY = 100;

const histories = new Map();

function getHistory(pageId = getActivePageId()) {
  if (!histories.has(pageId)) histories.set(pageId, { past: [], future: [] });
  return histories.get(pageId);
}

/** Push a new snapshot onto the undo stack; clears the redo stack. */
export function push(snapshot, pageId) {
  const history = getHistory(pageId);
  history.past.push(snapshot);
  if (history.past.length > MAX_HISTORY) history.past.shift();
  history.future = [];
}

/**
 * Undo: pop from past, return the previous snapshot.
 * Caller must pass the current snapshot for redo storage.
 */
export function undo(currentSnapshot, pageId) {
  const history = getHistory(pageId);
  if (history.past.length === 0) return null;
  history.future.push(currentSnapshot);
  return history.past.pop();
}

/**
 * Redo: pop from future, return that snapshot.
 * Caller must pass the current snapshot for undo storage.
 */
export function redo(currentSnapshot, pageId) {
  const history = getHistory(pageId);
  if (history.future.length === 0) return null;
  history.past.push(currentSnapshot);
  return history.future.pop();
}

export function canUndo(pageId) { return getHistory(pageId).past.length > 0; }
export function canRedo(pageId) { return getHistory(pageId).future.length > 0; }

export function clear(pageId) {
  if (pageId) histories.delete(pageId);
  else histories.clear();
}

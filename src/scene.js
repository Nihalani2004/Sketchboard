/**
 * scene.js — Single source of truth for all drawable elements.
 * All tools read/write through this module; Konva nodes are views built from it.
 */

let elements = [];

/** Generate a unique ID for new elements */
export function generateId() {
  return `el_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Return a shallow copy of the elements array */
export function getElements() {
  return [...elements];
}

/** Add a new element; returns the added element */
export function addElement(el) {
  elements.push(el);
  return el;
}

/** Apply a partial patch to an element by id */
export function updateElement(id, patch) {
  const idx = elements.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  elements[idx] = { ...elements[idx], ...patch };
  return elements[idx];
}

/** Remove an element by id */
export function removeElement(id) {
  elements = elements.filter((e) => e.id !== id);
}

/** Replace the entire element array (used by undo/redo and import) */
export function setElements(newElements) {
  elements = newElements.map((e) => ({ ...e }));
}

/** Deep-clone current state (used by history) */
export function snapshot() {
  return elements.map((e) => ({ ...e }));
}

/** Serialize to JSON-compatible object for export */
export function serialize() {
  return {
    elements: snapshot(),
    version: 1,
  };
}

/** Deserialize from imported JSON */
export function deserialize(data) {
  if (!data || !Array.isArray(data.elements)) {
    throw new Error('Invalid Sketchboard JSON: missing elements array');
  }
  setElements(data.elements);
}

/** Default style for new elements */
export const DEFAULT_STYLE = {
  strokeColor: '#1e1e1e',
  backgroundColor: 'transparent',
  fillStyle: 'hachure',
  strokeWidth: 2,
  strokeStyle: 'solid',
  roughness: 2.0,
  opacity: 1,
  groupId: null,
  fontSize: 20,
  fontFamily: "'Caveat', cursive",
};

/** Create a new element object with defaults */
export function createElement(type, overrides = {}) {
  return {
    id: generateId(),
    type,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    points: [],
    angle: 0,
    seed: Math.floor(Math.random() * 100000),
    text: '',
    ...DEFAULT_STYLE,
    ...overrides,
  };
}

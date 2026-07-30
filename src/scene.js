/**
 * scene.js — Single source of truth for all drawable elements.
 * All tools read/write through this module; Konva nodes are views built from it.
 */

let elements = [];

/** Generate a unique ID for new elements */
export function generateId() {
  return `el_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Deep-clone a single element (handles nested arrays like `points`).
 */
function cloneElement(el) {
  const clone = {};
  for (const key of Object.keys(el)) {
    const val = el[key];
    if (Array.isArray(val)) {
      // Deep-clone arrays (handles nested arrays like [[x,y,p], ...])
      clone[key] = JSON.parse(JSON.stringify(val));
    } else {
      clone[key] = val;
    }
  }
  return clone;
}

/** Return a deep copy of the elements array */
export function getElements() {
  return elements.map(cloneElement);
}

/** Add a new element; returns the added element */
export function addElement(el) {
  elements.push(cloneElement(el));
  return el;
}

/** Apply a partial patch to an element by id */
export function updateElement(id, patch) {
  const idx = elements.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  elements[idx] = { ...elements[idx], ...patch };
  // Deep-clone any array values in the patch
  for (const key of Object.keys(patch)) {
    if (Array.isArray(patch[key])) {
      elements[idx][key] = JSON.parse(JSON.stringify(patch[key]));
    }
  }
  return { ...elements[idx] };
}

/** Remove an element by id */
export function removeElement(id) {
  elements = elements.filter((e) => e.id !== id);
}

/** Bring target elements to the front of the Z-index stack */
export function bringToFront(ids) {
  if (!ids || ids.length === 0) return;
  const targetIds = new Set(ids);
  const selected = elements.filter((e) => targetIds.has(e.id));
  const unselected = elements.filter((e) => !targetIds.has(e.id));
  elements = [...unselected, ...selected];
}

/** Send target elements to the back of the Z-index stack */
export function sendToBack(ids) {
  if (!ids || ids.length === 0) return;
  const targetIds = new Set(ids);
  const selected = elements.filter((e) => targetIds.has(e.id));
  const unselected = elements.filter((e) => !targetIds.has(e.id));
  elements = [...selected, ...unselected];
}

/** Move target elements forward one position */
export function bringForward(ids) {
  if (!ids || ids.length === 0) return;
  const targetIds = new Set(ids);
  for (let i = elements.length - 2; i >= 0; i--) {
    if (targetIds.has(elements[i].id) && !targetIds.has(elements[i + 1].id)) {
      const temp = elements[i];
      elements[i] = elements[i + 1];
      elements[i + 1] = temp;
    }
  }
}

/** Move target elements backward one position */
export function sendBackward(ids) {
  if (!ids || ids.length === 0) return;
  const targetIds = new Set(ids);
  for (let i = 1; i < elements.length; i++) {
    if (targetIds.has(elements[i].id) && !targetIds.has(elements[i - 1].id)) {
      const temp = elements[i];
      elements[i] = elements[i - 1];
      elements[i - 1] = temp;
    }
  }
}

/** Replace the entire element array (used by undo/redo and import) */
export function setElements(newElements) {
  elements = newElements.map(cloneElement);
}

/** Deep-clone current state (used by history) */
export function snapshot() {
  return elements.map(cloneElement);
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
  fillStyle: 'solid',
  strokeWidth: 2,
  strokeStyle: 'solid',
  roughness: 0,
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

/**
 * scene.js — Document and active-page source of truth for drawable elements.
 * Tools continue to use the active-page element API; documents can contain many pages.
 */

import { DEFAULT_CANVAS_SETTINGS, normalizeCanvasSettings } from './canvasSettings.js';

const DOCUMENT_VERSION = 2;
const MAX_TITLE_LENGTH = 80;

let documentState = createDocument();

export function generateId(prefix = 'el') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneValue(item)]));
  }
  return value;
}

function cloneElement(element) { return cloneValue(element); }
function clonePage(page) { return cloneValue(page); }

function normaliseTitle(title, fallback = 'Untitled page') {
  if (typeof title !== 'string') return fallback;
  const cleaned = title.trim().replace(/\s+/g, ' ').slice(0, MAX_TITLE_LENGTH);
  return cleaned || fallback;
}

function createPage(title = 'Page 1', overrides = {}) {
  return {
    id: overrides.id || generateId('page'),
    title: normaliseTitle(title, 'Page'),
    elements: Array.isArray(overrides.elements) ? overrides.elements.map(cloneElement) : [],
    canvasSettings: normalizeCanvasSettings(overrides.canvasSettings),
    viewport: normaliseViewport(overrides.viewport),
  };
}

function createDocument() {
  const page = createPage('Page 1');
  return { version: DOCUMENT_VERSION, activePageId: page.id, pages: [page] };
}

function normaliseViewport(value = {}) {
  const scale = Number.isFinite(value.scale) ? Math.max(0.05, Math.min(20, value.scale)) : 1;
  return {
    x: Number.isFinite(value.x) ? value.x : 0,
    y: Number.isFinite(value.y) ? value.y : 0,
    scale,
  };
}

function activePage() {
  const page = documentState.pages.find((item) => item.id === documentState.activePageId);
  if (page) return page;
  documentState.activePageId = documentState.pages[0].id;
  return documentState.pages[0];
}

export function getActivePageId() { return activePage().id; }
export function getPages() {
  return documentState.pages.map(({ id, title, canvasSettings, viewport, elements }) => ({
    id, title, canvasSettings: cloneValue(canvasSettings), viewport: cloneValue(viewport), elementCount: elements.length,
  }));
}
export function getActivePage() { return clonePage(activePage()); }

export function setActivePage(id) {
  if (!documentState.pages.some((page) => page.id === id)) return false;
  documentState.activePageId = id;
  return true;
}

export function addPage(options = {}) {
  const pageNumber = documentState.pages.length + 1;
  const page = createPage(options.title || `Page ${pageNumber}`, options);
  documentState.pages.push(page);
  documentState.activePageId = page.id;
  return getActivePage();
}

export function duplicatePage(id = getActivePageId()) {
  const source = documentState.pages.find((page) => page.id === id);
  if (!source) return null;
  const copy = createPage(`${source.title} copy`, {
    elements: source.elements,
    canvasSettings: source.canvasSettings,
    viewport: source.viewport,
  });
  const index = documentState.pages.indexOf(source);
  documentState.pages.splice(index + 1, 0, copy);
  documentState.activePageId = copy.id;
  return getActivePage();
}

export function renamePage(id, title) {
  const page = documentState.pages.find((item) => item.id === id);
  if (!page) return false;
  page.title = normaliseTitle(title, page.title);
  return true;
}

export function deletePage(id = getActivePageId()) {
  if (documentState.pages.length <= 1) return false;
  const index = documentState.pages.findIndex((page) => page.id === id);
  if (index === -1) return false;
  documentState.pages.splice(index, 1);
  if (documentState.activePageId === id) {
    documentState.activePageId = documentState.pages[Math.max(0, index - 1)].id;
  }
  return true;
}

export function getCanvasSettings() { return cloneValue(activePage().canvasSettings); }
export function updateCanvasSettings(patch) {
  const page = activePage();
  page.canvasSettings = normalizeCanvasSettings({ ...page.canvasSettings, ...patch });
  return getCanvasSettings();
}
export function getViewport() { return cloneValue(activePage().viewport); }
export function updateViewport(viewport) {
  activePage().viewport = normaliseViewport(viewport);
}

/** Return a deep copy of active-page elements. */
export function getElements() { return activePage().elements.map(cloneElement); }
export function addElement(element) { activePage().elements.push(cloneElement(element)); return element; }
export function updateElement(id, patch) {
  const elements = activePage().elements;
  const index = elements.findIndex((element) => element.id === id);
  if (index === -1) return null;
  elements[index] = { ...elements[index], ...cloneValue(patch) };
  return cloneElement(elements[index]);
}
export function removeElement(id) { activePage().elements = activePage().elements.filter((element) => element.id !== id); }
export function bringToFront(ids) {
  const selected = new Set(ids || []);
  const elements = activePage().elements;
  activePage().elements = [...elements.filter((element) => !selected.has(element.id)), ...elements.filter((element) => selected.has(element.id))];
}
export function sendToBack(ids) {
  const selected = new Set(ids || []);
  const elements = activePage().elements;
  activePage().elements = [...elements.filter((element) => selected.has(element.id)), ...elements.filter((element) => !selected.has(element.id))];
}
export function bringForward(ids) {
  const selected = new Set(ids || []); const elements = activePage().elements;
  for (let index = elements.length - 2; index >= 0; index--) if (selected.has(elements[index].id) && !selected.has(elements[index + 1].id)) [elements[index], elements[index + 1]] = [elements[index + 1], elements[index]];
}
export function sendBackward(ids) {
  const selected = new Set(ids || []); const elements = activePage().elements;
  for (let index = 1; index < elements.length; index++) if (selected.has(elements[index].id) && !selected.has(elements[index - 1].id)) [elements[index], elements[index - 1]] = [elements[index - 1], elements[index]];
}
export function setElements(elements) { activePage().elements = Array.isArray(elements) ? elements.map(cloneElement) : []; }
export function snapshot() { return getElements(); }

export function serialize() { return cloneValue(documentState); }

/** Import legacy v1 files and v2 multi-page documents. Validation happens in export.js. */
export function deserialize(data) {
  if (Array.isArray(data?.elements)) {
    const page = createPage('Page 1', { elements: data.elements, canvasSettings: data.appState?.canvasSettings, viewport: data.appState?.viewport });
    documentState = { version: DOCUMENT_VERSION, activePageId: page.id, pages: [page] };
    return;
  }
  if (!data || !Array.isArray(data.pages) || data.pages.length === 0) throw new Error('Invalid Sketchboard JSON: missing elements array or pages');
  const seen = new Set();
  const pages = data.pages.map((page, index) => {
    if (seen.has(page.id)) throw new Error(`Invalid Sketchboard JSON: duplicate page ${index + 1}`);
    seen.add(page.id);
    return createPage(page.title || `Page ${index + 1}`, page);
  });
  documentState = {
    version: DOCUMENT_VERSION,
    activePageId: pages.some((page) => page.id === data.activePageId) ? data.activePageId : pages[0].id,
    pages,
  };
}

export const DEFAULT_STYLE = {
  strokeColor: '#1e1e1e', backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 2,
  strokeStyle: 'solid', roughness: 0, opacity: 1, groupId: null, fontSize: 20, fontFamily: "'Caveat', cursive",
};

export function createElement(type, overrides = {}) {
  return { id: generateId(), type, x: 0, y: 0, width: 0, height: 0, points: [], angle: 0, seed: Math.floor(Math.random() * 100000), text: '', ...DEFAULT_STYLE, ...overrides };
}

export { DEFAULT_CANVAS_SETTINGS };

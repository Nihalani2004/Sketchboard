/** Durable, local-only recovery for the current Sketchboard document. */

import { validateImportData } from './export.js';

export const DRAFT_STORAGE_KEY = 'sketchboard:draft:v1';
const MAX_DRAFT_CHARS = 4 * 1024 * 1024;
const DEFAULT_DELAY_MS = 600;

function getBrowserStorage() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function createDraftStore({ storage = getBrowserStorage(), onStatus = () => {}, delay = DEFAULT_DELAY_MS } = {}) {
  let pendingSave = null;

  function report(status) { onStatus(status); }

  function removeInvalidDraft() {
    try { storage?.removeItem(DRAFT_STORAGE_KEY); } catch { /* Storage is unavailable. */ }
  }

  function restore() {
    if (!storage) { report('unavailable'); return null; }
    try {
      const raw = storage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return null;
      if (raw.length > MAX_DRAFT_CHARS) {
        removeInvalidDraft();
        report('discarded');
        return null;
      }
      const document = JSON.parse(raw);
      validateImportData(document);
      report('restored');
      return document;
    } catch {
      removeInvalidDraft();
      report('discarded');
      return null;
    }
  }

  function save(document) {
    if (!storage) { report('unavailable'); return false; }
    try {
      const serialized = JSON.stringify(document);
      if (serialized.length > MAX_DRAFT_CHARS) {
        report('too-large');
        return false;
      }
      storage.setItem(DRAFT_STORAGE_KEY, serialized);
      report('saved');
      return true;
    } catch {
      report('unavailable');
      return false;
    }
  }

  function schedule(document) {
    if (pendingSave) clearTimeout(pendingSave);
    pendingSave = setTimeout(() => {
      pendingSave = null;
      save(document);
    }, delay);
  }

  function flush(document) {
    if (pendingSave) {
      clearTimeout(pendingSave);
      pendingSave = null;
    }
    return save(document);
  }

  return { restore, save, schedule, flush };
}

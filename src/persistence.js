/** Local-only autosave and bounded recent-document recovery. */

import { validateImportData } from './export.js';

export const DRAFT_STORAGE_KEY = 'sketchboard:draft:v2';
export const RECENT_DOCUMENTS_STORAGE_KEY = 'sketchboard:recent-documents:v1';
export const MAX_RECENT_DOCUMENTS = 5;
const MAX_STORAGE_CHARS = 4 * 1024 * 1024;
const DEFAULT_DELAY_MS = 600;

function getBrowserStorage() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function createDraftId() {
  return `draft_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function documentTitle(document) {
  const activePage = document.pages?.find((page) => page.id === document.activePageId) || document.pages?.[0];
  return activePage?.title || 'Untitled board';
}

function toMetadata(record) {
  return { id: record.id, title: record.title, updatedAt: record.updatedAt, pageCount: record.document.pages.length };
}

function isValidRecord(record) {
  if (!record || typeof record !== 'object' || typeof record.id !== 'string' || typeof record.title !== 'string' || typeof record.updatedAt !== 'string') return false;
  try {
    validateImportData(record.document);
    return true;
  } catch {
    return false;
  }
}

export function createDraftStore({ storage = getBrowserStorage(), onStatus = () => {}, delay = DEFAULT_DELAY_MS } = {}) {
  let pendingSave = null;

  function report(status) { onStatus(status); }

  function getActiveId() {
    if (!storage) return null;
    try {
      const state = JSON.parse(storage.getItem(DRAFT_STORAGE_KEY) || 'null');
      return typeof state?.activeId === 'string' ? state.activeId : null;
    } catch {
      return null;
    }
  }

  function writeActiveId(activeId) {
    storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ version: 1, activeId }));
  }

  function readRecords() {
    if (!storage) return [];
    try {
      const raw = storage.getItem(RECENT_DOCUMENTS_STORAGE_KEY);
      if (raw && raw.length > MAX_STORAGE_CHARS) {
        storage.removeItem(RECENT_DOCUMENTS_STORAGE_KEY);
        report('discarded');
        return [];
      }
      const parsed = JSON.parse(raw || '[]');
      if (!Array.isArray(parsed)) return [];
      const records = parsed.filter(isValidRecord).sort((first, second) => second.updatedAt.localeCompare(first.updatedAt));
      if (records.length !== parsed.length) persistRecords(records);
      return records;
    } catch {
      try { storage.removeItem(RECENT_DOCUMENTS_STORAGE_KEY); } catch { /* Storage is unavailable. */ }
      return [];
    }
  }

  function persistRecords(records) {
    storage.setItem(RECENT_DOCUMENTS_STORAGE_KEY, JSON.stringify(records));
  }

  function listRecent() {
    if (!storage) { report('unavailable'); return []; }
    return readRecords().map(toMetadata);
  }

  function restore(id = null) {
    if (!storage) { report('unavailable'); return null; }
    const activeId = id || getActiveId();
    if (!activeId) {
      try {
        if (storage.getItem(DRAFT_STORAGE_KEY)) {
          storage.removeItem(DRAFT_STORAGE_KEY);
          report('discarded');
        }
      } catch { /* Storage is unavailable. */ }
      return null;
    }
    const record = readRecords().find((item) => item.id === activeId);
    if (!record) return null;
    try {
      validateImportData(record.document);
      writeActiveId(record.id);
      report('restored');
      return record.document;
    } catch {
      discard(record.id);
      report('discarded');
      return null;
    }
  }

  function save(document, { id = getActiveId() || createDraftId(), title = documentTitle(document) } = {}) {
    if (!storage) { report('unavailable'); return false; }
    try {
      validateImportData(document);
      const record = { id, title, updatedAt: new Date().toISOString(), document };
      const records = [record, ...readRecords().filter((item) => item.id !== id)].slice(0, MAX_RECENT_DOCUMENTS);

      while (JSON.stringify(records).length > MAX_STORAGE_CHARS && records.length > 1) records.pop();
      if (JSON.stringify(records).length > MAX_STORAGE_CHARS) {
        report('too-large');
        return false;
      }

      persistRecords(records);
      writeActiveId(id);
      report('saved');
      return true;
    } catch {
      report('unavailable');
      return false;
    }
  }

  function discard(id = getActiveId()) {
    if (!storage || !id) return false;
    try {
      const records = readRecords().filter((record) => record.id !== id);
      if (records.length === 0) storage.removeItem(RECENT_DOCUMENTS_STORAGE_KEY);
      else persistRecords(records);
      if (getActiveId() === id) storage.removeItem(DRAFT_STORAGE_KEY);
      return true;
    } catch {
      report('unavailable');
      return false;
    }
  }

  function startNew() {
    if (!storage) { report('unavailable'); return false; }
    try {
      storage.removeItem(DRAFT_STORAGE_KEY);
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

  return { discard, flush, getActiveId, listRecent, restore, save, schedule, startNew };
}

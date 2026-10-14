import { describe, expect, it } from 'vitest';
import { DRAFT_STORAGE_KEY, createDraftStore } from '../src/persistence.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

const validDocument = {
  version: 2,
  activePageId: 'page_1',
  pages: [{ id: 'page_1', title: 'Page 1', elements: [], canvasSettings: {}, viewport: {} }],
};

describe('draft persistence', () => {
  it('saves and restores a valid document locally', () => {
    const statuses = [];
    const store = createDraftStore({ storage: memoryStorage(), onStatus: (status) => statuses.push(status) });
    expect(store.save(validDocument)).toBe(true);
    expect(store.restore()).toEqual(validDocument);
    expect(statuses).toEqual(['saved', 'restored']);
  });

  it('discards malformed drafts without throwing', () => {
    const statuses = [];
    const storage = memoryStorage({ [DRAFT_STORAGE_KEY]: '{bad json' });
    const store = createDraftStore({ storage, onStatus: (status) => statuses.push(status) });
    expect(store.restore()).toBeNull();
    expect(storage.getItem(DRAFT_STORAGE_KEY)).toBeNull();
    expect(statuses).toEqual(['discarded']);
  });

  it('handles disabled browser storage safely', () => {
    const statuses = [];
    const store = createDraftStore({ storage: null, onStatus: (status) => statuses.push(status) });
    expect(store.save(validDocument)).toBe(false);
    expect(store.restore()).toBeNull();
    expect(statuses).toEqual(['unavailable', 'unavailable']);
  });
});

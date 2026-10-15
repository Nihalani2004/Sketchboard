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

  it('keeps a bounded recent-document list and restores the selected draft', () => {
    const storage = memoryStorage();
    const store = createDraftStore({ storage });
    const first = { ...validDocument, pages: [{ ...validDocument.pages[0], title: 'Planning' }] };
    const second = { ...validDocument, activePageId: 'page_2', pages: [{ ...validDocument.pages[0], id: 'page_2', title: 'Roadmap' }] };

    store.save(first, { id: 'draft_first' });
    store.save(second, { id: 'draft_second' });

    expect(store.listRecent().map((document) => document.title)).toEqual(['Roadmap', 'Planning']);
    expect(store.restore('draft_first')).toEqual(first);
    expect(store.getActiveId()).toBe('draft_first');
  });

  it('discards only the requested recent document', () => {
    const store = createDraftStore({ storage: memoryStorage() });
    store.save(validDocument, { id: 'keep' });
    store.save({ ...validDocument, activePageId: 'page_2', pages: [{ ...validDocument.pages[0], id: 'page_2', title: 'Other' }] }, { id: 'remove' });

    expect(store.discard('remove')).toBe(true);
    expect(store.listRecent().map((document) => document.id)).toEqual(['keep']);
  });

  it('starts a new draft without removing recent documents', () => {
    const store = createDraftStore({ storage: memoryStorage() });
    store.save(validDocument, { id: 'existing' });

    expect(store.startNew()).toBe(true);
    expect(store.getActiveId()).toBeNull();
    expect(store.listRecent().map((document) => document.id)).toEqual(['existing']);
  });
});

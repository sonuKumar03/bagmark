import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getSettings, saveSettings } from '../src/lib/config';
import { saveMetadata, getMetadata, getAllMetadata, deleteMetadata } from '../src/lib/storage';
import { BookmarkMetadata, DEFAULT_SETTINGS } from '../src/lib/types';

describe('storage & config', () => {
  let mockStore: Record<string, any> = {};

  beforeEach(() => {
    mockStore = {};
    (globalThis as any).browser = {
      storage: {
        local: {
          get: vi.fn(async (keys) => {
            if (typeof keys === 'string') {
              return { [keys]: mockStore[keys] };
            }
            if (Array.isArray(keys)) {
              const res: Record<string, any> = {};
              keys.forEach((k) => (res[k] = mockStore[k]));
              return res;
            }
            return { ...mockStore };
          }),
          set: vi.fn(async (items) => {
            Object.assign(mockStore, items);
          }),
          remove: vi.fn(async (keys) => {
            const list = Array.isArray(keys) ? keys : [keys];
            list.forEach((k) => delete mockStore[k]);
          }),
        },
      },
    };
  });

  it('retrieves default settings when nothing is stored', async () => {
    const settings = await getSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it('updates and persists settings', async () => {
    await saveSettings({ defaultFolderName: 'MyCustomBag', enableDateSubfolders: false });
    const updated = await getSettings();
    expect(updated.defaultFolderName).toBe('MyCustomBag');
    expect(updated.enableDateSubfolders).toBe(false);
  });

  it('saves, retrieves, and deletes metadata', async () => {
    const item: BookmarkMetadata = {
      id: 'bm_123',
      url: 'https://example.com',
      title: 'Example',
      dateAdded: Date.now(),
      folderId: 'folder_1',
      folderTitle: '2026-09',
      tags: ['reading'],
      quote: 'Interesting excerpt',
    };
    await saveMetadata(item);
    expect(await getMetadata('bm_123')).toEqual(item);

    const all = await getAllMetadata();
    expect(all['bm_123']).toEqual(item);

    await deleteMetadata('bm_123');
    expect(await getMetadata('bm_123')).toBeNull();
  });

  it('ignores non-metadata keys in getAllMetadata and returns null for missing key', async () => {
    await browser.storage.local.set({ random_key: 'foo', bagmark_settings: { defaultFolderName: 'BagMark' } });
    const all = await getAllMetadata();
    expect(all).toEqual({});

    expect(await getMetadata('non_existent')).toBeNull();
  });
});

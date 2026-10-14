import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ensureRootFolder,
  ensureDateSubfolder,
  getFolderHierarchy,
  saveBookmark,
  saveBookmarks,
} from '../src/lib/bookmarks';

describe('bookmarks operations', () => {
  let nodes: any[] = [];
  let metadata: Record<string, any> = {};

  beforeEach(() => {
    metadata = {};
    nodes = [
      {
        id: 'root________',
        title: '',
        children: [
          {
            id: 'unfiled_____',
            title: 'Other Bookmarks',
            children: [],
          },
        ],
      },
    ];

    (globalThis as any).browser = {
      storage: { local: { set: vi.fn(async (values: any) => Object.assign(metadata, values)) } },
      bookmarks: {
        get: vi.fn(async (id: string) => {
          const find = (items: any[]): any => {
            for (const item of items) {
              if (item.id === id) return item;
              const nested = item.children && find(item.children);
              if (nested) return nested;
            }
          };
          const node = find(nodes);
          if (!node) throw new Error('Folder not found');
          return [node];
        }),
        getTree: vi.fn(async () => nodes),
        getChildren: vi.fn(async (id: string) => {
          const find = (arr: any[]): any => {
            for (const n of arr) {
              if (n.id === id) return n.children || [];
              if (n.children) {
                const sub = find(n.children);
                if (sub) return sub;
              }
            }
            return null;
          };
          return find(nodes) || [];
        }),
        create: vi.fn(async (details: any) => {
          const newNode = {
            id: `id_${Date.now()}_${Math.random()}`,
            parentId: details.parentId,
            title: details.title,
            url: details.url,
            children: details.url ? undefined : [],
          };
          // add to parent
          const findAndAdd = (arr: any[]): boolean => {
            for (const n of arr) {
              if (n.id === details.parentId) {
                n.children = n.children || [];
                n.children.push(newNode);
                return true;
              }
              if (n.children && findAndAdd(n.children)) return true;
            }
            return false;
          };
          findAndAdd(nodes);
          return newNode;
        }),
      },
    };
  });

  it('creates root BagMark folder if it does not exist', async () => {
    const rootFolder = await ensureRootFolder('BagMark');
    expect(rootFolder.title).toBe('BagMark');
    // Calling again returns the existing folder
    const sameFolder = await ensureRootFolder('BagMark');
    expect(sameFolder.id).toBe(rootFolder.id);
  });

  it('creates and returns YYYY-MM subfolder under parent', async () => {
    const rootFolder = await ensureRootFolder('BagMark');
    const testDate = new Date(2026, 8, 30); // 2026-09
    const subfolder = await ensureDateSubfolder(rootFolder.id, testDate);
    expect(subfolder.title).toBe('2026-09');
    expect(subfolder.parentId).toBe(rootFolder.id);

    // Calling again returns same subfolder
    const again = await ensureDateSubfolder(rootFolder.id, testDate);
    expect(again.id).toBe(subfolder.id);
  });

  it('detects duplicate URLs accurately', async () => {
    const rootFolder = await ensureRootFolder('BagMark');
    await browser.bookmarks.create({
      parentId: rootFolder.id,
      title: 'Vite Guide',
      url: 'https://vite.dev/guide',
    });

    const dup = await saveBookmark({ url: 'https://vite.dev/guide?utm_source=docs', title: 'Vite', targetFolderId: rootFolder.id });
    expect(dup.isDuplicate).toBe(true);
    expect(dup.node.title).toBe('Vite Guide');
  });

  it('retrieves folder hierarchy excluding root node', async () => {
    const rootFolder = await ensureRootFolder('BagMark');
    await ensureDateSubfolder(rootFolder.id, new Date(2026, 8, 30));

    const folders = await getFolderHierarchy();
    expect(folders.length).toBeGreaterThanOrEqual(2);
    expect(folders.some((f) => f.id === 'root________')).toBe(false);
    expect(folders.some((f) => f.title === 'Other Bookmarks')).toBe(true);
    expect(folders.some((f) => f.title === 'BagMark')).toBe(true);
    expect(folders.some((f) => f.title === '2026-09')).toBe(true);

    const bagmarkFolder = folders.find((f) => f.title === 'BagMark');
    expect(bagmarkFolder?.path).toBe('Other Bookmarks / BagMark');
    const dateFolder = folders.find((f) => f.title === '2026-09');
    expect(dateFolder?.path).toBe('Other Bookmarks / BagMark / 2026-09');
  });

  it('saves new bookmark and returns duplicate flag if already exists', async () => {
    const result1 = await saveBookmark({
      url: 'https://developer.mozilla.org',
      title: 'MDN Web Docs',
      enableDateSubfolders: true,
      defaultFolderName: 'BagMark',
    });

    expect(result1.isDuplicate).toBe(false);
    expect(result1.node.title).toBe('MDN Web Docs');

    const result2 = await saveBookmark({
      url: 'https://developer.mozilla.org?utm_source=test',
      title: 'MDN Web Docs Dup',
      enableDateSubfolders: true,
      defaultFolderName: 'BagMark',
    });

    expect(result2.isDuplicate).toBe(true);
    expect(result2.node.id).toBe(result1.node.id);
  });

  it('saves bookmark directly into targetFolderId without date subfolder when disabled', async () => {
    const rootFolder = await ensureRootFolder('BagMark');
    const result = await saveBookmark({
      url: 'https://github.com',
      title: 'GitHub',
      targetFolderId: rootFolder.id,
      enableDateSubfolders: false,
    });

    expect(result.isDuplicate).toBe(false);
    expect(result.node.parentId).toBe(rootFolder.id);
  });

  it('falls back to first child if Other Bookmarks is not found in tree', async () => {
    nodes = [
      {
        id: 'root________',
        title: '',
        children: [
          {
            id: 'toolbar_____',
            title: 'Bookmarks Toolbar',
            children: [],
          },
        ],
      },
    ];

    const folder = await ensureRootFolder('MyFolder');
    expect(folder.title).toBe('MyFolder');
    expect(folder.parentId).toBe('toolbar_____');
  });

  it('saves into another folder even when the URL already exists elsewhere', async () => {
    await saveBookmark({ url: 'https://example.com', title: 'First', defaultFolderName: 'First' });
    const second = await saveBookmark({ url: 'https://example.com', title: 'Second', defaultFolderName: 'Second' });
    expect(second.isDuplicate).toBe(false);
    expect(second.node.title).toBe('Second');
    expect(second.folderTitle).toBe('Second');
  });

  it('compares tracking variants on both sides without replacing existing metadata', async () => {
    const first = await saveBookmark({ url: 'https://example.com?utm_source=first', title: 'Original', quote: 'Keep this quote' });
    const original = { ...metadata[`bagmark_meta_${first.node.id}`] };
    const second = await saveBookmark({ url: 'https://example.com?fbclid=second', title: 'Replacement', quote: 'Another quote' });
    expect(second.isDuplicate).toBe(true);
    expect(second.node.id).toBe(first.node.id);
    expect(metadata[`bagmark_meta_${first.node.id}`]).toEqual(original);
    expect(original.quote).toBe('Keep this quote');
  });

  it('checks the final date folder rather than the base folder', async () => {
    const base = await saveBookmark({ url: 'https://example.com', title: 'Base' });
    const dated = await saveBookmark({ url: 'https://example.com', title: 'Dated', enableDateSubfolders: true });
    expect(dated.isDuplicate).toBe(false);
    expect(dated.node.parentId).not.toBe(base.node.parentId);
    expect((await saveBookmark({ url: 'https://example.com', title: 'Again', enableDateSubfolders: true })).node.id).toBe(dated.node.id);
  });

  it('allows duplicates when prevention is disabled', async () => {
    const first = await saveBookmark({ url: 'https://example.com', title: 'First' });
    const second = await saveBookmark({ url: 'https://example.com', title: 'Second', warnDuplicates: false });
    expect(second.isDuplicate).toBe(false);
    expect(second.node.id).not.toBe(first.node.id);
  });

  it('serializes simultaneous saves including default and date folder creation', async () => {
    const [first, second] = await Promise.all([
      saveBookmark({ url: 'https://example.com', title: 'First', enableDateSubfolders: true }),
      saveBookmark({ url: 'https://example.com', title: 'Second', enableDateSubfolders: true }),
    ]);
    expect(first.isDuplicate).toBe(false);
    expect(second.isDuplicate).toBe(true);
    expect(second.node.id).toBe(first.node.id);
    expect(nodes[0].children[0].children).toHaveLength(1);
    expect(nodes[0].children[0].children[0].children).toHaveLength(1);
  });

  it('reads destination bookmarks once per batch and reports failures without stopping later saves', async () => {
    const folder = await ensureRootFolder();
    vi.mocked(browser.bookmarks.getChildren).mockClear();
    vi.mocked(browser.bookmarks.create).mockRejectedValueOnce(new Error('Failed save'));
    const results = await saveBookmarks([
      { url: 'https://failed.example', title: 'Failed', targetFolderId: folder.id },
      { url: 'https://example.com?utm_source=first', title: 'First', targetFolderId: folder.id },
      { url: 'https://example.com?gclid=second', title: 'Second', targetFolderId: folder.id },
    ]);
    expect(results[0]).toMatchObject({ error: new Error('Failed save') });
    expect(results[1]).toMatchObject({ isDuplicate: false });
    expect(results[2]).toMatchObject({ isDuplicate: true });
    expect(browser.bookmarks.getChildren).toHaveBeenCalledTimes(1);
    expect(nodes[0].children[0].children[0].children).toHaveLength(1);
    expect((await saveBookmark({ url: 'https://after.example', title: 'After', targetFolderId: folder.id })).isDuplicate).toBe(false);
  });

  it('uses Chromium Other Bookmarks regardless of its ID or language', async () => {
    nodes = [{ id: '0', title: '', children: [
      { id: '1', title: 'Favoritenleiste', children: [] },
      { id: '42', title: 'Weitere Lesezeichen', folderType: 'other', children: [] },
    ] }];

    const folder = await ensureRootFolder();
    expect(folder.parentId).toBe('42');
    expect((await ensureRootFolder()).id).toBe(folder.id);
  });

  it('routes right-click saves through destination deduplication and metadata storage', async () => {
    let click!: (info: any, tab?: any) => Promise<void>;
    const settings = { enableDateSubfolders: false, showNotifications: false };
    (browser.storage.local as any).get = vi.fn(async () => ({ bagmark_settings: settings }));
    (browser.storage as any).onChanged = { addListener: vi.fn() };
    (browser as any).runtime = { onInstalled: { addListener: vi.fn() }, onStartup: { addListener: vi.fn() } };
    (browser as any).contextMenus = { onClicked: { addListener: (handler: typeof click) => { click = handler; } } };
    vi.resetModules();
    await import('../src/background/index');

    const firstFolder = await ensureRootFolder('First');
    const secondFolder = await ensureRootFolder('Second');
    const info = { menuItemId: `bagmark_target_${firstFolder.id}`, pageUrl: 'https://example.com?utm_source=first', selectionText: 'Original quote' };
    await click(info, { title: 'Page title' });
    await click({ ...info, pageUrl: 'https://example.com?gclid=second', selectionText: 'Replacement quote' }, { title: 'New title' });
    await click({ ...info, menuItemId: `bagmark_target_${secondFolder.id}` }, { title: 'Other collection' });

    const firstChildren = await browser.bookmarks.getChildren(firstFolder.id);
    const secondChildren = await browser.bookmarks.getChildren(secondFolder.id);
    expect(firstChildren).toHaveLength(1);
    expect(secondChildren).toHaveLength(1);
    expect(metadata[`bagmark_meta_${firstChildren[0].id}`]).toMatchObject({ title: 'Page title', quote: 'Original quote', folderTitle: 'First' });
    expect(metadata[`bagmark_meta_${secondChildren[0].id}`]).toMatchObject({ title: 'Other collection', folderTitle: 'Second' });
  });

  it('excludes Chromium root and managed folders from folder choices', async () => {
    nodes = [{ id: '0', title: '', children: [
      { id: '1', title: 'Bookmarks bar', children: [] },
      { id: '2', title: 'Other bookmarks', folderType: 'other', children: [] },
      { id: '3', title: 'Company', unmodifiable: 'managed', children: [
        { id: '4', title: 'Policies' },
      ] },
    ] }];

    expect(await getFolderHierarchy()).toEqual([
      { id: '1', title: 'Bookmarks bar', path: 'Bookmarks bar' },
      { id: '2', title: 'Other bookmarks', path: 'Other bookmarks' },
    ]);
  });
});

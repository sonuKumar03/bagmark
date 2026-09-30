import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ensureRootFolder,
  ensureDateSubfolder,
  findDuplicateBookmark,
  getFolderHierarchy,
  saveBookmark,
} from '../src/lib/bookmarks';

describe('bookmarks operations', () => {
  let nodes: any[] = [];

  beforeEach(() => {
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
      bookmarks: {
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
            return [];
          };
          return find(nodes);
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
        search: vi.fn(async (query: any) => {
          const matches: any[] = [];
          const traverse = (arr: any[]) => {
            for (const n of arr) {
              if (query.url && n.url === query.url) matches.push(n);
              if (n.children) traverse(n.children);
            }
          };
          traverse(nodes);
          return matches;
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

    const dup = await findDuplicateBookmark('https://vite.dev/guide?utm_source=docs');
    expect(dup).not.toBeNull();
    expect(dup?.title).toBe('Vite Guide');
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

  it('returns null when duplicate URL is not found', async () => {
    const dup = await findDuplicateBookmark('https://nonexistent.org');
    expect(dup).toBeNull();
  });
});

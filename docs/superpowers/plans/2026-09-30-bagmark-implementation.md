# BagMark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build "BagMark", an advanced Firefox extension using Vite + TypeScript that enables right-click bookmark saving to custom or default folders, chronological/date tracking (with optional `YYYY-MM` subfolders), rich metadata capture (source URL, quote selection), duplicate link detection, and an interactive popup dashboard.

**Architecture:** A multi-page WebExtension MV3 architecture built with Vite. A background script manages Firefox context menus, bookmark operations, and metadata synchronization. Modular core libraries (`src/lib/`) handle typed storage, bookmark tree resolution, and date formatting with test coverage. Responsive popup and options pages provide search, recent feed, and folder customization.

**Tech Stack:** TypeScript, Vite, Vitest, `@types/firefox-webext-browser`, `web-ext`.

**Spec:** [docs/superpowers/specs/2026-09-30-bagmark-design.md](file:///Users/sonukumar/project/bag-bookmark/docs/superpowers/specs/2026-09-30-bagmark-design.md)

## Global Constraints
- Target platform: Firefox WebExtension (Manifest V3 compatible with Firefox background scripts)
- Language & Tooling: TypeScript with strict mode, Vite bundler
- Testing: Vitest for unit tests of utilities, bookmark logic, and storage helpers
- Firefox APIs used: `browser.bookmarks`, `browser.menus`, `browser.storage.local`, `browser.notifications`, `browser.tabs`
- Naming: Extension name "BagMark", root default folder "BagMark", context menu action "Bag It" / "Save to BagMark"

---

### Task 1: Project Scaffolding & Configuration

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `manifest.json`
- Create: `.gitignore`

**Interfaces:**
- Produces: Working build pipeline via `npm run build` outputting to `dist/` and test runner via `npm run test`.

- [ ] **Step 1: Create `.gitignore`**

```gitignore
node_modules/
dist/
*.log
.DS_Store
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "bag-bookmark",
  "version": "1.0.0",
  "description": "Advanced Firefox bookmark extension with date tracking, custom folders, and context menu quick-save",
  "type": "module",
  "scripts": {
    "dev": "vite build --watch",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@types/firefox-webext-browser": "^0.1.38",
    "@types/node": "^22.0.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "types": ["@types/firefox-webext-browser", "vitest/globals"]
  },
  "include": ["src/**/*", "tests/**/*", "vite.config.ts"]
}
```

- [ ] **Step 4: Create `manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "BagMark - Advanced Bookmarks",
  "version": "1.0.0",
  "description": "Right-click to save bookmarks to custom or date-based folders with rich metadata.",
  "permissions": [
    "bookmarks",
    "menus",
    "storage",
    "notifications",
    "tabs"
  ],
  "background": {
    "scripts": ["src/background/index.ts"],
    "type": "module"
  },
  "action": {
    "default_popup": "src/popup/index.html",
    "default_title": "BagMark Dashboard"
  },
  "options_ui": {
    "page": "src/options/index.html",
    "open_in_tab": true
  },
  "browser_specific_settings": {
    "gecko": {
      "id": "bagmark@local.extension",
      "strict_min_version": "109.0"
    }
  }
}
```

- [ ] **Step 5: Create `vite.config.ts`**

```typescript
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        options: resolve(__dirname, 'src/options/index.html'),
        background: resolve(__dirname, 'src/background/index.ts')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') {
            return 'background.js';
          }
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  }
});
```

- [ ] **Step 6: Install dependencies & verify build toolchain**

Run: `rtk npm install`
Expected: Dependencies installed successfully.

- [ ] **Step 7: Commit scaffolding**

```bash
rtk git add .gitignore package.json tsconfig.json manifest.json vite.config.ts package-lock.json
rtk git commit -m "chore: setup project structure, manifest, and Vite build configuration"
```

---

### Task 2: Core Types & Utility Modules (TDD)

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/lib/utils.ts`
- Test: `tests/utils.test.ts`

**Interfaces:**
- Produces:
  - `BookmarkMetadata` interface
  - `BagMarkSettings` interface
  - `formatYearMonth(date: Date): string`
  - `formatRelativeTime(timestamp: number, now?: number): string`
  - `formatDisplayDate(timestamp: number): string`
  - `normalizeUrl(rawUrl: string): string`

- [ ] **Step 1: Create `src/lib/types.ts`**

```typescript
export interface BookmarkMetadata {
  id: string;              // Firefox bookmark ID
  url: string;             // Destination URL
  title: string;           // Bookmark title
  dateAdded: number;       // Epoch milliseconds
  folderId: string;        // Destination folder ID
  folderTitle: string;     // Destination folder name (e.g. "2026-09" or "Dev")
  sourcePageUrl?: string;  // Page where the link was found
  sourcePageTitle?: string;// Title of originating webpage
  quote?: string;          // Selected text excerpt
  tags: string[];          // User tags
}

export interface BagMarkSettings {
  defaultFolderName: string;     // Default: "BagMark"
  enableDateSubfolders: boolean; // Default: true (YYYY-MM)
  warnDuplicates: boolean;       // Default: true
  favoriteFolderIds: string[];   // Pinned folder IDs for submenu
  showNotifications: boolean;    // Default: true
}

export const DEFAULT_SETTINGS: BagMarkSettings = {
  defaultFolderName: 'BagMark',
  enableDateSubfolders: true,
  warnDuplicates: true,
  favoriteFolderIds: [],
  showNotifications: true,
};
```

- [ ] **Step 2: Write failing unit tests in `tests/utils.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { formatYearMonth, formatRelativeTime, formatDisplayDate, normalizeUrl } from '../src/lib/utils';

describe('utils', () => {
  it('formats Date to YYYY-MM', () => {
    const d = new Date(2026, 8, 30); // Month is 0-indexed (8 = September)
    expect(formatYearMonth(d)).toBe('2026-09');
  });

  it('normalizes URLs by stripping trailing slashes and common tracking parameters', () => {
    const raw = 'https://example.com/article/?utm_source=twitter&utm_medium=social#heading';
    expect(normalizeUrl(raw)).toBe('https://example.com/article');
  });

  it('formats relative time for recent timestamps', () => {
    const now = 1790800000000;
    const tenMinutesAgo = now - 10 * 60 * 1000;
    const twoDaysAgo = now - 2 * 24 * 60 * 60 * 1000;
    expect(formatRelativeTime(tenMinutesAgo, now)).toBe('10m ago');
    expect(formatRelativeTime(twoDaysAgo, now)).toBe('2d ago');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `rtk npm test`
Expected: FAIL ("Cannot find module '../src/lib/utils'")

- [ ] **Step 4: Implement `src/lib/utils.ts`**

```typescript
export function formatYearMonth(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function formatDisplayDate(timestamp: number): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).format(new Date(timestamp));
}

export function formatRelativeTime(timestamp: number, now: number = Date.now()): string {
  const diffSec = Math.floor((now - timestamp) / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth}mo ago`;
  return `${Math.floor(diffMonth / 12)}y ago`;
}

export function normalizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    // Strip common tracking parameters
    const paramsToDelete: string[] = [];
    url.searchParams.forEach((_, key) => {
      if (key.startsWith('utm_') || key === 'ref' || key === 'fbclid' || key === 'gclid') {
        paramsToDelete.push(key);
      }
    });
    paramsToDelete.forEach((key) => url.searchParams.delete(key));
    // Remove hash
    url.hash = '';
    // Strip trailing slash if pathname ends with /
    let clean = url.toString();
    if (clean.endsWith('/') && url.pathname !== '/') {
      clean = clean.slice(0, -1);
    }
    return clean;
  } catch {
    return rawUrl.trim();
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `rtk npm test`
Expected: PASS

- [ ] **Step 6: Commit utilities**

```bash
rtk git add src/lib/types.ts src/lib/utils.ts tests/utils.test.ts
rtk git commit -m "feat: add types and utility functions with unit tests"
```

---

### Task 3: Storage & Configuration Management (TDD)

**Files:**
- Create: `src/lib/storage.ts`
- Create: `src/lib/config.ts`
- Test: `tests/storage.test.ts`

**Interfaces:**
- Consumes: `BookmarkMetadata`, `BagMarkSettings`, `DEFAULT_SETTINGS` from `src/lib/types.ts`
- Produces:
  - `getSettings(): Promise<BagMarkSettings>`
  - `saveSettings(settings: Partial<BagMarkSettings>): Promise<BagMarkSettings>`
  - `saveMetadata(metadata: BookmarkMetadata): Promise<void>`
  - `getMetadata(bookmarkId: string): Promise<BookmarkMetadata | null>`
  - `getAllMetadata(): Promise<Record<string, BookmarkMetadata>>`
  - `deleteMetadata(bookmarkId: string): Promise<void>`

- [ ] **Step 1: Write failing tests in `tests/storage.test.ts`**

```typescript
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npm test`
Expected: FAIL

- [ ] **Step 3: Implement `src/lib/config.ts`**

```typescript
import { BagMarkSettings, DEFAULT_SETTINGS } from './types';

const SETTINGS_KEY = 'bagmark_settings';

export async function getSettings(): Promise<BagMarkSettings> {
  const result = await browser.storage.local.get(SETTINGS_KEY);
  if (!result || !result[SETTINGS_KEY]) {
    return { ...DEFAULT_SETTINGS };
  }
  return { ...DEFAULT_SETTINGS, ...result[SETTINGS_KEY] };
}

export async function saveSettings(partial: Partial<BagMarkSettings>): Promise<BagMarkSettings> {
  const current = await getSettings();
  const merged: BagMarkSettings = { ...current, ...partial };
  await browser.storage.local.set({ [SETTINGS_KEY]: merged });
  return merged;
}
```

- [ ] **Step 4: Implement `src/lib/storage.ts`**

```typescript
import { BookmarkMetadata } from './types';

const METADATA_PREFIX = 'bagmark_meta_';

export async function saveMetadata(metadata: BookmarkMetadata): Promise<void> {
  const key = `${METADATA_PREFIX}${metadata.id}`;
  await browser.storage.local.set({ [key]: metadata });
}

export async function getMetadata(bookmarkId: string): Promise<BookmarkMetadata | null> {
  const key = `${METADATA_PREFIX}${bookmarkId}`;
  const res = await browser.storage.local.get(key);
  return res && res[key] ? (res[key] as BookmarkMetadata) : null;
}

export async function getAllMetadata(): Promise<Record<string, BookmarkMetadata>> {
  const all = await browser.storage.local.get(null);
  const metadataMap: Record<string, BookmarkMetadata> = {};
  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith(METADATA_PREFIX)) {
      const meta = value as BookmarkMetadata;
      metadataMap[meta.id] = meta;
    }
  }
  return metadataMap;
}

export async function deleteMetadata(bookmarkId: string): Promise<void> {
  const key = `${METADATA_PREFIX}${bookmarkId}`;
  await browser.storage.local.remove(key);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `rtk npm test`
Expected: PASS

- [ ] **Step 6: Commit storage & config**

```bash
rtk git add src/lib/config.ts src/lib/storage.ts tests/storage.test.ts
rtk git commit -m "feat: implement configuration and metadata storage with unit tests"
```

---

### Task 4: Bookmark Hierarchy & Date Organization Operations (TDD)

**Files:**
- Create: `src/lib/bookmarks.ts`
- Test: `tests/bookmarks.test.ts`

**Interfaces:**
- Consumes: `normalizeUrl`, `formatYearMonth` from `src/lib/utils.ts`
- Produces:
  - `ensureRootFolder(name: string): Promise<browser.bookmarks.BookmarkTreeNode>`
  - `ensureDateSubfolder(parentId: string, date?: Date): Promise<browser.bookmarks.BookmarkTreeNode>`
  - `findDuplicateBookmark(rawUrl: string): Promise<browser.bookmarks.BookmarkTreeNode | null>`
  - `getFolderHierarchy(): Promise<Array<{ id: string; title: string; path: string }>>`
  - `saveBookmark(details: SaveBookmarkInput): Promise<{ node: browser.bookmarks.BookmarkTreeNode; isDuplicate: boolean }>`

- [ ] **Step 1: Write failing tests in `tests/bookmarks.test.ts`**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ensureRootFolder, ensureDateSubfolder, findDuplicateBookmark } from '../src/lib/bookmarks';

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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npm test`
Expected: FAIL

- [ ] **Step 3: Implement `src/lib/bookmarks.ts`**

```typescript
import { formatYearMonth, normalizeUrl } from './utils';

export interface SaveBookmarkInput {
  url: string;
  title: string;
  targetFolderId?: string;
  enableDateSubfolders?: boolean;
  defaultFolderName?: string;
}

export async function ensureRootFolder(name: string = 'BagMark'): Promise<browser.bookmarks.BookmarkTreeNode> {
  const tree = await browser.bookmarks.getTree();
  // Find "unfiled" (Other Bookmarks) or fallback to root children
  let parentId = 'unfiled_____';
  if (tree[0]?.children) {
    const other = tree[0].children.find(
      (c) => c.id === 'unfiled_____' || c.title.toLowerCase().includes('other')
    );
    if (other) {
      parentId = other.id;
    } else if (tree[0].children[0]) {
      parentId = tree[0].children[0].id;
    }
  }

  // Look for existing folder with `name` under parentId
  const siblings = await browser.bookmarks.getChildren(parentId);
  const existing = siblings.find((item) => !item.url && item.title === name);
  if (existing) {
    return existing;
  }

  return await browser.bookmarks.create({
    parentId,
    title: name,
  });
}

export async function ensureDateSubfolder(
  parentId: string,
  date: Date = new Date()
): Promise<browser.bookmarks.BookmarkTreeNode> {
  const folderName = formatYearMonth(date);
  const children = await browser.bookmarks.getChildren(parentId);
  const existing = children.find((c) => !c.url && c.title === folderName);
  if (existing) {
    return existing;
  }

  return await browser.bookmarks.create({
    parentId,
    title: folderName,
  });
}

export async function findDuplicateBookmark(
  rawUrl: string
): Promise<browser.bookmarks.BookmarkTreeNode | null> {
  const cleanUrl = normalizeUrl(rawUrl);
  // Search exact raw URL first
  let results = await browser.bookmarks.search({ url: rawUrl });
  if (results && results.length > 0) return results[0];

  // If cleanUrl is different, search clean URL
  if (cleanUrl !== rawUrl) {
    results = await browser.bookmarks.search({ url: cleanUrl });
    if (results && results.length > 0) return results[0];
  }

  return null;
}

export async function getFolderHierarchy(): Promise<Array<{ id: string; title: string; path: string }>> {
  const tree = await browser.bookmarks.getTree();
  const folders: Array<{ id: string; title: string; path: string }> = [];

  function traverse(nodes: browser.bookmarks.BookmarkTreeNode[], currentPath: string) {
    for (const node of nodes) {
      if (!node.url) {
        const nextPath = currentPath ? `${currentPath} / ${node.title || 'Bookmarks'}` : (node.title || 'Bookmarks');
        if (node.id !== 'root________') {
          folders.push({ id: node.id, title: node.title || 'Folder', path: nextPath });
        }
        if (node.children) {
          traverse(node.children, nextPath);
        }
      }
    }
  }

  traverse(tree, '');
  return folders;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `rtk npm test`
Expected: PASS

- [ ] **Step 5: Commit bookmark logic**

```bash
rtk git add src/lib/bookmarks.ts tests/bookmarks.test.ts
rtk git commit -m "feat: implement bookmark tree and date subfolder operations with unit tests"
```

---

### Task 5: Background Event Script & Context Menus

**Files:**
- Create: `src/background/index.ts`

**Interfaces:**
- Consumes: `ensureRootFolder`, `ensureDateSubfolder`, `findDuplicateBookmark` from `src/lib/bookmarks.ts`, `saveMetadata` from `src/lib/storage.ts`, `getSettings` from `src/lib/config.ts`.
- Sets up Firefox context menus and listens to click events.

- [ ] **Step 1: Implement `src/background/index.ts`**

```typescript
import { ensureRootFolder, ensureDateSubfolder, findDuplicateBookmark } from '../lib/bookmarks';
import { getSettings } from '../lib/config';
import { saveMetadata } from '../lib/storage';
import { BookmarkMetadata } from '../lib/types';
import { formatDisplayDate } from '../lib/utils';

const QUICK_SAVE_ID = 'bagmark_quick_save';
const SUBMENU_ROOT_ID = 'bagmark_submenu_root';

async function updateContextMenus() {
  await browser.menus.removeAll();

  const settings = await getSettings();

  // 1. Top-level 1-click Quick Save to default folder
  browser.menus.create({
    id: QUICK_SAVE_ID,
    title: `Bag It (Save to ${settings.defaultFolderName})`,
    contexts: ['link', 'page', 'selection'],
  });

  // 2. Submenu for custom / favorite folders
  if (settings.favoriteFolderIds && settings.favoriteFolderIds.length > 0) {
    browser.menus.create({
      id: SUBMENU_ROOT_ID,
      title: 'Bag It to ▸',
      contexts: ['link', 'page', 'selection'],
    });

    for (const folderId of settings.favoriteFolderIds) {
      try {
        const nodes = await browser.bookmarks.get(folderId);
        if (nodes && nodes[0]) {
          browser.menus.create({
            id: `bagmark_target_${folderId}`,
            parentId: SUBMENU_ROOT_ID,
            title: nodes[0].title,
            contexts: ['link', 'page', 'selection'],
          });
        }
      } catch (err) {
        console.warn(`Could not load favorite folder ${folderId}:`, err);
      }
    }
  }
}

async function handleSaveAction(
  info: browser.menus.OnClickData,
  tab?: browser.tabs.Tab
) {
  const settings = await getSettings();
  const targetUrl = info.linkUrl || info.pageUrl || tab?.url;
  if (!targetUrl) return;

  const targetTitle = info.linkText || tab?.title || targetUrl;
  const quote = info.selectionText || undefined;
  const sourcePageUrl = info.pageUrl;
  const sourcePageTitle = tab?.title;

  // Duplicate Check
  if (settings.warnDuplicates) {
    const duplicate = await findDuplicateBookmark(targetUrl);
    if (duplicate) {
      if (settings.showNotifications) {
        const addedDate = duplicate.dateAdded ? formatDisplayDate(duplicate.dateAdded) : 'previously';
        browser.notifications.create({
          type: 'basic',
          iconUrl: 'assets/icon-48.png',
          title: 'Already in BagMark!',
          message: `"${duplicate.title}" was already saved on ${addedDate}.`,
        });
      }
      return;
    }
  }

  // Determine base folder
  let baseFolderId: string;
  let baseFolderTitle: string = settings.defaultFolderName;

  if (info.menuItemId.toString().startsWith('bagmark_target_')) {
    baseFolderId = info.menuItemId.toString().replace('bagmark_target_', '');
    const folderNodes = await browser.bookmarks.get(baseFolderId);
    baseFolderTitle = folderNodes[0]?.title || 'Folder';
  } else {
    const rootNode = await ensureRootFolder(settings.defaultFolderName);
    baseFolderId = rootNode.id;
    baseFolderTitle = rootNode.title;
  }

  // Determine destination folder (auto-date subfolder if enabled)
  let destFolderId = baseFolderId;
  let destFolderTitle = baseFolderTitle;

  if (settings.enableDateSubfolders) {
    const dateNode = await ensureDateSubfolder(baseFolderId, new Date());
    destFolderId = dateNode.id;
    destFolderTitle = `${baseFolderTitle} / ${dateNode.title}`;
  }

  // Create Bookmark
  const newBookmark = await browser.bookmarks.create({
    parentId: destFolderId,
    title: targetTitle,
    url: targetUrl,
  });

  // Store Rich Metadata
  const metadata: BookmarkMetadata = {
    id: newBookmark.id,
    url: targetUrl,
    title: targetTitle,
    dateAdded: newBookmark.dateAdded || Date.now(),
    folderId: destFolderId,
    folderTitle: destFolderTitle,
    sourcePageUrl,
    sourcePageTitle,
    quote,
    tags: [],
  };
  await saveMetadata(metadata);

  // Notification confirmation
  if (settings.showNotifications) {
    browser.notifications.create({
      type: 'basic',
      iconUrl: 'assets/icon-48.png',
      title: 'Bagged Successfully! 🎒',
      message: `Saved "${targetTitle}" to ${destFolderTitle}`,
    });
  }
}

browser.runtime.onInstalled.addListener(async () => {
  await updateContextMenus();
});

browser.runtime.onStartup.addListener(async () => {
  await updateContextMenus();
});

browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes['bagmark_settings']) {
    updateContextMenus();
  }
});

browser.menus.onClicked.addListener((info, tab) => {
  handleSaveAction(info, tab);
});
```

- [ ] **Step 2: Commit background script**

```bash
rtk git add src/background/index.ts
rtk git commit -m "feat: implement background context menu registration and save handler"
```

---

### Task 6: Popup Dashboard UI

**Files:**
- Create: `src/popup/index.html`
- Create: `src/popup/popup.ts`
- Create: `src/popup/popup.css`

**Features:**
- Real-time search filter across saved bookmarks (title, URL, quote, tags)
- Relative time badges (`"5m ago"`, `"Yesterday"`)
- Folder location chips
- Quick actions: Copy URL, Open in new tab, Delete
- Link to Options / Settings page

- [ ] **Step 1: Create `src/popup/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>BagMark</title>
  <link rel="stylesheet" href="./popup.css" />
</head>
<body>
  <header class="app-header">
    <div class="logo-area">
      <span class="logo-icon">🎒</span>
      <h1>BagMark</h1>
    </div>
    <div class="header-actions">
      <button id="btnOptions" class="icon-btn" title="Settings">⚙️</button>
    </div>
  </header>

  <div class="search-bar">
    <input type="text" id="searchInput" placeholder="Search saved links, tags, quotes..." autofocus />
  </div>

  <div class="stats-bar">
    <span id="bookmarkCount">Loading...</span>
    <select id="folderFilter">
      <option value="all">All Folders</option>
    </select>
  </div>

  <main id="bookmarkList" class="bookmark-list">
    <!-- Rendered dynamically -->
  </main>

  <script type="module" src="./popup.ts"></script>
</body>
</html>
```

- [ ] **Step 2: Create `src/popup/popup.css`**

```css
:root {
  --bg-color: #1e1e24;
  --card-bg: #2b2b36;
  --card-hover: #343442;
  --text-main: #f3f4f6;
  --text-muted: #9ca3af;
  --accent: #f59e0b;
  --accent-hover: #d97706;
  --border: #3f3f4e;
  --danger: #ef4444;
  --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

body {
  width: 380px;
  max-height: 560px;
  margin: 0;
  padding: 12px;
  background-color: var(--bg-color);
  color: var(--text-main);
  font-family: var(--font-family);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.logo-area {
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo-icon {
  font-size: 20px;
}

h1 {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
  color: var(--text-main);
}

.icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  padding: 4px;
  border-radius: 4px;
}

.icon-btn:hover {
  background: var(--card-bg);
}

.search-bar input {
  width: 100%;
  padding: 8px 12px;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-main);
  font-size: 13px;
  box-sizing: border-box;
}

.search-bar input:focus {
  outline: 2px solid var(--accent);
  border-color: transparent;
}

.stats-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: var(--text-muted);
  margin: 10px 0 6px 0;
}

.stats-bar select {
  background: var(--card-bg);
  color: var(--text-main);
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 11px;
  padding: 2px 6px;
}

.bookmark-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  max-height: 400px;
  padding-right: 4px;
}

.bookmark-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: background 0.15s ease;
}

.bookmark-card:hover {
  background: var(--card-hover);
}

.card-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main);
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-title:hover {
  color: var(--accent);
}

.card-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: var(--text-muted);
}

.folder-badge {
  background: var(--border);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  color: var(--text-main);
}

.quote-snippet {
  font-size: 11px;
  font-style: italic;
  color: var(--text-muted);
  background: rgba(0, 0, 0, 0.2);
  padding: 4px 8px;
  border-left: 2px solid var(--accent);
  border-radius: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

.action-btn {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-muted);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 10px;
  cursor: pointer;
}

.action-btn:hover {
  color: var(--text-main);
  border-color: var(--text-main);
}

.action-btn.delete:hover {
  color: var(--danger);
  border-color: var(--danger);
}

.empty-state {
  text-align: center;
  padding: 30px 10px;
  color: var(--text-muted);
  font-size: 13px;
}
```

- [ ] **Step 3: Implement `src/popup/popup.ts`**

```typescript
import { getAllMetadata, deleteMetadata } from '../lib/storage';
import { BookmarkMetadata } from '../lib/types';
import { formatRelativeTime } from '../lib/utils';

let allItems: BookmarkMetadata[] = [];

async function loadBookmarks() {
  const metadataMap = await getAllMetadata();
  allItems = Object.values(metadataMap).sort((a, b) => b.dateAdded - a.dateAdded);

  populateFolderFilter(allItems);
  renderList(allItems);
}

function populateFolderFilter(items: BookmarkMetadata[]) {
  const folderFilter = document.getElementById('folderFilter') as HTMLSelectElement;
  const folders = Array.from(new Set(items.map((i) => i.folderTitle).filter(Boolean)));
  folderFilter.innerHTML = '<option value="all">All Folders</option>';
  folders.forEach((f) => {
    const opt = document.createElement('option');
    opt.value = f;
    opt.textContent = f;
    folderFilter.appendChild(opt);
  });
}

function renderList(items: BookmarkMetadata[]) {
  const listEl = document.getElementById('bookmarkList')!;
  const countEl = document.getElementById('bookmarkCount')!;
  countEl.textContent = `${items.length} ${items.length === 1 ? 'item' : 'items'}`;

  if (items.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <p>No bookmarks found.</p>
        <small>Right-click any link and select "Bag It" to save!</small>
      </div>
    `;
    return;
  }

  listEl.innerHTML = items
    .map(
      (item) => `
    <div class="bookmark-card" data-id="${item.id}">
      <a href="${item.url}" target="_blank" class="card-title" title="${item.title}">${item.title}</a>
      ${item.quote ? `<div class="quote-snippet">"${item.quote}"</div>` : ''}
      <div class="card-meta">
        <span class="folder-badge">📁 ${item.folderTitle || 'Default'}</span>
        <span class="time-badge">${formatRelativeTime(item.dateAdded)}</span>
      </div>
      <div class="card-actions">
        <button class="action-btn copy-btn" data-url="${item.url}">Copy</button>
        <button class="action-btn delete delete-btn" data-id="${item.id}">Delete</button>
      </div>
    </div>
  `
    )
    .join('');

  // Event handlers
  listEl.querySelectorAll('.copy-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLButtonElement;
      const url = target.getAttribute('data-url');
      if (url) {
        navigator.clipboard.writeText(url);
        target.textContent = 'Copied!';
        setTimeout(() => (target.textContent = 'Copy'), 1500);
      }
    });
  });

  listEl.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const target = e.currentTarget as HTMLButtonElement;
      const id = target.getAttribute('data-id');
      if (id) {
        try {
          await browser.bookmarks.remove(id);
        } catch {
          // May already have been removed natively
        }
        await deleteMetadata(id);
        allItems = allItems.filter((i) => i.id !== id);
        filterAndRender();
      }
    });
  });
}

function filterAndRender() {
  const searchInput = (document.getElementById('searchInput') as HTMLInputElement).value.toLowerCase();
  const folderFilter = (document.getElementById('folderFilter') as HTMLSelectElement).value;

  const filtered = allItems.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchInput) ||
      item.url.toLowerCase().includes(searchInput) ||
      (item.quote && item.quote.toLowerCase().includes(searchInput));
    const matchesFolder = folderFilter === 'all' || item.folderTitle === folderFilter;
    return matchesSearch && matchesFolder;
  });

  renderList(filtered);
}

document.addEventListener('DOMContentLoaded', () => {
  loadBookmarks();

  document.getElementById('searchInput')?.addEventListener('input', filterAndRender);
  document.getElementById('folderFilter')?.addEventListener('change', filterAndRender);

  document.getElementById('btnOptions')?.addEventListener('click', () => {
    browser.runtime.openOptionsPage();
  });
});
```

- [ ] **Step 4: Commit popup UI**

```bash
rtk git add src/popup/index.html src/popup/popup.ts src/popup/popup.css
rtk git commit -m "feat: implement popup dashboard with search, filter, and quick actions"
```

---

### Task 7: Options & Settings Configuration Page

**Files:**
- Create: `src/options/index.html`
- Create: `src/options/options.ts`
- Create: `src/options/options.css`

**Features:**
- Configure base folder name (default: `"BagMark"`)
- Checkbox list of existing browser bookmark folders to pin to the right-click submenu
- Toggle auto-create `YYYY-MM` date subfolders
- Toggle duplicate link warning notification
- Save & feedback state

- [ ] **Step 1: Create `src/options/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>BagMark Settings</title>
  <link rel="stylesheet" href="./options.css" />
</head>
<body>
  <div class="container">
    <header class="settings-header">
      <span class="logo">🎒</span>
      <h1>BagMark Settings</h1>
    </header>

    <section class="section">
      <h2>General Preferences</h2>
      
      <div class="form-group">
        <label for="defaultFolderName">Default Folder Name</label>
        <input type="text" id="defaultFolderName" value="BagMark" />
        <small>Primary root folder created under Other Bookmarks for 1-click saves.</small>
      </div>

      <div class="checkbox-group">
        <label>
          <input type="checkbox" id="enableDateSubfolders" />
          <span>Organize into Date Subfolders (e.g. <code>BagMark / 2026-09</code>)</span>
        </label>
      </div>

      <div class="checkbox-group">
        <label>
          <input type="checkbox" id="warnDuplicates" />
          <span>Warn when saving duplicate links</span>
        </label>
      </div>

      <div class="checkbox-group">
        <label>
          <input type="checkbox" id="showNotifications" />
          <span>Show desktop notification confirmations</span>
        </label>
      </div>
    </section>

    <section class="section">
      <h2>Context Submenu Pinned Folders</h2>
      <p class="section-desc">Select folders to display in the right-click "Bag It to ▸" submenu:</p>
      <div id="folderList" class="folder-list">
        <!-- Rendered dynamically -->
      </div>
    </section>

    <footer class="footer">
      <button id="btnSave" class="btn primary">Save Changes</button>
      <span id="saveStatus" class="status-msg"></span>
    </footer>
  </div>

  <script type="module" src="./options.ts"></script>
</body>
</html>
```

- [ ] **Step 2: Create `src/options/options.css`**

```css
:root {
  --bg: #121216;
  --surface: #1e1e24;
  --border: #2e2e38;
  --text: #f3f4f6;
  --text-muted: #9ca3af;
  --accent: #f59e0b;
  --accent-hover: #d97706;
  --success: #10b981;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  margin: 0;
  padding: 40px 20px;
}

.container {
  max-width: 640px;
  margin: 0 auto;
}

.settings-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 28px;
}

.logo {
  font-size: 32px;
}

h1 {
  font-size: 24px;
  margin: 0;
}

.section {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

h2 {
  font-size: 16px;
  margin-top: 0;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 8px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}

.form-group label {
  font-size: 13px;
  font-weight: 600;
}

.form-group input[type="text"] {
  padding: 8px 12px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  font-size: 14px;
}

.form-group small {
  color: var(--text-muted);
  font-size: 12px;
}

.checkbox-group {
  margin-bottom: 12px;
}

.checkbox-group label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  cursor: pointer;
}

.section-desc {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 12px;
}

.folder-list {
  max-height: 220px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px;
  background: var(--bg);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.folder-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.footer {
  display: flex;
  align-items: center;
  gap: 16px;
}

.btn.primary {
  background: var(--accent);
  color: #121216;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
}

.btn.primary:hover {
  background: var(--accent-hover);
}

.status-msg {
  font-size: 13px;
  color: var(--success);
}
```

- [ ] **Step 3: Implement `src/options/options.ts`**

```typescript
import { getSettings, saveSettings } from '../lib/config';
import { getFolderHierarchy } from '../lib/bookmarks';

async function initOptions() {
  const settings = await getSettings();

  const defaultFolderInput = document.getElementById('defaultFolderName') as HTMLInputElement;
  const dateSubfoldersCheckbox = document.getElementById('enableDateSubfolders') as HTMLInputElement;
  const warnDuplicatesCheckbox = document.getElementById('warnDuplicates') as HTMLInputElement;
  const showNotificationsCheckbox = document.getElementById('showNotifications') as HTMLInputElement;
  const folderListEl = document.getElementById('folderList')!;
  const saveBtn = document.getElementById('btnSave')!;
  const statusMsg = document.getElementById('saveStatus')!;

  defaultFolderInput.value = settings.defaultFolderName;
  dateSubfoldersCheckbox.checked = settings.enableDateSubfolders;
  warnDuplicatesCheckbox.checked = settings.warnDuplicates;
  showNotificationsCheckbox.checked = settings.showNotifications;

  // Load available bookmark folders
  try {
    const folders = await getFolderHierarchy();
    folderListEl.innerHTML = folders
      .map(
        (f) => `
      <label class="folder-item">
        <input type="checkbox" value="${f.id}" ${
          settings.favoriteFolderIds.includes(f.id) ? 'checked' : ''
        } class="fav-folder-cb" />
        <span>📁 ${f.path}</span>
      </label>
    `
      )
      .join('');
  } catch (err) {
    folderListEl.innerHTML = `<span style="color:var(--text-muted);font-size:12px;">Could not load bookmark folders.</span>`;
  }

  saveBtn.addEventListener('click', async () => {
    const selectedFavorites: string[] = [];
    document.querySelectorAll('.fav-folder-cb:checked').forEach((cb) => {
      selectedFavorites.push((cb as HTMLInputElement).value);
    });

    await saveSettings({
      defaultFolderName: defaultFolderInput.value.trim() || 'BagMark',
      enableDateSubfolders: dateSubfoldersCheckbox.checked,
      warnDuplicates: warnDuplicatesCheckbox.checked,
      showNotifications: showNotificationsCheckbox.checked,
      favoriteFolderIds: selectedFavorites,
    });

    statusMsg.textContent = 'Settings saved successfully! ✓';
    setTimeout(() => {
      statusMsg.textContent = '';
    }, 2500);
  });
}

document.addEventListener('DOMContentLoaded', initOptions);
```

- [ ] **Step 4: Commit options page**

```bash
rtk git add src/options/index.html src/options/options.ts src/options/options.css
rtk git commit -m "feat: implement options configuration UI for folders and preferences"
```

---

### Task 8: Build Verification, Packaging & Linting

**Files:**
- Create: `public/assets/icon-48.png` (or SVG icon)
- Modify: `package.json`

- [ ] **Step 1: Create Extension Icons in `public/assets/`**

Create SVG icon and helper icons for manifest.

- [ ] **Step 2: Run Full Build**

Run: `rtk npm run build`
Expected: Build passes, produces `dist/` containing `manifest.json`, `background.js`, `src/popup/index.html`, and `src/options/index.html`.

- [ ] **Step 3: Run Full Test Suite**

Run: `rtk npm test`
Expected: All test suites PASS.

- [ ] **Step 4: Final Git Commit**

```bash
rtk git add .
rtk git commit -m "chore: complete BagMark extension build verification"
```

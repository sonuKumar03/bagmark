# BagMark — Advanced Firefox Bookmark Extension Design Specification

## Overview
**BagMark** is an advanced, lightweight Firefox extension built with Vite and TypeScript. It enables frictionless bookmarking directly from context menus, dynamic subfolder organization, automatic date-based archiving (e.g. `BagMark / 2026-09 / ...`), rich metadata tracking (timestamps, source page reference, selected quotes/notes), duplicate link detection, and an interactive popup dashboard.

---

## 1. User Goals & Key Features

1. **Context Menu Quick Save**:
   - Right-click any link, page background, or text selection.
   - Top-level item: 1-click instant save to default folder (`"BagMark"`).
   - Submenu (`"BagMark ▸"`): Save directly into user-selected favorite/pinned folders.
2. **Date Tracking & Chronological Organization**:
   - Built-in Firefox `dateAdded` tracking.
   - Configurable **Auto-Date Subfolders**: When enabled, bookmarks are organized as `<TargetFolder> / YYYY-MM / <Bookmark>`. Folders are resolved or created dynamically.
3. **Rich Metadata Capture**:
   - Stores exact timestamp (`dateAdded`), source webpage URL, source webpage title, and any highlighted quote/text selection inside `browser.storage.local`.
4. **Duplicate Link Prevention**:
   - Detects if a URL is already bookmarked before saving. Alerts the user with the existing folder location and save date.
5. **Popup Dashboard**:
   - Search & filter bookmarks by title, URL, or date.
   - View recent bookmarks with relative time badges (`"2 hours ago"`), target folder badges, and quote snippet previews.
   - One-click copy, visit, and delete.
6. **Options & Customization**:
   - Manage primary folder name (default: `"BagMark"`).
   - Manage favorite/pinned folders displayed in the context submenu.
   - Toggle auto-date subfolders (`YYYY-MM`).
   - Duplicate warning toggles.

---

## 2. System Architecture

```
bag-bookmark/
├── manifest.json                  # Firefox WebExtension MV3 manifest
├── package.json                   # Dependencies (Vite, TypeScript, Vitest, @types/firefox-webext-browser)
├── tsconfig.json                  # Strict TypeScript configuration
├── vite.config.ts                 # Multi-page build config (background, popup, options)
├── src/
│   ├── background/
│   │   └── index.ts               # Background event handler (menus, shortcuts, save logic)
│   ├── popup/
│   │   ├── index.html             # Popup dashboard interface
│   │   ├── popup.ts               # Search, list rendering, filter controls
│   │   └── popup.css              # Clean, modern, high-contrast dark/light styles
│   ├── options/
│   │   ├── index.html             # Options configuration UI
│   │   ├── options.ts             # Settings management & folder picker
│   │   └── options.css
│   └── lib/
│       ├── types.ts               # TypeScript models & configuration interfaces
│       ├── bookmarks.ts           # Bookmark tree traversal, folder resolution & creation
│       ├── storage.ts             # Metadata read/write via browser.storage.local
│       ├── config.ts              # Settings getters/setters & default config
│       └── utils.ts               # Date formatters (YYYY-MM, relative time), URL normalizer
└── tests/
    ├── bookmarks.test.ts          # Unit tests for folder resolution logic
    └── utils.test.ts              # Unit tests for date formatting & URL utilities
```

---

## 3. Data Models & Schemas

### 3.1 Metadata Schema (`browser.storage.local`)
Stored under key `metadata_${bookmarkId}` or in a combined index `bagmark_metadata`:

```typescript
export interface BookmarkMetadata {
  id: string;              // Firefox bookmark ID
  url: string;             // Destination URL
  title: string;           // Bookmark title
  dateAdded: number;       // Epoch milliseconds
  folderId: string;        // Destination folder ID
  folderTitle: string;     // Destination folder name (e.g. "2026-09" or "Dev")
  sourcePageUrl?: string;  // Page where the link was found (if clicked from a page)
  sourcePageTitle?: string;// Title of the originating page
  quote?: string;          // Highlighted text excerpt (if text was selected)
  tags: string[];          // User tags (editable in popup)
}
```

### 3.2 User Settings Schema
Stored in `browser.storage.sync` (or `browser.storage.local` fallback):

```typescript
export interface BagMarkSettings {
  defaultFolderName: string;    // Default: "BagMark"
  enableDateSubfolders: boolean;// Default: true (groups under YYYY-MM)
  warnDuplicates: boolean;      // Default: true
  favoriteFolders: string[];    // Array of folder IDs to show in the context submenu
  showNotifications: boolean;   // Default: true
}
```

---

## 4. Component Details & Data Flow

### 4.1 Background Event Script (`src/background/index.ts`)
- **Initialization (`runtime.onInstalled` & `runtime.onStartup`)**:
  - Re-registers context menus using `browser.menus.create`.
  - Queries `browser.bookmarks.getTree()` to verify the primary `"BagMark"` folder exists under `"Other Bookmarks"` (or `"unfiled"`), creating it if necessary.
  - Dynamically builds submenus for pinned favorite folders.
- **Context Menu Click Handler (`menus.onClicked`)**:
  1. Identifies click origin:
     - `info.menuItemId === 'bagmark_quick_save'` ➔ Primary folder.
     - `info.menuItemId.startsWith('bagmark_folder_')` ➔ Specific favorite folder ID.
  2. Extracts data:
     - Target URL: `info.linkUrl || info.pageUrl`.
     - Title: `info.linkText || tab.title || targetUrl`.
     - Quote: `info.selectionText || undefined`.
     - Source: `info.pageUrl`.
  3. Duplicate check:
     - Calls `browser.bookmarks.search({ url })`.
     - If found and `warnDuplicates === true`, triggers notification: *"Already in [Folder] (saved [Date])"*.
  4. Path resolution:
     - If `enableDateSubfolders === true`, calls `ensureDateSubfolder(baseFolderId, new Date())` returning the `YYYY-MM` child folder ID.
  5. Creation:
     - Calls `browser.bookmarks.create({ parentId, title, url })`.
     - Writes `BookmarkMetadata` to storage.
  6. Feedback:
     - Triggers native browser notification or badge icon flash.

### 4.2 Core Bookmark Operations (`src/lib/bookmarks.ts`)
- `ensureRootFolder(name: string): Promise<BookmarkTreeNode>`: Finds or creates the base root folder.
- `ensureDateSubfolder(parentId: string, date: Date): Promise<BookmarkTreeNode>`: Formats `YYYY-MM` (e.g. `2026-09`), checks existing children of `parentId`, and creates if missing.
- `findBookmarkByUrl(url: string): Promise<BookmarkTreeNode | null>`: Exact URL search.
- `getAllFolders(): Promise<Array<{ id: string; title: string; path: string }>>`: Flattens folder tree for options/popup folder pickers.

### 4.3 Popup Dashboard (`src/popup/`)
- Lists bookmarks saved under BagMark folders (or all recent bookmarks) in descending chronological order.
- Search input filter for real-time search across titles, URLs, tags, and quote snippets.
- Displays metadata: exact formatted date, relative time badge (`"10m ago"`), folder badge, quote snippet.
- Action buttons: Copy link, delete bookmark, launch URL.

### 4.4 Options Page (`src/options/`)
- Choose default folder location and name.
- Select favorite folders via a checkbox list of all existing browser bookmark folders.
- Toggle switch for `Auto-organize by Year-Month (YYYY-MM)`.
- Toggle switch for `Duplicate URL detection`.

---

## 5. Security & Manifest Permissions
- `manifest_version: 3` (Firefox compatible).
- **Permissions**:
  - `"bookmarks"`: Read and write bookmarks and folder hierarchy.
  - `"menus"` / `"contextMenus"`: Register right-click menu actions.
  - `"storage"`: Persist settings and rich metadata.
  - `"notifications"`: Display save confirmations and duplicate warnings.
  - `"tabs"`: Retrieve source page title and active tab context.

---

## 6. Testing & Quality Strategy
- **Unit Tests (`tests/`)**:
  - Vitest test suite mocking browser APIs where needed.
  - Test date formatting utilities (`formatYearMonth`, `formatRelativeTime`).
  - Test URL normalization (stripping tracking query parameters like `utm_*` when checking duplicates).
  - Test folder hierarchy navigation and creation logic.
- **Manual Verification**:
  - Load unpacked extension into Firefox via `about:debugging`.
  - Right-click link ➔ Instant save.
  - Right-click selection ➔ Verify quote is stored and visible in popup.
  - Check duplicate save warning.
  - Verify folder creation in Firefox's Bookmark Library (`Ctrl/Cmd + Shift + O`).

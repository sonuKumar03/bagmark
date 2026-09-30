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

  // Also check slash-normalized variant (e.g. root domain with or without trailing slash)
  const altUrl = cleanUrl.endsWith('/') ? cleanUrl.slice(0, -1) : cleanUrl + '/';
  if (altUrl !== rawUrl && altUrl !== cleanUrl) {
    results = await browser.bookmarks.search({ url: altUrl });
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
        const title = node.title || (node.id === 'root________' ? '' : 'Folder');
        const nextPath = node.id === 'root________'
          ? ''
          : (currentPath ? `${currentPath} / ${title}` : title);
        if (node.id !== 'root________' && title) {
          folders.push({ id: node.id, title, path: nextPath });
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

export async function saveBookmark(
  details: SaveBookmarkInput
): Promise<{ node: browser.bookmarks.BookmarkTreeNode; isDuplicate: boolean }> {
  const duplicate = await findDuplicateBookmark(details.url);
  if (duplicate) {
    return { node: duplicate, isDuplicate: true };
  }

  let baseFolderId = details.targetFolderId;
  if (!baseFolderId) {
    const root = await ensureRootFolder(details.defaultFolderName || 'BagMark');
    baseFolderId = root.id;
  }

  let destFolderId = baseFolderId;
  if (details.enableDateSubfolders) {
    const dateFolder = await ensureDateSubfolder(baseFolderId, new Date());
    destFolderId = dateFolder.id;
  }

  const node = await browser.bookmarks.create({
    parentId: destFolderId,
    title: details.title,
    url: details.url,
  });

  return { node, isDuplicate: false };
}

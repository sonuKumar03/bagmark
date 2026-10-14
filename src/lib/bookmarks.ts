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
  const writable = tree[0]?.children?.filter((node) => !node.unmodifiable) || [];
  const parent = writable.find((node) =>
    node.id === 'unfiled_____' ||
    (node as browser.bookmarks.BookmarkTreeNode & { folderType?: string }).folderType === 'other'
  ) || writable[0];
  if (!parent) throw new Error('No writable bookmark folder available');
  const parentId = parent.id;

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
      if (!node.url && !node.unmodifiable) {
        const title = node.title || 'Folder';
        const nextPath = currentPath ? `${currentPath} / ${title}` : title;
        folders.push({ id: node.id, title, path: nextPath });
        if (node.children) {
          traverse(node.children, nextPath);
        }
      }
    }
  }

  traverse(tree[0]?.children || [], '');
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

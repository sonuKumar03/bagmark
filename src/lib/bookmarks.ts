import { formatYearMonth, normalizeUrl } from './utils';
import { saveMetadata } from './storage';

export interface SaveBookmarkInput {
  url: string;
  title: string;
  targetFolderId?: string;
  enableDateSubfolders?: boolean;
  defaultFolderName?: string;
  warnDuplicates?: boolean;
  sourcePageUrl?: string;
  sourcePageTitle?: string;
  quote?: string;
}

export interface SaveBookmarkResult {
  node: browser.bookmarks.BookmarkTreeNode;
  isDuplicate: boolean;
  folderTitle: string;
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

// shortcut: this queue is per context; keep all save callers in the background when adding popup saves.
let saveQueue: Promise<unknown> = Promise.resolve();

export function saveBookmarks(details: SaveBookmarkInput[]): Promise<Array<SaveBookmarkResult | { error: unknown }>> {
  const operation = saveQueue.then(async () => {
    const destinations = new Map<string, { id: string; title: string }>();
    const indexes = new Map<string, Map<string, browser.bookmarks.BookmarkTreeNode>>();
    const results: Array<SaveBookmarkResult | { error: unknown }> = [];
    const date = new Date();

    for (const input of details) {
      try {
        const key = JSON.stringify([input.targetFolderId, input.defaultFolderName || 'BagMark', !!input.enableDateSubfolders]);
        let destination = destinations.get(key);
        if (!destination) {
          const base = input.targetFolderId
            ? (await browser.bookmarks.get(input.targetFolderId))[0]
            : await ensureRootFolder(input.defaultFolderName || 'BagMark');
          if (!base || base.url || base.unmodifiable) throw new Error('Target is not a writable folder');
          const folder = input.enableDateSubfolders ? await ensureDateSubfolder(base.id, date) : base;
          destination = { id: folder.id, title: input.enableDateSubfolders ? `${base.title} / ${folder.title}` : base.title };
          destinations.set(key, destination);
        }

        let index = indexes.get(destination.id);
        if (!index) {
          const children = await browser.bookmarks.getChildren(destination.id);
          index = new Map(children.filter((node) => !!node.url).map((node) => [normalizeUrl(node.url!), node]));
          indexes.set(destination.id, index);
        }
        const normalizedUrl = normalizeUrl(input.url);
        const duplicate = input.warnDuplicates !== false && index.get(normalizedUrl);
        if (duplicate) {
          results.push({ node: duplicate, isDuplicate: true, folderTitle: destination.title });
          continue;
        }

        const node = await browser.bookmarks.create({ parentId: destination.id, title: input.title, url: input.url });
        index.set(normalizedUrl, node);
        await saveMetadata({
          id: node.id,
          url: input.url,
          title: input.title,
          dateAdded: node.dateAdded || Date.now(),
          folderId: destination.id,
          folderTitle: destination.title,
          sourcePageUrl: input.sourcePageUrl,
          sourcePageTitle: input.sourcePageTitle,
          quote: input.quote,
          tags: [],
        });
        results.push({ node, isDuplicate: false, folderTitle: destination.title });
      } catch (error) {
        results.push({ error });
      }
    }
    return results;
  });
  saveQueue = operation.catch(() => {});
  return operation;
}

export async function saveBookmark(details: SaveBookmarkInput): Promise<SaveBookmarkResult> {
  const [result] = await saveBookmarks([details]);
  if ('error' in result) throw result.error;
  return result;
}

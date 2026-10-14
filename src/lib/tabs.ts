import { saveBookmarks } from './bookmarks';
import { getSettings } from './config';
import { isBookmarkableUrl } from './utils';
import type { SaveOpenTabsRequest, SaveOpenTabsResult } from './types';

export async function saveOpenTabs(request: SaveOpenTabsRequest): Promise<SaveOpenTabsResult> {
  if (!Number.isInteger(request.windowId) || request.windowId < 0 ||
      typeof request.targetFolderId !== 'string' || !request.targetFolderId.trim()) {
    throw new Error('Choose a valid window and destination folder.');
  }
  if (request.newFolderName !== undefined &&
      (typeof request.newFolderName !== 'string' || !request.newFolderName.trim())) {
    throw new Error('Enter a name for the new folder.');
  }

  const tabs = await browser.tabs.query({ windowId: request.windowId });
  const eligible = tabs.filter((tab) => isBookmarkableUrl(tab.url)).sort((a, b) => a.index - b.index);
  const summary: SaveOpenTabsResult = { saved: 0, skipped: tabs.length - eligible.length, failed: 0 };
  if (!eligible.length) return summary;

  const [parent] = await browser.bookmarks.get(request.targetFolderId);
  if (!parent || parent.url || parent.unmodifiable) throw new Error('Choose an existing writable folder.');
  const settings = await getSettings();
  const folder = request.newFolderName !== undefined
    ? await browser.bookmarks.create({ parentId: parent.id, title: request.newFolderName.trim() })
    : parent;
  summary.folderId = folder.id;
  const results = await saveBookmarks(eligible.map((tab) => ({
    url: tab.url!,
    title: tab.title || tab.url!,
    targetFolderId: folder.id,
    warnDuplicates: settings.warnDuplicates,
    sourcePageUrl: tab.url,
    sourcePageTitle: tab.title,
  })));
  for (const result of results) {
    if ('error' in result) summary.failed++;
    else if (result.isDuplicate) summary.skipped++;
    else summary.saved++;
  }
  return summary;
}

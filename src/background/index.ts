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
  if (info.menuItemId === SUBMENU_ROOT_ID) {
    return;
  }

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

  try {
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
  } catch (error) {
    console.error('Failed to save bookmark:', error);
    if (settings.showNotifications) {
      browser.notifications.create({
        type: 'basic',
        iconUrl: 'assets/icon-48.png',
        title: 'BagMark Save Failed',
        message: 'Could not save bookmark. Target folder may no longer exist.',
      });
    }
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

// Call immediately on background script execution
updateContextMenus();


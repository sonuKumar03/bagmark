import '../lib/browser';
import { saveBookmark } from '../lib/bookmarks';
import { getSettings } from '../lib/config';
import { formatDisplayDate } from '../lib/utils';

const QUICK_SAVE_ID = 'bagmark_quick_save';
const SUBMENU_ROOT_ID = 'bagmark_submenu_root';

async function updateContextMenus() {
  await browser.contextMenus.removeAll();

  const settings = await getSettings();

  // 1. Top-level 1-click Quick Save to default folder
  browser.contextMenus.create({
    id: QUICK_SAVE_ID,
    title: `Bag It (Save to ${settings.defaultFolderName})`,
    contexts: ['link', 'page', 'selection'],
  });

  // 2. Submenu for custom / favorite folders
  if (settings.favoriteFolderIds && settings.favoriteFolderIds.length > 0) {
    browser.contextMenus.create({
      id: SUBMENU_ROOT_ID,
      title: 'Bag It to ▸',
      contexts: ['link', 'page', 'selection'],
    });

    for (const folderId of settings.favoriteFolderIds) {
      try {
        const nodes = await browser.bookmarks.get(folderId);
        if (nodes && nodes[0]) {
          browser.contextMenus.create({
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
  info: browser.contextMenus.OnClickData,
  tab?: browser.tabs.Tab
) {
  if (info.menuItemId === SUBMENU_ROOT_ID) {
    return;
  }

  const settings = await getSettings();
  const targetUrl = info.linkUrl || info.pageUrl || tab?.url;
  if (!targetUrl) return;

  const targetTitle = info.linkText || tab?.title || targetUrl;
  try {
    const targetFolderId = info.menuItemId.toString().startsWith('bagmark_target_')
      ? info.menuItemId.toString().replace('bagmark_target_', '')
      : undefined;
    const { node, isDuplicate, folderTitle } = await saveBookmark({
      url: targetUrl,
      title: targetTitle,
      targetFolderId,
      defaultFolderName: settings.defaultFolderName,
      enableDateSubfolders: settings.enableDateSubfolders,
      warnDuplicates: settings.warnDuplicates,
      sourcePageUrl: info.pageUrl,
      sourcePageTitle: tab?.title,
      quote: info.selectionText || undefined,
    });

    if (settings.showNotifications) {
      if (isDuplicate) {
        const addedDate = node.dateAdded ? formatDisplayDate(node.dateAdded) : 'previously';
        browser.notifications.create({
          type: 'basic',
          iconUrl: 'assets/icon-48.png',
          title: 'Already in this folder!',
          message: `"${node.title}" was already saved in ${folderTitle} on ${addedDate}.`,
        });
      } else {
        browser.notifications.create({
          type: 'basic',
          iconUrl: 'assets/icon-48.png',
          title: 'Bagged Successfully! 🎒',
          message: `Saved "${targetTitle}" to ${folderTitle}`,
        });
      }
    }
  } catch (error) {
    console.error('Failed to save bookmark:', error);
    if (settings.showNotifications) {
      browser.notifications.create({
        type: 'basic',
        iconUrl: 'assets/icon-48.png',
        title: 'BagMark Save Failed',
        message: 'Could not save bookmark or metadata. Check the destination folder before retrying.',
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

browser.contextMenus.onClicked.addListener((info, tab) => {
  return handleSaveAction(info, tab);
});

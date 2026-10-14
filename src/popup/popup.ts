import '../lib/browser';
import { getAllMetadata, deleteMetadata } from '../lib/storage';
import { BookmarkMetadata, SaveOpenTabsResult } from '../lib/types';
import { formatRelativeTime, isBookmarkableUrl } from '../lib/utils';
import { getFolderHierarchy } from '../lib/bookmarks';

let allItems: BookmarkMetadata[] = [];

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch {
    // Invalid URL fallback
  }
  return '#';
}

async function loadBookmarks() {
  const metadataMap = await getAllMetadata();
  allItems = Object.values(metadataMap).sort((a, b) => b.dateAdded - a.dateAdded);

  populateFolderFilter(allItems);
  renderList(allItems);
}

function populateFolderFilter(items: BookmarkMetadata[]) {
  const folderFilter = document.getElementById('folderFilter') as HTMLSelectElement;
  const folders = Array.from(new Set(items.map((i) => i.folderTitle).filter(Boolean)));
  folderFilter.replaceChildren();
  const defaultOpt = document.createElement('option');
  defaultOpt.value = 'all';
  defaultOpt.textContent = 'All Folders';
  folderFilter.appendChild(defaultOpt);

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

  listEl.replaceChildren();

  if (items.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'empty-state';
    const p = document.createElement('p');
    p.textContent = 'No bookmarks found.';
    const small = document.createElement('small');
    small.textContent = 'Right-click any link and select "Bag It" to save!';
    emptyDiv.appendChild(p);
    emptyDiv.appendChild(small);
    listEl.appendChild(emptyDiv);
    return;
  }

  for (const item of items) {
    const card = document.createElement('div');
    card.className = 'bookmark-card';
    card.dataset.id = item.id;

    const link = document.createElement('a');
    link.href = sanitizeUrl(item.url);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'card-title';
    link.title = item.title;
    link.textContent = item.title;
    card.appendChild(link);

    if (item.quote) {
      const quoteDiv = document.createElement('div');
      quoteDiv.className = 'quote-snippet';
      quoteDiv.textContent = `"${item.quote}"`;
      card.appendChild(quoteDiv);
    }

    const metaDiv = document.createElement('div');
    metaDiv.className = 'card-meta';

    const folderBadge = document.createElement('span');
    folderBadge.className = 'folder-badge';
    folderBadge.textContent = `📁 ${item.folderTitle || 'Default'}`;

    const timeBadge = document.createElement('span');
    timeBadge.className = 'time-badge';
    timeBadge.textContent = formatRelativeTime(item.dateAdded);

    metaDiv.appendChild(folderBadge);
    metaDiv.appendChild(timeBadge);
    card.appendChild(metaDiv);

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'card-actions';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'action-btn copy-btn';
    copyBtn.dataset.url = sanitizeUrl(item.url);
    copyBtn.textContent = 'Copy';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'action-btn delete delete-btn';
    deleteBtn.dataset.id = item.id;
    deleteBtn.textContent = 'Delete';

    actionsDiv.appendChild(copyBtn);
    actionsDiv.appendChild(deleteBtn);
    card.appendChild(actionsDiv);

    listEl.appendChild(card);
  }
}


function filterAndRender() {
  const searchInput = (document.getElementById('searchInput') as HTMLInputElement).value.toLowerCase();
  const folderFilter = (document.getElementById('folderFilter') as HTMLSelectElement).value;

  const filtered = allItems.filter((item) => {
    const matchesTags = Array.isArray(item.tags) && item.tags.some((t) => t.toLowerCase().includes(searchInput));
    const matchesSearch =
      item.title.toLowerCase().includes(searchInput) ||
      item.url.toLowerCase().includes(searchInput) ||
      (item.quote && item.quote.toLowerCase().includes(searchInput)) ||
      matchesTags;
    const matchesFolder = folderFilter === 'all' || item.folderTitle === folderFilter;
    return matchesSearch && matchesFolder;
  });

  renderList(filtered);
}

async function initTabSaving() {
  const form = document.getElementById('saveTabsForm') as HTMLFormElement;
  const fields = document.getElementById('saveTabsFields') as HTMLFieldSetElement;
  const folderSelect = document.getElementById('saveTabsFolder') as HTMLSelectElement;
  const createFolder = document.getElementById('createTabFolder') as HTMLInputElement;
  const folderName = document.getElementById('tabFolderName') as HTMLInputElement;
  const button = document.getElementById('btnSaveTabs') as HTMLButtonElement;
  const status = document.getElementById('saveTabsStatus')!;
  let windowId: number;
  let count = 0;

  function updateFolderMode() {
    document.getElementById('tabFolderNameField')!.hidden = !createFolder.checked;
    document.getElementById('saveTabsFolderLabel')!.textContent = createFolder.checked ? 'Parent folder' : 'Save to folder';
    folderName.disabled = !createFolder.checked;
    folderName.required = createFolder.checked;
  }
  createFolder.addEventListener('change', updateFolderMode);

  async function loadFolders(selectedId = '') {
    const folders = await getFolderHierarchy();
    folderSelect.replaceChildren(new Option('Choose a folder', ''));
    for (const folder of folders) folderSelect.add(new Option(folder.path, folder.id));
    folderSelect.value = selectedId;
    if (!folders.length) throw new Error('No writable folders available. Create a folder in the bookmark manager first.');
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (fields.disabled) return;
    if (createFolder.checked && !folderName.value.trim()) {
      folderName.setCustomValidity('Enter a folder name.');
      folderName.reportValidity();
      return;
    }
    fields.disabled = true;
    status.dataset.error = 'false';
    status.textContent = 'Saving tabs…';
    try {
      const result: SaveOpenTabsResult | { error: string } = await browser.runtime.sendMessage({
        type: 'save-open-tabs',
        windowId,
        targetFolderId: folderSelect.value,
        newFolderName: createFolder.checked ? folderName.value.trim() : undefined,
      });
      if (!result) throw new Error('No response. Reload BagMark and try again.');
      if ('error' in result) throw new Error(result.error);
      status.textContent = `${result.saved} saved · ${result.skipped} skipped · ${result.failed} failed.`;
      status.dataset.error = String(result.failed > 0);
      if (result.failed) status.textContent += ' Check the folder before retrying.';
      if (result.folderId) {
        await loadFolders(result.folderId);
        createFolder.checked = false;
        updateFolderMode();
      }
      await loadBookmarks();
    } catch (error) {
      status.dataset.error = 'true';
      status.textContent = error instanceof Error ? error.message : 'Could not save tabs. Check the folder and try again.';
    } finally {
      fields.disabled = false;
      button.disabled = count === 0;
    }
  });
  folderName.addEventListener('input', () => folderName.setCustomValidity(''));

  try {
    const currentWindow = await browser.windows.getCurrent();
    if (currentWindow.id === undefined) throw new Error('Could not identify this window. Reopen BagMark.');
    windowId = currentWindow.id;
    const [tabs] = await Promise.all([browser.tabs.query({ windowId }), loadFolders()]);
    count = tabs.filter((tab) => isBookmarkableUrl(tab.url)).length;
    document.getElementById('tabPreview')!.textContent = `${count} web ${count === 1 ? 'tab' : 'tabs'} in this window`;
    button.textContent = `Save ${count} ${count === 1 ? 'tab' : 'tabs'}`;
    fields.disabled = false;
    button.disabled = count === 0;
  } catch (error) {
    status.dataset.error = 'true';
    status.textContent = error instanceof Error ? error.message : 'Could not load tabs or folders. Reopen BagMark to retry.';
    document.getElementById('tabPreview')!.textContent = 'Tab saving unavailable';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const listEl = document.getElementById('bookmarkList');
  listEl?.addEventListener('click', async (e) => {
    const copyBtn = (e.target as HTMLElement).closest<HTMLButtonElement>('.copy-btn');
    if (copyBtn) {
      const url = copyBtn.getAttribute('data-url');
      if (url) {
        await navigator.clipboard.writeText(url);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyBtn.textContent = 'Copy';
        }, 1500);
      }
      return;
    }

    const deleteBtn = (e.target as HTMLElement).closest<HTMLButtonElement>('.delete-btn');
    if (deleteBtn) {
      const id = deleteBtn.getAttribute('data-id');
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
    }
  });

  loadBookmarks();
  initTabSaving();

  document.getElementById('searchInput')?.addEventListener('input', filterAndRender);
  document.getElementById('folderFilter')?.addEventListener('change', filterAndRender);

  document.getElementById('btnOptions')?.addEventListener('click', () => {
    browser.runtime.openOptionsPage();
  });
});

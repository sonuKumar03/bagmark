import { getAllMetadata, deleteMetadata } from '../lib/storage';
import { BookmarkMetadata } from '../lib/types';
import { formatRelativeTime } from '../lib/utils';

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

  document.getElementById('searchInput')?.addEventListener('input', filterAndRender);
  document.getElementById('folderFilter')?.addEventListener('change', filterAndRender);

  document.getElementById('btnOptions')?.addEventListener('click', () => {
    browser.runtime.openOptionsPage();
  });
});

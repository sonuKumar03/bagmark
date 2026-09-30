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
    .map((item) => {
      const safeUrl = sanitizeUrl(item.url);
      const escapedUrl = escapeHtml(safeUrl);
      const escapedTitle = escapeHtml(item.title);
      const escapedFolder = escapeHtml(item.folderTitle || 'Default');
      const escapedId = escapeHtml(item.id);
      const quoteHtml = item.quote ? `<div class="quote-snippet">"${escapeHtml(item.quote)}"</div>` : '';

      return `
    <div class="bookmark-card" data-id="${escapedId}">
      <a href="${escapedUrl}" target="_blank" rel="noopener noreferrer" class="card-title" title="${escapedTitle}">${escapedTitle}</a>
      ${quoteHtml}
      <div class="card-meta">
        <span class="folder-badge">📁 ${escapedFolder}</span>
        <span class="time-badge">${formatRelativeTime(item.dateAdded)}</span>
      </div>
      <div class="card-actions">
        <button class="action-btn copy-btn" data-url="${escapedUrl}">Copy</button>
        <button class="action-btn delete delete-btn" data-id="${escapedId}">Delete</button>
      </div>
    </div>
  `;
    })
    .join('');
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

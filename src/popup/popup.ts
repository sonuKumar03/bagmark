import { getAllMetadata, deleteMetadata } from '../lib/storage';
import { BookmarkMetadata } from '../lib/types';
import { formatRelativeTime } from '../lib/utils';

let allItems: BookmarkMetadata[] = [];

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
    .map(
      (item) => `
    <div class="bookmark-card" data-id="${item.id}">
      <a href="${item.url}" target="_blank" class="card-title" title="${item.title}">${item.title}</a>
      ${item.quote ? `<div class="quote-snippet">"${item.quote}"</div>` : ''}
      <div class="card-meta">
        <span class="folder-badge">📁 ${item.folderTitle || 'Default'}</span>
        <span class="time-badge">${formatRelativeTime(item.dateAdded)}</span>
      </div>
      <div class="card-actions">
        <button class="action-btn copy-btn" data-url="${item.url}">Copy</button>
        <button class="action-btn delete delete-btn" data-id="${item.id}">Delete</button>
      </div>
    </div>
  `
    )
    .join('');

  // Event handlers
  listEl.querySelectorAll('.copy-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLButtonElement;
      const url = target.getAttribute('data-url');
      if (url) {
        navigator.clipboard.writeText(url);
        target.textContent = 'Copied!';
        setTimeout(() => (target.textContent = 'Copy'), 1500);
      }
    });
  });

  listEl.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const target = e.currentTarget as HTMLButtonElement;
      const id = target.getAttribute('data-id');
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
    });
  });
}

function filterAndRender() {
  const searchInput = (document.getElementById('searchInput') as HTMLInputElement).value.toLowerCase();
  const folderFilter = (document.getElementById('folderFilter') as HTMLSelectElement).value;

  const filtered = allItems.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchInput) ||
      item.url.toLowerCase().includes(searchInput) ||
      (item.quote && item.quote.toLowerCase().includes(searchInput));
    const matchesFolder = folderFilter === 'all' || item.folderTitle === folderFilter;
    return matchesSearch && matchesFolder;
  });

  renderList(filtered);
}

document.addEventListener('DOMContentLoaded', () => {
  loadBookmarks();

  document.getElementById('searchInput')?.addEventListener('input', filterAndRender);
  document.getElementById('folderFilter')?.addEventListener('change', filterAndRender);

  document.getElementById('btnOptions')?.addEventListener('click', () => {
    browser.runtime.openOptionsPage();
  });
});

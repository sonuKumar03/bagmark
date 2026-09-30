import { getSettings, saveSettings } from '../lib/config';
import { getFolderHierarchy } from '../lib/bookmarks';

let statusTimeout: ReturnType<typeof setTimeout> | null = null;

export async function initOptions() {
  const settings = await getSettings();

  const defaultFolderInput = document.getElementById('defaultFolderName') as HTMLInputElement;
  const dateSubfoldersCheckbox = document.getElementById('enableDateSubfolders') as HTMLInputElement;
  const warnDuplicatesCheckbox = document.getElementById('warnDuplicates') as HTMLInputElement;
  const showNotificationsCheckbox = document.getElementById('showNotifications') as HTMLInputElement;
  const folderListEl = document.getElementById('folderList')!;
  const saveBtn = document.getElementById('btnSave')!;
  const statusMsg = document.getElementById('saveStatus')!;

  if (defaultFolderInput) {
    defaultFolderInput.value = settings.defaultFolderName;
  }
  if (dateSubfoldersCheckbox) {
    dateSubfoldersCheckbox.checked = settings.enableDateSubfolders;
  }
  if (warnDuplicatesCheckbox) {
    warnDuplicatesCheckbox.checked = settings.warnDuplicates;
  }
  if (showNotificationsCheckbox) {
    showNotificationsCheckbox.checked = settings.showNotifications;
  }

  // Load available bookmark folders
  if (folderListEl) {
    try {
      const folders = await getFolderHierarchy();
      folderListEl.innerHTML = '';
      folders.forEach((f) => {
        const label = document.createElement('label');
        label.className = 'folder-item';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = f.id;
        if (settings.favoriteFolderIds.includes(f.id)) {
          input.checked = true;
        }
        input.className = 'fav-folder-cb';

        const span = document.createElement('span');
        span.textContent = `📁 ${f.path}`;

        label.appendChild(input);
        label.appendChild(span);
        folderListEl.appendChild(label);
      });
    } catch {
      folderListEl.innerHTML = '<span style="color:var(--text-muted);font-size:12px;">Could not load bookmark folders.</span>';
    }
  }

  saveBtn?.addEventListener('click', async () => {
    const selectedFavorites: string[] = [];
    document.querySelectorAll('.fav-folder-cb:checked').forEach((cb) => {
      selectedFavorites.push((cb as HTMLInputElement).value);
    });

    const finalFolderName = defaultFolderInput.value.trim() || 'BagMark';
    defaultFolderInput.value = finalFolderName;

    try {
      await saveSettings({
        defaultFolderName: finalFolderName,
        enableDateSubfolders: dateSubfoldersCheckbox.checked,
        warnDuplicates: warnDuplicatesCheckbox.checked,
        showNotifications: showNotificationsCheckbox.checked,
        favoriteFolderIds: selectedFavorites,
      });

      statusMsg.textContent = 'Settings saved successfully! ✓';
      statusMsg.style.color = 'var(--success, #10b981)';
    } catch {
      statusMsg.textContent = 'Failed to save settings. Please try again.';
      statusMsg.style.color = '#ef4444';
    }

    if (statusTimeout) clearTimeout(statusTimeout);
    statusTimeout = setTimeout(() => {
      statusMsg.textContent = '';
    }, 2500);
  });
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initOptions);
}

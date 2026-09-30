import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initOptions } from '../src/options/options';
import { DEFAULT_SETTINGS } from '../src/lib/types';

describe('options page', () => {
  let mockStore: Record<string, any> = {};
  let elements: Record<string, any> = {};
  let eventListeners: Record<string, Function[]> = {};

  function createMockElement(tag: string, id: string = ''): any {
    const el: any = {
      tagName: tag.toUpperCase(),
      id,
      className: '',
      value: '',
      checked: false,
      textContent: '',
      innerHTML: '',
      children: [] as any[],
      style: {},
      listeners: {} as Record<string, Function[]>,
      addEventListener: vi.fn((event: string, handler: Function) => {
        el.listeners[event] = el.listeners[event] || [];
        el.listeners[event].push(handler);
      }),
      appendChild: vi.fn((child: any) => {
        el.children.push(child);
      }),
      click: async () => {
        if (el.listeners['click']) {
          for (const fn of el.listeners['click']) {
            await fn();
          }
        }
      },
    };
    return el;
  }

  beforeEach(() => {
    mockStore = {};
    eventListeners = {};

    elements = {
      defaultFolderName: createMockElement('input', 'defaultFolderName'),
      enableDateSubfolders: createMockElement('input', 'enableDateSubfolders'),
      warnDuplicates: createMockElement('input', 'warnDuplicates'),
      showNotifications: createMockElement('input', 'showNotifications'),
      folderList: createMockElement('div', 'folderList'),
      btnSave: createMockElement('button', 'btnSave'),
      saveStatus: createMockElement('span', 'saveStatus'),
    };

    (globalThis as any).document = {
      readyState: 'complete',
      getElementById: vi.fn((id: string) => elements[id] || null),
      createElement: vi.fn((tag: string) => createMockElement(tag)),
      querySelectorAll: vi.fn((selector: string) => {
        if (selector === '.fav-folder-cb:checked') {
          return elements.folderList.children
            .map((label: any) => label.children.find((c: any) => c.className?.includes('fav-folder-cb')))
            .filter((input: any) => input && input.checked);
        }
        return [];
      }),
      addEventListener: vi.fn((event: string, handler: Function) => {
        eventListeners[event] = eventListeners[event] || [];
        eventListeners[event].push(handler);
      }),
    };

    (globalThis as any).browser = {
      storage: {
        local: {
          get: vi.fn(async (key: string) => ({ [key]: mockStore[key] })),
          set: vi.fn(async (obj: any) => {
            Object.assign(mockStore, obj);
          }),
        },
      },
      bookmarks: {
        getTree: vi.fn(async () => [
          {
            id: 'root________',
            title: '',
            children: [
              {
                id: 'unfiled_____',
                title: 'Other Bookmarks',
                children: [
                  {
                    id: 'folder_xss',
                    title: '<script>alert(1)</script> & "quotes"',
                  },
                  {
                    id: 'folder_normal',
                    title: 'Articles',
                  },
                ],
              },
            ],
          },
        ]),
      },
    };
  });

  it('loads default settings and renders folder tree with textContent', async () => {
    await initOptions();

    expect(elements.defaultFolderName.value).toBe(DEFAULT_SETTINGS.defaultFolderName);
    expect(elements.enableDateSubfolders.checked).toBe(DEFAULT_SETTINGS.enableDateSubfolders);
    expect(elements.warnDuplicates.checked).toBe(DEFAULT_SETTINGS.warnDuplicates);
    expect(elements.showNotifications.checked).toBe(DEFAULT_SETTINGS.showNotifications);

    // Check rendered folders
    expect(elements.folderList.children.length).toBe(3); // Other Bookmarks, folder_xss, folder_normal
    const xssLabel = elements.folderList.children[1];
    const span = xssLabel.children[1];
    expect(span.textContent).toBe('📁 Bookmarks / Other Bookmarks / <script>alert(1)</script> & "quotes"');
  });

  it('marks pinned folders as checked if present in settings', async () => {
    mockStore['bagmark_settings'] = {
      ...DEFAULT_SETTINGS,
      favoriteFolderIds: ['folder_normal'],
    };

    await initOptions();

    const normalLabel = elements.folderList.children[2];
    const input = normalLabel.children[0];
    expect(input.checked).toBe(true);
  });

  it('saves modified settings on Save button click', async () => {
    await initOptions();

    // Modify settings inputs
    elements.defaultFolderName.value = 'CustomBag';
    elements.enableDateSubfolders.checked = false;
    elements.warnDuplicates.checked = false;
    elements.showNotifications.checked = false;

    // Check a folder checkbox
    const normalLabel = elements.folderList.children[2];
    normalLabel.children[0].checked = true;

    // Click Save
    await elements.btnSave.click();

    expect(mockStore['bagmark_settings']).toEqual({
      defaultFolderName: 'CustomBag',
      enableDateSubfolders: false,
      warnDuplicates: false,
      showNotifications: false,
      favoriteFolderIds: ['folder_normal'],
    });

    expect(elements.saveStatus.textContent).toBe('Settings saved successfully! ✓');
  });

  it('falls back to "BagMark" if defaultFolderName is whitespace or empty', async () => {
    await initOptions();

    elements.defaultFolderName.value = '   ';
    await elements.btnSave.click();

    expect(elements.defaultFolderName.value).toBe('BagMark');
    expect(mockStore['bagmark_settings'].defaultFolderName).toBe('BagMark');
  });

  it('handles bookmarks.getTree error gracefully', async () => {
    (globalThis as any).browser.bookmarks.getTree = vi.fn(async () => {
      throw new Error('Bookmarks API unavailable');
    });

    await initOptions();

    expect(elements.folderList.innerHTML).toContain('Could not load bookmark folders.');
  });
});

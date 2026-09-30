export interface BookmarkMetadata {
  id: string;              // Firefox bookmark ID
  url: string;             // Destination URL
  title: string;           // Bookmark title
  dateAdded: number;       // Epoch milliseconds
  folderId: string;        // Destination folder ID
  folderTitle: string;     // Destination folder name (e.g. "2026-09" or "Dev")
  sourcePageUrl?: string;  // Page where the link was found
  sourcePageTitle?: string;// Title of originating webpage
  quote?: string;          // Selected text excerpt
  tags: string[];          // User tags
}

export interface BagMarkSettings {
  defaultFolderName: string;     // Default: "BagMark"
  enableDateSubfolders: boolean; // Default: true (YYYY-MM)
  warnDuplicates: boolean;       // Default: true
  favoriteFolderIds: string[];   // Pinned folder IDs for submenu
  showNotifications: boolean;    // Default: true
}

export const DEFAULT_SETTINGS: BagMarkSettings = {
  defaultFolderName: 'BagMark',
  enableDateSubfolders: true,
  warnDuplicates: true,
  favoriteFolderIds: [],
  showNotifications: true,
};

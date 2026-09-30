import { BookmarkMetadata } from './types';

const METADATA_PREFIX = 'bagmark_meta_';

export async function saveMetadata(metadata: BookmarkMetadata): Promise<void> {
  const key = `${METADATA_PREFIX}${metadata.id}`;
  await browser.storage.local.set({ [key]: metadata });
}

export async function getMetadata(bookmarkId: string): Promise<BookmarkMetadata | null> {
  const key = `${METADATA_PREFIX}${bookmarkId}`;
  const res = await browser.storage.local.get(key);
  return res && res[key] ? (res[key] as BookmarkMetadata) : null;
}

export async function getAllMetadata(): Promise<Record<string, BookmarkMetadata>> {
  const all = await browser.storage.local.get(null);
  const metadataMap: Record<string, BookmarkMetadata> = {};
  for (const [key, value] of Object.entries(all || {})) {
    if (key.startsWith(METADATA_PREFIX)) {
      const meta = value as BookmarkMetadata;
      const id = meta?.id || key.slice(METADATA_PREFIX.length);
      if (id && meta && typeof meta === 'object') {
        metadataMap[id] = { ...meta, id };
      }
    }
  }
  return metadataMap;
}

export async function deleteMetadata(bookmarkId: string): Promise<void> {
  const key = `${METADATA_PREFIX}${bookmarkId}`;
  await browser.storage.local.remove(key);
}

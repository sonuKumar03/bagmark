import { BagMarkSettings, DEFAULT_SETTINGS } from './types';

const SETTINGS_KEY = 'bagmark_settings';

export async function getSettings(): Promise<BagMarkSettings> {
  const result = await browser.storage.local.get(SETTINGS_KEY);
  if (!result || !result[SETTINGS_KEY]) {
    return { ...DEFAULT_SETTINGS };
  }
  return { ...DEFAULT_SETTINGS, ...result[SETTINGS_KEY] };
}

export async function saveSettings(partial: Partial<BagMarkSettings>): Promise<BagMarkSettings> {
  const current = await getSettings();
  const merged: BagMarkSettings = { ...current, ...partial };
  await browser.storage.local.set({ [SETTINGS_KEY]: merged });
  return merged;
}

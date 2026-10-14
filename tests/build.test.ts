import { describe, it, expect } from 'vitest';
import { build } from 'vite';
import type { RollupOutput } from 'rollup';

describe('browser builds', () => {
  it.each(['production', 'chromium'])('emits a usable %s manifest and entry points', async (mode) => {
    const result = await build({ mode, logLevel: 'silent', build: { write: false } }) as RollupOutput;
    const asset = result.output.find((item) => item.fileName === 'manifest.json');
    if (!asset || asset.type !== 'asset') throw new Error('Missing manifest');
    const manifest = JSON.parse(String(asset.source));
    expect(manifest.permissions).toContain('contextMenus');
    expect(manifest.permissions).not.toContain('menus');
    expect(result.output.some((item) => item.fileName === 'background.js')).toBe(true);
    for (const path of [manifest.action.default_popup, manifest.options_ui.page]) {
      expect(result.output.some((item) => item.fileName === path)).toBe(true);
    }
    if (mode === 'chromium') {
      expect(manifest.background).toEqual({ service_worker: 'background.js', type: 'module' });
      expect(manifest.minimum_chrome_version).toBe('123');
      expect(manifest.browser_specific_settings).toBeUndefined();
    } else {
      expect(manifest.background).toEqual({ scripts: ['background.js'], type: 'module' });
      expect(manifest.browser_specific_settings.gecko.id).toBe('bagmark@local.extension');
    }
  });
});

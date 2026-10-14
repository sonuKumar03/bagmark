import { afterEach, it, expect, vi } from 'vitest';

afterEach(() => vi.unstubAllGlobals());

it.each([false, true])('initializes the API namespace while preserving native browser=%s', async (native) => {
  const chromeApi = { runtime: { id: 'chromium' } };
  const nativeApi = { runtime: { id: 'native' } };
  vi.stubGlobal('chrome', chromeApi);
  vi.stubGlobal('browser', native ? nativeApi : undefined);
  vi.resetModules();
  await import('../src/lib/browser');
  expect(browser.runtime.id).toBe(native ? 'native' : 'chromium');
});

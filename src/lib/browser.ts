// Chromium before 148 exposes these APIs only as chrome.
if (typeof browser === 'undefined') {
  const globals = globalThis as typeof globalThis & { browser: typeof browser; chrome: typeof browser };
  globals.browser = globals.chrome;
}

export {};

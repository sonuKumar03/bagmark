import { defineConfig, Plugin } from 'vite';
import { resolve } from 'path';
import { readFileSync } from 'fs';

function manifestPlugin(chromium: boolean): Plugin {
  return {
    name: 'vite-plugin-bagmark-manifest',
    generateBundle() {
      const manifestPath = resolve(__dirname, 'manifest.json');
      const manifestContent = JSON.parse(readFileSync(manifestPath, 'utf-8'));

      // Transform background script entry from TypeScript source to compiled bundle
      manifestContent.background = chromium ? {
        service_worker: 'background.js',
        type: 'module'
      } : {
        scripts: ['background.js'],
        type: 'module'
      };
      if (chromium) {
        delete manifestContent.browser_specific_settings;
        manifestContent.minimum_chrome_version = '123';
      }

      this.emitFile({
        type: 'asset',
        fileName: 'manifest.json',
        source: JSON.stringify(manifestContent, null, 2)
      });
    }
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [manifestPlugin(mode === 'chromium')],
  build: {
    outDir: mode === 'chromium' ? 'dist-chromium' : 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        options: resolve(__dirname, 'src/options/index.html'),
        background: resolve(__dirname, 'src/background/index.ts')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') {
            return 'background.js';
          }
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  }
}));

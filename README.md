# BagMark 🎒

> An advanced, lightweight Firefox extension to quickly save bookmarks to customizable or date-organized folders with rich metadata and duplicate detection.

![BagMark Icon](public/assets/icon.svg)

---

## ✨ Features

- **1-Click Right-Click Quick Save**: Right-click any link or webpage background and select **"Bag It (Save to BagMark)"** to save directly into your default folder.
- **Context Submenus for Custom Folders**: Right-click submenu (`"Bag It to ▸"`) dynamically lists your favorite / pinned bookmark folders.
- **Chronological Date Organization**: Optional auto-filing into year-month subfolders (e.g. `BagMark / 2026-09 / ...`), created on the fly.
- **Rich Metadata Capture**: Automatically records exact timestamps (`dateAdded`), originating webpage URL/title, and any highlighted quote/text excerpt into local storage.
- **Duplicate Link Detection**: Alerts you if a link has already been bookmarked, showing where and when it was saved.
- **Interactive Popup Dashboard**: Fast, search-as-you-type dashboard to filter bookmarks by title, URL, quote, or tags, with folder filters, relative time badges, and 1-click clipboard copy.
- **Options & Customization**: Configure default folder name, toggle date-based subfolders, manage pinned submenu folders, and adjust alert notifications.
- **Modern Stack**: Built with TypeScript, Vite, Vitest, and Firefox Manifest V3.

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)
- npm or pnpm
- Mozilla Firefox (v115+)

### Installation & Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/sonuKumar03/bagmark.git
   cd bagmark
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run tests**:
   ```bash
   npm test
   ```

4. **Build the extension**:
   ```bash
   npm run build
   ```

5. **Load in Firefox**:
   - Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
   - Click **"Load Temporary Add-on..."**.
   - Select `dist/manifest.json` from this project directory.
   - Right-click any link on the web to start bagging links!

---

## 📦 Distribution & Packaging

### Local Packaging
To generate a local `.zip` bundle for manual testing or upload:
```bash
npm run package
```
The resulting zip will be created in `web-ext-artifacts/`.

### 🚀 Automated Releases & Mozilla AMO Signing
This repository is configured with a GitHub Actions workflow that automatically builds, tests, signs with Mozilla AMO, and publishes a GitHub Release when a git tag is pushed:

```bash
# 1. Tag a new version
git tag v1.0.3

# 2. Push tag to GitHub
git push origin v1.0.3
```

GitHub Actions will automatically:
1. Extract the version (`1.0.3`) and sync `package.json` & `manifest.json`.
2. Run test suites (`npm test`) and build the extension.
3. Sign the `.xpi` via Mozilla Add-ons (AMO) API using repository secrets (`AMO_JWT_ISSUER`, `AMO_JWT_SECRET`).
4. Publish a [GitHub Release](https://github.com/sonuKumar03/bagmark/releases) with the signed `.xpi` attached for 1-click install in Firefox.

---

## 🛠️ Project Structure

```
bagmark/
├── manifest.json              # Source Firefox MV3 manifest
├── package.json               # Dependencies & scripts
├── tsconfig.json              # Strict TypeScript configuration
├── vite.config.ts             # Vite multi-page build with manifest generation
├── public/assets/             # Brand icons (SVG & PNGs)
├── src/
│   ├── background/
│   │   └── index.ts           # Context menu management & save event handlers
│   ├── popup/                 # Interactive popup dashboard
│   │   ├── index.html
│   │   ├── popup.ts
│   │   └── popup.css
│   ├── options/               # Settings & folder picker page
│   │   ├── index.html
│   │   ├── options.ts
│   │   └── options.css
│   └── lib/                   # Core business logic modules
│       ├── types.ts           # TypeScript interfaces
│       ├── utils.ts           # Date formatters & URL normalizer
│       ├── storage.ts         # Metadata local storage manager
│       ├── config.ts          # Settings persistence
│       └── bookmarks.ts       # Firefox bookmark tree traversal & creation
└── tests/                     # Vitest automated test suite
```

---

## 📄 License

MIT © [sonuKumar03](https://github.com/sonuKumar03)

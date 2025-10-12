This file contains focused, repo-specific guidance for AI coding agents working on seedisplay.

- Big picture
  - Electron desktop app: `main.js` (main process) + `index.html` and `js/*` (renderer).
  - Security posture: renderer runs with `contextIsolation=true` and `nodeIntegration=false`. All Node and privileged I/O is provided through `preload.js` via a small explicit API exposed on `window.api`, plus `window.logger` and a tiny `axios` shim.
  - Files and persistent data live under a single base folder: BASE_PATH = `C:/SEE/` (hard-coded). Many operations use a relative path under that base.

- Important integration points & flows
  - Preload → Renderer: `contextBridge.exposeInMainWorld('api', {...})` in `preload.js`. Key methods: `getConfig()`, `readFile()`, `readBundledFile()`, `writeFile()`, `fetchJson()`, `getEnv()`, `existsSync()`, `saveBinary()`, `getMediaCacheInfo()`, `setMediaCacheLimit()`, `pruneMedia()`, and `onMessage()`.
  - Structured logging: use `window.logger.info|warn|error|debug(tag, ...args)` — logs are forwarded to the main process on the `renderer-log` IPC channel.
  - Preload resilience: `preload.js` detects when Node `require` is unavailable (sandboxed) and falls back to IPC calls to `ipcMain.handle('preload-*')` in `main.js`. If you change preload, update `main.js` handlers accordingly.
  - Media cache & binary download: renderer code downloads media via `window.api.saveBinary(relativePath, url)`; `preload` ensures parent directories exist and triggers `preload-pruneMedia` (best-effort).

- Project-specific conventions & gotchas
  - BASE_PATH is hard-coded to `C:/SEE/`. If you run or test on another path, update `BASE_PATH` in `preload.js` and `main.js` (or mock it in tests).
  - Many file APIs take a relative path under BASE_PATH (e.g. `media/foo.jpg`). Use `window.api.readFile('path')` rather than direct fs access.
  - `window.logger` is the canonical logging API. Avoid direct `console.*` in renderer code; prefer the logger so messages are captured by `electron-log` in main.
  - `API/listeDiapo.js` is testable and has unit tests under `test/listeDiapo.test.js` (Mocha). When refactoring parsing logic keep exports compatible with Node tests.
  - The app uses Open‑Meteo (no API key) in `js/meteo.js`; weather can be disabled in the config.

- Developer workflows (commands to use)
  - Run tests: `npm test` (uses Mocha). Run from workspace root (PowerShell):
    ```powershell
    cd "<repo>"; npm test
    ```
  - Start app (dev): `npm start` → runs `electron .`. DevTools open automatically by default.
  - Build/pack: `npm run dist` (uses `electron-builder`), `npm run publish` to build & publish (Windows target configured).
  - When modifying preload API: after edits, run `npm start` and check renderer console / DevTools. Renderer console messages are forwarded to main logs; look for `renderer-log` entries.

- IPC channel quick reference
  - Renderer → Main (preload fallbacks): `preload-getConfig`, `preload-readFile`, `preload-writeFile`, `preload-readBundledFile`, `preload-fetchJson`, `preload-getEnv`(sync), `preload-existsSync`(sync), `preload-saveBinary`, `preload-getMediaCacheInfo`, `preload-setMediaCacheLimit`(sync), `preload-pruneMedia`.
  - Logs: renderer sends `{ level, msg }` on `renderer-log`.

- Testing & refactoring tips
  - Keep pure logic (parsing, mapping) in plain modules under `API/` or `js/` and avoid `window` references so Mocha tests can require the modules directly.
  - To run a single test file: `npx mocha test/listeDiapo.test.js --exit`.
  - When adding features that touch disk/network, prefer adding a thin adapter in `preload.js` and unit-test the adapter logic separately.

- PR template hints (short)
  - Title: `chore: <area> - short description` (e.g. `chore(preload): add new api method saveThumbnail`).
  - Body: describe changed preload surface (list method names), mention if `main.js` needs corresponding `ipcMain.handle` handlers and include local smoke-test steps: `npm test && npm start`.

If anything here is unclear or you want more examples (e.g., a minimal code snippet showing the canonical way to read a file or use the logger), tell me which area and I'll expand it.

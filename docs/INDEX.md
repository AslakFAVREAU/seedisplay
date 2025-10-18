# 📚 Documentation Index - SEE Display

Last Updated: October 18, 2025

## 🚀 Quick Start
- **[QUICKSTART.md](./QUICKSTART.md)** - Démarrage rapide (dev & debug)
- **[../LAUNCH_MODES.md](../LAUNCH_MODES.md)** - Modes de lancement (start, start:debug, start:prod)
- **[../README.md](../README.md)** - Vue d'ensemble du projet

## 📂 Documentation Structure

### 📋 Main Docs (Root)
- **[../README.md](../README.md)** - Main project documentation
- **[../CHANGELOG.md](../CHANGELOG.md)** - Version history
- **[../LAUNCH_MODES.md](../LAUNCH_MODES.md)** - Application launch modes
- **[../BUILD_INSTALLER_GUIDE.md](../BUILD_INSTALLER_GUIDE.md)** - Build & installer guide
- **[../ICONS_QUICKSTART.md](../ICONS_QUICKSTART.md)** - Icon generation quickstart

### 📖 Guides ([guides/](./guides/))
- **[guides/HOW_TO_CREATE_GITHUB_ISSUE.md](./guides/HOW_TO_CREATE_GITHUB_ISSUE.md)** - GitHub issue automation
- **[guides/GITHUB_ISSUE_TEMPLATE_DISPLAY_RATIO.md](./guides/GITHUB_ISSUE_TEMPLATE_DISPLAY_RATIO.md)** - Display ratio issue template
- **[../INTEGRATION_GUIDE.md](../INTEGRATION_GUIDE.md)** - Module integration guide

### 🏗️ Features ([features/](./features/))
- **[features/SECURITY_AUDIT_GUIDE.md](./features/SECURITY_AUDIT_GUIDE.md)** - Security audit procedures
- **[features/SECURITY_AUDIT_REPORT.md](./features/SECURITY_AUDIT_REPORT.md)** - Latest security audit report

### 🛠️ Setup ([setup/](./setup/))
- **[setup/DEBUG_MODE.md](./setup/DEBUG_MODE.md)** - Debug mode configuration
- **[setup/INSTALLER_SIDEBAR_CUSTOMIZATION.md](./setup/INSTALLER_SIDEBAR_CUSTOMIZATION.md)** - NSIS installer sidebar customization

### 📚 Project Phases ([phases/](./phases/))
- **[phases/PHASE1_COMPLETE.md](./phases/PHASE1_COMPLETE.md)** - Phase 1: Architecture modernization
- **[phases/PHASE2_COMPLETE.md](./phases/PHASE2_COMPLETE.md)** - Phase 2: Integration & resilience
- **[phases/PHASE3_UI_RESPONSIVE.md](./phases/PHASE3_UI_RESPONSIVE.md)** - Phase 3: UI/UX & responsive design

### 📦 Archive ([archived/](./archived/))
Historical development documentation and session notes. See [archived/](./archived/) for:
- `AUTO_UPDATE*.md` - Auto-update feature docs
- `PHASE*.md` - Session notes from development phases
- `REFACTOR_*.md` - Refactoring notes
- `*_WEEK*.md` - Weekly progress reports

## 🎯 Current Status

### Completed
✅ v1.9.3 with custom branding (NSIS sidebar + taskbar icon)  
✅ 132/132 tests passing  
✅ 0 security vulnerabilities  
✅ GitHub Issues created for next features (#1, #2)  
✅ Repository cleanup & organization (Oct 18, 2025)  

### In Progress
� TODO #5: Multi-ratio display support (Issue #1)  
🔄 TODO #6: CEC energy management (Issue #2)  

## 📊 Key Modules

### Core System
- `main.js` - Main Electron process
- `preload.js` - Security bridge with API exposure
- `index.html` + `js/` - Renderer process
- `API/listeDiapo.js` - Presentation parsing engine

### Features
- `js/DisplayState.js` - State machine (event-driven)
- `js/ErrorHandler.js` - Circuit breaker pattern
- `js/MediaCache.js` - LRU cache with ETag
- `js/ApiManager.js` - API resilience wrapper
- `js/MediaCacheManager.js` - Preload orchestration
- `js/meteo.js` - Open-Meteo weather API
- `js/dateHeure.js` - Date/time display
- `js/ephe.js` - Ephemeris calculations

## 🔗 External References

- **GitHub Repo**: https://github.com/AslakFAVREAU/seedisplay
- **Open-Meteo API**: https://open-meteo.com/
- **Electron Docs**: https://www.electronjs.org/docs

## 📝 Notes

- All documentation is maintained in Markdown format
- Session summaries and detailed notes are archived in `./archived/` for reference
- For latest changes, refer to [../CHANGELOG.md](../CHANGELOG.md)
- Development phases are documented in `./phases/` for historical context
- **[COMPLETION_REPORT.md](../COMPLETION_REPORT.md)** - Rapport de complétion
- **[SUCCESS.md](../SUCCESS.md)** - Célébration Phase 1
- **[CHANGELOG.md](../CHANGELOG.md)** - Historique des changements
- **[REFACTOR_COMPLETED.md](../REFACTOR_COMPLETED.md)** - Refactoring completed

## 📋 Refactoring Documents
- **[REFACTOR_DISPLAY_SYSTEM.md](../REFACTOR_DISPLAY_SYSTEM.md)** - Refactoring display system
- **[preload.js](../preload.js)** - Bridge preload avec API

## 🎯 Current Status

**Version:** v1.9.0
**Test Status:** 110/110 passing
**Branch:** refactor/display-loop-system
**Build:** Ready for production

## 🚀 Production Ready
- ✅ Phase 1: 3 modules, 60 tests
- ✅ Phase 2: Full integration, 110 tests
- ✅ Phase 3: Responsive UI, DEBUG_MODE
- ✅ All backward compatible
- ✅ Zero breaking changes

## 📂 File Organization

```
seedisplay/
├── README.md                 # Main project README
├── docs/
│   ├── INDEX.md            # ← You are here
│   ├── QUICKSTART.md
│   ├── phases/
│   │   ├── PHASE1_SUMMARY.md
│   │   ├── PHASE2_COMPLETE.md
│   │   ├── PHASE2_RESUME_FR.md
│   │   ├── PHASE2_WEEK1.md
│   │   ├── PHASE2_WEEK4.md
│   │   └── PHASE3_UI_RESPONSIVE.md
│   └── features/
├── js/
│   ├── DisplayState.js       # Phase 1
│   ├── ErrorHandler.js       # Phase 1
│   ├── ApiManager.js         # Phase 2
│   ├── MediaCacheManager.js  # Phase 2
│   └── ...
├── API/
│   ├── listeDiapo.js
│   └── ...
├── test/
│   └── **/*.test.js          # 110 passing tests
├── package.json              # v1.9.0
└── main.js, preload.js, index.html
```

## 🔗 Related Files (Root)
- `PHASE1_SUMMARY.md`
- `PHASE2_COMPLETE.md`
- `PHASE2_RESUME_FR.md`
- `PHASE2_WEEK1.md`
- `PHASE2_WEEK4.md`
- `README_PHASE1.md`
- `REFACTOR_COMPLETED.md`
- `SUCCESS.md`

**Note:** Consider moving these to `docs/phases/` for better organization.

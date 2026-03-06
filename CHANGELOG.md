# CHANGELOG

## v1.12.1 - Patch Release (1 Mars 2026)

### 🔧 Maintenance
- Rebuild Linux (AppImage x86_64)

---

## v1.10.1 - Custom Display Mode (9 Février 2026)

### 🎯 Résumé
- ✅ Mode résolution personnalisée (custom display) fonctionnel
- ✅ Approche clip-path sur `<body>` pour clipper le contenu aux dimensions exactes
- ✅ Fond noir sur le reste de l'écran via `html { background: #000 }`
- ✅ Compatible avec tous les éléments `position: fixed`
- ✅ Footer (bottomBar + logo) masqué en mode custom
- ✅ Debug log masqué en mode custom

### ✨ Features

#### Mode Custom Resolution
- Configuration via `configSEE.json` : `isCustomResolution`, `screenWidth`, `screenHeight`
- Fenêtre fullscreen avec `clip-path: polygon()` sur `<body>` pour clipper le rendu
- Le clip-path clippe TOUT y compris les éléments `position: fixed`
- Le reste de l'écran affiche le background noir de `<html>`
- Variable globale `window.IS_CUSTOM_MODE` pour les guards JS

#### Guards IS_CUSTOM_MODE
- `listeDiapo.js` : `_applyDimensionsToDOM()` et `_applyCssDimensions()` skip en mode custom
- `defaultScreen.js` : sleep screen utilise les dimensions custom
- `main.js` : `resize-window` IPC handler ignoré en mode custom

### 🔧 Modifications Code

**main.js**
- `createWindow()` : injection CSS clip-path + JS globals via `did-finish-load`
- `resize-window` handler : return early si mode custom
- `#bottomBar` masqué via CSS `display: none !important` en mode custom
- `#debugLog` masqué via JS en mode custom

**index.html**
- Logo footer réduit : `clamp(20px, 3vh, 35px)` (était `clamp(30px, 6vh, 50px)`)
- Debug log : suppression de l'auto-display (`style.display = 'block'`)

**API/listeDiapo.js**
- Guard `IS_CUSTOM_MODE` en haut de `_applyDimensionsToDOM()` et `_applyCssDimensions()`
- Planning bar utilise `CUSTOM_HEIGHT + 'px'` au lieu de `100vh` en mode custom

**js/defaultScreen.js**
- Sleep screen : dimensions custom et insertion dans `#appWrapper` en mode custom

### 📊 Tests & Qualité
- ✅ Clip-path fonctionne pour 511×1152 sur écran 2560×1600
- ✅ Pas de régression sur le mode standard
- ✅ Pas de debug log visible en mode custom
- ✅ Pas de barre footer visible en mode custom

---

## v1.10.0 - Raspberry Pi Support

- ✅ Support cross-platform (Windows/Linux/macOS)
- ✅ Détection automatique Raspberry Pi
- ✅ Optimisations mémoire et GPU pour ARM64
- ✅ Script d'installation automatique
- ✅ Service systemd pré-configuré
- ✅ Build targets Linux ARM64 (.deb, AppImage, tar.gz)

---

## v1.9.0 - Production Ready

### 🎯 Résumé Session
- ✅ Tous les tests passent (110/110)
- ✅ Documentation réorganisée et centralisée
- ✅ DEBUG_MODE implémenté pour développement
- ✅ Layout responsive avec flexbox
- ✅ Logique GIF Noël (décembre seulement)

### ✨ Features Nouvelles

#### Debug Mode (`npm run start:debug`)
- Bloque sur pageDefault sans boucle
- Permet modification graphique via DevTools (F12)
- `DEBUG_MODE = false; LoopDiapo();` pour reprendre

#### UI Responsive
- 100vh layout avec flexbox
- Widths dynamiques (90%, max-width clamped)
- Fonts responsive (clamp())
- Météo responsive avec flex-wrap
- GIF Noël positionné en haut-droit (fixed)

#### Logique Saisonnière
- GIF Noël affiché en décembre uniquement
- Display: none tous les autres mois
- Intégré dans defaultScreen.js

### 📚 Documentation

**Nouvelle structure docs/**
```
docs/
├── README.md              # Index central
├── QUICKSTART.md          # Commandes essentielles
├── DEBUG_MODE.md          # Guide debug détaillé
└── phases/
    ├── PHASE1_COMPLETE.md
    └── PHASE2_COMPLETE.md
```

### 🔧 Modifications Code

**loopDiapo.js**
- Variable `pauseLoop` pour pause manuelle
- `window.DEBUG_MODE` variable globale
- Early check dans `LoopDiapo()` pour respecter DEBUG_MODE
- Fonction `pauseOnPageDefault()` / `resumeLoop()`

**defaultScreen.js**
- Vérification mois courant pour afficher GIF
- `monthGif == 11` pour décembre
- Logs informatifs pour debug

**index.html**
- CSS refactorisé pour flexbox full-page
- `#pageDefault`: 100vh, flex column
- `#weekDiv`: margin: 2vh auto
- `#gifNoel`: position: fixed, right: 15%, top: 0
- `#bottomBar`: padding-bottom: 70px sur pageDefault
- Meteorological cards: responsive, flex-wrap

**package.json**
- New script: `npm run start:debug`
- Passes `DEBUG_MODE=true` via cross-env

### 📊 Tests & Quality
- ✅ 110/110 tests passing
- ✅ 0 breaking changes
- ✅ Backward compatible
- ✅ All modules integrated

### 🚀 Production Ready

**Commits this session:**
- `fef1a59` - docs: reorganize documentation
- Previous Phase 2 commits: 19b6a35, 86ad3d0, 2ca90a7, cd4c03c, 247b3ef

**Version Tags:**
- `v1.9.0` - Production stable

### 📝 Usage Guide

**Development (Debug)**
```bash
npm run start:debug
# F12 > Modify CSS > resumeLoop() to test
```

**Production**
```bash
npm start
# Normal loop operation
```

**Build**
```bash
npm run dist  # Create seedisplay-v1.9.0.exe
```

### 🎓 Key Learnings

1. **Responsive Design**: Flexbox + viewport units (vh, vw) = powerful responsive
2. **Debug Mode**: Environmental variable approach clean for dev/prod separation
3. **Documentation**: Centralized docs/ structure makes knowledge base discoverable
4. **Git Workflow**: Logical commits per feature makes history readable

### 🔮 Next Steps (Phase 3)

- Advanced monitoring & metrics
- Offline mode support
- Network resilience improvements
- UI animations & transitions
- Mobile refinement

---

**Commit**: fef1a59
**Branch**: refactor/display-loop-system
**Status**: ✅ Ready for production merge

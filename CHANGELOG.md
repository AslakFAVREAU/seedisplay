# CHANGELOG

## v2.10.0 - Fix syntaxe preload vidéo (12 Mars 2026)

### 🐛 Fix
- **Correction SyntaxError loopDiapo.js:192** : bloc `catch` orphelin resté après la désactivation du preload vidéo — empêchait le chargement complet du fichier et donc `LoopDiapo` n'était plus défini

---

## v2.0.9 - Fix PIPELINE_ERROR_DECODE définitif (12 Mars 2026)

### 🐛 Fix critique
- **cloneNode vidéo** : remplacement de l'élément `<video>` par un élément neuf (`createElement`) à chaque lecture. C'est la seule solution pour éviter que Chromium réutilise les décodeurs matériels audio/vidéo corrompus au 2ème passage
- **Suppression `<source>`** : utilisation de `video.src` directement (plus de `<source>` enfant qui empêche le reset du pipeline)
- **Preload désactivé** : le préchargement dans le player inactif corrompait le décodeur du prochain player

---

## v2.0.8 - Fix DECODE 2ème passage vidéo (12 Mars 2026)

### 🐛 Fix critique
- **PIPELINE_ERROR_DECODE au 2ème passage** : reset complet du décodeur vidéo (`pause` + `removeAttribute('src')` + `load()`) avant chaque chargement — Chromium réutilisait le pipeline avec un état corrompu (`is_key_frame=0` sans frames de référence)
- Appliqué sur les deux players vidéo (`showMedia` + `_preloadNextVideo`)

### 🛡️ Résilience
- **Re-download sur DECODE** : premier DECODE tente un re-download (fichier possiblement corrompu), blacklist seulement si échec après re-download
- Flag `redownloaded` persistant par fichier dans la blacklist (1 seul re-download par fichier)

---

## v2.0.7 - Blacklist DECODE & Détection Codecs (12 Mars 2026)

### 🛡️ Résilience vidéo
- **Blacklist vidéo DECODE/SRC_NOT_SUPPORTED** : après 3 échecs consécutifs sur le même fichier, skip immédiat (plus de re-download inutile)
- **Re-download limité** : seulement sur erreurs NETWORK (code 2) ou inconnues (code 0), pas sur DECODE (codec incompatible)
- **Reset blacklist** : vidée automatiquement à chaque redémarrage de boucle (nouveau refresh API)

### 📡 Monitoring
- **Détection codecs au boot** : `canPlayType()` sur H.264, H.265, VP8, VP9, AV1, AAC, Opus, MP3, AC3, EAC3
- **Heartbeat enrichi** : `debug.codecs` (support par codec) + `videoHealth.blacklisted` détaillé (file, count, label, reason, since)

---

## v2.0.6 - Fix BASE_PATH & Résilience Media (11 Mars 2026)

### 🐛 Fix critique
- **BASE_PATH Windows manquant dans main.js** : `getBasePath()` ne gérait pas `win32`, tombait dans le fallback `~/.seedisplay/` au lieu de `C:/SEE/`. Le protocole `see-media://` et tous les IPC handlers cherchaient les fichiers au mauvais endroit → ERR_FILE_NOT_FOUND sur les médias
- Alignement main.js/preload.js : Windows `C:/SEE/`, Linux `/opt/seedisplay/data/`, macOS `~/Library/Application Support/SEEDisplay/`

### 🛡️ Résilience media (vidéo + image)
- **Video health tracker** : `_videoHealth` global + `_reportVideoError()` sur tous les chemins d'erreur (DOWNLOAD_FAILED, PLAY_FAILED, LOAD_TIMEOUT, STALLED_TIMEOUT, MediaError, REDOWNLOAD_FAILED)
- **Image health tracker** : `_imageHealth` global + `_reportImageError()` + retry avec re-download sur `onerror`
- **Abort controllers** : `ac.abort()` sur chaque chemin de sortie vidéo (timeout, stalled, play().catch, error handler) pour éviter les double-skip
- **Ghost loop prevention** : `_abortAllVideoControllers()` dans `stopLoopDiapo()` et `LoopDiapo()` au démarrage
- **Stack overflow fix** : `masquerPageDefault` wrap-around via `setTimeout` au lieu d'appel direct
- **Unknown mediaType** : bloc `else` final avec skip en 500ms (anti-deadlock)
- **ABORTED (code 1)** : ignoré dans le handler d'erreur vidéo (causé par notre propre `load()` lors du retry)
- **see-media:// nocache** : `#nocache=` au lieu de `?nocache=` (compatible avec le protocole custom)

### 📡 Monitoring (Heartbeat enrichi)
- `videoHealth` + `imageHealth` dans le payload heartbeat
- `currentMedia` fix : lecture du format tableau `[type, file]`
- `recentErrors` (5 dernières) + `circuitBreakers` status

### 🔧 Preload
- Vérification intégrité sur 304 : si le fichier local est absent/vide malgré un ETag valide → supprime metadata + force re-download

---

## v2.0.5 - Résilience & Monitoring (11 Mars 2026)

### 🛡️ Résilience
- **Météo cache offline** : sauvegarde dans `cache/lastMeteo.json` après chaque fetch réussi, rechargé automatiquement en cas d'erreur réseau
- **Météo scheduler autonome** : `setInterval(30min)` démarré après le premier fetch réussi (ne dépend plus du cycle diapo)
- **Seuil restart API** : porté de 3 à 10 erreurs consécutives (~50 min), les diapos existantes restent actives pendant la coupure

### 📡 Monitoring (Heartbeat)
- **Erreurs JS capturées** : `window.onerror` + `unhandledrejection` → stockés dans `ErrorHandler.errorLog`
- **Remontée via heartbeat** : 5 dernières erreurs + état des circuit breakers envoyés dans chaque payload SOEK

### 🐛 Fixes
- `_applyMeteoData()` factorisé pour réutilisation depuis le cache offline

---

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

# 🚀 Quickstart Guide

## Installation & Démarrage

### Prérequis
- Node.js 18+
- npm 9+

### Installation
```bash
cd seedisplay
npm install
```

## Commandes Essentielles

### Mode Development (Production)
```bash
npm start
```
Lance l'app normalement avec boucle complète.

### Mode Debug (Développement)
```bash
npm run start:debug
```
Lance l'app **bloquée sur pageDefault** pour éditer les styles via DevTools (F12).

Dans la console DevTools:
- Reprendre la boucle: `DEBUG_MODE = false; LoopDiapo();`

### Tests
```bash
npm test                    # Tous les tests (110 tests)
npm run test:performance   # Tests de performance
```

### Build & Production
```bash
npm run dist               # Crée seedisplay-v1.9.0.exe
npm run publish           # Build + upload vers dépôt
```

## Structure Projet Rapide

```
seedisplay/
├── index.html           # Entry point (App shell)
├── main.js              # Electron main process
├── preload.js           # Bridge main ↔ renderer
├── app.scss             # Styles globaux
│
├── js/
│   ├── loopDiapo.js     # Boucle diaporama
│   ├── DisplayState.js  # State management (Phase 1)
│   ├── ErrorHandler.js  # Circuit breaker (Phase 1)
│   ├── ApiManager.js    # API resilience (Phase 2)
│   ├── defaultScreen.js # Page accueil
│   ├── meteo.js         # Météo Open-Meteo
│   └── ...
│
├── API/
│   ├── listeDiapo.js    # Parse API diapo
│   └── ...
│
├── test/                # Tests Mocha
├── docs/                # Documentation (ce dossier)
└── logo/                # Logos & assets
```

## Debug Mode - Étapes Typiques

1. **Lancer en debug:**
   ```bash
   npm run start:debug
   ```

2. **Ouvrir DevTools:** `F12` (ou Ctrl+Shift+I)

3. **Modifier CSS directement** dans l'onglet Elements

4. **Tester en reprise de boucle:**
   ```javascript
   DEBUG_MODE = false; LoopDiapo();
   ```

5. **Voir les logs:** Console DevTools affiche tous les logs

## Variables d'Environnement

| Variable | Valeur | Effet |
|----------|--------|--------|
| `DEBUG_MODE` | `true` | Bloque sur pageDefault (npm run start:debug) |
| `NODE_ENV` | `production` | Mode production (npm run start:prod) |

## Fichiers Importants

- `index.html` - Layout responsive avec flexbox
- `js/loopDiapo.js` - Cœur de la boucle (DEBUG_MODE, pauseOnPageDefault())
- `js/defaultScreen.js` - Page accueil + logique GIF Noël
- `preload.js` - API sécurisée renderer ↔ main

## Prochaines Étapes

- Lire `DEVELOPMENT.md` pour plus de détails
- Consulter `PHASE2_COMPLETE.md` pour l'architecture complète
- Voir `TROUBLESHOOTING.md` si des problèmes

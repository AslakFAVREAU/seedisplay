# 🔧 Debug Mode Guide

## Vue d'Ensemble

Le **Debug Mode** (`npm run start:debug`) vous permet de bloquer l'interface sur `pageDefault` pour éditer les styles graphiquement sans que l'app ne boucle.

## Activation

### Lancer en mode Debug
```bash
npm run start:debug
```

### Vérification
Dans la console DevTools (F12):
```javascript
console.log(DEBUG_MODE);  // true
```

## Utilisation

### 1. Ouvrir DevTools
- **F12** ou **Ctrl+Shift+I** (Windows/Linux)
- **Cmd+Option+I** (macOS)

### 2. Onglet "Elements" (ou "Inspector")
- Vous verrez `#pageDefault` visible avec tous les éléments (heure, date, météo, weekDiv, etc.)
- Modifier directement les CSS dans le panneau Styles

### 3. Tester les changements en temps réel
- Les modifications CSS s'appliquent **immédiatement**
- Voir le résultat sans recharger

### 4. Reprendre la boucle
Dans la console DevTools, tapez:
```javascript
DEBUG_MODE = false; LoopDiapo();
```

### 5. Re-bloquer (si besoin)
```javascript
DEBUG_MODE = true;
```

## Cas d'Usage

### Ajuster les margins
```javascript
// Dans Elements > #pageDefault
// Modifier: padding-bottom: 70px;
```

### Tester la responsivité
- Redimensionner la fenêtre (F12 > Responsive mode)
- Observer les changements avec flexbox

### Vérifier z-index et positions
```javascript
// Console: Inspecter les computed styles
const el = document.getElementById('weekDiv');
console.log(window.getComputedStyle(el));
```

## Structure des Éléments en Debug

```
#pageDefault (flex column, 100vh, bloquée)
├── #titleMain (date, heure, éphe)
├── #zone_meteo (5 cartes météo)
├── #weekDiv (numéro de semaine)
├── #bottomBar (fixed, logo en bas)
└── #gifNoel (fixed, top-right, décembre seulement)
```

## Console Helpers

Commandes utiles disponibles dans la console:

```javascript
// Vérifier l'état
console.log('DEBUG_MODE:', DEBUG_MODE);
console.log('pauseLoop:', pauseLoop);

// Forcer un refresh
location.reload();

// Masquer/Afficher des éléments
document.getElementById('zone_meteo').style.display = 'none'; // Masquer météo
document.getElementById('zone_meteo').style.display = 'flex';   // Afficher

// Simuler décembre (tester GIF Noël)
// Modifier defaultScreen() pour ne pas dépendre de la date réelle
```

## Logs DevTools

Tous les logs `window.logger.info/warn/error` apparaissent dans la console. Filtrer:
```javascript
// Dans la console, utiliser le filtre
// Chercher "diapo" pour les logs de loopDiapo
// Chercher "default" pour les logs de defaultScreen
```

## Troubleshooting Debug Mode

### L'app continue à boucler en debug
- Vérifier que `npm run start:debug` (et non `npm start`)
- Vérifier la console: voir le log `🔧 DEBUG_MODE activated via npm start:debug`

### Les changements CSS ne s'appliquent pas
- Vérifier le z-index des éléments
- Vérifier que l'élément n'est pas `display: none`
- Vérifier position: fixed vs relative

### Comment sortir du debug mode?
```javascript
DEBUG_MODE = false; LoopDiapo();
// Puis relancer npm start pour production
```

## Tips Pro

1. **Cloner le style d'un élément:**
   ```javascript
   const el = document.getElementById('weekDiv');
   const clone = el.cloneNode(true);
   clone.id = 'weekDiv-test';
   document.body.appendChild(clone);
   ```

2. **Tester les animations:**
   - Ajouter `transition: all 3s ease;` temporairement pour voir le mouvement

3. **Responsive testing:**
   - F12 > Toggle device toolbar > Tester différentes résolutions

4. **Memory profiling:**
   - F12 > Performance > Enregistrer > Relancer la boucle > Analyser

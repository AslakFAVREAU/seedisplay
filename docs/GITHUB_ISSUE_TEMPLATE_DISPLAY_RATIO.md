# [AMÉLIORATION] Gestion multi-ratio et orientation d'écran (16:9, 16:10, Portrait, Vertical)

## 📋 Objectif
Gérer correctement l'affichage des images et vidéos selon les différents ratios d'écran et orientations.

## 🎬 Problématique Actuelle
- Bandes noires visibles quand image 16:9 sur écran 16:10
- Pas de support pour les orientations portrait/vertical
- Pas de support pour d'autres ratios (4:3, 21:9, etc.)

## 📊 Ratios à Gérer
1. **16:9** - HDMI standard, TV, projecteur classique
2. **16:10** - Moniteurs de bureau, certaines TV
3. **4:3** - Anciens écrans, certains projecteurs
4. **21:9** - Ultrawide
5. **Ratio libre** - Images/vidéos non standard

## 🔄 Orientations à Supporter
1. **Paysage (Horizontal)** - 1920x1080
2. **Portrait (Vertical)** - 1080x1920
3. **Carré (1:1)** - 1024x1024

## 🛠️ Solution Proposée

### Modes d'Affichage
- **FILL**: Remplir l'écran (peut crop les bords)
- **FIT**: Afficher l'image complète (peut avoir des bandes)
- **STRETCH**: Étirer l'image (déforme le contenu)

### Étapes d'Implémentation

#### 1. Détection du Ratio de l'Écran
```javascript
// Dans main.js ou preload.js
function detectScreenRatio() {
  const { display } = require('electron').screen;
  const primaryDisplay = display.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  
  const ratio = width / height;
  
  if (Math.abs(ratio - 16/9) < 0.01) return '16:9';
  if (Math.abs(ratio - 16/10) < 0.01) return '16:10';
  if (Math.abs(ratio - 4/3) < 0.01) return '4:3';
  if (Math.abs(ratio - 21/9) < 0.01) return '21:9';
  
  return `${Math.round(ratio * 100) / 100}:1`;
}
```

#### 2. Détection du Ratio de l'Image
```javascript
// Dans API/listeDiapo.js
function getImageRatio(width, height) {
  const ratio = width / height;
  return {
    decimal: ratio,
    name: getRatioName(ratio),
    isPortrait: height > width
  };
}

function getRatioName(ratio) {
  if (Math.abs(ratio - 16/9) < 0.01) return '16:9';
  if (Math.abs(ratio - 16/10) < 0.01) return '16:10';
  if (Math.abs(ratio - 4/3) < 0.01) return '4:3';
  if (Math.abs(ratio - 1) < 0.05) return '1:1';
  return 'libre';
}
```

#### 3. Implémentation des Modes d'Affichage
```scss
// Dans app.scss
.media-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;

  /* Mode FIT - Voir l'image complète */
  &.mode-fit img,
  &.mode-fit video {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  /* Mode FILL - Remplir l'écran */
  &.mode-fill img,
  &.mode-fill video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  /* Mode STRETCH - Étirer l'image */
  &.mode-stretch img,
  &.mode-stretch video {
    width: 100%;
    height: 100%;
    object-fit: fill;
  }

  /* Support Portrait */
  &.orientation-portrait {
    img, video {
      max-width: 100%;
      max-height: 100%;
    }
  }
}
```

#### 4. Configuration dans configSEE.json
```json
{
  "displayMode": "fit",
  "detectedScreenRatio": "16:10",
  "supportedRatios": ["16:9", "16:10", "4:3", "1:1", "libre"],
  "portraitSupport": true,
  "autoDetectRatio": true
}
```

#### 5. Logique dans loopDiapo.js
```javascript
// Appliquer le bon mode lors de la lecture
function displayMedia(media) {
  const container = document.querySelector('.media-container');
  
  // Détecter le ratio de l'image/vidéo
  const ratio = detectMediaRatio(media);
  
  // Appliquer la classe appropriée
  container.classList.remove('mode-fit', 'mode-fill', 'mode-stretch');
  container.classList.add(`mode-${config.displayMode}`);
  
  if (ratio.isPortrait) {
    container.classList.add('orientation-portrait');
  } else {
    container.classList.remove('orientation-portrait');
  }
}
```

### Fichiers à Modifier
- `index.html` - Structure des conteneurs média
- `app.scss` - Styles pour les différents modes
- `js/loopDiapo.js` - Logique d'application du mode
- `js/getConfigSEE.js` - Charger la config du mode d'affichage
- `preload.js` - Exposer la détection de ratio d'écran
- `configSEE.json` - Ajouter les paramètres

### Tests Recommandés
```javascript
// test/display-ratio.test.js
describe('Display Ratio Detection', () => {
  it('should detect 16:9 ratio correctly');
  it('should detect 16:10 ratio correctly');
  it('should detect portrait orientation');
  it('should apply correct CSS mode for FIT');
  it('should apply correct CSS mode for FILL');
  it('should handle mixed ratios in sequence');
});
```

## ✅ Critères de Succès
- [ ] Aucune bande noire non désirée sur 16:9 + 16:10
- [ ] Images en portrait s'affichent correctement
- [ ] Mode d'affichage configurable (FIT/FILL/STRETCH) dans configSEE.json
- [ ] Tests sur 3+ résolutions différentes
- [ ] Documentation mise à jour (README, docs/)
- [ ] Backward compatible avec les configurations existantes

## 📊 Détails
- **Priorité:** 🟡 Moyenne (Amélioration UX)
- **Effort estimé:** 2-3 heures
- **Impact:** Améliore expérience visuelle sur tous les écrans
- **Complexité:** Moyenne
- **Tags:** `amélioration`, `enhancement`, `ui`, `display`

## 📝 Checklist d'Implémentation
- [ ] Créer fonction de détection de ratio écran
- [ ] Créer fonction de détection de ratio image/vidéo
- [ ] Implémenter les 3 modes d'affichage en CSS
- [ ] Ajouter la configuration dans configSEE.json
- [ ] Intégrer la logique dans loopDiapo.js
- [ ] Tester sur résolutions multiples
- [ ] Ajouter les tests unitaires
- [ ] Documenter dans README.md
- [ ] Valider sur écrans réels (16:9, 16:10, 4:3)

## 🔗 Ressources Connexes
- [object-fit CSS](https://developer.mozilla.org/en-US/docs/Web/CSS/object-fit)
- [Electron Screen API](https://www.electronjs.org/docs/api/screen)
- [Aspect Ratio Standards](https://en.wikipedia.org/wiki/Aspect_ratio_(image))

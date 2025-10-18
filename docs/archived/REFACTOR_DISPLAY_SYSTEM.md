# Refactor du système d'affichage - Architecture Slides avec Z-Index

## Problèmes de l'ancien système

L'ancien système utilisait un double-buffering complexe avec manipulation manuelle de `display` et `opacity` :
- Variables `imgShow/imgLoad` et `player/playerLoad` difficiles à synchroniser
- Appels multiples à `smoothTransition()` créant des interférences
- Timing complexe avec multiples `setTimeout` imbriqués
- Transitions visuelles saccadées et apparitions furtives
- Code difficile à maintenir et déboguer

## Nouveau système : Architecture Slides

### Concept
Tous les médias (images et vidéos) sont des "slides" empilés en position absolute. Un seul slide est visible à la fois via la classe CSS `.active`.

### Structure HTML
```html
<div id="mediaContainer">
  <div class="media-slide" id="divVideo1">...</div>
  <div class="media-slide" id="divVideo2">...</div>
  <div class="media-slide" id="divImg1">...</div>
  <div class="media-slide" id="divImg2">...</div>
</div>
```

### CSS
```css
.media-slide {
  position: absolute;
  opacity: 0;           /* Invisible par défaut */
  z-index: 1;
  transition: opacity 0.5s ease-in-out;  /* Transition CSS pure */
}

.media-slide.active {
  opacity: 1;           /* Visible */
  z-index: 2;          /* Au premier plan */
}
```

### Avantages

1. **Simplicité** : Un seul toggle (classe `.active`) au lieu de multiples variables
2. **Performance** : Transitions CSS natives (GPU-accelerated)
3. **Fluidité** : Cross-fade propre sans saccades
4. **Maintenabilité** : Logique linéaire facile à comprendre
5. **Robustesse** : Pas d'interférences entre transitions

### Flux d'exécution

1. **Sélection du slide** : `getNextSlideForMediaType()` trouve le prochain slide disponible du bon type
2. **Préchargement** : Le média est chargé dans le slide (backgroundImage ou video.load())
3. **Activation** : `activateSlide()` ajoute la classe `.active` → transition CSS automatique
4. **Préchargement suivant** : Après 500ms, le prochain média est préchargé pendant l'affichage actuel
5. **Programmation** : `setTimeout()` pour le prochain média selon la durée configurée

### API Principale

#### `LoopDiapo()`
Démarre la boucle d'affichage séquentiel
- Charge `ArrayMedia` ou fallback à `ArrayDiapo`
- Commence à l'index 0
- Boucle automatiquement (wrap-around)

#### `stopLoopDiapo()`
Arrête la boucle et désactive tous les slides

#### `showMedia(mediaIndex)`
Affiche un média spécifique
- Gère le wrap-around automatique
- Active le slide approprié
- Lance la vidéo si nécessaire
- Précharge le média suivant
- Programme le prochain affichage

#### `activateSlide(slideIndex)`
Active un slide et désactive tous les autres
- Manipulation CSS pure (classe `.active`)
- Pas de manipulation de `display` ou `opacity` en JS

### Configuration

#### Variables globales
- `currentSlideIndex` : Index du slide actuellement affiché (0-3)
- `currentMediaIndex` : Position dans ArrayLoop
- `mediaLoop` : Array des médias à afficher
- `loopTimeout` : Timer pour le prochain média

#### Mapping des slides
```javascript
const SLIDES = {
    VIDEO1: { id: 'divVideo1', index: 0, type: 'video', videoId: 'video1', sourceId: 'srcVideo1' },
    VIDEO2: { id: 'divVideo2', index: 1, type: 'video', videoId: 'video2', sourceId: 'srcVideo2' },
    IMG1: { id: 'divImg1', index: 2, type: 'image' },
    IMG2: { id: 'divImg2', index: 3, type: 'image' }
};
```

### Timing

- **Transition CSS** : 500ms (opacity fade-in/fade-out)
- **Préchargement** : Démarre 500ms après activation (après transition)
- **Durée d'affichage** : Configurable par média (défaut 5000ms)

### Logging

Tous les événements sont loggés via `window.logger` :
- `info` : Activation de slides, affichage de médias
- `debug` : Programmation des timeouts
- `error` : Erreurs de chargement ou lecture

### Migration depuis l'ancien système

L'ancien système est sauvegardé dans `js/loopDiapo.old.js` pour référence.

Principales différences :
- ❌ Anciennement : `imgShow`, `imgLoad`, `player`, `playerLoad`
- ✅ Maintenant : `currentSlideIndex` unique
- ❌ Anciennement : Manipulation manuelle de `display` et `opacity`
- ✅ Maintenant : Classe CSS `.active` uniquement
- ❌ Anciennement : `smoothTransition()` avec timeouts imbriqués
- ✅ Maintenant : Transitions CSS pures

### Tests

Pour tester :
```bash
npm start
```

Vérifier dans les logs :
- `activating slide index X`
- `showing media Y: type=Z file=...`
- `preloading [next media] in [slideId]`
- `scheduling next media in X seconds`

### Performance

Améliorations mesurables :
- ✅ Transitions fluides sans saccades
- ✅ Pas d'apparitions furtives
- ✅ Cross-fade professionnel
- ✅ Préchargement non-bloquant
- ✅ Utilisation du GPU pour les transitions CSS

## Branche

Ce refactor est sur la branche : `refactor/display-loop-system`

Pour revenir à l'ancien système :
```bash
git checkout chore/electron-upgrade
```

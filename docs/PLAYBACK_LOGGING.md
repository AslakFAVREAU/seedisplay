# PlaybackLogger - Documentation

## Vue d'ensemble

Le module `PlaybackLogger` enregistre précisément chaque diffusion de média pour permettre la génération de rapports de régie publicitaire.

## Emplacement des logs

```
C:\SEE\logs\playback-YYYY-MM-DD.json
```

Un nouveau fichier est créé chaque jour. Les logs sont automatiquement flush toutes les 30 secondes.

## Structure des données

Chaque entrée de log contient :

| Champ | Type | Description |
|-------|------|-------------|
| `timestamp` | string | Horodatage ISO 8601 du début de diffusion |
| `ecranId` | number | ID de l'écran (depuis configSEE.json) |
| `sessionId` | string | ID unique de la session applicative |
| `mediaId` | number | ID du média dans la base de données |
| `mediaNom` | string | Nom du média |
| `mediaFichier` | string | Nom du fichier média |
| `mediaType` | string | Type de média : `img` ou `video` |
| `diapoId` | number | ID du diaporama parent |
| `diapoNom` | string | Nom du diaporama |
| `startTime` | string | Heure exacte de début (ISO 8601) |
| `endTime` | string | Heure exacte de fin (ISO 8601) |
| `dureeConfiguree` | number | Durée configurée en secondes |
| `dureeReelle` | number | Durée réellement affichée en secondes |
| `status` | string | Statut de fin (voir ci-dessous) |

## Statuts possibles

| Statut | Description |
|--------|-------------|
| `complete` | Le média a été affiché pendant toute sa durée configurée |
| `interrupted` | Le média a été remplacé par le suivant (comportement normal en boucle) |
| `error` | Une erreur s'est produite pendant l'affichage |
| `session_end` | L'application a été fermée |

## Exemple de log

```json
[
  {
    "timestamp": "2026-01-02T22:24:09.240Z",
    "ecranId": 1,
    "sessionId": "mjxfxytm7leco",
    "mediaId": 13,
    "mediaNom": "diapositive3",
    "mediaFichier": "EVENEMENT-SOE-diapositive3-694d06ebe56f8.jpg",
    "mediaType": "img",
    "diapoId": 5,
    "diapoNom": "dvdd",
    "startTime": "2026-01-02T22:24:09.240Z",
    "endTime": "2026-01-02T22:24:14.246Z",
    "dureeConfiguree": 5,
    "dureeReelle": 5,
    "status": "interrupted"
  }
]
```

## Utilisation pour la régie publicitaire

### Calcul du nombre de passages

```javascript
const logs = JSON.parse(fs.readFileSync('C:/SEE/logs/playback-2026-01-02.json'));
const passagesParMedia = {};

logs.forEach(entry => {
  const key = entry.mediaId;
  passagesParMedia[key] = (passagesParMedia[key] || 0) + 1;
});

console.log(passagesParMedia);
// { 13: 5, 14: 5, 15: 5, 9: 5 }
```

### Calcul du temps total de diffusion

```javascript
const tempsTotal = logs.reduce((sum, entry) => sum + entry.dureeReelle, 0);
console.log(`Temps total: ${tempsTotal} secondes`);
```

### Filtrer par écran

```javascript
const logsEcran1 = logs.filter(entry => entry.ecranId === 1);
```

### Filtrer par période

```javascript
const debut = new Date('2026-01-02T10:00:00Z');
const fin = new Date('2026-01-02T18:00:00Z');

const logsPeriode = logs.filter(entry => {
  const start = new Date(entry.startTime);
  return start >= debut && start <= fin;
});
```

### Export CSV

```javascript
const csv = ['timestamp,ecranId,mediaId,mediaNom,dureeReelle,status'];
logs.forEach(e => {
  csv.push(`${e.timestamp},${e.ecranId},${e.mediaId},${e.mediaNom},${e.dureeReelle},${e.status}`);
});
fs.writeFileSync('rapport.csv', csv.join('\n'));
```

## Configuration

Le PlaybackLogger est initialisé automatiquement au chargement de l'application. L'ID écran est configuré depuis `configSEE.json`.

### Paramètres internes

| Paramètre | Valeur | Description |
|-----------|--------|-------------|
| Intervalle de flush | 30 secondes | Fréquence d'écriture sur disque |
| Format de date fichier | `YYYY-MM-DD` | Un fichier par jour |

## API JavaScript

```javascript
// Disponible globalement via window.playbackLogger

// Définir l'ID écran
window.playbackLogger.setEcranId(1);

// Démarrer l'enregistrement d'un média
window.playbackLogger.startMedia({
  mediaId: 13,
  mediaNom: 'diapositive3',
  mediaFichier: 'fichier.jpg',
  mediaType: 'img',
  diapoId: 5,
  diapoNom: 'dvdd',
  duree: 5
});

// Terminer l'enregistrement (appelé automatiquement au média suivant)
window.playbackLogger.endMedia('complete');

// Forcer un flush immédiat
await window.playbackLogger.flush();

// Obtenir les stats de session
const stats = window.playbackLogger.getSessionStats();
// { sessionId: '...', ecranId: 1, logsInBuffer: 3, currentMedia: 'fichier.jpg' }
```

## Fichiers concernés

- `js/PlaybackLogger.js` - Module principal
- `js/loopDiapo.js` - Intégration (appel startMedia)
- `API/listeDiapo.js` - Enrichissement des métadonnées média
- `index.html` - Chargement du script

## Dépannage

### Les logs ne sont pas créés

1. Vérifier que le dossier `C:\SEE\logs\` existe
2. Vérifier les permissions d'écriture
3. Attendre 30 secondes pour le flush automatique
4. Consulter la console pour les erreurs `[playback]`

### Les métadonnées sont manquantes

Vérifier que l'API renvoie bien les champs dans la timeline :
- `media.id`
- `media.nom`
- `diapo.id`
- `diapo.nom`

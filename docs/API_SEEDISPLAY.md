# 📺 API SEE Display - Documentation d'intégration

Documentation de l'API pour le projet **seedisplay** (affichage dynamique sur écrans).

> **URL de base**: `https://soek.fr/see/API/`
> **Version**: 2.2 (Janvier 2026)

---

> ⚠️ **Note**: Cette documentation est maintenue dans les deux repositories liés :
> - **Backend (API)**: [AslakFAVREAU/app_soek](https://github.com/AslakFAVREAU/app_soek) → `docs/API_SEEDISPLAY.md`
> - **Frontend (Affichage)**: [AslakFAVREAU/seedisplay](https://github.com/AslakFAVREAU/seedisplay) → `docs/API_SEEDISPLAY.md`
> 
> Toute modification doit être synchronisée entre les deux repos.

---

## 📡 Endpoint Principal

### GET `/see/API/diapo/{idEcran}`

Récupère la configuration complète d'un écran et ses diaporamas actifs.

#### Paramètres

| Paramètre | Type | Description |
|-----------|------|-------------|
| `idEcran` | integer | ID unique de l'écran |

#### Réponse (JSON)

```json
{
  "status": "active",
  "ecranId": 13,
  "ecranNom": "Écran Accueil",
  "orientation": "landscape",
  "ratio": "16:9",
  "dimensions": "1920x1080",
  "luminosite": 80,
  "modeNuit": {
    "actif": true,
    "luminositeNuit": 25,
    "heureDebut": "22:00",
    "heureFin": "07:00"
  },
  "programmation": {
    "active": true,
    "heureDemarrage": "07:00",
    "heureExtinction": "22:00",
    "joursFonctionnement": [1, 2, 3, 4, 5]
  },
  "config": {
    "meteo": {
      "actif": true,
      "latitude": 48.8566,
      "longitude": 2.3522,
      "units": "metric"
    },
    "affichage": {
      "logoSOE": true,
      "weekNo": true,
      "weekType": false,
      "weekDisplay": true
    }
  },
  "refreshInterval": 300,
  "modePrioritaire": false,
  "serverTime": "2025-12-26T14:30:00+01:00",
  "totalDiapos": 3,
  "totalMedias": 12,
  "timeline": [...],
  "diapos": [...]
}
```

---

## 🔄 Structure de la réponse

### Statut de l'écran

| Champ | Type | Description |
|-------|------|-------------|
| `status` | string | `"active"` = en service, `"sleep"` = hors plage horaire |
| `ecranId` | integer | ID de l'écran |
| `ecranNom` | string | Nom de l'écran |
| `orientation` | string | `"landscape"` ou `"portrait"` |
| `ratio` | string | Ratio calculé (ex: `"16:9"`, `"16:10"`, `"9:16"`) |
| `dimensions` | string | Résolution (ex: `"1920x1080"`) |
| `luminosite` | integer | Luminosité actuelle (0-100), ajustée automatiquement si mode nuit actif |
| `refreshInterval` | integer | Intervalle de refresh en secondes |
| `modePrioritaire` | boolean | `true` si un diapo prioritaire est actif (timeline exclusive) |
| `serverTime` | string | Date/heure serveur ISO 8601 pour synchronisation |

### Mode Nuit (luminosité adaptative)

```json
"modeNuit": {
  "actif": true,
  "luminositeNuit": 25,
  "heureDebut": "22:00",
  "heureFin": "07:00"
}
```

| Champ | Type | Description |
|-------|------|-------------|
| `actif` | boolean | Mode nuit activé ou non |
| `luminositeNuit` | integer | Luminosité pendant la nuit (0-100) |
| `heureDebut` | string | Heure de début du mode nuit (format `"HH:mm"`) |
| `heureFin` | string | Heure de fin du mode nuit (format `"HH:mm"`) |

> **Note**: Le champ `luminosite` retourne automatiquement la valeur ajustée selon l'heure (luminosité normale ou luminosité nuit).

### Programmation horaire de l'écran

```json
"programmation": {
  "active": true,
  "heureDemarrage": "07:00",
  "heureExtinction": "22:00",
  "joursFonctionnement": [1, 2, 3, 4, 5]
}
```

| Champ | Type | Description |
|-------|------|-------------|
| `active` | boolean | Programmation horaire activée ou non |
| `heureDemarrage` | string | Heure de démarrage quotidien (format `"HH:mm"`) |
| `heureExtinction` | string | Heure d'extinction quotidienne (format `"HH:mm"`) |
| `joursFonctionnement` | array | Jours autorisés (0=Dim, 1=Lun, ..., 6=Sam) |

### Statut "sleep" (hors plage horaire)

Quand l'écran est configuré pour s'éteindre pendant certaines heures :

```json
{
  "status": "sleep",
  "ecranId": 13,
  "ecranNom": "Écran Accueil",
  "orientation": "landscape",
  "ratio": "16:9",
  "dimensions": "1920x1080",
  "luminosite": 0,
  "typeHorsPlage": "noir",
  "imageHorsPlage": null,
  "prochainDemarrage": "07:00",
  "diapos": []
}
```

| Champ | Type | Description |
|-------|------|-------------|
| `typeHorsPlage` | string | `"noir"` = écran noir, `"logo"` = logo SEE, `"image"` = image personnalisée |
| `imageHorsPlage` | string\|null | Chemin de l'image à afficher (si `typeHorsPlage = "image"`) |
| `prochainDemarrage` | string\|null | Heure de prochain réveil (format `"HH:mm"`) |

---

## ⚙️ Configuration Client

> ⚠️ **TODO Symfony**: Ajouter ces champs dans l'entité `Ecran` et les inclure dans la réponse API.
> Ces paramètres permettent de configurer l'affichage côté client (seedisplay) depuis le back-office.

### Structure `config`

```json
{
  "status": "active",
  "ecranId": 13,
  // ... autres champs existants ...
  
  "config": {
    "meteo": {
      "actif": true,
      "latitude": 48.8566,
      "longitude": 2.3522,
      "units": "metric"
    },
    "affichage": {
      "logoSOE": true,
      "weekNo": true,
      "weekType": true,
      "weekDisplay": true
    }
  }
}
```

### Configuration Météo

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `meteo.actif` | boolean | Oui | Afficher le widget météo |
| `meteo.latitude` | float | Si actif | Latitude en décimal (-90.0 à 90.0) |
| `meteo.longitude` | float | Si actif | Longitude en décimal (-180.0 à 180.0) |
| `meteo.units` | string | Non | `"metric"` (°C, km/h) ou `"imperial"` (°F, mph). Défaut: `"metric"` |

#### Format Latitude/Longitude

- **Type**: Nombre décimal (float)
- **Précision**: 4-6 décimales recommandées
- **Exemples**:
  - Paris: `48.8566`, `2.3522`
  - Lyon: `45.7640`, `4.8357`
  - Bordeaux: `44.8378`, `-0.5792` (longitude négative = Ouest)

### Configuration Affichage

| Champ | Type | Défaut | Description |
|-------|------|--------|-------------|
| `affichage.logoSOE` | boolean | `true` | Afficher le logo SOE |
| `affichage.weekNo` | boolean | `true` | Afficher le numéro de semaine |
| `affichage.weekType` | boolean | `false` | Afficher "Paire/Impaire" au lieu de "Semaine" |
| `affichage.weekDisplay` | boolean | `true` | Afficher la zone semaine |

### Implémentation Symfony suggérée

```php
// Entité Ecran - Nouveaux champs à ajouter

// Météo
#[ORM\Column(type: 'boolean', options: ['default' => true])]
private bool $meteoActif = true;

#[ORM\Column(type: 'float', nullable: true)]
#[Assert\Range(min: -90, max: 90, notInRangeMessage: 'Latitude: -90 à 90')]
private ?float $meteoLatitude = null;

#[ORM\Column(type: 'float', nullable: true)]
#[Assert\Range(min: -180, max: 180, notInRangeMessage: 'Longitude: -180 à 180')]
private ?float $meteoLongitude = null;

#[ORM\Column(type: 'string', length: 10, options: ['default' => 'metric'])]
#[Assert\Choice(choices: ['metric', 'imperial'])]
private string $meteoUnits = 'metric';

// Affichage
#[ORM\Column(type: 'boolean', options: ['default' => true])]
private bool $affichageLogoSOE = true;

#[ORM\Column(type: 'boolean', options: ['default' => true])]
private bool $affichageWeekNo = true;

#[ORM\Column(type: 'boolean', options: ['default' => false])]
private bool $affichageWeekType = false;

#[ORM\Column(type: 'boolean', options: ['default' => true])]
private bool $affichageWeekDisplay = true;
```

```php
// Dans le Controller API - Ajouter à la réponse
$response['config'] = [
    'meteo' => [
        'actif' => $ecran->isMeteoActif(),
        'latitude' => $ecran->getMeteoLatitude(),
        'longitude' => $ecran->getMeteoLongitude(),
        'units' => $ecran->getMeteoUnits(),
    ],
    'affichage' => [
        'logoSOE' => $ecran->isAffichageLogoSOE(),
        'weekNo' => $ecran->isAffichageWeekNo(),
        'weekType' => $ecran->isAffichageWeekType(),
        'weekDisplay' => $ecran->isAffichageWeekDisplay(),
    ],
];
```

---

## 📋 Structure de la réponse complète

L'API retourne trois éléments clés :
- **`config`** : Configuration client (météo, affichage) - voir section précédente
- **`timeline`** : Liste pré-calculée des médias actifs maintenant (pour affichage immédiat)
- **`diapos`** : Liste complète des diapos avec toutes leurs règles (pour fonctionnement autonome)

```json
{
  "status": "active",
  "serverTime": "2025-01-15T14:30:00+01:00",
  "ecranId": 13,
  "ecranNom": "Écran Accueil",
  "orientation": "landscape",
  "ratio": "16:9",
  "dimensions": "1920x1080",
  "luminosite": 80,
  "modeNuit": { ... },
  "programmation": { ... },
  "config": {
    "meteo": { "actif": true, "latitude": 48.8566, "longitude": 2.3522, "units": "metric" },
    "affichage": { "logoSOE": true, "weekNo": true, "weekType": false, "weekDisplay": true }
  },
  "refreshInterval": 300,
  "totalDiapos": 3,
  "totalMedias": 12,
  "timeline": [ ... ],
  "diapos": [ ... ]
}
```

### Timeline (médias actifs maintenant)

La `timeline` est une liste plate des médias à afficher **immédiatement**, pré-calculée par le serveur :

```json
"timeline": [
  {
    "ordre": 1,
    "diapoId": 42,
    "diapoNom": "Annonces Urgentes",
    "diapoType": "prioritaire",
    "diapoPriorite": 10,
    "mediaId": 123,
    "mediaNom": "Alerte Météo",
    "mediaType": "img",
    "mediaFichier": "alerte_meteo.jpg",
    "mediaUrl": "/uploads/see/media/alerte_meteo.jpg",
    "duree": 15,
    "transition": "cut"
  },
  ...
]
```

### Diapos (règles complètes pour fonctionnement autonome)

Les `diapos` contiennent **toutes les règles de programmation** pour que seedisplay puisse fonctionner **en cas de perte de connexion** :

```json
"diapos": [
  {
    "id": 42,
    "nom": "Annonces Janvier",
    "actif": true,
    
    "dateDebut": "2025-01-01T00:00:00+01:00",
    "dateFin": "2025-01-31T23:59:59+01:00",
    
    "type": "standard",
    "priorite": 0,
    
    "programmation": {
      "mode": "simple",
      "heureDebut": "08:00",
      "heureFin": "18:00",
      "joursSemaine": [1, 2, 3, 4, 5],
      "plagesHoraires": null
    },
    
    "medias": [
      {
        "ordre": 1,
        "duree": 10,
        "mediaId": 123,
        "nom": "Promo Janvier",
        "type": "img",
        "fichier": "promo_janvier.jpg",
        "url": "/uploads/see/media/promo_janvier.jpg"
      },
      ...
    ],
    "totalMedias": 5,
    "dureeTotale": 50
  },
  ...
]
```

### Champs du Diapo

| Champ | Type | Description |
|-------|------|-------------|
| `id` | integer | ID unique du diapo |
| `nom` | string | Nom du diaporama |
| `actif` | boolean | Diapo activé ou inhibé |
| `dateDebut` | ISO8601 | Date/heure de début de validité |
| `dateFin` | ISO8601 | Date/heure de fin de validité |
| `type` | string | `"standard"`, `"programme"` ou `"prioritaire"` |
| `priorite` | integer | Niveau de priorité (0-10, 10 = max) |
| `programmation.mode` | string | `"simple"` ou `"avance"` |
| `programmation.heureDebut` | string | Heure début (mode simple) |
| `programmation.heureFin` | string | Heure fin (mode simple) |
| `programmation.joursSemaine` | array | Jours autorisés [0-6] (0=Dim) |
| `programmation.plagesHoraires` | object | Plages par jour (mode avancé) |
| `medias` | array | Liste des médias ordonnée |
| `totalMedias` | integer | Nombre de médias |
| `dureeTotale` | integer | Durée totale en secondes |

---

## 🔌 Fonctionnement hors ligne

Grâce aux règles complètes dans `diapos`, seedisplay peut :

1. **Continuer à afficher** même sans connexion
2. **Appliquer les règles de programmation** localement
3. **Respecter les priorités** et les dates de validité
4. **Gérer les changements d'horaire** (passage mode nuit, etc.)

### Implémentation recommandée

```javascript
// Cache local des diapos
let cachedDiapos = [];
let lastSync = null;

async function syncWithServer() {
  try {
    const response = await fetch(API_URL);
    const data = await response.json();
    
    // Sauvegarder les diapos complets pour fonctionnement hors ligne
    cachedDiapos = data.diapos;
    lastSync = new Date(data.serverTime);
    
    // Sauvegarder en localStorage pour persistance
    localStorage.setItem('see_diapos', JSON.stringify(cachedDiapos));
    localStorage.setItem('see_lastSync', lastSync.toISOString());
    
    // Utiliser la timeline pré-calculée
    return data.timeline;
    
  } catch (error) {
    console.warn('Connexion perdue, utilisation du cache local');
    
    // Charger depuis localStorage
    const cached = localStorage.getItem('see_diapos');
    if (cached) {
      cachedDiapos = JSON.parse(cached);
      // Recalculer la timeline localement
      return calculateTimelineLocally(cachedDiapos);
    }
    
    return [];
  }
}

/**
 * Calcule la timeline localement (mode hors ligne)
 */
function calculateTimelineLocally(diapos) {
  const now = new Date();
  const timeline = [];
  
  // Filtrer les diapos actifs
  const activeDiapos = diapos.filter(diapo => {
    if (!diapo.actif) return false;
    
    // Vérifier période
    if (diapo.dateDebut && new Date(diapo.dateDebut) > now) return false;
    if (diapo.dateFin && new Date(diapo.dateFin) < now) return false;
    
    // Vérifier programmation
    if (diapo.type === 'programme' || diapo.type === 'prioritaire') {
      if (!isInProgrammation(diapo.programmation, now)) return false;
    }
    
    return true;
  });
  
  // Trier par priorité
  activeDiapos.sort((a, b) => {
    if (a.type === 'prioritaire' && b.type !== 'prioritaire') return -1;
    if (b.type === 'prioritaire' && a.type !== 'prioritaire') return 1;
    return (b.priorite || 0) - (a.priorite || 0);
  });
  
  // Construire la timeline
  let ordre = 1;
  for (const diapo of activeDiapos) {
    for (const media of diapo.medias) {
      timeline.push({
        ordre: ordre++,
        diapoId: diapo.id,
        diapoNom: diapo.nom,
        diapoType: diapo.type,
        ...media
      });
    }
  }
  
  return timeline;
}

/**
 * Vérifie si l'heure actuelle est dans la programmation
 */
function isInProgrammation(prog, now) {
  const currentDay = now.getDay(); // 0=Dim
  const currentTime = now.toTimeString().slice(0, 5); // "HH:mm"
  const joursFr = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  
  // Mode avancé
  if (prog.mode === 'avance' && prog.plagesHoraires) {
    const plages = prog.plagesHoraires[joursFr[currentDay]] || [];
    return plages.some(p => currentTime >= p.debut && currentTime <= p.fin);
  }
  
  // Mode simple
  if (prog.joursSemaine && prog.joursSemaine.length > 0) {
    if (!prog.joursSemaine.includes(currentDay)) return false;
  }
  
  if (prog.heureDebut && prog.heureFin) {
    if (currentTime < prog.heureDebut || currentTime > prog.heureFin) return false;
  }
  
  return true;
}
```

---

## 🎯 Types de Diaporama

### `standard` (défaut)
- **Comportement**: Affiché en permanence dans les dates de validité
- **Programmation**: Ignorée (HeureDebut, HeureFin, JoursSemaine)
- **Priorité**: Normale (affichage séquentiel)

```javascript
// Exemple de logique
if (diapo.TypeDiapo === 'standard') {
  // Afficher si dans la période DateDebut → DateFin
  const now = Date.now();
  const start = Date.parse(diapo.DateDebutDiapo);
  const end = Date.parse(diapo.DateFinDiapo);
  if (start <= now && now <= end) {
    // ✅ Ajouter à la boucle
  }
}
```

### `programme`
- **Comportement**: Affiché uniquement aux heures programmées
- **Programmation**: Respecte HeureDebut, HeureFin, JoursSemaine
- **Priorité**: Normale

```javascript
// Exemple de logique
if (diapo.TypeDiapo === 'programme') {
  const now = new Date();
  const currentDay = now.getDay(); // 0=Dim, 1=Lun, ...
  const currentTime = now.toTimeString().slice(0, 8); // "HH:mm:ss"
  
  // Vérifier le jour
  if (!diapo.JoursSemaine || !diapo.JoursSemaine.includes(currentDay)) {
    return false; // Pas le bon jour
  }
  
  // Vérifier l'heure
  if (diapo.HeureDebut && diapo.HeureFin) {
    if (currentTime < diapo.HeureDebut || currentTime > diapo.HeureFin) {
      return false; // Hors plage horaire
    }
  }
  
  // ✅ Ajouter à la boucle
}
```

### `prioritaire`
- **Comportement**: **EXCLUSIF** - Quand un diapo prioritaire est actif, la timeline ne contient QUE les médias des diapos prioritaires
- **Programmation**: Peut respecter les horaires si définis
- **Priorité**: Élevée (valeur `Priorite` > 0)
- **Indicateur API**: Le champ `modePrioritaire: true` indique qu'un ou plusieurs diapos prioritaires sont actifs

> ⚠️ **Important**: Quand `modePrioritaire === true`, la `timeline` retournée par l'API ne contient que les médias des diapos prioritaires. Les diapos standards et programmés sont ignorés jusqu'à la fin du/des prioritaire(s).

```javascript
// Exemple de logique - Tri par priorité
const sortedDiapos = diapos.sort((a, b) => {
  // Prioritaires en premier
  if (a.TypeDiapo === 'prioritaire' && b.TypeDiapo !== 'prioritaire') return -1;
  if (b.TypeDiapo === 'prioritaire' && a.TypeDiapo !== 'prioritaire') return 1;
  // Ensuite par niveau de priorité
  return (b.Priorite || 0) - (a.Priorite || 0);
});

// Logique d'exclusivité (côté serveur, déjà appliquée dans timeline)
const prioritaires = sortedDiapos.filter(d => d.type === 'prioritaire');
const diaposForTimeline = prioritaires.length > 0 ? prioritaires : sortedDiapos;
```

---

## 📅 Programmation Horaire Avancée

### Mode Simple (JoursSemaine + HeureDebut/HeureFin)

```json
{
  "TypeDiapo": "programme",
  "HeureDebut": "09:00:00",
  "HeureFin": "17:00:00",
  "JoursSemaine": [1, 2, 3, 4, 5],
  "PlagesHoraires": null
}
```

**Interprétation**: Afficher du lundi au vendredi, de 9h à 17h.

### Mode Avancé (PlagesHoraires)

```json
{
  "TypeDiapo": "programme",
  "HeureDebut": null,
  "HeureFin": null,
  "JoursSemaine": null,
  "PlagesHoraires": {
    "lundi": [
      {"debut": "08:00", "fin": "12:00"},
      {"debut": "14:00", "fin": "18:00"}
    ],
    "mardi": [
      {"debut": "09:00", "fin": "17:00"}
    ],
    "mercredi": [],
    "jeudi": [
      {"debut": "08:00", "fin": "20:00"}
    ],
    "vendredi": [
      {"debut": "08:00", "fin": "12:00"}
    ],
    "samedi": [],
    "dimanche": []
  }
}
```

**Interprétation**: 
- Lundi: 8h-12h et 14h-18h
- Mardi: 9h-17h
- Mercredi: Pas d'affichage
- Jeudi: 8h-20h
- Vendredi: 8h-12h (matin seulement)
- Weekend: Pas d'affichage

---

## 🖼️ Structure d'un Média (ligneMedia)

```json
{
  "OrdreLigneMedia": 1,
  "DureeLigneMedia": 10,
  "MediaLigneMedia": {
    "Id": 123,
    "NomMedia": "Promo Janvier",
    "TypeMedia": "img",
    "FichierMedia": "promo_janvier_2025.jpg"
  }
}
```

| Champ | Type | Description |
|-------|------|-------------|
| `OrdreLigneMedia` | integer | Position dans la séquence (1, 2, 3, ...) |
| `DureeLigneMedia` | integer | Durée d'affichage en secondes |
| `MediaLigneMedia.Id` | integer | ID du média |
| `MediaLigneMedia.NomMedia` | string | Nom du média |
| `MediaLigneMedia.TypeMedia` | string | `"img"` ou `"video"` |
| `MediaLigneMedia.FichierMedia` | string | Nom du fichier (URL relative) |

### URL des médias

```
https://soek.fr/uploads/see/media/{FichierMedia}
```

Exemple:
```
https://soek.fr/uploads/see/media/promo_janvier_2025.jpg
```

---

## 💻 Exemple d'implémentation complète

### Fonction de filtrage des diapos

```javascript
/**
 * Filtre les diapos selon les règles de programmation
 * @param {Array} diapos - Liste des diapos de l'API
 * @returns {Array} - Diapos à afficher maintenant
 */
function filterActiveDiapos(diapos) {
  const now = new Date();
  const timestamp = now.getTime();
  const currentDay = now.getDay(); // 0=Dim, 1=Lun, ...
  const currentDayName = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][currentDay];
  const currentTime = now.toTimeString().slice(0, 5); // "HH:mm"
  
  return diapos.filter(diapo => {
    // 1. Vérifier la période de validité (DateDebut → DateFin)
    const start = diapo.DateDebutDiapo ? Date.parse(diapo.DateDebutDiapo) : 0;
    const end = diapo.DateFinDiapo ? Date.parse(diapo.DateFinDiapo) : Number.MAX_SAFE_INTEGER;
    
    if (timestamp < start || timestamp > end) {
      return false; // Hors période de validité
    }
    
    // 2. Si type standard, pas de vérification horaire
    if (diapo.TypeDiapo === 'standard') {
      return true;
    }
    
    // 3. Pour type programme ou prioritaire, vérifier la programmation
    if (diapo.TypeDiapo === 'programme' || diapo.TypeDiapo === 'prioritaire') {
      
      // Mode avancé: PlagesHoraires
      if (diapo.PlagesHoraires && typeof diapo.PlagesHoraires === 'object') {
        const plagesDuJour = diapo.PlagesHoraires[currentDayName];
        
        if (!plagesDuJour || plagesDuJour.length === 0) {
          return false; // Pas de plage pour aujourd'hui
        }
        
        // Vérifier si l'heure actuelle est dans une des plages
        return plagesDuJour.some(plage => {
          return currentTime >= plage.debut && currentTime <= plage.fin;
        });
      }
      
      // Mode simple: JoursSemaine + HeureDebut/HeureFin
      if (diapo.JoursSemaine && diapo.JoursSemaine.length > 0) {
        if (!diapo.JoursSemaine.includes(currentDay)) {
          return false; // Pas le bon jour
        }
      }
      
      if (diapo.HeureDebut && diapo.HeureFin) {
        const heureDebut = diapo.HeureDebut.slice(0, 5); // "HH:mm"
        const heureFin = diapo.HeureFin.slice(0, 5);
        
        if (currentTime < heureDebut || currentTime > heureFin) {
          return false; // Hors plage horaire
        }
      }
      
      return true;
    }
    
    return true; // Par défaut, afficher
  });
}

/**
 * Trie les diapos par priorité
 * @param {Array} diapos - Liste des diapos filtrés
 * @returns {Array} - Diapos triés (prioritaires en premier)
 */
function sortDiaposByPriority(diapos) {
  return diapos.sort((a, b) => {
    // Prioritaires en premier
    if (a.TypeDiapo === 'prioritaire' && b.TypeDiapo !== 'prioritaire') return -1;
    if (b.TypeDiapo === 'prioritaire' && a.TypeDiapo !== 'prioritaire') return 1;
    
    // Ensuite par niveau de priorité (décroissant)
    return (b.Priorite || 0) - (a.Priorite || 0);
  });
}

/**
 * Extrait la liste des médias à afficher
 * @param {Array} diapos - Diapos filtrés et triés
 * @returns {Array} - Liste plate des médias [type, fichier, durée]
 */
function extractMediaList(diapos) {
  const mediaList = [];
  
  for (const diapo of diapos) {
    if (!diapo.ligneMedia || !Array.isArray(diapo.ligneMedia)) continue;
    
    for (const ligne of diapo.ligneMedia) {
      const media = ligne.MediaLigneMedia;
      if (!media || !media.FichierMedia) continue;
      
      mediaList.push([
        media.TypeMedia || 'img',
        encodeURIComponent(media.FichierMedia),
        ligne.DureeLigneMedia || 10,
        diapo.id // Optionnel: garder trace du diapo source
      ]);
    }
  }
  
  return mediaList;
}
```

### Intégration dans listeDiapo.js

```javascript
// Dans API/listeDiapo.js

function listeDiapo(data) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    _log('warn', 'diapo', 'listeDiapo: no data');
    return [];
  }
  
  // 1. Filtrer les diapos actifs (période + programmation horaire)
  const activeDiapos = filterActiveDiapos(data);
  _log('info', 'diapo', 'Active diapos after filter: ' + activeDiapos.length + '/' + data.length);
  
  // 2. Trier par priorité
  const sortedDiapos = sortDiaposByPriority(activeDiapos);
  
  // 3. Extraire la liste des médias
  const mediaList = extractMediaList(sortedDiapos);
  _log('info', 'diapo', 'Media list: ' + mediaList.length + ' items');
  
  return mediaList;
}
```

---

## 🔧 Gestion de l'orientation

L'API retourne l'orientation de l'écran dans `orientation`:

```javascript
// Adapter l'affichage selon l'orientation
function applyOrientation(ecranData) {
  const orientation = ecranData.orientation || 'paysage';
  const container = document.getElementById('mediaContainer');
  
  if (orientation === 'portrait') {
    container.classList.add('portrait-mode');
    container.classList.remove('landscape-mode');
    // Ajuster le CSS pour 9:16
  } else {
    container.classList.add('landscape-mode');
    container.classList.remove('portrait-mode');
    // CSS par défaut 16:9
  }
}
```

### CSS pour orientation portrait

```css
/* Mode portrait (9:16) */
.portrait-mode {
  width: 100vh !important;
  height: 100vw !important;
  transform: rotate(90deg);
  transform-origin: center center;
}

.portrait-mode img,
.portrait-mode video {
  object-fit: contain;
  max-width: 100%;
  max-height: 100%;
}
```

---

## � Gestion de la luminosité

L'API retourne la luminosité actuelle et les paramètres du mode nuit. L'écran d'affichage peut ajuster son CSS en fonction.

### Implémentation JavaScript

```javascript
/**
 * Applique la luminosité à l'écran via un filtre CSS
 * @param {Object} ecranData - Données de l'API
 */
function applyLuminosite(ecranData) {
  const luminosite = ecranData.luminosite || 100;
  const container = document.body;
  
  // Appliquer un filtre brightness (0-100 → 0-1)
  const brightness = luminosite / 100;
  container.style.filter = `brightness(${brightness})`;
  
  __log('info', 'config', `Luminosité appliquée: ${luminosite}%`);
}

/**
 * Gère le mode nuit localement (si l'écran veut gérer lui-même)
 * @param {Object} modeNuit - Configuration du mode nuit
 */
function handleModeNuit(modeNuit) {
  if (!modeNuit || !modeNuit.actif) return;
  
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5); // "HH:mm"
  
  const heureDebut = modeNuit.heureDebut || "22:00";
  const heureFin = modeNuit.heureFin || "07:00";
  
  // Vérifier si on est en mode nuit
  let isNightMode = false;
  if (heureDebut > heureFin) {
    // Cas où la nuit chevauche minuit (ex: 22:00 → 07:00)
    isNightMode = currentTime >= heureDebut || currentTime < heureFin;
  } else {
    // Cas classique
    isNightMode = currentTime >= heureDebut && currentTime < heureFin;
  }
  
  if (isNightMode) {
    const luminositeNuit = modeNuit.luminositeNuit || 25;
    document.body.style.filter = `brightness(${luminositeNuit / 100})`;
    __log('info', 'config', `Mode nuit actif: ${luminositeNuit}%`);
  }
}
```

### CSS pour transition douce

```css
/* Transition douce lors du changement de luminosité */
body {
  transition: filter 2s ease-in-out;
}

/* Overlay pour assombrir l'écran (alternative au filter) */
.luminosity-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, var(--darkness-level, 0));
  pointer-events: none;
  z-index: 9999;
  transition: background 2s ease-in-out;
}
```

### Méthode alternative: overlay noir

```javascript
/**
 * Alternative: utiliser un overlay noir pour réduire la luminosité
 * Plus compatible avec certains navigateurs
 */
function applyLuminositeOverlay(luminosite) {
  let overlay = document.getElementById('luminosity-overlay');
  
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'luminosity-overlay';
    overlay.className = 'luminosity-overlay';
    document.body.appendChild(overlay);
  }
  
  // luminosite 100 = overlay transparent, luminosite 0 = overlay noir total
  const darkness = 1 - (luminosite / 100);
  overlay.style.setProperty('--darkness-level', darkness);
}
```

---

## 😴 Gestion du mode Sleep

Quand l'API retourne `status: "sleep"`, l'écran doit réagir selon `typeHorsPlage`:

```javascript
/**
 * Gère le mode sleep de l'écran
 * @param {Object} data - Réponse de l'API
 */
function handleSleepMode(data) {
  __log('info', 'config', 'Écran en mode sleep');
  
  // Arrêter la boucle de diaporama
  stopLoopDiapo();
  
  // Masquer le contenu
  document.getElementById('mediaContainer').style.display = 'none';
  document.getElementById('pageDefault').style.display = 'none';
  
  // Afficher selon le type
  const sleepContainer = document.getElementById('sleepContainer') || createSleepContainer();
  sleepContainer.style.display = 'flex';
  
  switch (data.typeHorsPlage) {
    case 'noir':
      sleepContainer.style.background = '#000';
      sleepContainer.innerHTML = '';
      break;
      
    case 'logo':
      sleepContainer.style.background = '#000';
      sleepContainer.innerHTML = '<img src="assets/logo-see.png" alt="SEE" style="max-width: 200px; opacity: 0.3;">';
      break;
      
    case 'image':
      if (data.imageHorsPlage) {
        sleepContainer.style.backgroundImage = `url(${data.imageHorsPlage})`;
        sleepContainer.style.backgroundSize = 'cover';
        sleepContainer.style.backgroundPosition = 'center';
      }
      break;
  }
  
  // Programmer le prochain check pour le réveil
  if (data.prochainDemarrage) {
    __log('info', 'config', `Prochain réveil prévu à ${data.prochainDemarrage}`);
    scheduleWakeupCheck(data.prochainDemarrage);
  }
}

function createSleepContainer() {
  const container = document.createElement('div');
  container.id = 'sleepContainer';
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;
  document.body.appendChild(container);
  return container;
}
```

---

## �🛠️ Gestion des erreurs

### Codes de réponse HTTP

| Code | Description |
|------|-------------|
| 200 | Succès |
| 404 | Écran non trouvé |
| 500 | Erreur serveur |

### Exemple de gestion d'erreur

```javascript
async function fetchDiapoData(ecranId) {
  try {
    const url = `https://soek.fr/see/API/diapo/${ecranId}`;
    const response = await fetch(url, { timeout: 10000 });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    // Vérifier le statut de l'écran
    if (data.status === 'sleep') {
      handleSleepMode(data);
      return null;
    }
    
    return data.diapos || [];
    
  } catch (error) {
    console.error('Erreur API diapo:', error);
    // Fallback: utiliser le cache local
    return getCachedDiapos();
  }
}
```

---

## 📊 Diagramme de flux

```
┌─────────────────────────────────────────────────────────────────┐
│                    GET /see/API/diapo/{id}                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Écran trouvé ?  │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
              ▼                             ▼
        ┌───────────┐                 ┌───────────┐
        │  Non 404  │                 │    Oui    │
        └───────────┘                 └─────┬─────┘
                                            │
                                            ▼
                              ┌─────────────────────────┐
                              │ Dans plage horaire ?    │
                              └────────────┬────────────┘
                                           │
                    ┌──────────────────────┴─────────────────────┐
                    │                                            │
                    ▼                                            ▼
          ┌──────────────────┐                        ┌──────────────────┐
          │  status: sleep   │                        │  status: active  │
          │  diapos: []      │                        │  diapos: [...]   │
          └──────────────────┘                        └──────────────────┘
                                                              │
                                                              ▼
                                              ┌───────────────────────────────┐
                                              │ Client filtre les diapos:     │
                                              │ 1. Période DateDebut/DateFin  │
                                              │ 2. TypeDiapo + Programmation  │
                                              │ 3. Tri par priorité           │
                                              │ 4. Extraction médias          │
                                              └───────────────────────────────┘
```

---

## � Diapos Événements (SOEG → SEE)

### Concept

Les salles SOEG peuvent être liées à des écrans SEE. Lors de la création d'un événement, une diapo prioritaire peut être générée automatiquement pour s'afficher pendant la durée de l'événement.

### Relation Salle ↔ Écran

Une salle peut être associée à un ou plusieurs écrans. Cette association se fait dans l'administration des salles.

### Diapo générée automatiquement

Quand un utilisateur crée un événement avec l'option "Afficher sur l'écran de la salle", une diapo est créée avec :

| Propriété | Valeur |
|-----------|--------|
| `TypeDiapo` | `prioritaire` |
| `Priorite` | `8` (haute) |
| `DateDebutDiapo` | Début de l'événement |
| `DateFinDiapo` | Fin de l'événement |
| `HeureDebut` | Heure début événement |
| `HeureFin` | Heure fin événement |
| `JoursSemaine` | Jour de l'événement |
| `NomDiapo` | `[Event] Nom de l'événement` |

### Modes d'affichage

| Mode | Description |
|------|-------------|
| `auto` | Template généré dynamiquement (voir ci-dessous) |
| `custom` | Média personnalisé uploadé par l'utilisateur |

### Template Auto - Structure JSON

Pour les diapos en mode `auto`, l'API peut renvoyer des données de template au lieu d'un média :

```json
{
  "id": 456,
  "NomDiapo": "[Event] Réunion Projet Alpha",
  "TypeDiapo": "prioritaire",
  "Priorite": 8,
  "templateData": {
    "type": "evenement",
    "nom": "Réunion Projet Alpha",
    "salle": "Salle Einstein",
    "batiment": "Bâtiment A, 2ème étage",
    "heureDebut": "14:00",
    "heureFin": "16:00",
    "date": "15/01/2026",
    "responsable": "Jean Dupont",
    "typeEvent": "Réunion",
    "couleurSalle": "#0866C6"
  },
  "ligneMedia": []
}
```

### Rendu côté seedisplay

Quand `templateData` est présent et `ligneMedia` est vide, seedisplay doit générer dynamiquement l'affichage :

```html
<!-- Exemple de rendu HTML pour template événement -->
<div class="event-template" style="background: linear-gradient(135deg, #0866C6, #1976D2);">
  <h1 class="event-title">Réunion Projet Alpha</h1>
  <div class="event-info">
    <p><i class="icon-location"></i> Salle Einstein</p>
    <p><i class="icon-clock"></i> 14:00 - 16:00</p>
  </div>
</div>
```

### CSS suggéré

```css
.event-template {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  color: white;
  text-align: center;
  padding: 5%;
}

.event-title {
  font-size: 5vw;
  font-weight: 700;
  margin-bottom: 2vh;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
}

.event-info {
  font-size: 2.5vw;
  opacity: 0.95;
}

.event-info p {
  margin: 1vh 0;
}
```

---

## � API Planning du Jour

### GET `/see/API/planning/{idEcran}`

Récupère le planning du jour pour toutes les salles associées à un écran.

> **Usage**: Affichage du programme de la journée sur un écran d'accueil ou de couloir.

#### Paramètres

| Paramètre | Type | Description |
|-----------|------|-------------|
| `idEcran` | integer | ID unique de l'écran |

#### Réponse (JSON)

```json
{
  "status": "success",
  "ecranId": 13,
  "ecranNom": "Écran Hall Accueil",
  "date": "2026-01-15",
  "dateFormatee": "15/01/2026",
  "jourSemaine": "Mercredi",
  "serverTime": "2026-01-15T09:30:00+01:00",
  "refreshInterval": 60,
  "salles": [
    {
      "id": 5,
      "nom": "Salle Einstein",
      "batiment": "Bâtiment A",
      "couleur": "#0866C6",
      "capacite": 20
    },
    {
      "id": 8,
      "nom": "Salle Curie",
      "batiment": "Bâtiment A",
      "couleur": "#28A745",
      "capacite": 12
    }
  ],
  "totalSalles": 2,
  "evenements": [
    {
      "id": 456,
      "nom": "Réunion Direction",
      "salleId": 5,
      "salleNom": "Salle Einstein",
      "salleCouleur": "#0866C6",
      "heureDebut": "09:00",
      "heureFin": "10:30",
      "dateDebut": "2026-01-15",
      "responsable": "Marie Martin",
      "typeEvent": "Réunion",
      "statut": "en_cours",
      "minutesRestantes": 45,
      "minutesAvantDebut": null
    },
    {
      "id": 457,
      "nom": "Formation RH",
      "salleId": 8,
      "salleNom": "Salle Curie",
      "salleCouleur": "#28A745",
      "heureDebut": "14:00",
      "heureFin": "17:00",
      "dateDebut": "2026-01-15",
      "responsable": "Paul Dupont",
      "typeEvent": "Formation",
      "statut": "a_venir",
      "minutesRestantes": null,
      "minutesAvantDebut": 270
    }
  ],
  "totalEvenements": 2,
  "planningParSalle": [
    {
      "salle": { "id": 5, "nom": "Salle Einstein", ... },
      "evenements": [ ... ],
      "eventEnCours": { ... },
      "prochainEvent": { ... }
    }
  ]
}
```

#### Statuts des événements

| Statut | Description |
|--------|-------------|
| `a_venir` | L'événement n'a pas encore commencé |
| `en_cours` | L'événement est actuellement en cours |
| `termine` | L'événement est terminé |

#### Cas "Aucune salle associée"

Si l'écran n'a pas de salles associées :

```json
{
  "status": "no_salles",
  "ecranId": 13,
  "ecranNom": "Écran Test",
  "message": "Aucune salle associée à cet écran",
  "salles": [],
  "evenements": [],
  "serverTime": "2026-01-15T09:30:00+01:00"
}
```

### Utilisation côté seedisplay

#### Affichage suggéré

L'API fournit les données brutes. seedisplay peut les afficher de différentes façons :

1. **Vue Planning** : Grille horaire avec créneaux (style agenda)
2. **Vue Liste** : Liste des événements du jour triés par heure
3. **Vue Multi-Salles** : Colonnes par salle avec événements

#### Exemple de rendu HTML

```html
<div class="planning-du-jour">
  <header class="planning-header">
    <h1>Planning du Mercredi 15/01/2026</h1>
    <time>09:30</time>
  </header>
  
  <div class="planning-grid">
    <!-- Colonne par salle -->
    <div class="salle-column" style="--salle-color: #0866C6;">
      <h2>Salle Einstein</h2>
      
      <div class="event en-cours">
        <span class="heure">09:00 - 10:30</span>
        <span class="nom">Réunion Direction</span>
        <span class="responsable">Marie Martin</span>
        <span class="countdown">45 min restantes</span>
      </div>
      
      <div class="event a-venir">
        <span class="heure">11:00 - 12:00</span>
        <span class="nom">Entretien RH</span>
      </div>
    </div>
    
    <div class="salle-column" style="--salle-color: #28A745;">
      <h2>Salle Curie</h2>
      <!-- ... -->
    </div>
  </div>
</div>
```

#### CSS suggéré

```css
.planning-du-jour {
  font-family: 'Segoe UI', sans-serif;
  background: linear-gradient(135deg, #1a1a2e, #16213e);
  color: white;
  height: 100vh;
  padding: 2vw;
}

.planning-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 3vh;
}

.planning-header h1 {
  font-size: 4vw;
  font-weight: 600;
}

.planning-header time {
  font-size: 5vw;
  font-weight: 700;
}

.planning-grid {
  display: flex;
  gap: 2vw;
  height: calc(100vh - 15vh);
}

.salle-column {
  flex: 1;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 1vw;
  padding: 1.5vw;
  border-top: 0.5vw solid var(--salle-color);
}

.salle-column h2 {
  font-size: 2vw;
  margin-bottom: 2vh;
  color: var(--salle-color);
}

.event {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 0.5vw;
  padding: 1.5vw;
  margin-bottom: 1.5vh;
  border-left: 0.3vw solid var(--salle-color);
}

.event.en-cours {
  background: rgba(255, 255, 255, 0.15);
  animation: pulse 2s infinite;
}

.event .heure {
  font-size: 1.8vw;
  font-weight: 600;
}

.event .nom {
  font-size: 2vw;
  display: block;
  margin: 0.5vh 0;
}

.event .responsable {
  font-size: 1.2vw;
  opacity: 0.7;
}

.event .countdown {
  font-size: 1.5vw;
  color: #ffc107;
  font-weight: 600;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.85; }
}
```

---

## 🔄 Changelog API

### v2.2 (Janvier 2026)
- ✅ **API Planning du Jour** : Nouvel endpoint `/see/API/planning/{idEcran}`
- ✅ **Événements par salle** : Planning groupé par salle avec statut temps réel
- ✅ **Compteurs temps** : `minutesRestantes` et `minutesAvantDebut` pour affichage dynamique

### v2.1 (Janvier 2026)
- ✅ **Liaison Salle ↔ Écran** : Relation ManyToMany entre salles SOEG et écrans SEE
- ✅ **Diapos Événements** : Génération automatique de diapos prioritaires pour les événements
- ✅ **Template Data** : Nouveau champ `templateData` pour affichage dynamique sans média
- ✅ **Mode affichage** : `auto` (template) ou `custom` (média personnalisé)

### v2.0 (Janvier 2026)
- ✅ Ajout `TypeDiapo` (standard, programme, prioritaire)
- ✅ Ajout `Priorite` (0-10)
- ✅ Ajout `HeureDebut`, `HeureFin`, `JoursSemaine`
- ✅ Ajout `PlagesHoraires` (programmation avancée)
- ✅ Ajout `orientation`, `dimensions`, `ratio` pour l'écran
- ✅ Gestion du statut `sleep` (hors plage horaire)

### v1.0 (Legacy)
- `DateDebutDiapo`, `DateFinDiapo`
- `ligneMedia` avec `TypeMedia`, `FichierMedia`, `DureeLigneMedia`

---

## 📞 Support

En cas de problème avec l'API :
1. Vérifier que l'`idEcran` est correct
2. Vérifier que l'écran est activé dans SOEK
3. Consulter les logs de la console seedisplay
4. Contacter l'administrateur SOEK

---

*Documentation générée le 01 janvier 2026*

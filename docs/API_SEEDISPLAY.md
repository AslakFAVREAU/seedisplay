# 📺 API SEE Display - Documentation d'intégration

Documentation de l'API pour le projet **seedisplay** (affichage dynamique sur écrans).

> **URL de base**: `https://soek.fr/see/API/diapo/{idEcran}`
> **Version**: 2.0 (Janvier 2026)

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
  "refreshInterval": 300,
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

## 📋 Structure d'un Diapo

Chaque élément dans le tableau `diapos` :

```json
{
  "id": 42,
  "NomDiapo": "Annonces Janvier",
  "DateDebutDiapo": "2025-01-01T00:00:00+01:00",
  "DateFinDiapo": "2025-01-31T23:59:59+01:00",
  "TypeDiapo": "standard",
  "Priorite": 0,
  "HeureDebut": "08:00:00",
  "HeureFin": "18:00:00",
  "JoursSemaine": [1, 2, 3, 4, 5],
  "PlagesHoraires": null,
  "ligneMedia": [...]
}
```

### Champs du Diapo

| Champ | Type | Description |
|-------|------|-------------|
| `id` | integer | ID unique du diapo |
| `NomDiapo` | string | Nom du diaporama |
| `DateDebutDiapo` | ISO8601 | Date/heure de début de validité |
| `DateFinDiapo` | ISO8601 | Date/heure de fin de validité |
| `TypeDiapo` | string | Type de diaporama (voir ci-dessous) |
| `Priorite` | integer | Niveau de priorité (0-10) |
| `HeureDebut` | string\|null | Heure de début d'affichage (format `"HH:mm:ss"`) |
| `HeureFin` | string\|null | Heure de fin d'affichage (format `"HH:mm:ss"`) |
| `JoursSemaine` | array\|null | Jours autorisés (0=Dim, 1=Lun, ..., 6=Sam) |
| `PlagesHoraires` | object\|null | Plages horaires avancées par jour |
| `ligneMedia` | array | Liste des médias du diaporama |

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
- **Comportement**: Passe devant les autres diaporamas
- **Programmation**: Peut respecter les horaires si définis
- **Priorité**: Élevée (valeur `Priorite` > 0)

```javascript
// Exemple de logique - Tri par priorité
const sortedDiapos = diapos.sort((a, b) => {
  // Prioritaires en premier
  if (a.TypeDiapo === 'prioritaire' && b.TypeDiapo !== 'prioritaire') return -1;
  if (b.TypeDiapo === 'prioritaire' && a.TypeDiapo !== 'prioritaire') return 1;
  // Ensuite par niveau de priorité
  return (b.Priorite || 0) - (a.Priorite || 0);
});
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

## 🔄 Changelog API

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

*Documentation générée le 25 décembre 2025*

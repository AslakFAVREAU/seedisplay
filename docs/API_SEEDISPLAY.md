# API SEE Display

> Documentation de l'API consommée par l'application **SEE Display** (Electron).
> Dernière mise à jour : 13/02/2026

## Base URL

| Environnement | URL |
|---------------|-----|
| **Production** | `https://soek.fr` |
| **Beta** | `https://beta.soek.fr` |
| **Local** | `http://localhost:8000` |

---

## 1. Récupération des diapos — `GET /see/API/diapo/{uuid}`

Point d'entrée principal. Retourne la configuration complète de l'écran, les diapos actives, les médias et les templates.

### Paramètres

| Paramètre | Type | Description |
|-----------|------|-------------|
| `uuid` | string (path) | UUID de l'écran |

### Réponse : `status: "active"` (dans les heures de fonctionnement)

```json
{
  "status": "active",
  "ecranId": 1,
  "ecranNom": "Écran Hall",
  "orientation": "paysage",
  "ratio": "16:9",
  "dimensions": "1920 × 1080",
  "customResolution": null,
  "luminosite": 75,
  "modeNuit": {
    "actif": true,
    "type": "fixe",
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
    },
    "planning": {
      "actif": true,
      "position": "bottom",
      "hauteur": 30,
      "refreshInterval": 60,
      "slideDuree": 15,
      "maxSallesPerPage": 4,
      "apiUrl": "/see/API/planning/{uuid}"
    }
  },
  "fondEcran": "/uploads/see/fonds/background.jpg",
  "masquerPageDefault": false,
  "sonActif": false,
  "refreshInterval": 300,
  "serverTime": "2026-02-11T14:30:00+01:00",
  "modePrioritaire": false,
  "totalDiapos": 3,
  "totalMedias": 8,
  "timeline": [ ... ],
  "diapos": [ ... ],
  "templates": [ ... ]
}
```

### Réponse : `status: "sleep"` (en dehors des heures de fonctionnement)

```json
{
  "status": "sleep",
  "ecranId": 1,
  "ecranNom": "Écran Hall",
  "orientation": "paysage",
  "ratio": "16:9",
  "dimensions": "1920 × 1080",
  "customResolution": null,
  "typeHorsPlage": "noir",
  "imageHorsPlage": null,
  "luminosite": 75,
  "prochainDemarrage": "07:00",
  "diapos": []
}
```

### Réponse : 404 (écran non trouvé)

```json
{
  "error": "Écran non trouvé",
  "uuid_recherche": "xxxx-xxxx-xxxx",
  "message": "Vérifiez que l'UUID est correct dans la configuration seedisplay"
}
```

---

## 2. Mode Nuit — Détail du champ `modeNuit`

Le mode nuit gère la réduction automatique de la luminosité de l'écran.

### Deux modes disponibles

#### Mode Fixe (`type: "fixe"`)

Les heures de début et fin sont définies manuellement par l'administrateur.

```json
{
  "actif": true,
  "type": "fixe",
  "luminositeNuit": 25,
  "heureDebut": "22:00",
  "heureFin": "07:00"
}
```

#### Mode Automatique (`type: "auto"`)

Les heures sont calculées automatiquement à partir du **lever et coucher du soleil** de la ville configurée. L'API [sunrise-sunset.org](https://sunrise-sunset.org) est interrogée côté serveur (cache 6h).

```json
{
  "actif": true,
  "type": "auto",
  "luminositeNuit": 25,
  "heureDebut": "17:42",
  "heureFin": "07:58",
  "solaire": {
    "coucher": "17:42",
    "lever": "07:58",
    "decalageDebut": 0,
    "decalageFin": 0,
    "ville": "Paris (75000)"
  }
}
```

| Champ | Type | Description |
|-------|------|-------------|
| `actif` | bool | Mode nuit activé |
| `type` | string | `"fixe"` ou `"auto"` |
| `luminositeNuit` | int | Luminosité pendant la nuit (0-100) |
| `heureDebut` | string\|null | Heure de début du mode nuit (`HH:mm`) |
| `heureFin` | string\|null | Heure de fin du mode nuit (`HH:mm`) |
| `solaire` | object\|absent | Présent uniquement si `type: "auto"` |
| `solaire.coucher` | string | Heure du coucher du soleil (avant décalage) |
| `solaire.lever` | string | Heure du lever du soleil (avant décalage) |
| `solaire.decalageDebut` | int | Décalage en minutes après le coucher |
| `solaire.decalageFin` | int | Décalage en minutes avant le lever |
| `solaire.ville` | string | Nom de la ville configurée |

### Comportement côté serveur

- Le champ racine `luminosite` est **pré-calculé** : le serveur détermine si l'écran est actuellement en mode nuit et retourne la bonne valeur (jour ou nuit).
- Les champs `heureDebut` / `heureFin` sont **toujours remplis** quel que soit le type, pour que le client puisse aussi faire la transition lui-même entre deux appels API.
- En mode auto, les heures changent chaque jour. Le cache serveur est renouvelé toutes les 6h, et une nouvelle date = nouveau calcul automatique.

### Côté SEE Display (SleepManager)

Le `SleepManager` lit `modeNuit.heureDebut` et `modeNuit.heureFin` toutes les 60 secondes pour gérer la transition jour/nuit en temps réel. **Aucune modification nécessaire** : les champs sont identiques en mode fixe et auto.

---

## 3. Timeline (médias pré-calculés)

Liste ordonnée des médias actifs à afficher maintenant.

```json
"timeline": [
  {
    "ordre": 1,
    "diapoId": 5,
    "diapoNom": "Diapo Accueil",
    "diapoType": "standard",
    "diapoPriorite": 0,
    "mediaId": 12,
    "mediaNom": "Photo entrée",
    "mediaType": "img",
    "mediaFichier": "photo_entree.jpg",
    "mediaUrl": "/uploads/see/media/photo_entree.jpg",
    "duree": 10,
    "transition": "cut"
  }
]
```

| Champ | Type | Description |
|-------|------|-------------|
| `mediaType` | string | `"img"` ou `"video"` |
| `duree` | int | Durée d'affichage en secondes |
| `mediaUrl` | string | Chemin relatif du fichier média |

---

## 4. Diapos (détail complet)

```json
"diapos": [
  {
    "id": 5,
    "nom": "Diapo Accueil",
    "actif": true,
    "dateDebut": "2026-01-01T00:00:00+01:00",
    "dateFin": null,
    "type": "standard",
    "priorite": 0,
    "programmation": {
      "mode": "simple",
      "heureDebut": "08:00",
      "heureFin": "18:00",
      "joursSemaine": [1, 2, 3, 4, 5],
      "plagesHoraires": null
    },
    "isEventTemplate": false,
    "medias": [
      {
        "ordre": 1,
        "duree": 10,
        "mediaId": 12,
        "nom": "Photo entrée",
        "type": "img",
        "fichier": "photo_entree.jpg",
        "url": "/uploads/see/media/photo_entree.jpg"
      }
    ],
    "totalMedias": 1,
    "dureeTotale": 10
  }
]
```

### Diapo événement (isEventTemplate = true)

```json
{
  "isEventTemplate": true,
  "evenement": {
    "id": 3,
    "nom": "Réunion Parents",
    "description": "Réunion trimestrielle",
    "salle": "Salle A",
    "heureDebut": "14:00",
    "heureFin": "16:00",
    "date": "2026-02-15",
    "mode": "auto",
    "anticipation": 30,
    "heureDebutAffichage": "13:30"
  }
}
```

---

## 5. Templates dynamiques

```json
"templates": [
  {
    "id": 1,
    "uuid": "abc-def-123",
    "nom": "Anniversaires",
    "type": "ANNIVERSAIRES",
    "ordre": 1,
    "dureeAffichage": 15,
    "actif": true,
    "dateCreation": "2026-01-15T10:00:00+01:00",
    "dateModification": "2026-02-01T14:30:00+01:00",
    "config": {},
    "presentation": {},
    "data": {}
  }
]
```

### Données par type de template

| Type | Champs `data` |
|------|---------------|
| `ANNIVERSAIRES` | `personnes`, `anniversairesDuJour`, `anniversairesDeLaSemaine`, `totalPersonnes` |
| `MENU` | `menus`, `menuDuJour`, `menusDeLaSemaine`, `totalMenus` |
| `ANNONCE` | `titre`, `message`, `niveau`, `dateDebut`, `dateFin` |
| `BIENVENUE` | `titre`, `sousTitre`, `logo`, `couleurFond` |
| `METEO` | `latitude`, `longitude`, `ville`, `units` |
| `TRAFIC` | `arrets`, `apiKey` |

#### Détail du template TRAFIC

Le template TRAFIC fournit la configuration nécessaire pour que SEE Display interroge l'API IDFM PRIM en temps réel.

##### Champs `data`

| Champ | Type | Description |
|-------|------|-------------|
| `arrets` | array | Liste des arrêts à surveiller |
| `apiKey` | string | Clé API IDFM PRIM pour les appels directs |

##### Structure d'un arrêt

```json
{
  "arrets": [
    {
      "id": "stop_area:IDFM:71264",
      "nom": "République",
      "label": "République (Paris)",
      "lignesSelectionnees": [
        {
          "id": "line:IDFM:C01379",
          "code": "3",
          "mode": "Métro",
          "couleur": "#6EC4E8",
          "textColor": "#000000"
        },
        {
          "id": "line:IDFM:C01380",
          "code": "5",
          "mode": "Métro",
          "couleur": "#F28E42",
          "textColor": "#000000"
        }
      ]
    },
    {
      "id": "stop_area:IDFM:73689",
      "nom": "La Défense",
      "label": "La Défense Grande Arche (Puteaux)",
      "lignesSelectionnees": []
    }
  ],
  "apiKey": "Fg550K..."
}
```

##### Comportement du filtrage par lignes

| Cas | Valeur `lignesSelectionnees` | Comportement |
|-----|------------------------------|--------------|
| Toutes les lignes | `[]` (tableau vide) | Afficher **tous** les départs de l'arrêt |
| Lignes spécifiques | `[{id, code, mode, couleur, textColor}, ...]` | Filtrer pour n'afficher que les départs des lignes sélectionnées |

> **Note** : Le filtrage doit être appliqué côté client (SEE Display) en comparant le champ `ligne` des départs retournés par l'API IDFM avec les `code` des `lignesSelectionnees`.

##### API IDFM PRIM — Endpoints utilisés par SEE Display

SEE Display utilise directement l'API IDFM PRIM avec la clé API fournie.

| Endpoint | URL | Description |
|----------|-----|-------------|
| **Départs** | `https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/stop_areas/{stopId}/departures?count=N&data_freshness=realtime&disable_geojson=true` | Prochains départs en temps réel |

**Authentification** : Header `apikey: {apiKey}` (clé en minuscules).

**Format de réponse des départs** (Navitia) :

```json
{
  "departures": [
    {
      "display_informations": {
        "code": "9",
        "commercial_mode": "Métro",
        "color": "B5BD00",
        "text_color": "000000",
        "direction": "Mairie de Montreuil (Montreuil)",
        "network": "RATP",
        "headsign": "Mairie de Montreuil"
      },
      "stop_date_time": {
        "departure_date_time": "20260213T143000"
      }
    }
  ]
}
```

| Champ | Description |
|-------|-------------|
| `code` | Code court de la ligne (ex: "9", "A", "56") |
| `commercial_mode` | Mode de transport ("Métro", "Bus", "RER", "Tram", "Train") |
| `color` | Couleur de la ligne (hex sans #) |
| `text_color` | Couleur du texte (hex sans #) |
| `direction` | Destination du véhicule |
| `departure_date_time` | Heure de départ format `YYYYMMDDTHHmmss` |

---

## 6. Planning — `GET /see/API/planning/{uuid}`

Retourne les événements du jour pour les salles associées à l'écran.

### Réponse succès

```json
{
  "status": "success",
  "ecranId": 1,
  "ecranNom": "Écran Hall",
  "date": "2026-02-11",
  "dateFormatee": "11/02/2026",
  "jourSemaine": "Mercredi",
  "serverTime": "2026-02-11T14:30:00+01:00",
  "refreshInterval": 60,
  "salles": [
    {
      "id": 1,
      "nom": "Salle A",
      "batiment": "Bâtiment 1",
      "couleur": "#0866C6",
      "capacite": 30
    }
  ],
  "totalSalles": 1,
  "evenements": [
    {
      "id": 5,
      "nom": "Réunion équipe",
      "salleId": 1,
      "salleNom": "Salle A",
      "salleCouleur": "#0866C6",
      "heureDebut": "14:00",
      "heureFin": "15:30",
      "dateDebut": "2026-02-11",
      "responsable": "Jean Dupont",
      "typeEvent": "Réunion",
      "statut": "en_cours",
      "minutesRestantes": 45,
      "minutesAvantDebut": null
    }
  ],
  "totalEvenements": 3,
  "planningParSalle": [
    {
      "salle": { "id": 1, "nom": "Salle A", "batiment": "Bâtiment 1", "couleur": "#0866C6", "capacite": 30 },
      "evenements": [ ... ],
      "prochainEvent": { ... },
      "eventEnCours": { ... }
    }
  ]
}
```

### Réponse : aucune salle associée

```json
{
  "status": "no_salles",
  "ecranId": 1,
  "ecranNom": "Écran Hall",
  "message": "Aucune salle associée à cet écran",
  "salles": [],
  "evenements": [],
  "serverTime": "2026-02-11T14:30:00+01:00"
}
```

### Statuts des événements

| Statut | Description |
|--------|-------------|
| `a_venir` | L'événement n'a pas encore commencé. `minutesAvantDebut` est renseigné. |
| `en_cours` | L'événement est en cours. `minutesRestantes` est renseigné. |
| `termine` | L'événement est terminé. |

---

## 7. Heartbeat — `POST /see/API/heartbeat/{ecranUuid}`

Envoyé périodiquement par SEE Display pour signaler son état au serveur.

### Corps de la requête (JSON)

```json
{
  "version": "1.9.21",
  "uptime": "2h 34m",
  "debug": {
    "sleepMode": false,
    "nightMode": true,
    "screenStatus": "active"
  },
  "screenshot": "data:image/jpeg;base64,/9j/4AAQ..."
}
```

### Réponses

| Code | Réponse |
|------|---------|
| 200 | `{ "success": true, "message": "Heartbeat received", "serverTime": "..." }` |
| 400 | `{ "error": "Invalid JSON payload" }` |
| 401 | `{ "error": "Invalid token" }` |
| 404 | `{ "error": "Ecran not found" }` |

---

## 8. Monitoring — `GET /see/API/monitoring/status`

> Requiert `ROLE_ADMIN_SEE`

```json
{
  "ecrans": [
    {
      "id": 1,
      "uuid": "abc-def-123",
      "nom": "Écran Hall",
      "status": "active",
      "screenshot": "base64...",
      "version": "1.9.21",
      "uptime": "5h 12m",
      "lastSeen": "14:28:00",
      "debug": {}
    }
  ],
  "stats": { "online": 5, "offline": 1, "total": 6 },
  "serverTime": "2026-02-11T14:30:00+01:00"
}
```

---

## 9. Monitoring détail écran — `GET /see/API/monitoring/ecran/{uuid}`

> Requiert `ROLE_ADMIN_SEE`

```json
{
  "id": 1,
  "uuid": "abc-def-123",
  "nom": "Écran Hall",
  "entitee": "Organisation 1",
  "status": "active",
  "version": "1.9.21",
  "uptime": "5h 12m",
  "lastSeen": "11/02/2026 14:28:00",
  "screenshot": "base64...",
  "debug": {},
  "config": {
    "orientation": "paysage",
    "ratio": "16:9",
    "luminosite": 75,
    "sonActif": false,
    "planningActif": true,
    "modeNuitActif": true,
    "programmationActive": true
  }
}
```

---

## 10. Régénération de token — `POST /see/API/ecran/{uuid}/regenerate-token`

> Requiert `ROLE_ADMIN_SEE`

| Code | Réponse |
|------|---------|
| 200 | `{ "success": true, "token": "new-token" }` |
| 500 | `{ "success": false, "error": "Erreur lors de la régénération du token" }` |

---

## 11. APIs internes AJAX

> Requiert `ROLE_ADMINSOE`

| Route | Description | Réponse |
|-------|-------------|---------|
| `GET /see/api/users-by-entitee/{id}` | Utilisateurs d'une organisation | `[{ "id": 1, "label": "Nom" }]` |
| `GET /see/api/dossiers-by-entitee/{id}` | Dossiers médias d'une org | `[{ "id": 1, "nom": "...", "type": "..." }]` |
| `GET /see/api/ecrans-by-entitee/{id}` | Écrans d'une organisation | `[{ "id": 1, "nom": "..." }]` |

---

## Notes techniques

### Rafraîchissement
- `refreshInterval` (défaut 300s, min 60, max 600) : intervalle entre chaque appel de SEE Display.
- En mode auto nuit, les heures solaires changent quotidiennement. Le cache serveur (6h) + le refresh régulier garantissent des heures à jour.

### Calcul de luminosité
Le champ racine `luminosite` est **pré-calculé côté serveur** en tenant compte du mode nuit (fixe ou auto). Le client (`SleepManager`) fait aussi sa propre vérification toutes les 60 secondes avec `heureDebut`/`heureFin` pour des transitions fluides entre les appels API.

### Mode nuit auto — API externe
Le serveur utilise [sunrise-sunset.org](https://api.sunrise-sunset.org) (gratuit, pas de clé API) pour récupérer les heures de lever/coucher. Les données sont converties en heure de Paris (`Europe/Paris`) et mises en cache 6h. Une nouvelle date = une nouvelle clé de cache = un nouvel appel automatique.
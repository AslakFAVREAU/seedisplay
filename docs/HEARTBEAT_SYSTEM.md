# Heartbeat System - SEE Display

## Vue d'ensemble

Le système de heartbeat permet à chaque écran SEE Display d'envoyer régulièrement son statut au serveur SOEK. Cela permet de :
- Monitorer les écrans en temps réel
- Voir la version installée sur chaque écran
- Afficher une miniature 720p de ce qui est affiché
- Détecter les écrans hors ligne

---

## 📡 Fréquence d'envoi

| Paramètre | Valeur |
|-----------|--------|
| **Premier envoi** | 10 secondes après démarrage |
| **Intervalle** | Toutes les 30 secondes |
| **Screenshot** | 720p (1280x720), JPEG 80% |

---

## 📤 Payload envoyé

```json
{
  "ecranUuid": "96371d93-ed93-11f0-88b0-00e04cdaf7ae",
  "version": "1.9.34",
  "timestamp": "2026-01-26T16:45:00.000Z",
  "uptime": 3600,
  "debug": {
    "mediaCount": 12,
    "currentMedia": "video-accueil.mp4",
    "cacheStatus": "ok",
    "cacheEntries": 45,
    "screenStatus": "active",
    "luminosite": 50,
    "sonActif": false,
    "nightMode": false,
    "sleepMode": false,
    "planningActive": true,
    "memoryUsage": 42
  },
  "screenshot": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
}
```

### Champs

| Champ | Type | Description |
|-------|------|-------------|
| `ecranUuid` | string | UUID unique de l'écran |
| `version` | string | Version de l'application |
| `timestamp` | string | Date/heure ISO 8601 |
| `uptime` | number | Secondes depuis démarrage |
| `debug` | object | Infos de debug détaillées |
| `screenshot` | string\|null | Image base64 JPEG 720p |

### Debug object

| Champ | Type | Description |
|-------|------|-------------|
| `mediaCount` | number | Nombre de médias dans la playlist |
| `currentMedia` | string\|null | Nom du média actuellement affiché |
| `cacheStatus` | string | "ok" ou "error" |
| `cacheEntries` | number | Nombre d'entrées en cache |
| `screenStatus` | string | "active", "sleep", "night", "error" |
| `luminosite` | number | Luminosité actuelle (0-100) |
| `sonActif` | boolean | Son activé sur les vidéos |
| `nightMode` | boolean | Mode nuit actif |
| `sleepMode` | boolean | Mode veille actif |
| `planningActive` | boolean | Planning jour affiché |
| `memoryUsage` | number\|null | Utilisation mémoire en % |

---

## 🖥️ Endpoint SOEK

### Request

```http
POST /see/API/heartbeat/{ecranUuid}
Content-Type: application/json
X-API-Token: {apiToken}
```

### Response attendue

```json
{
  "success": true,
  "message": "Heartbeat received"
}
```

### Codes HTTP

| Code | Signification |
|------|---------------|
| 200 | OK, heartbeat enregistré |
| 401 | Token invalide |
| 404 | Écran non trouvé |
| 500 | Erreur serveur |

---

## 🗄️ Stockage côté serveur (suggestion)

### Table `ecran_heartbeat`

```sql
CREATE TABLE ecran_heartbeat (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ecran_id INT NOT NULL,
  version VARCHAR(20),
  last_seen DATETIME NOT NULL,
  uptime INT,
  debug_json JSON,
  screenshot_path VARCHAR(255),
  is_online BOOLEAN GENERATED ALWAYS AS (last_seen > NOW() - INTERVAL 2 MINUTE),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (ecran_id) REFERENCES ecran(id),
  INDEX idx_last_seen (last_seen)
);
```

### Logique `is_online`

- **En ligne** : `last_seen` < 2 minutes
- **Hors ligne** : `last_seen` >= 2 minutes

### Stockage screenshot

```
/uploads/see/heartbeat/
├── 96371d93-ed93-11f0-88b0-00e04cdaf7ae.jpg
├── a1b2c3d4-...jpg
└── ...
```

Remplacer le fichier à chaque heartbeat (pas d'historique).

---

## 🎨 Dashboard Admin (suggestion)

### Vue grille d'écrans

```
┌────────────────────────────────────────────────────────────┐
│  📺 Monitoring SEE Display                                 │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  [miniature] │  │  [miniature] │  │  [miniature] │     │
│  │              │  │              │  │      ⚠️       │     │
│  │  🟢 En ligne │  │  🟢 En ligne │  │  🔴 Hors ligne│     │
│  │  Accueil     │  │  Cantine     │  │  Parking     │     │
│  │  v1.9.34     │  │  v1.9.33     │  │  v1.9.28     │     │
│  │  12 médias   │  │  8 médias    │  │  il y a 45min│     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Vue détaillée (clic sur écran)

```
┌────────────────────────────────────────────────────────────┐
│  📺 Accueil - 96371d93-ed93-11f0-88b0-00e04cdaf7ae        │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─────────────────────────────────────┐                  │
│  │                                     │                  │
│  │        [Screenshot 720p]            │                  │
│  │                                     │                  │
│  └─────────────────────────────────────┘                  │
│                                                            │
│  📊 Infos                                                  │
│  ├─ Version: v1.9.34                                      │
│  ├─ Statut: 🟢 Actif                                      │
│  ├─ Uptime: 2h 35min                                      │
│  ├─ Dernière mise à jour: il y a 15s                      │
│  │                                                        │
│  🎬 Médias                                                 │
│  ├─ Playlist: 12 médias                                   │
│  ├─ Média courant: video-accueil.mp4                      │
│  ├─ Cache: 45 entrées ✅                                  │
│  │                                                        │
│  ⚙️ Configuration                                         │
│  ├─ Luminosité: 50%                                       │
│  ├─ Son: 🔇 Muet                                          │
│  ├─ Mode nuit: ❌                                         │
│  ├─ Planning: ✅ Actif                                    │
│  │                                                        │
│  💻 Système                                                │
│  ├─ Mémoire: 42%                                          │
│  └─ IP: 192.168.1.50                                      │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 📱 Intégration côté SEE Display

### Initialisation

Le HeartbeatManager est initialisé dans `index.html` après le chargement de la config :

```javascript
// Après getConfigSEE()
if (window.HeartbeatManager) {
  window.heartbeatManager = new HeartbeatManager({ interval: 30000 });
  window.heartbeatManager.init({
    ecranUuid: idEcran,
    apiToken: apiToken,
    env: env
  });
  window.heartbeatManager.start();
}
```

### Fichiers impliqués

| Fichier | Rôle |
|---------|------|
| `js/HeartbeatManager.js` | Module principal |
| `preload.js` | API `captureScreen()` |
| `main.js` | Handler IPC screenshot |

---

## 🔧 Configuration

### Activer/désactiver

```javascript
// Désactiver temporairement
window.heartbeatManager.setEnabled(false);

// Réactiver
window.heartbeatManager.setEnabled(true);
```

### Changer l'intervalle

```javascript
// Dans les options du constructeur
new HeartbeatManager({ interval: 60000 }); // 1 minute
```

---

## ⚠️ Notes importantes

1. **Taille du screenshot** : ~50-100 KB en JPEG 80% (720p)
2. **Bande passante** : ~100 KB / 30s = ~12 MB/heure par écran
3. **Sans screenshot** : ~1 KB / 30s = ~120 KB/heure par écran
4. **Timeout** : Si pas de heartbeat depuis 2 min → écran considéré hors ligne

---

## 🚨 Incidents (watchdog) — contrat SEE Display ↔ SOEK

Le heartbeat donne l'état **courant** de l'écran (`debug` est écrasé à chaque envoi).
Les incidents donnent l'**historique** : chaque blocage, crash, relance ou média sauté
est journalisé sur le boîtier puis envoyé à SOEK, qui le conserve 30 jours.

### Côté boîtier

- Journal tenu par le **process main** (`lib/IncidentLog.js`) : il reste opérationnel
  quand la page est figée ou a crashé.
- File persistée dans `BASE_PATH/cache/incidents.json` (300 entrées max, les plus
  anciens `info` sont supprimés en premier) : un incident écrit juste avant un
  redémarrage part au démarrage suivant.
- **Dédoublonnage** : même `type` + même `contexte.fichier` dans les 10 dernières
  minutes → `occurrences` est incrémenté au lieu de créer une ligne.
- Envoi au démarrage, 2 s après un incident `critique`, sinon toutes les 60 s.
  Échec → backoff 1 min, 2 min, 4 min… plafonné à 10 min. Rien n'est envoyé en mode
  `--offline` ni sans `ecranUuid`/`apiToken`.
- La page signale ses incidents via `window.api.reportIncident(type, niveau, message, contexte)`.

### Endpoint

```
POST /see/API/heartbeat/{ecranUuid}/incidents
Content-Type: application/json
X-API-Token: {apiToken}
```

```json
{
  "ecranUuid": "xxx-xxx-xxx",
  "incidents": [
    {
      "clientId": "3f0c7b8e-2a41-4c55-9d0e-6a7f1b2c3d4e",
      "ts": "2026-11-03T08:12:45.120Z",
      "type": "RENDERER_FIGE",
      "niveau": "critique",
      "source": "main",
      "message": "Aucun signe de vie de la page depuis 46s",
      "contexte": { "secondesSansPing": 46, "tentative": 1 },
      "versionApp": "2.11.0",
      "uptimeS": 18234,
      "occurrences": 1
    }
  ]
}
```

| Champ | Règle côté SOEK |
|-------|-----------------|
| `clientId` | UUID obligatoire, clé d'idempotence (unique par écran) |
| `ts` | ISO 8601 obligatoire (heure du boîtier) |
| `type` | `[A-Z0-9_]`, 64 car. max, sinon `AUTRE` |
| `niveau` | `info` \| `warn` \| `critique`, sinon `warn` |
| `message` | tronqué à 500 caractères |
| `contexte` | objet JSON, tronqué à 8 Ko encodé |
| `occurrences` | entier ≥ 1 |

Limites : 50 incidents par lot, corps ≤ 256 Ko (sinon 413), JSON invalide → 400,
token absent ou faux → 401.

### Réponse

```json
{
  "success": true,
  "accepted": ["3f0c7b8e-…"],
  "rejected": [{ "clientId": "…", "raison": "clientId invalide" }],
  "serverTime": "2026-11-03T08:12:46+01:00"
}
```

Un `clientId` déjà connu est renvoyé dans `accepted` sans être réinséré (renvoi après
coupure réseau). Les `accepted` et les `rejected` sont retirés de la file du boîtier ;
tout le reste est renvoyé plus tard.

### Types d'incidents

| Type | Niveau | Source | Signification |
|------|--------|--------|---------------|
| `DEMARRAGE` | info / warn | main | Démarrage de l'app ; `warn` si l'arrêt précédent était inattendu (coupure, crash) |
| `RENDERER_FIGE` | critique | main | Plus de signe de vie de la page depuis 45 s |
| `RENDERER_NE_REPOND_PLUS` | critique | main | Chromium signale la page bloquée > 30 s → crash forcé |
| `RENDERER_CRASH` | critique | main | Process de la page arrêté (`reason`, `exitCode`) |
| `GPU_CRASH` | warn | main | Process GPU arrêté (relancé par Chromium) |
| `CHARGEMENT_ECHOUE` | warn | main | `index.html` n'a pas pu être chargé |
| `MEMOIRE_ELEVEE` | warn | main | Page > 1,5 Go → rechargée |
| `PAGE_RECHARGEE` | warn / info | main | Action du watchdog : rechargement (`cause`) |
| `APP_RELANCEE` | critique | main | Action du watchdog : relance complète (`cause`) |
| `MODE_SUR_ACTIVE` | critique | main | Plus de 3 relances en 1 h → l'écran reste sur la page par défaut |
| `MODE_SUR_DESACTIVE` | info | main | 1 h sans incident critique → reprise normale |
| `BOUCLE_BLOQUEE` | warn / critique | renderer / main | Aucun média depuis 90 s+ ; `contexte.niveau` = 1 (relance boucle), 2 (remise à zéro), 3 (restart), `arret` ou `main` |
| `TOUS_MEDIAS_EN_ECHEC` | critique | renderer | Un cycle complet sans aucun média affichable (backoff 10/30/60 s) |
| `VIDEO_SAUTEE` | warn | renderer | Vidéo sautée (`fichier`, `code` : DECODE, LOAD_TIMEOUT, PLAY_FAILED…) |
| `VIDEO_FIGEE` | warn | renderer | Lecture bloquée 10 s (`fichier`, `position`) |
| `IMAGE_SAUTEE` | warn | renderer | Image illisible ou non chargée en 8 s (`fichier`, `code`) |
| `TEMPLATE_TIMEOUT` | warn | renderer | Template non terminé après sa durée + 20 s (`typeTemplate`) |

Un type inconnu de SOEK doit quand même être stocké et affiché (libellé = type brut) :
le boîtier peut être plus récent que le serveur.

### Escalade du watchdog

```
Page (js/loopDiapo.js), contrôle toutes les 60 s, aucun média depuis 90 s+ :
  niveau 1 → relance de la boucle
  niveau 2 → remise à zéro (lecteurs vidés, verrous libérés, liste rechargée)
  niveau 3 → restart demandé au main
Main (lib/MainWatchdog.js), contrôle toutes les 5 s :
  plus de ping 45 s      → reload ; toujours rien 60 s après → relance de l'app
  page bloquée > 30 s    → crash forcé → reload
  crash de la page       → reload ; > 3 crashs en 10 min → relance de l'app
  > 3 relances en 1 h    → mode sûr (page par défaut, polling API maintenu)
```

`debug.watchdog` dans le heartbeat donne l'état en direct :
`{ reloads, relaunches, forcedCrashes, safeMode, lastAction, niveauBoucle, relaunchesLastHour, incidentsEnAttente, incidentsDernierEnvoi, incidentsDerniereErreur }`.

### Affichage attendu dans SOEK (monitoring)

- **Carte écran** : badge `fa-bolt` « N » sur 24 h ; rouge s'il y a au moins un
  incident critique, orange sinon ; infobulle « N incident(s) dont M critique(s) sur 24h ».
- **Modale de détail** : section « Incidents (7 derniers jours) », une ligne par
  incident, la plus récente en haut : heure · pastille de niveau · libellé du type ·
  message · « ×N » si `occurrences > 1` ; contexte dépliable.
- **Alerte email** (`app:monitor-ecrans`, horaire) : incidents critiques de la dernière heure.

### Tester sans SOEK

```bash
node scripts/fake-soek.js --faults=random --corrupt-video   # affiche les incidents reçus
npm run start:faults                                        # configSEE.json : "env": "local"
# DevTools : __faults.freeze(60000), __faults.crash(), __faults.breakLoop()…
```

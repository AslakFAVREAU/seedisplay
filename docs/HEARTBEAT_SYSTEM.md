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

# API Pairing — Spécifications serveur SOEK

## Résumé

Système d'appairage type "WPS" pour associer un écran SEE Display à un compte SOEK.  
L'écran affiche un **code 4 caractères** (ex: `K7M3`), l'utilisateur le saisit sur SOEK pour associer l'écran.

---

## Flow complet

```
┌─────────────┐                      ┌─────────────┐                    ┌──────────┐
│  SEE Display │                      │  Serveur    │                    │  User    │
│  (Electron)  │                      │  SOEK       │                    │  (web)   │
└──────┬───────┘                      └──────┬──────┘                    └────┬─────┘
       │                                     │                               │
       │  1. POST /see/API/pair              │                               │
       │  { code:"K7M3", deviceId:"dev-xx" } │                               │
       │────────────────────────────────────►│                               │
       │                                     │  Stocke code + deviceId       │
       │  ◄── 200 { ok, expiresIn: 600 }     │  TTL = 10 min                │
       │                                     │                               │
       │                                     │   2. User va sur soek.fr      │
       │                                     │   et entre le code "K7M3"     │
       │                                     │◄──────────────────────────────│
       │                                     │                               │
       │                                     │  3. POST /see/API/pair/confirm│
       │                                     │  { code:"K7M3",              │
       │                                     │    ecranUuid:"550e...",       │
       │                                     │    apiToken:"tok_xxx" }       │
       │                                     │◄──────────────────────────────│
       │                                     │                               │
       │                                     │  Met à jour le code:          │
       │                                     │  status: "paired"             │
       │                                     │  + ecranUuid + apiToken       │
       │                                     │                               │
       │  4. GET /see/API/pair/K7M3/status   │                               │
       │────────────────────────────────────►│                               │
       │                                     │                               │
       │  ◄── 200 { status:"paired",        │                               │
       │       ecranUuid:"550e...",           │                               │
       │       ecranNom:"Écran Accueil",     │                               │
       │       apiToken:"tok_xxx" }          │                               │
       │                                     │                               │
       │  5. Sauvegarde config + redémarre   │                               │
       │                                     │                               │
```

---

## Endpoints à implémenter

### 1. `POST /see/API/pair` — Enregistrer un code d'appairage

L'écran SEE Display appelle cet endpoint au démarrage pour enregistrer son code.

**Request:**
```json
{
  "code": "K7M3",
  "deviceId": "dev-m4x7k2-abc123",
  "hostname": "Mozilla/5.0 ... Electron/38.2.2",
  "platform": "Linux x86_64"
}
```

| Champ      | Type   | Description                                              |
|------------|--------|----------------------------------------------------------|
| `code`     | string | Code 4 caractères alphanumériques (sans 0,O,1,I,L)      |
| `deviceId` | string | Identifiant unique du device (persisté côté écran)       |
| `hostname` | string | User-Agent de l'écran (optionnel, pour info)             |
| `platform` | string | Plateforme: "Win32", "Linux x86_64", etc. (optionnel)    |

**Response 200:**
```json
{
  "ok": true,
  "expiresIn": 600
}
```

| Champ       | Type   | Description                                    |
|-------------|--------|------------------------------------------------|
| `ok`        | bool   | Succès de l'enregistrement                     |
| `expiresIn` | int    | Durée de validité du code en secondes (ex: 600 = 10 min) |

**Response 409** (code déjà utilisé):
```json
{
  "error": "Code already in use",
  "retryWith": "NEW_CODE"
}
```

**Stockage côté serveur** (table temporaire ou Redis):
```
pairing_codes:
  code: "K7M3"
  deviceId: "dev-m4x7k2-abc123"
  hostname: "..."
  platform: "Linux x86_64"
  status: "pending"          ← sera changé en "paired"
  ecranUuid: null            ← sera rempli par confirm
  apiToken: null             ← sera rempli par confirm
  ecranNom: null             ← sera rempli par confirm
  createdAt: "2026-02-25T10:30:00Z"
  expiresAt: "2026-02-25T10:40:00Z"
```

---

### 2. `GET /see/API/pair/{code}/status` — Vérifier le statut d'un code

L'écran poll cet endpoint toutes les **5 secondes** pour voir si le code a été associé.

**Request:** `GET /see/API/pair/K7M3/status`

**Response 200 — En attente (pas encore appairé):**
```json
{
  "status": "pending"
}
```

**Response 200 — Appairé ! :**
```json
{
  "status": "paired",
  "ecranUuid": "550e8400-e29b-41d4-a716-446655440000",
  "ecranNom": "Écran Accueil",
  "apiToken": "tok_xxxxxxxxxxxxxxxxxxxxxxxx"
}
```

| Champ       | Type   | Description                                          |
|-------------|--------|------------------------------------------------------|
| `status`    | string | `"pending"` ou `"paired"`                            |
| `ecranUuid` | string | UUID de l'écran associé (seulement si paired)        |
| `ecranNom`  | string | Nom de l'écran sur SOEK (seulement si paired)        |
| `apiToken`  | string | Token API pour cet écran (seulement si paired)       |

**Response 404 — Code expiré ou inconnu:**
```json
{
  "error": "Code not found or expired"
}
```

> Quand l'écran reçoit 404, il re-génère automatiquement un nouveau code et recommence.

---

### 3. `POST /see/API/pair/confirm` — Associer un écran à un code (côté web SOEK)

Appelé depuis l'interface web SOEK quand l'utilisateur entre le code affiché sur l'écran.

**Request:**
```json
{
  "code": "K7M3",
  "ecranUuid": "550e8400-e29b-41d4-a716-446655440000",
  "apiToken": "tok_xxxxxxxxxxxxxxxxxxxxxxxx"
}
```

| Champ       | Type   | Description                                        |
|-------------|--------|----------------------------------------------------|
| `code`      | string | Code 4 car. affiché sur l'écran                    |
| `ecranUuid` | string | UUID de l'écran à associer (choisi par l'user)     |
| `apiToken`  | string | Token API généré pour cet écran                    |

**Response 200:**
```json
{
  "ok": true,
  "ecranNom": "Écran Accueil",
  "deviceId": "dev-m4x7k2-abc123"
}
```

**Response 404:**
```json
{
  "error": "Code not found or expired"
}
```

**Response 409:**
```json
{
  "error": "Code already paired"
}
```

**Action serveur:**
1. Trouver l'entrée avec ce `code` et `status: "pending"`
2. Mettre à jour: `status → "paired"`, `ecranUuid`, `apiToken`, `ecranNom`
3. Au prochain poll de l'écran, il recevra les infos et se configurera

---

## Côté web SOEK — Interface utilisateur

Il faut une page/modale dans l'interface admin SOEK (ou une page dédiée `soek.fr/pair`) où l'utilisateur peut :

1. **Entrer le code 4 caractères** affiché sur l'écran
2. **Choisir l'écran** à associer (dropdown de ses écrans existants, ou en créer un nouveau)
3. **Valider** → appelle `POST /see/API/pair/confirm`

### Mockup simple :
```
┌──────────────────────────────────┐
│  Associer un écran SEE Display   │
│                                  │
│  Code affiché sur l'écran:       │
│  ┌────┬────┬────┬────┐          │
│  │ K  │ 7  │ M  │ 3  │          │
│  └────┴────┴────┴────┘          │
│                                  │
│  Associer à l'écran:            │
│  ┌──────────────────────┐       │
│  │ Écran Accueil     ▼  │       │
│  └──────────────────────┘       │
│                                  │
│  [ Associer cet écran ]         │
│                                  │
└──────────────────────────────────┘
```

---

## Notes d'implémentation

### Sécurité
- Les codes expirent après **10 minutes** (configurable)
- Les codes sont à usage unique : une fois `paired`, impossible de les réutiliser
- Après 3 tentatives échouées sur un code, le bloquer (anti-brute-force)
- Nettoyer les codes expirés régulièrement (cron ou TTL Redis)

### Caractères utilisés dans les codes
Alphabet volontairement réduit pour éviter les confusions visuelles :
```
ABCDEFGHJKMNPQRSTUVWXYZ23456789
```
**Exclus :** `0` (confondu avec `O`), `1` (confondu avec `I`/`L`), `O`, `I`, `L`

Ça donne 30 caractères possibles → 30^4 = **810 000 combinaisons** → largement suffisant.

### Stockage recommandé
- **Redis** avec TTL automatique (le plus simple)
- Ou table SQL avec cleanup via cron :
```sql
CREATE TABLE pairing_codes (
    code VARCHAR(4) PRIMARY KEY,
    device_id VARCHAR(64),
    hostname VARCHAR(255),
    platform VARCHAR(64),
    status ENUM('pending', 'paired') DEFAULT 'pending',
    ecran_uuid VARCHAR(36),
    ecran_nom VARCHAR(255),
    api_token VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    INDEX idx_expires (expires_at),
    INDEX idx_status (status)
);
```

### Nettoyage
```sql
-- À exécuter périodiquement (cron toutes les 5 min)
DELETE FROM pairing_codes WHERE expires_at < NOW();
```

---

## Résumé pour le dev serveur

| Endpoint | Méthode | Qui appelle | Quand |
|----------|---------|-------------|-------|
| `/see/API/pair` | POST | Écran (Electron) | Au démarrage setup |
| `/see/API/pair/{code}/status` | GET | Écran (Electron) | Toutes les 5s |
| `/see/API/pair/confirm` | POST | Interface web SOEK | Quand user entre le code |

**Temps estimé côté serveur : ~2-3h** (3 endpoints simples + 1 table/Redis + 1 UI basique).

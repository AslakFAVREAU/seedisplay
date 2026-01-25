# Configuration Serveur SOEK - Auto-update SEE Display

Ce document décrit comment configurer le serveur SOEK pour héberger les mises à jour automatiques de SEE Display.

---

## 📁 Structure des dossiers requise

```
/updates/seedisplay/
├── latest.yml                              ← Fichier manifest (OBLIGATOIRE)
├── SEE-Display-Setup-X.X.X.exe             ← Installeur
└── SEE-Display-Setup-X.X.X.exe.blockmap    ← Optionnel (delta updates)
```

**URLs finales :**
| Environnement | URL |
|---------------|-----|
| **Production** | `https://soek.fr/updates/seedisplay/` |
| **Beta** | `https://beta.soek.fr/updates/seedisplay/` |

---

## ⚠️ IMPORTANT : Nom du fichier manifest

Le fichier de version **DOIT** s'appeler **`latest.yml`**

```
✅ latest.yml        → Correct
❌ stable.yml        → NE FONCTIONNERA PAS
❌ beta.yml          → NE FONCTIONNERA PAS
```

electron-updater cherche toujours `latest.yml` par défaut.

---

## 📄 Format du fichier `latest.yml`

```yaml
version: 1.9.21
files:
  - url: SEE-Display-Setup-1.9.21.exe
    sha512: +ctUBliyRwDpwmmKRTx2nLkMMAdtK6tYpZRU5uEGBH/rI6yQM7P8nn7rH/qtoCzu1FfKlRzngi+xyXp6HWi+0A==
    size: 95676152
path: SEE-Display-Setup-1.9.21.exe
sha512: +ctUBliyRwDpwmmKRTx2nLkMMAdtK6tYpZRU5uEGBH/rI6yQM7P8nn7rH/qtoCzu1FfKlRzngi+xyXp6HWi+0A==
releaseDate: '2026-01-25T12:23:58.245Z'
```

### Champs obligatoires

| Champ | Description |
|-------|-------------|
| `version` | Numéro de version (semver) |
| `files[].url` | Nom du fichier .exe |
| `files[].sha512` | Hash SHA512 en base64 |
| `files[].size` | Taille en bytes |
| `path` | Nom du fichier .exe (répété) |
| `sha512` | Hash SHA512 en base64 (répété) |
| `releaseDate` | Date ISO 8601 |

**Note** : Ce fichier est généré automatiquement par le build (`npm run build`). Il suffit de le copier tel quel.

---

## 🌐 Requêtes HTTP de l'application

### 1. Vérification de version

```http
GET /updates/seedisplay/latest.yml
Accept: application/json, text/plain, */*
User-Agent: electron-updater
```

### 2. Téléchargement de l'installeur

```http
GET /updates/seedisplay/SEE-Display-Setup-X.X.X.exe
```

### 3. Headers envoyés (pour stats/logs)

| Header | Description | Exemple |
|--------|-------------|---------|
| `X-App-Version` | Version actuelle de l'app | `1.9.21` |
| `X-Update-Channel` | Canal configuré | `stable` ou `beta` |
| `User-Agent` | Agent | `electron-updater` |

---

## 📤 Réponses attendues

| Requête | Content-Type | Code HTTP |
|---------|--------------|-----------|
| `latest.yml` | `text/yaml` ou `text/plain` | 200 |
| `.exe` | `application/octet-stream` | 200 |
| `.blockmap` | `application/octet-stream` | 200 |

**CORS** : Pas nécessaire (requêtes depuis Electron, pas un navigateur)

---

## 📦 Workflow d'upload pour admin SOEK

Quand on publie une nouvelle version :

1. **Récupérer les fichiers** depuis le build (`dist/vX.X.X/`) :
   - `SEE-Display-Setup-X.X.X.exe`
   - `SEE-Display-Setup-X.X.X.exe.blockmap` (optionnel)
   - `latest.yml`

2. **Uploader sur le serveur** dans `/updates/seedisplay/` :
   - Uploader le `.exe`
   - Uploader le `.blockmap` (optionnel)
   - **Remplacer** `latest.yml` avec le nouveau

3. **Vérifier** l'accessibilité

---

## ✅ Test de vérification

Pour vérifier que tout est bien configuré :

```bash
# Vérifier le manifest
curl https://soek.fr/updates/seedisplay/latest.yml

# Doit retourner le YAML avec la version actuelle
```

```bash
# Vérifier que l'exe est accessible (HEAD request)
curl -I https://soek.fr/updates/seedisplay/SEE-Display-Setup-1.9.21.exe

# Doit retourner HTTP 200
```

---

## 🔧 Configuration côté SEE Display

L'application détermine l'URL du serveur selon le champ `env` dans `C:/SEE/configSEE.json` :

| Valeur `env` | URL de mise à jour |
|--------------|-------------------|
| `"prod"` ou `"soek"` | `https://soek.fr/updates/seedisplay` |
| `"beta"` | `https://beta.soek.fr/updates/seedisplay` |
| `"localhost"` ou `"local"` | `http://localhost:8000/updates/seedisplay` |

---

## 📊 Logs utiles côté serveur

Si vous voulez tracker les mises à jour, loggez ces infos depuis les headers :

```
[2026-01-25 14:30:00] Update check from app v1.9.20, channel: stable
[2026-01-25 14:30:01] Download started: SEE-Display-Setup-1.9.21.exe
```

Cela permet de :
- Tracker les versions déployées
- Analyser l'adoption des mises à jour
- Détecter les problèmes de déploiement

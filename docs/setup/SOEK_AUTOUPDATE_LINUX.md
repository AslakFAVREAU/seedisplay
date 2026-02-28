# Modifications SOEK — Auto-update Linux (AppImage)

> **Date** : 26 février 2026  
> **Contexte** : SEE Display supporte maintenant l'auto-update sur Linux via AppImage. Le serveur SOEK doit être adapté pour servir les fichiers Linux en plus des fichiers Windows.

---

## Résumé des changements

Le module d'auto-update `electron-updater` utilise **un manifest différent par plateforme** :

| Plateforme | Manifest cherché | Fichier installeur |
|------------|------------------|--------------------|
| **Windows** | `latest.yml` | `SEE-Display-Setup-X.X.X.exe` |
| **Linux** | `latest-linux.yml` | `SEE-Display-X.X.X-x86_64.AppImage` |

**C'est automatique côté client** — electron-updater sait quel manifest demander selon l'OS. Côté serveur, il faut juste héberger les deux.

---

## 1. Nouvelle structure de fichiers sur le serveur

### Avant (Windows uniquement)

```
soek.fr/updates/seedisplay/
├── latest.yml
├── SEE-Display-Setup-X.X.X.exe
└── SEE-Display-Setup-X.X.X.exe.blockmap
```

### Après (Windows + Linux)

```
soek.fr/updates/seedisplay/
├── latest.yml                              ← manifest Windows (inchangé)
├── latest-linux.yml                        ← NOUVEAU : manifest Linux
├── SEE-Display-Setup-X.X.X.exe             ← installeur Windows (inchangé)
├── SEE-Display-Setup-X.X.X.exe.blockmap    ← blockmap Windows (optionnel)
└── SEE-Display-X.X.X-x86_64.AppImage       ← NOUVEAU : AppImage Linux (~122 MB)
```

Même chose pour le canal beta :

```
soek.fr/updates/seedisplay/beta/
├── latest.yml
├── latest-linux.yml                        ← NOUVEAU
├── SEE-Display-Setup-X.X.X.exe
└── SEE-Display-X.X.X-x86_64.AppImage       ← NOUVEAU
```

---

## 2. Contenu du fichier `latest-linux.yml`

Ce fichier est **généré automatiquement** par le build. Exemple réel (v1.10.9) :

```yaml
version: 1.10.9
files:
  - url: SEE-Display-1.10.9-x86_64.AppImage
    sha512: D7S1ZT103MHO3w6IwOkaOZGjruAGhqCRa3jw3CIoiZLe6PNQU07mHp36b4baAFSgEZFQk636hCzZ+tuxzDYYmg==
    size: 127651438
    blockMapSize: 134786
path: SEE-Display-1.10.9-x86_64.AppImage
sha512: D7S1ZT103MHO3w6IwOkaOZGjruAGhqCRa3jw3CIoiZLe6PNQU07mHp36b4baAFSgEZFQk636hCzZ+tuxzDYYmg==
releaseDate: '2026-02-26T18:48:00.786Z'
```

### Champs obligatoires

| Champ | Description |
|-------|-------------|
| `version` | Numéro de version semver |
| `files[].url` | Nom du fichier AppImage |
| `files[].sha512` | Hash SHA512 base64 de l'AppImage |
| `files[].size` | Taille en bytes |
| `path` | Nom du fichier AppImage |
| `sha512` | Hash SHA512 base64 (dupliqué) |
| `releaseDate` | Date ISO 8601 |

---

## 3. Modifications du module d'upload SOEK

### 3.1. Accepter les nouveaux types de fichiers

Le formulaire/API d'upload doit accepter :

| Extension | MIME type | Taille typique |
|-----------|-----------|----------------|
| `.AppImage` | `application/octet-stream` | ~120 MB |
| `latest-linux.yml` | `text/yaml` | ~300 bytes |

⚠️ **Vérifier la limite upload** : l'AppImage fait ~122 MB, s'assurer que la config PHP/Nginx permet des uploads de cette taille.

```nginx
# nginx.conf
client_max_body_size 200M;
```

```ini
# php.ini
upload_max_filesize = 200M
post_max_size = 200M
```

### 3.2. Servir les fichiers correctement

Les fichiers doivent être accessibles en GET sans authentification :

```
GET https://soek.fr/updates/seedisplay/latest-linux.yml      → 200 OK (text/yaml)
GET https://soek.fr/updates/seedisplay/SEE-Display-1.10.9-x86_64.AppImage → 200 OK (application/octet-stream)
```

### 3.3. Headers HTTP à vérifier

```apache
# .htaccess — s'assurer que les .AppImage sont servis correctement
<IfModule mod_headers.c>
    Header set Access-Control-Allow-Origin "*"
    Header set Access-Control-Allow-Methods "GET"
</IfModule>

# MIME type pour AppImage
AddType application/octet-stream .AppImage
```

### 3.4. Génération auto du `latest-linux.yml` (si Option B est utilisée)

Si le serveur génère les manifests automatiquement à l'upload, ajouter le support Linux :

```php
<?php
// Détection du type de fichier uploadé
$filename = $_FILES['installer']['name'];
$file = $_FILES['installer']['tmp_name'];
$size = filesize($file);
$sha512 = base64_encode(hash_file('sha512', $file, true));

if (str_ends_with($filename, '.AppImage')) {
    // === LINUX ===
    preg_match('/Display-(\d+\.\d+\.\d+)/', $filename, $matches);
    $version = $matches[1];
    
    $yaml = "version: $version
files:
  - url: $filename
    sha512: $sha512
    size: $size
path: $filename
sha512: $sha512
releaseDate: '" . date('c') . "'
";
    
    file_put_contents('latest-linux.yml', $yaml);
    
} elseif (str_ends_with($filename, '.exe')) {
    // === WINDOWS (existant) ===
    preg_match('/Setup-(\d+\.\d+\.\d+)\.exe/', $filename, $matches);
    $version = $matches[1];
    
    $yaml = "version: $version
files:
  - url: $filename
    sha512: $sha512
    size: $size
path: $filename
sha512: $sha512
releaseDate: '" . date('c') . "'
";
    
    file_put_contents('latest.yml', $yaml);
}
?>
```

---

## 4. Interface admin — Modifications UI

### Interface actuelle (Windows uniquement)

L'interface d'upload SOEK a actuellement **3 champs** :

| # | Champ actuel | Type |
|---|-------------|------|
| 1 | 📁 **Fichier d'installation (.exe)** | Drag & drop / Parcourir |
| 2 | 🔣 **Fichier Blockmap (.blockmap)** - Optionnel | Choisir un fichier |
| 3 | 📄 **Fichier latest.yml** - Recommandé | Choisir un fichier |

### Champs à ajouter (Linux)

Ajouter **3 nouveaux champs** en dessous des existants, dans une section séparée "Linux" :

| # | Nouveau champ à ajouter | Type | Notes |
|---|------------------------|------|-------|
| 4 | 🐧 **Fichier AppImage (.AppImage)** | Drag & drop / Parcourir | ~122 MB — même style que le champ .exe |
| 5 | 🔣 **Fichier Blockmap Linux (.AppImage.blockmap)** - Optionnel | Choisir un fichier | Même style que le blockmap Windows |
| 6 | 📄 **Fichier latest-linux.yml** - Recommandé | Choisir un fichier | Même style que latest.yml |

### Maquette de l'interface modifiée

```
┌─────────────────────────────────────────────────────┐
│  ══════════ WINDOWS ══════════                      │
│                                                     │
│  📁 Fichier d'installation (.exe)          ← existant
│  ┌─────────────────────────────────────┐            │
│  │  Glissez-déposez SEE-Display-       │            │
│  │  Setup-X.X.X.exe ici               │            │
│  │         [ Parcourir ]               │            │
│  └─────────────────────────────────────┘            │
│                                                     │
│  🔣 Fichier Blockmap (.blockmap) - Optionnel ← existant
│  [ Choisir un fichier ] Aucun fichier choisi        │
│                                                     │
│  📄 Fichier latest.yml - Recommandé        ← existant
│  [ Choisir un fichier ] Aucun fichier choisi        │
│                                                     │
│  ══════════ LINUX ══════════              ← NOUVEAU │
│                                                     │
│  🐧 Fichier AppImage (.AppImage)          ← NOUVEAU │
│  ┌─────────────────────────────────────┐            │
│  │  Glissez-déposez SEE-Display-       │            │
│  │  X.X.X-x86_64.AppImage ici         │            │
│  │         [ Parcourir ]               │            │
│  └─────────────────────────────────────┘            │
│                                                     │
│  🔣 Fichier Blockmap Linux - Optionnel    ← NOUVEAU │
│  [ Choisir un fichier ] Aucun fichier choisi        │
│                                                     │
│  📄 Fichier latest-linux.yml - Recommandé ← NOUVEAU │
│  ℹ️ Importez le fichier latest-linux.yml             │
│    généré par le build Docker.                      │
│  [ Choisir un fichier ] Aucun fichier choisi        │
│                                                     │
│              [ 🚀 Publier la mise à jour ]           │
└─────────────────────────────────────────────────────┘
```

### Validations côté serveur

| Validation | Règle |
|-----------|-------|
| Extension `.AppImage` | Accepter `application/octet-stream` |
| Taille max upload | **200 MB** minimum (AppImage ~122 MB) |
| Nom du fichier | Doit matcher `SEE-Display-*-x86_64.AppImage` |
| `latest-linux.yml` | Si non fourni, le générer automatiquement à partir du hash SHA512 de l'AppImage |
| Indépendance | Les champs Linux sont **optionnels** — on peut publier un update Windows seul ou Linux seul |

### Config serveur (limites upload)

```nginx
# nginx.conf
client_max_body_size 200M;
```

```ini
# php.ini
upload_max_filesize = 200M
post_max_size = 200M
max_execution_time = 300
```

---

## 5. Endpoints à vérifier

### Nouveaux endpoints (à ajouter)

| Méthode | URL | Description |
|---------|-----|-------------|
| `GET` | `/updates/seedisplay/latest-linux.yml` | Manifest Linux stable |
| `GET` | `/updates/seedisplay/SEE-Display-*-x86_64.AppImage` | AppImage stable |
| `GET` | `/updates/seedisplay/beta/latest-linux.yml` | Manifest Linux beta |
| `GET` | `/updates/seedisplay/beta/SEE-Display-*-x86_64.AppImage` | AppImage beta |

### Test de vérification

```bash
# Depuis un terminal Linux ou avec curl :

# 1. Vérifier que le manifest Linux est accessible
curl -I https://soek.fr/updates/seedisplay/latest-linux.yml
# Attendu : HTTP 200

# 2. Vérifier le contenu du manifest
curl https://soek.fr/updates/seedisplay/latest-linux.yml
# Attendu : YAML avec version, sha512, url du fichier AppImage

# 3. Vérifier que l'AppImage est téléchargeable
curl -I https://soek.fr/updates/seedisplay/SEE-Display-1.10.9-x86_64.AppImage
# Attendu : HTTP 200, Content-Length ~127MB
```

---

## 6. Process de publication (mis à jour)

### Étape 1 — Build sur le poste dev (Windows)

```powershell
cd C:\Programation\seedisplay

# Build Windows (existant)
npm run build

# Build Linux AppImage (via Docker)
docker run --rm -v "${PWD}:/project" -w /project electronuserland/builder:20 `
  bash -c "npm ci && npx electron-builder --linux AppImage --x64"
```

### Étape 2 — Fichiers générés dans `dist/vX.X.X/`

```
dist/vX.X.X/
├── SEE-Display-Setup-X.X.X.exe          ← Windows
├── SEE-Display-Setup-X.X.X.exe.blockmap ← Windows (diff updates)
├── latest.yml                           ← Manifest Windows
├── SEE-Display-X.X.X-x86_64.AppImage    ← Linux
└── latest-linux.yml                     ← Manifest Linux
```

### Étape 3 — Upload sur SOEK

Uploader les 4 fichiers (+ blockmap optionnel) dans `/updates/seedisplay/`.

---

## 7. Points d'attention

| Sujet | Détail |
|-------|--------|
| **Nommage manifest** | `latest-linux.yml` — NE PAS renommer (electron-updater cherche ce nom exact) |
| **Taille upload** | L'AppImage fait ~122 MB, vérifier les limites serveur |
| **HTTPS obligatoire** | electron-updater refuse les URL HTTP (sauf localhost) |
| **SHA512** | Le hash dans le YAML doit correspondre exactement au fichier, sinon l'update est refusée |
| **Même URL** | Windows et Linux utilisent la **même URL de base** (`/updates/seedisplay/`), seul le nom du manifest change |
| **Pas de code côté client** | Aucune modification de `main.js` nécessaire — electron-updater gère la détection de plateforme |

---

## 8. FAQ

**Q: Faut-il modifier le code de SEE Display ?**  
Non. `electron-updater` sait automatiquement chercher `latest-linux.yml` quand il tourne sur Linux. La config `setFeedURL({ url: 'https://soek.fr/updates/seedisplay' })` dans `main.js` est suffisante pour les deux plateformes.

**Q: Que se passe-t-il si `latest-linux.yml` n'existe pas sur le serveur ?**  
L'auto-update sur Linux échouera silencieusement (404). Les clients Windows ne sont pas affectés.

**Q: L'AppImage se met à jour comment côté client ?**  
electron-updater télécharge la nouvelle AppImage, remplace l'ancienne, et relance l'app. L'AppImage doit être dans un dossier **writable** par l'utilisateur (ex: `~/Applications/`).

**Q: Faut-il supporter ARM64 pour Raspberry Pi ?**  
Pas pour l'instant. L'auto-update AppImage est pour x64 uniquement. Les Raspberry Pi (ARM64) sont mis à jour manuellement.

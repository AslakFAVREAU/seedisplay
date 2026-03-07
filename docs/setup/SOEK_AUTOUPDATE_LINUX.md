# Modifications SOEK — Auto-update Linux (AppImage)

> **Date** : 7 mars 2026  
> **Contexte** : SEE Display est distribué exclusivement en AppImage Linux x64. Le serveur SOEK doit servir les fichiers de mise à jour correspondants.

---

## Résumé

Le module d'auto-update `electron-updater` cherche le manifest `latest-linux.yml` sur le serveur, puis télécharge l'AppImage correspondante.

| Plateforme | Manifest cherché | Fichier installeur |
|------------|------------------|--------------------|
| **Linux x64** | `latest-linux.yml` | `SEE-Display-x86_64.AppImage` |

---

## 1. Structure de fichiers sur le serveur

```
soek.fr/updates/seedisplay/
├── latest-linux.yml                        ← manifest Linux
└── SEE-Display-x86_64.AppImage             ← AppImage (~122 MB)
```

Canal beta :

```
soek.fr/updates/seedisplay/beta/
├── latest-linux.yml
└── SEE-Display-x86_64.AppImage
```

---

## 2. Contenu du fichier `latest-linux.yml`

Ce fichier est **généré automatiquement** par le build. Exemple :

```yaml
version: 2.0.0
files:
  - url: SEE-Display-x86_64.AppImage
    sha512: D7S1ZT103MHO3w6IwOkaOZGjruAGhqCRa3jw3CIoiZLe...==
    size: 127651438
    blockMapSize: 134786
path: SEE-Display-x86_64.AppImage
sha512: D7S1ZT103MHO3w6IwOkaOZGjruAGhqCRa3jw3CIoiZLe...==
releaseDate: '2026-03-07T09:00:00.000Z'
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

## 3. Configuration serveur

### Limites upload

L'AppImage fait ~122 MB, s'assurer que la config PHP/Nginx permet des uploads de cette taille.

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

### Headers HTTP

```apache
# .htaccess
<IfModule mod_headers.c>
    Header set Access-Control-Allow-Origin "*"
    Header set Access-Control-Allow-Methods "GET"
</IfModule>

AddType application/octet-stream .AppImage
```

### Génération auto du manifest (optionnel)

Si le serveur génère les manifests automatiquement à l'upload :

```php
<?php
$filename = $_FILES['installer']['name'];
$file = $_FILES['installer']['tmp_name'];
$size = filesize($file);
$sha512 = base64_encode(hash_file('sha512', $file, true));

if (str_ends_with($filename, '.AppImage')) {
    preg_match('/Display-(\d+\.\d+\.\d+)/', $filename, $matches);
    $version = $matches[1] ?? 'unknown';
    
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
}
?>
```

---

## 4. Interface admin — Upload

| # | Champ | Type | Notes |
|---|-------|------|-------|
| 1 | 🐧 **Fichier AppImage (.AppImage)** | Drag & drop / Parcourir | ~122 MB |
| 2 | 📄 **Fichier latest-linux.yml** - Recommandé | Choisir un fichier | Généré par le build |

### Validations

| Validation | Règle |
|-----------|-------|
| Extension `.AppImage` | Accepter `application/octet-stream` |
| Taille max upload | **200 MB** minimum |
| Nom du fichier | Doit matcher `SEE-Display-*-x86_64.AppImage` |
| `latest-linux.yml` | Si non fourni, le générer automatiquement |

---

## 5. Endpoints

| Méthode | URL | Description |
|---------|-----|-------------|
| `GET` | `/updates/seedisplay/latest-linux.yml` | Manifest stable |
| `GET` | `/updates/seedisplay/SEE-Display-*-x86_64.AppImage` | AppImage stable |
| `GET` | `/updates/seedisplay/beta/latest-linux.yml` | Manifest beta |
| `GET` | `/updates/seedisplay/beta/SEE-Display-*-x86_64.AppImage` | AppImage beta |

### Test de vérification

```bash
# 1. Vérifier que le manifest est accessible
curl -I https://soek.fr/updates/seedisplay/latest-linux.yml
# Attendu : HTTP 200

# 2. Vérifier le contenu du manifest
curl https://soek.fr/updates/seedisplay/latest-linux.yml
# Attendu : YAML avec version, sha512, url

# 3. Vérifier que l'AppImage est téléchargeable
curl -I https://soek.fr/updates/seedisplay/SEE-Display-x86_64.AppImage
# Attendu : HTTP 200, Content-Length ~122MB
```

---

## 6. Process de publication

### Étape 1 — Build via WSL

```powershell
cd C:\Programation\seedisplay
wsl -d Ubuntu -- bash -c "cd /mnt/c/Programation/seedisplay && npx electron-builder --linux AppImage --x64"
```

### Étape 2 — Fichiers générés dans `dist/vX.X.X/`

```
dist/vX.X.X/
├── SEE-Display-x86_64.AppImage    ← AppImage Linux
└── latest-linux.yml               ← Manifest Linux
```

### Étape 3 — Upload sur SOEK

Uploader les 2 fichiers dans `/updates/seedisplay/`.

---

## 7. Points d'attention

| Sujet | Détail |
|-------|--------|
| **Nommage manifest** | `latest-linux.yml` — NE PAS renommer (electron-updater cherche ce nom exact) |
| **Taille upload** | L'AppImage fait ~122 MB, vérifier les limites serveur |
| **HTTPS obligatoire** | electron-updater refuse les URL HTTP (sauf localhost) |
| **SHA512** | Le hash dans le YAML doit correspondre exactement au fichier |
| **Pas de code côté client** | Aucune modification de `main.js` nécessaire — electron-updater gère la détection de plateforme |

---

## 8. FAQ

**Q: Faut-il modifier le code de SEE Display ?**  
Non. `electron-updater` sait automatiquement chercher `latest-linux.yml` quand il tourne sur Linux. La config `setFeedURL({ url: 'https://soek.fr/updates/seedisplay' })` dans `main.js` est suffisante.

**Q: Que se passe-t-il si `latest-linux.yml` n'existe pas sur le serveur ?**  
L'auto-update échouera silencieusement (404).

**Q: L'AppImage se met à jour comment côté client ?**  
electron-updater télécharge la nouvelle AppImage, remplace l'ancienne, et relance l'app. L'AppImage doit être dans un dossier **writable** par l'utilisateur (ex: `~/Applications/`).

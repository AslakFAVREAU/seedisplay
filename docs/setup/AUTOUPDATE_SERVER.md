# Configuration du Serveur de Mises à Jour SEE Display

Ce document décrit l'intégration entre **SEE Display** (Electron) et le serveur de mises à jour **SOEK**.

---

## 📁 Structure des Dossiers sur SOEK

Deux canaux de mise à jour sont supportés :

```
soek.fr/
└── updates/
    └── seedisplay/
        ├── latest.yml                          # Manifest version stable
        ├── SEE-Display-Setup-X.X.X.exe         # Installeur stable
        ├── SEE-Display-Setup-X.X.X.exe.blockmap # Diff updates (optionnel)
        └── beta/
            ├── latest.yml                      # Manifest version beta
            ├── SEE-Display-Setup-X.X.X.exe     # Installeur beta
            └── SEE-Display-Setup-X.X.X.exe.blockmap
```

| Canal | URL | Usage |
|-------|-----|-------|
| **STABLE** | `https://soek.fr/updates/seedisplay` | Production |
| **BETA** | `https://soek.fr/updates/seedisplay/beta` | Tests/Preview |

### ⚠️ IMPORTANT : Nom du fichier manifest

Le fichier de version **DOIT** s'appeler **`latest.yml`** (PAS `stable.yml` !)

```
✅ latest.yml        → Correct
❌ stable.yml        → NE FONCTIONNERA PAS
❌ beta.yml          → NE FONCTIONNERA PAS
```

**Pourquoi ?** electron-updater avec `provider: 'generic'` cherche toujours `latest.yml` par défaut.
Si vous passez un paramètre `channel`, il cherchera `{channel}.yml` mais cela cause des erreurs de type "Cannot find channel 'xxx'".

---

## 🔐 Zone Admin d'Upload

### Intégration avec le module de login existant

Utiliser le **module de login existant** sur soek.fr pour sécuriser l'accès à l'upload des mises à jour.

### Dossiers à rendre accessibles pour upload

| Canal | Chemin sur le serveur |
|-------|----------------------|
| **STABLE** | `/updates/seedisplay/` |
| **BETA** | `/updates/seedisplay/beta/` |

### Fichiers à uploader par version
1. `SEE-Display-Setup-X.X.X.exe` (installeur ~80-100 Mo)
2. `SEE-Display-Setup-X.X.X.exe.blockmap` (pour updates différentielles, optionnel)
3. `latest.yml` (fichier de version, généré automatiquement par le build)

---

## 📤 Headers HTTP envoyés par SEE Display

Lors de chaque appel à l'API SOEK, SEE Display envoie automatiquement :

| Header | Description | Exemple |
|--------|-------------|---------|
| `X-App-Version` | Version actuelle de l'application | `1.9.14` |
| `X-Update-Channel` | Canal de mise à jour configuré | `stable` ou `beta` |
| `X-API-Token` | Token d'authentification (si configuré) | `abc123...` |

Ces headers permettent à SOEK de :
- Tracker les versions déployées
- Analyser l'adoption des mises à jour
- Notifier si une version critique est disponible

---

## 📄 Format du fichier `latest.yml`

Ce fichier est **généré automatiquement** par electron-builder. Exemple :

```yaml
version: 1.9.14
files:
  - url: SEE-Display-Setup-1.9.14.exe
    sha512: abc123def456...  # Hash SHA512 du fichier (OBLIGATOIRE)
    size: 98765432           # Taille en bytes
path: SEE-Display-Setup-1.9.14.exe
sha512: abc123def456...
releaseDate: '2026-01-22T10:30:00.000Z'
```

### Champs obligatoires
| Champ | Description |
|-------|-------------|
| `version` | Numéro de version (semver) |
| `path` | Nom du fichier .exe |
| `sha512` | Hash SHA512 en base64 du fichier .exe |
| `releaseDate` | Date ISO 8601 |

### ⚠️ Important
- Le hash SHA512 **doit correspondre exactement** au fichier uploadé
- Si le hash ne match pas, la mise à jour sera **refusée** par electron-updater

---

## 🔄 Processus de Publication

### Option A : Upload manuel

1. **Builder le projet** sur la machine de dev :
   ```powershell
   cd C:\Programation\seedisplay
   npm run build
   ```

2. **Récupérer les fichiers** dans `dist/vX.X.X/` :
   - `SEE-Display-Setup-X.X.X.exe`
   - `SEE-Display-Setup-X.X.X.exe.blockmap`
   - `latest.yml`

3. **Uploader sur soek.fr** via la zone admin :
   - Sélectionner le canal (stable ou beta)
   - Uploader les 3 fichiers
   - Vérifier que `latest.yml` est accessible

### Option B : Interface admin avec génération auto

L'admin peut uploader uniquement le `.exe` et le serveur génère `latest.yml` :

```php
<?php
// Exemple de génération du latest.yml côté serveur
$file = $_FILES['installer']['tmp_name'];
$filename = $_FILES['installer']['name'];
$size = filesize($file);
$sha512 = base64_encode(hash_file('sha512', $file, true));

// Extraire la version du nom de fichier
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
?>
```

---

## ✅ Vérification

### Endpoints à tester

| Endpoint | Description |
|----------|-------------|
| `GET /updates/seedisplay/latest.yml` | Manifest de la dernière version stable |
| `GET /updates/seedisplay/beta/latest.yml` | Manifest de la dernière version beta |
| `GET /updates/seedisplay/{filename}` | Téléchargement des fichiers stable |
| `GET /updates/seedisplay/beta/{filename}` | Téléchargement des fichiers beta |

### Test manuel
```powershell
# Vérifier que latest.yml stable est accessible
Invoke-WebRequest -Uri "https://soek.fr/updates/seedisplay/latest.yml" -UseBasicParsing

# Vérifier latest.yml beta
Invoke-WebRequest -Uri "https://soek.fr/updates/seedisplay/beta/latest.yml" -UseBasicParsing

# Vérifier le contenu
(Invoke-WebRequest -Uri "https://soek.fr/updates/seedisplay/latest.yml" -UseBasicParsing).Content
```

### Réponse attendue
```yaml
version: 1.9.14
files:
  - url: SEE-Display-Setup-1.9.14.exe
    sha512: base64hashici...
    size: 98765432
path: SEE-Display-Setup-1.9.14.exe
sha512: base64hashici...
releaseDate: '2026-01-22T10:30:00.000Z'
```

---

## 🛡️ Sécurité

### HTTPS obligatoire
- electron-updater **refuse** les URLs HTTP
- Les certificats SSL doivent être valides

### Vérification d'intégrité
- Le hash SHA512 dans `latest.yml` est vérifié avant installation
- Si le hash ne correspond pas, la mise à jour est **annulée**

### Protection de la zone admin
- Authentification HTTP Basic ou formulaire
- Rate limiting sur les uploads
- Logs des actions d'upload

### Headers CORS (si nécessaire)
```apache
# .htaccess
<IfModule mod_headers.c>
    Header set Access-Control-Allow-Origin "*"
    Header set Access-Control-Allow-Methods "GET"
</IfModule>
```

---

## 📱 Configuration côté Client

L'URL d'auto-update est déterminée automatiquement par le champ `env` dans `configSEE.json` :

```json
{
  "env": "beta",
  "ecranUuid": "xxx"
}
```

| Valeur `env` | URL de mise à jour |
|--------------|-------------------|
| `"beta"` | `https://beta.soek.fr/updates/seedisplay` |
| `"prod"` | `https://soek.fr/updates/seedisplay` |
| `"soek"` | `https://soek.fr/updates/seedisplay` |
| `"localhost"` | `http://localhost:8000/updates/seedisplay` |

---

## 🔧 Dépannage

### L'app ne détecte pas la mise à jour
1. Vérifier que `latest.yml` est accessible publiquement
2. Vérifier que la version dans `latest.yml` > version installée
3. Consulter les logs : `%USERPROFILE%\AppData\Roaming\SEE Display\logs\main.log`

### Erreur "sha512 checksum mismatch"
- Le fichier `.exe` a été corrompu pendant l'upload
- Ré-uploader le fichier ou régénérer le hash

### Erreur 404 sur le fichier .exe
- Vérifier que le nom de fichier dans `latest.yml` correspond exactement
- Vérifier les permissions du fichier sur le serveur

---

## 📞 Contact

Pour toute question sur la configuration :
- Email : [contact technique]
- Documentation dev : `docs/` dans le repo GitHub

---

*Document généré le 22 janvier 2026*

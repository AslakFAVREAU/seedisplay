# 🎨 Guide: Personnaliser l'Image de l'Installateur NSIS

## 📋 Contexte

Actuellement, l'installateur affiche **l'icône par défaut Electron** (logo bleu avec flèche de téléchargement) dans la sidebar gauche.

![Image actuelle](./assets/current-installer-sidebar.png)

## 🎯 Objectif

Remplacer l'image par défaut par **votre logo SEE Display personnalisé**.

---

## 📐 Spécifications de l'Image

### Dimensions
- **Largeur:** 164 pixels
- **Hauteur:** 314 pixels
- **Ratio:** ~1:2 (vertical)

### Format
- **Recommandé:** BMP 24-bit
- **Alternative:** PNG (sera converti automatiquement)
- **Profondeur de couleur:** 24-bit minimum

### Design
- Zone visible pendant toute l'installation
- Fond uni ou dégradé recommandé
- Logo centré verticalement et horizontalement
- Éviter les textes trop petits (illisibles)
- Contraste élevé pour visibilité

---

## 🛠️ Étapes de Configuration

### 1️⃣ Créer l'Image

**Option A: Depuis un Éditeur d'Image (Photoshop, GIMP, etc.)**

```
1. Nouveau document: 164 x 314 px
2. Résolution: 72 DPI (web)
3. Mode couleur: RGB
4. Fond: Bleu SEE ou dégradé
5. Ajouter votre logo (centré)
6. Exporter en BMP 24-bit ou PNG
7. Enregistrer: build/installer-sidebar.bmp
```

**Option B: Template Quick Start**

Utilisez ce template HTML + Canvas:

```html
<!DOCTYPE html>
<html>
<head>
    <title>NSIS Sidebar Generator</title>
</head>
<body>
    <canvas id="canvas" width="164" height="314"></canvas>
    <script>
        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        
        // Fond dégradé bleu
        const gradient = ctx.createLinearGradient(0, 0, 0, 314);
        gradient.addColorStop(0, '#1e3a8a');
        gradient.addColorStop(1, '#3b82f6');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 164, 314);
        
        // Texte "SEE Display"
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('SEE', 82, 140);
        ctx.fillText('Display', 82, 170);
        
        // Télécharger l'image
        canvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'installer-sidebar.png';
            a.click();
        });
    </script>
</body>
</html>
```

### 2️⃣ Placer l'Image

```bash
# Créer le dossier si nécessaire
mkdir build

# Copier votre image
cp chemin/vers/votre/image.bmp build/installer-sidebar.bmp
# ou
cp chemin/vers/votre/image.png build/installer-sidebar.png
```

### 3️⃣ Configurer package.json

Ajouter dans la section `build.nsis`:

```json
{
  "build": {
    "nsis": {
      "installerSidebar": "build/installer-sidebar.bmp",
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      // ... autres options
    }
  }
}
```

**Ou avec PNG:**

```json
{
  "build": {
    "nsis": {
      "installerSidebar": "build/installer-sidebar.png",
      // ...
    }
  }
}
```

### 4️⃣ Rebuild l'Installateur

```bash
# Rebuild complet
npm run dist

# Vérifier le résultat
.\dist\v1.9.3\SEE-Display-Setup-1.9.3.exe
```

---

## ✅ Vérification

### Checklist
- [ ] Image créée avec les bonnes dimensions (164x314px)
- [ ] Format correct (BMP 24-bit ou PNG)
- [ ] Image placée dans `build/installer-sidebar.bmp`
- [ ] package.json mis à jour avec `installerSidebar`
- [ ] Build réussie sans erreur
- [ ] Installateur testé - image apparaît correctement
- [ ] Image visible pendant toute l'installation
- [ ] Qualité de l'image acceptable (pas de pixelisation)

---

## 🎨 Exemples de Design

### Design 1: Logo Centré Simple
```
┌──────────────────┐
│                  │
│                  │
│                  │
│      [LOGO]      │
│                  │
│   SEE Display    │
│                  │
│                  │
│                  │
└──────────────────┘
```

### Design 2: Dégradé avec Logo
```
┌──────────────────┐
│  Bleu foncé      │
│                  │
│      [LOGO]      │
│                  │
│   SEE Display    │
│    v1.9.2        │
│                  │
│  Bleu clair      │
│                  │
└──────────────────┘
```

### Design 3: Minimaliste
```
┌──────────────────┐
│  Fond uni        │
│                  │
│                  │
│      [LOGO]      │
│      Simple      │
│                  │
│                  │
│                  │
│                  │
└──────────────────┘
```

---

## 🔧 Configuration Avancée

### Image de Désinstallation Différente

```json
{
  "build": {
    "nsis": {
      "installerSidebar": "build/installer-sidebar.bmp",
      "uninstallerSidebar": "build/uninstaller-sidebar.bmp"
    }
  }
}
```

### Bannière Haute (Alternative)

Si vous préférez une bannière en haut plutôt qu'une sidebar:

```json
{
  "build": {
    "nsis": {
      "installerHeader": "build/installer-header.bmp",
      "installerHeaderIcon": "build/icon.ico"
    }
  }
}
```

**Dimensions bannière:** 150 x 57 pixels

---

## 📊 Outils Recommandés

### Création d'Image
- **GIMP** (gratuit) - https://www.gimp.org/
- **Paint.NET** (gratuit) - https://www.getpaint.net/
- **Photoshop** (payant)
- **Figma** (gratuit pour usage personnel)

### Conversion BMP
Si vous avez une PNG et voulez convertir en BMP:

**PowerShell:**
```powershell
Add-Type -AssemblyName System.Drawing
$image = [System.Drawing.Image]::FromFile("build/installer-sidebar.png")
$image.Save("build/installer-sidebar.bmp", [System.Drawing.Imaging.ImageFormat]::Bmp)
```

**Ou avec ImageMagick:**
```bash
magick convert build/installer-sidebar.png -depth 24 build/installer-sidebar.bmp
```

---

## 🐛 Dépannage

### Problème: Image ne s'affiche pas
**Causes possibles:**
- Chemin incorrect dans package.json
- Format d'image non supporté
- Dimensions incorrectes

**Solution:**
```bash
# Vérifier que l'image existe
ls build/installer-sidebar.bmp

# Vérifier les dimensions (PowerShell)
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile("build/installer-sidebar.bmp")
Write-Host "Dimensions: $($img.Width)x$($img.Height)"
```

### Problème: Image pixelisée
**Cause:** Résolution trop basse
**Solution:** Recréer l'image en 164x314px minimum

### Problème: Erreur de build
**Cause:** Profondeur de couleur incorrecte
**Solution:** Utiliser BMP 24-bit (pas 8-bit ou 32-bit)

---

## 📝 Exemple Complet de Configuration

```json
{
  "name": "seedisplay",
  "version": "1.9.2",
  "build": {
    "appId": "fr.see.seedisplay",
    "productName": "SEE Display",
    "win": {
      "target": [
        { "target": "nsis", "arch": ["x64"] },
        { "target": "portable", "arch": ["x64"] }
      ],
      "icon": "build/icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "allowElevation": true,
      "installerIcon": "build/icon.ico",
      "uninstallerIcon": "build/icon.ico",
      "installerHeaderIcon": "build/icon.ico",
      "installerSidebar": "build/installer-sidebar.bmp",
      "uninstallerSidebar": "build/installer-sidebar.bmp",
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "SEE Display",
      "artifactName": "SEE-Display-Setup-${version}.exe",
      "deleteAppDataOnUninstall": false,
      "runAfterFinish": true,
      "license": "LICENSE"
    }
  }
}
```

---

## 🎯 Résultat Attendu

Après configuration, l'installateur affichera:

```
┌─────────────────┬──────────────────────────────────┐
│                 │  Installation de SEE Display     │
│   [VOTRE LOGO]  │                                  │
│                 │  Bienvenue dans l'assistant      │
│   SEE Display   │  d'installation...               │
│                 │                                  │
│                 │  [Options d'installation]        │
│                 │                                  │
│                 │                                  │
└─────────────────┴──────────────────────────────────┘
     164x314px              Contenu wizard
```

---

## 📚 Ressources

- [Electron Builder - NSIS Options](https://www.electron.build/configuration/nsis)
- [NSIS Documentation](https://nsis.sourceforge.io/Docs/)
- [Bitmap Specifications](https://en.wikipedia.org/wiki/BMP_file_format)

---

## ✅ TODO

- [ ] Créer l'image 164x314px
- [ ] Placer dans `build/installer-sidebar.bmp`
- [ ] Mettre à jour `package.json`
- [ ] Rebuild: `npm run dist`
- [ ] Tester l'installateur
- [ ] Commit les changements

---

**Date:** October 17, 2025  
**Version cible:** 1.9.3  
**Priorité:** Moyenne  
**Effort estimé:** 30 minutes

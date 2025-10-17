# 🎨 Génération Automatique d'Icônes

Ce script génère automatiquement tous les formats d'icônes nécessaires pour l'application Electron à partir d'une seule image source.

## 📋 Formats Générés

### Windows (.ico)
- Multi-résolutions incluses: 16, 24, 32, 48, 64, 128, 256px
- Fichier unique: `build/icon.ico`

### macOS (.icns)
- Multi-résolutions optimisées pour Retina
- Tailles: 16, 32, 64, 128, 256, 512, 1024px (@1x et @2x)
- Fichier unique: `build/icon.icns`
- **Note:** Nécessite macOS avec Xcode installé pour la conversion finale

### Linux (.png)
- Format PNG standard: 256x256px
- Fichier: `build/icon.png`

## 🚀 Utilisation

### Installation des Dépendances
```bash
npm install
```

### Génération des Icônes
```bash
npm run icons
```

### Image Source Requise
- **Fichier:** `assets/Flavicon.png`
- **Dimensions recommandées:** 1024x1024px minimum
- **Format:** PNG avec transparence
- **Qualité:** Haute résolution pour éviter le flou lors du redimensionnement

## 📁 Structure des Fichiers

```
seedisplay/
├── assets/
│   └── Flavicon.png          # Image source (1024x1024px recommandé)
├── build/                     # Dossier de sortie (créé automatiquement)
│   ├── icon.ico              # Windows
│   ├── icon.icns             # macOS
│   ├── icon.png              # Linux
│   └── temp/                 # Fichiers temporaires (supprimés après)
│       └── icon.iconset/     # Format intermédiaire pour .icns
└── scripts/
    └── generate-icons.js     # Script de génération
```

## ⚙️ Configuration

Le script utilise les dépendances suivantes:
- **sharp**: Redimensionnement et conversion d'images haute qualité
- **png-to-ico**: Combinaison de multiples PNG en un seul fichier .ico

### Dépendances Système

#### Windows
- Aucune dépendance système requise
- Génère automatiquement les fichiers .ico et .png

#### macOS
- **Xcode Command Line Tools** requis pour `iconutil`
- Installation: `xcode-select --install`
- Génère automatiquement tous les formats (.ico, .icns, .png)

#### Linux
- Aucune dépendance système requise
- Génère automatiquement les fichiers .ico et .png
- Pour .icns: copier le répertoire `build/temp/icon.iconset/` sur macOS

## 🔧 Workflow Complet

### 1. Préparer l'Image Source
```bash
# Assurez-vous que Flavicon.png existe dans assets/
# Dimensions optimales: 1024x1024px
# Format: PNG avec canal alpha (transparence)
```

### 2. Générer les Icônes
```bash
npm run icons
```

### 3. Vérifier les Résultats
```bash
# Les fichiers sont dans build/
ls build/
# Devrait afficher:
# icon.ico  (Windows)
# icon.icns (macOS - si sur macOS)
# icon.png  (Linux)
```

### 4. Builder l'Application
```bash
npm run dist
# Les icônes sont automatiquement incluses dans la build
```

## 🎯 Intégration avec package.json

Le script met automatiquement à jour `package.json` avec les chemins corrects:

```json
{
  "build": {
    "icon": "build/icon.ico",
    "win": {
      "icon": "build/icon.ico"
    },
    "mac": {
      "icon": "build/icon.icns"
    },
    "linux": {
      "icon": "build/icon.png"
    }
  }
}
```

## 📊 Tailles d'Icônes Détaillées

### Windows (.ico) - 7 tailles
| Taille | Usage |
|--------|-------|
| 16x16 | Liste de fichiers, barre des tâches (petit) |
| 24x24 | Liste de fichiers (moyen) |
| 32x32 | Barre des tâches, raccourcis |
| 48x48 | Explorateur Windows (large) |
| 64x64 | Explorateur Windows (très large) |
| 128x128 | Haute résolution |
| 256x256 | Très haute résolution |

### macOS (.icns) - 10 tailles
| Taille | Nom de fichier | Usage |
|--------|----------------|-------|
| 16x16 | icon_16x16.png | @1x petit |
| 32x32 | icon_16x16@2x.png | @2x petit (Retina) |
| 32x32 | icon_32x32.png | @1x moyen |
| 64x64 | icon_32x32@2x.png | @2x moyen (Retina) |
| 128x128 | icon_128x128.png | @1x grand |
| 256x256 | icon_128x128@2x.png | @2x grand (Retina) |
| 256x256 | icon_256x256.png | @1x très grand |
| 512x512 | icon_256x256@2x.png | @2x très grand (Retina) |
| 512x512 | icon_512x512.png | @1x énorme |
| 1024x1024 | icon_512x512@2x.png | @2x énorme (Retina) |

### Linux (.png)
| Taille | Usage |
|--------|-------|
| 256x256 | Icône standard |

## 🛠️ Dépannage

### Problème: Image source introuvable
```
❌ Erreur: Image source introuvable: assets/Flavicon.png
```
**Solution:** Vérifiez que `assets/Flavicon.png` existe

### Problème: iconutil non disponible (Windows/Linux)
```
⚠️  iconutil non disponible (macOS uniquement)
```
**Solution:** 
1. Les fichiers PNG sont générés dans `build/temp/icon.iconset/`
2. Copiez ce dossier sur un Mac
3. Exécutez: `iconutil -c icns build/temp/icon.iconset -o build/icon.icns`
4. Copiez `icon.icns` dans votre projet Windows/Linux

### Problème: Qualité d'image médiocre
```
⚠️  Attention: L'image source devrait faire au moins 1024x1024px
```
**Solution:** Utilisez une image source plus grande (1024x1024px ou plus)

### Problème: Erreur Sharp
```
❌ Erreur lors de la génération: ...sharp...
```
**Solution:** Réinstallez sharp:
```bash
npm uninstall sharp
npm install sharp --save-dev
```

## 📝 Exemples

### Régénérer après Modification de l'Image Source
```bash
# 1. Modifier assets/Flavicon.png
# 2. Régénérer les icônes
npm run icons

# 3. Vérifier visuellement
# Windows: Ouvrir build/icon.ico avec Paint ou Explorer
# macOS: Ouvrir build/icon.icns avec Aperçu
# Linux: Ouvrir build/icon.png avec Eye of GNOME

# 4. Builder avec les nouvelles icônes
npm run dist
```

### Personnalisation du Script

Si vous voulez modifier les tailles générées, éditez `scripts/generate-icons.js`:

```javascript
const CONFIG = {
  // Modifier les tailles .ico
  icoSizes: [16, 32, 48, 64, 128, 256, 512],
  
  // Modifier les tailles .icns
  icnsSizes: [
    // Ajouter/retirer des tailles ici
  ]
};
```

## ✅ Checklist de Validation

Avant de builder:
- [ ] Image source `assets/Flavicon.png` existe
- [ ] Image source fait au moins 1024x1024px
- [ ] Script `npm run icons` exécuté avec succès
- [ ] Fichiers générés dans `build/`:
  - [ ] icon.ico (Windows)
  - [ ] icon.icns (macOS - si disponible)
  - [ ] icon.png (Linux)
- [ ] package.json mis à jour automatiquement
- [ ] Test visuel des icônes effectué
- [ ] Build test: `npm run dist`

## 📚 Ressources

- [Sharp Documentation](https://sharp.pixelplumbing.com/)
- [png-to-ico Documentation](https://www.npmjs.com/package/png-to-ico)
- [Electron Builder Icons](https://www.electron.build/icons)
- [macOS iconutil Guide](https://developer.apple.com/library/archive/documentation/GraphicsAnimation/Conceptual/HighResolutionOSX/Optimizing/Optimizing.html)

## 🤝 Contribution

Pour améliorer ce script:
1. Modifiez `scripts/generate-icons.js`
2. Testez avec `npm run icons`
3. Documentez les changements dans ce README

## 📄 License

MIT - Voir le fichier LICENSE à la racine du projet

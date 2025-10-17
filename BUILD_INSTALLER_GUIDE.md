# 📦 Configuration Build - Installateur + Portable

## ✅ Formats de Distribution Configurés

Votre application génère maintenant **2 types de fichiers .exe**:

### 1️⃣ Installateur NSIS (Installation Permanente)
```
SEE-Display-Setup-1.9.1.exe
```

**Caractéristiques:**
- ✅ Installation dans `Program Files`
- ✅ Raccourci Bureau automatique
- ✅ Raccourci Menu Démarrer
- ✅ Désinstallation propre via Panneau de configuration
- ✅ Auto-update intégré
- ✅ Choix du répertoire d'installation
- ✅ Lance l'app après installation

**Usage:**
- Double-clic sur le `.exe`
- Suivre l'assistant d'installation
- Choisir le dossier d'installation (optionnel)
- L'application s'installe de façon permanente

### 2️⃣ Version Portable (Exécution Sans Installation)
```
SEE-Display-Portable-1.9.1.exe
```

**Caractéristiques:**
- ✅ Aucune installation requise
- ✅ Exécution depuis n'importe quel dossier
- ✅ Parfait pour clés USB
- ✅ Pas d'entrée dans le registre Windows
- ✅ Auto-update disponible

**Usage:**
- Double-clic sur le `.exe`
- L'application démarre immédiatement
- Aucune trace dans le système

---

## 🏗️ Configuration Détaillée

### Structure des Targets
```json
{
  "win": {
    "target": [
      {
        "target": "nsis",      // ← Installateur
        "arch": ["x64"]
      },
      {
        "target": "portable",  // ← Version portable
        "arch": ["x64"]
      }
    ]
  }
}
```

### Configuration NSIS (Installateur)

| Option | Valeur | Description |
|--------|--------|-------------|
| `oneClick` | `false` | Assistant complet (pas d'installation en un clic) |
| `allowToChangeInstallationDirectory` | `true` | Utilisateur peut choisir le dossier |
| `allowElevation` | `true` | Demande les droits admin si nécessaire |
| `createDesktopShortcut` | `true` | Crée un raccourci sur le bureau |
| `createStartMenuShortcut` | `true` | Crée un raccourci dans le menu Démarrer |
| `shortcutName` | `"SEE Display"` | Nom des raccourcis |
| `runAfterFinish` | `true` | Lance l'app après installation |
| `deleteAppDataOnUninstall` | `false` | Garde les données utilisateur lors de la désinstallation |
| `artifactName` | `"SEE-Display-Setup-${version}.exe"` | Nom du fichier installateur |

### Configuration Portable

| Option | Valeur | Description |
|--------|--------|-------------|
| `artifactName` | `"SEE-Display-Portable-${version}.exe"` | Nom du fichier portable |

---

## 🚀 Build de l'Application

### Commande Complète
```bash
npm run dist
```

Cette commande va:
1. ✅ Bump la version (patch: 1.9.1 → 1.9.2)
2. ✅ Générer **l'installateur NSIS**
3. ✅ Générer **la version portable**
4. ✅ Créer les fichiers `latest.yml` pour l'auto-update
5. ✅ Commit le changement de version

### Résultat Attendu
```
dist/v1.9.2/
├── SEE-Display-Setup-1.9.2.exe        (Installateur ~90 MB)
├── SEE-Display-Portable-1.9.2.exe     (Portable ~90 MB)
├── latest.yml                          (Config auto-update)
└── win-unpacked/                       (Version non packagée)
```

---

## 📊 Comparaison des Formats

| Critère | Installateur NSIS | Portable |
|---------|------------------|----------|
| **Installation** | Oui (Program Files) | Non |
| **Taille** | ~90 MB | ~87 MB |
| **Raccourcis** | Oui (Bureau + Menu) | Non |
| **Désinstallation** | Panneau de configuration | Supprimer le fichier |
| **Auto-update** | Oui | Oui |
| **Droits admin** | Recommandé | Non requis |
| **Clé USB** | Non recommandé | ✅ Parfait |
| **Déploiement entreprise** | ✅ Idéal | Possible |
| **Registre Windows** | Oui | Non |
| **Multiple installations** | Non (écrase) | ✅ Oui |

---

## 🎯 Cas d'Usage Recommandés

### Utilisez l'**Installateur NSIS** pour:
- ✅ Déploiement sur postes de travail fixes
- ✅ Installation permanente
- ✅ Utilisateurs non techniques (double-clic et c'est parti)
- ✅ Intégration avec le système Windows
- ✅ Déploiement via GPO (Group Policy)
- ✅ Mise à jour automatique fiable

### Utilisez la **Version Portable** pour:
- ✅ Clés USB / disques externes
- ✅ Démonstrations / tests
- ✅ Exécution sans droits admin
- ✅ Installations multiples (différentes versions)
- ✅ Environnements restreints (pas d'installation permise)
- ✅ Déploiement temporaire

---

## 🔧 Build Complète - Étape par Étape

### 1️⃣ Préparer l'Environnement
```bash
# Vérifier que les icônes sont générées
npm run icons

# Vérifier que les tests passent
npm test
```

### 2️⃣ Lancer la Build
```bash
npm run dist
```

**Attendez quelques minutes...**

### 3️⃣ Vérifier les Résultats
```bash
# Lister les fichiers générés
Get-ChildItem dist/v1.9.2/*.exe
```

**Sortie attendue:**
```
SEE-Display-Setup-1.9.2.exe        (~90 MB)
SEE-Display-Portable-1.9.2.exe     (~87 MB)
```

### 4️⃣ Tester les Deux Versions

**Tester l'installateur:**
```bash
# Double-clic sur SEE-Display-Setup-1.9.2.exe
# → Suivre l'assistant
# → Vérifier les raccourcis créés
# → Lancer l'app depuis le Menu Démarrer
```

**Tester la version portable:**
```bash
# Double-clic sur SEE-Display-Portable-1.9.2.exe
# → L'app démarre immédiatement
# → Aucune installation
```

---

## 📤 Publication sur GitHub

### Commande Complète
```bash
npm run publish
```

Cette commande va:
1. ✅ Builder les deux versions
2. ✅ Uploader sur GitHub Releases:
   - `SEE-Display-Setup-1.9.2.exe`
   - `SEE-Display-Portable-1.9.2.exe`
   - `latest.yml`
3. ✅ Créer la release v1.9.2
4. ✅ Activer l'auto-update pour tous les utilisateurs

---

## 🛠️ Personnalisation Avancée

### Modifier le Nom de l'Installateur
```json
{
  "nsis": {
    "artifactName": "MonApp-Installer-${version}.exe"
  }
}
```

### Ajouter un Logo dans l'Installateur
```json
{
  "nsis": {
    "installerIcon": "build/installer-icon.ico",
    "uninstallerIcon": "build/uninstaller-icon.ico"
  }
}
```

### Changer le Dossier d'Installation Par Défaut
```json
{
  "nsis": {
    "perMachine": true,
    "installerDirectory": "C:\\MonDossier"
  }
}
```

### Ajouter un MSI (Alternative à NSIS)
```json
{
  "win": {
    "target": [
      { "target": "nsis", "arch": ["x64"] },
      { "target": "msi", "arch": ["x64"] },
      { "target": "portable", "arch": ["x64"] }
    ]
  }
}
```

---

## 📋 Checklist de Release

Avant chaque publication:

- [ ] **Icônes générées** - `npm run icons`
- [ ] **Tests passent** - `npm test` (132/132)
- [ ] **Version bumpée** - Automatique avec `npm run dist`
- [ ] **Build réussie** - `npm run dist`
- [ ] **Fichiers vérifiés**:
  - [ ] `SEE-Display-Setup-${version}.exe` existe
  - [ ] `SEE-Display-Portable-${version}.exe` existe
  - [ ] Taille des fichiers correcte (~90 MB)
- [ ] **Tests manuels**:
  - [ ] Installateur fonctionne
  - [ ] Version portable fonctionne
  - [ ] Raccourcis créés correctement
  - [ ] Auto-update activé
- [ ] **Publication** - `npm run publish`
- [ ] **GitHub Release créée** - Vérifier sur GitHub
- [ ] **Documentation mise à jour**

---

## 🔍 Dépannage

### Problème: Un seul .exe généré
**Cause:** Configuration target incorrecte
**Solution:** Vérifier que `win.target` contient bien `nsis` ET `portable`

### Problème: Installateur ne démarre pas
**Cause:** Droits insuffisants
**Solution:** Clic droit → "Exécuter en tant qu'administrateur"

### Problème: Icône manquante
**Cause:** Chemin icon.ico incorrect
**Solution:** 
```bash
npm run icons  # Régénérer les icônes
npm run dist   # Rebuild
```

### Problème: Build très lente
**Cause:** Plusieurs targets simultanés
**Solution:** Build un seul target à la fois:
```bash
# Installateur uniquement
electron-builder --win nsis

# Portable uniquement
electron-builder --win portable
```

---

## 📚 Ressources

- [Electron Builder - Windows Targets](https://www.electron.build/configuration/win)
- [NSIS Configuration](https://www.electron.build/configuration/nsis)
- [Portable Configuration](https://www.electron.build/configuration/portable)

---

**Date:** October 17, 2025  
**Version:** 1.9.1  
**Status:** ✅ Configuration complète (NSIS + Portable)  
**Commande:** `npm run dist`

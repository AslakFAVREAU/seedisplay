# 📦 Guide de Build - SEE Display

## Créer un exécutable Windows

### Prérequis
- Node.js installé
- Toutes les dépendances installées : `npm install`

### Options de Build

#### 1️⃣ **Build Rapide - Version Portable** (Recommandé)
Crée un exécutable portable (.exe) directement utilisable sans installation :

```powershell
npm run dist
```

**Résultat** : `dist/SEE-Display-Portable-1.8.0.exe`
- ✅ Fichier unique, portable
- ✅ Pas d'installation nécessaire
- ✅ Rapide à générer (~2-3 minutes)
- ⚠️ Taille : ~200-300 MB (inclut Node.js et Chromium)

#### 2️⃣ **Build Complet - Installeur NSIS**
Crée un installeur Windows professionnel :

```powershell
npm run dist
```

**Résultat** : `dist/SEE Display Setup 1.8.0.exe`
- ✅ Installeur Windows classique
- ✅ Raccourcis bureau et menu démarrer
- ✅ Désinstallateur inclus
- ⚠️ Taille : ~250 MB

### Contenu du dossier `dist/`

Après le build, tu trouveras :
```
dist/
  ├── SEE Display Setup 1.8.0.exe     (Installeur)
  ├── SEE-Display-Portable-1.8.0.exe  (Version portable)
  └── win-unpacked/                    (Version décompressée)
      └── SEE Display.exe
```

### Distribution

#### Pour un ordinateur unique :
1. Utilise la **version portable** : `SEE-Display-Portable-1.8.0.exe`
2. Copie le fichier sur l'ordinateur cible
3. Double-clic pour lancer

#### Pour plusieurs ordinateurs :
1. Utilise l'**installeur** : `SEE Display Setup 1.8.0.exe`
2. Distribue le fichier
3. Installe sur chaque machine

### Configuration Post-Installation

L'application cherche les données dans : `C:/SEE/`

Structure attendue :
```
C:/SEE/
  ├── configSEE.json   (Configuration)
  └── media/           (Images et vidéos)
```

### Debugging

Si le build échoue, vérifie :
1. **Espace disque** : Minimum 2 GB disponibles
2. **Droits administrateur** : Exécuter PowerShell en admin si nécessaire
3. **Antivirus** : Peut bloquer electron-builder, désactiver temporairement
4. **Node version** : Node.js 18+ recommandé

### Logs de Build

Les logs sont dans :
- Windows : `%USERPROFILE%\AppData\Local\electron-builder\Cache`

### Raccourcis Clavier (dans l'app)

- `Ctrl + Shift + K` : Quitter l'application
- `F11` : Mode plein écran
- `Ctrl + Shift + I` : Ouvrir DevTools (debug)

### Build pour Production

Avant de builder pour la production :

1. **Tester localement** :
   ```powershell
   npm run start:prod
   ```

2. **Vérifier la config** :
   - `package.json` : version à jour
   - `configSEE.json` : paramètres corrects
   - Médias téléchargés dans `C:/SEE/media/`

3. **Builder** :
   ```powershell
   npm run dist
   ```

4. **Tester l'exe** :
   - Lancer `dist/SEE-Display-Portable-1.8.0.exe`
   - Vérifier que tout fonctionne
   - Tester sur une autre machine si possible

### Signatures et Certificats

⚠️ **Important** : Les builds ne sont PAS signés numériquement.

Windows affichera :
- "Application non reconnue" ou
- "Éditeur inconnu"

**C'est normal** et sans danger. Pour signer l'application :
1. Obtenir un certificat code-signing (payant, ~300€/an)
2. Configurer dans `package.json` :
   ```json
   "win": {
     "certificateFile": "path/to/cert.pfx",
     "certificatePassword": "password"
   }
   ```

### Auto-Update

L'application vérifie automatiquement les mises à jour sur GitHub.

Pour publier une mise à jour :
```powershell
npm run publish
```

Nécessite :
- Token GitHub configuré
- Release créée sur le repo

---

## 🚀 Quick Start

**Build le plus simple (version portable)** :
```powershell
npm run dist
```

Puis utilise : `dist/SEE-Display-Portable-1.8.0.exe`

---

## 📝 Notes

- Le premier build peut prendre 5-10 minutes (téléchargement d'Electron)
- Les builds suivants sont plus rapides (~2-3 minutes)
- L'application fonctionne sur Windows 10/11 (64-bit)
- Pas de version Mac/Linux configurée actuellement

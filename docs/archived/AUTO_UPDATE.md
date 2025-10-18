# Configuration des mises à jour automatiques - SEE Display

## Fonctionnement actuel ✅

Le système d'updateur automatique est maintenant configuré avec :

### **1. Configuration electron-builder (package.json)**
- Provider GitHub configuré pour `AslakFAVREAU/seedisplay`
- Support Windows (NSIS), macOS et Linux
- Configuration NSIS améliorée (choix du répertoire d'installation, raccourcis)
- Signature automatique désactivée (à réactiver si certificats disponibles)

### **2. Gestion des updates (main.js)**
- Vérification automatique au démarrage
- Vérification périodique toutes les 4 heures
- Installation automatique 5 secondes après téléchargement
- Logs détaillés pour debugging
- Support du mode développement (variable `ENABLE_DEV_UPDATES=true`)

### **3. Interface utilisateur (version.html)**
- Affichage de la version actuelle
- Messages d'état des mises à jour en temps réel
- Interface simple et fonctionnelle

## Commandes pour tester/déployer 🚀

### **Build et publication d'une release**
```powershell
# 1. Bump version dans package.json (déjà à 1.8.0)
# 2. Build et publish sur GitHub
npm run dist
npm run publish
```

### **Test en développement**
```powershell
# Activer les updates en dev (optionnel)
$env:ENABLE_DEV_UPDATES="true"
$env:NODE_ENV="development"
npm start
```

### **Forcer une vérification d'update**
Dans le code, ajouter temporairement :
```javascript
autoUpdater.checkForUpdates()
```

## Logs à surveiller 📊

L'application génère des logs detaillés :
- `Skip checkForUpdates because application is not packed` = Normal en développement
- `Checking for update...` = Vérification en cours
- `Update available/not available` = Résultat de la vérification
- `Update downloaded` = Téléchargement terminé, installation imminente

## Pour activer en production 🏭

1. **Créer une release sur GitHub** :
   - Tag: `v1.8.0`
   - Attacher les fichiers `.exe`, `.dmg`, `.AppImage` générés par `npm run dist`
   - Inclure `latest.yml` (métadonnées pour l'updater)

2. **Les clients existants** vérifieront automatiquement les nouvelles versions

3. **Signature de code (recommandé)** :
   - Windows : Certificat code-signing
   - macOS : Certificat Apple Developer + notarisation

## Dépannage 🔧

### **"Updates not working"**
- Vérifier que l'app est packagée (`npm run dist`)
- Vérifier les releases GitHub
- Consulter les logs `electron-log`

### **"Update fails to install"**
- Vérifier les permissions d'écriture
- Vérifier l'espace disque
- Vérifier la signature de code

### **"Dev updates needed"**
- Set `ENABLE_DEV_UPDATES=true`
- Ou configurer un serveur de dev dans `app-update.json`

## Prochaines améliorations 🎯

- [ ] Notification utilisateur avant installation
- [ ] Option de reporter la mise à jour
- [ ] Signature de code pour Windows/macOS
- [ ] Changements/changelog dans l'interface
- [ ] Backup automatique avant mise à jour
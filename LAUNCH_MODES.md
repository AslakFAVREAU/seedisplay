# Modes de Lancement - SEE Display

## 🚀 Commandes de Lancement

### Mode Développement
```bash
npm start
```
- Fenêtre avec frame et barre de menus
- DevTools ouverts automatiquement
- Charge `version.html` pour debugging
- Raccourcis de développement actifs

### Mode Production
```bash
npm run start:prod
```
- **Plein écran automatique**
- **DevTools désactivés**
- Pas de frame ni barre de menus
- Charge `index.html` (application principale)
- Interface épurée pour l'utilisateur final

## ⌨️ Raccourcis Clavier (Mode Production)

| Raccourci | Action |
|-----------|--------|
| `F11` | Basculer plein écran |
| `Ctrl+Shift+I` | Ouvrir/fermer DevTools (urgence) |
| `Ctrl+R` | Recharger l'application |
| `Alt+F4` | Quitter l'application |
| `Ctrl+Q` | Quitter l'application |

## 🔧 Tests et Performance

### Test Standard
```bash
npm test
```

### Test de Performance
```bash
npm run test:performance
```
- Mesure le temps de démarrage
- Analyse l'utilisation mémoire
- Teste la performance des opérations
- Génère un rapport `performance-report.json`

## 📦 Build et Distribution

### Build Local
```bash
npm run dist
```

### Publication
```bash
npm run publish
```

## 🎯 Détection Automatique du Mode

L'application détecte automatiquement le mode :

- **Production** : `NODE_ENV=production` OU application packagée
- **Développement** : Tous les autres cas

## 📊 Résultats des Tests de Performance

Derniers résultats :
- ✅ Démarrage : 5 secondes
- ✅ Mémoire moyenne : 11MB
- ✅ Pic mémoire : 12MB  
- ✅ Performance : 60 ops/seconde
- ✅ Aucune erreur détectée

## 🛠️ Troubleshooting

### L'application ne se lance pas en plein écran
- Vérifier que `NODE_ENV=production` est défini
- Utiliser `npm run start:prod` au lieu de `npm start`

### DevTools n'apparaissent pas en développement
- Utiliser `npm start` (pas `start:prod`)
- Utiliser `Ctrl+Shift+I` pour forcer l'ouverture

### Performance dégradée
- Lancer `npm run test:performance` pour diagnostic
- Vérifier les logs avec `electron-log`
- Surveiller l'utilisation mémoire

## 🔄 Auto-Updater

L'auto-updater est actif dans tous les modes :
- Vérification au démarrage
- Vérification toutes les 4 heures
- Installation automatique après 5 secondes
- Logs détaillés disponibles
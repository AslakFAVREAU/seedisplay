# 🍓 SEE Display pour Raspberry Pi

Guide d'installation et d'utilisation de SEE Display sur Raspberry Pi.

---

## 📋 Prérequis matériels

| Composant | Minimum | Recommandé |
|-----------|---------|------------|
| **Modèle** | Raspberry Pi 4 (4GB) | Raspberry Pi 5 (8GB) |
| **RAM** | 4 GB | 8 GB |
| **Stockage** | 32 GB microSD (Class 10) | 64 GB+ SSD (USB3) |
| **OS** | Raspberry Pi OS 64-bit | Raspberry Pi OS 64-bit (Bookworm) |
| **Écran** | 1080p HDMI | 1080p HDMI |

### ⚠️ Notes importantes

- **Architecture ARM64 requise** : Raspberry Pi OS 64-bit obligatoire
- **Connexion réseau** : Ethernet recommandé pour stabilité
- **Refroidissement** : Ventilateur recommandé pour usage 24/7

---

## 🚀 Installation rapide

### Option 1 : Script automatique (recommandé)

```bash
# Avec wget (installé par défaut sur Raspberry Pi OS)
wget -qO- https://raw.githubusercontent.com/AslakFAVREAU/seedisplay/raspberry/scripts/install-raspberry-pi.sh | bash

# OU avec curl (si installé)
curl -sSL https://raw.githubusercontent.com/AslakFAVREAU/seedisplay/raspberry/scripts/install-raspberry-pi.sh | bash
```

> **Note** : Si `curl` n'est pas installé : `sudo apt update && sudo apt install -y curl`

### Option 2 : Installation manuelle

```bash
# 1. Mettre à jour le système
sudo apt update && sudo apt upgrade -y

# 2. Installer les dépendances
sudo apt install -y git curl wget build-essential libnss3 libatk1.0-0 \
    libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 \
    libxdamage1 libxrandr2 libgbm1 libasound2 libgtk-3-0

# 3. Installer Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 4. Créer les répertoires
sudo mkdir -p /opt/seedisplay/data/media
sudo chown -R $USER:$USER /opt/seedisplay

# 5. Cloner le dépôt
git clone https://github.com/AslakFAVREAU/seedisplay.git /opt/seedisplay
cd /opt/seedisplay
git checkout raspberry

# 6. Installer les dépendances npm
npm install --production
```

---

## ⚙️ Configuration

### Fichier de configuration

Créer `/opt/seedisplay/data/configSEE.json` :

```json
{
    "ecranUuid": "VOTRE-UUID-ECRAN",
    "apiToken": "VOTRE-TOKEN-API",
    "env": "beta",
    "meteo": true,
    "meteoLat": 48.8566,
    "meteoLon": 2.3522
}
```

### Variables

| Variable | Description | Valeurs |
|----------|-------------|---------|
| `ecranUuid` | UUID de l'écran (fourni par SOEK) | UUID |
| `apiToken` | Token d'authentification API | String |
| `env` | Environnement serveur | `prod`, `beta`, `localhost` |
| `meteo` | Activer la météo | `true`, `false` |
| `meteoLat` | Latitude pour météo | Nombre |
| `meteoLon` | Longitude pour météo | Nombre |

---

## 🎬 Lancement

### Test manuel

```bash
cd /opt/seedisplay
npm start
```

### Service systemd (auto-démarrage)

```bash
# Activer le démarrage automatique
sudo systemctl enable seedisplay

# Démarrer le service
sudo systemctl start seedisplay

# Vérifier le statut
sudo systemctl status seedisplay

# Voir les logs
journalctl -u seedisplay -f
```

---

## 🔧 Optimisations Raspberry Pi

L'application détecte automatiquement le Raspberry Pi et applique des optimisations :

- **Limite mémoire** : 512 MB max pour le heap JavaScript
- **Processus limités** : 2 processus renderer max
- **Mode low-end** : Désactive les fonctionnalités gourmandes
- **GPU** : Utilise l'accélération matérielle VAAPI

### Optimisations système supplémentaires

```bash
# Augmenter la mémoire GPU (dans /boot/config.txt)
gpu_mem=256

# Désactiver le splash screen pour boot plus rapide
disable_splash=1

# Désactiver le overscan si pas nécessaire
disable_overscan=1
```

---

## 📊 Performance attendue

| Scénario | Pi 4 (4GB) | Pi 5 (8GB) |
|----------|------------|------------|
| Images statiques | ✅ Fluide | ✅ Fluide |
| Vidéos 1080p | ⚠️ OK (1 à la fois) | ✅ Fluide |
| Vidéos 4K | ❌ Non supporté | ⚠️ Possible |
| Templates HTML | ✅ OK | ✅ Fluide |

---

## 🐛 Dépannage

### Écran noir au démarrage

```bash
# Vérifier si Electron démarre
journalctl -u seedisplay -n 50

# Vérifier les permissions X11
echo $DISPLAY
xhost +local:
```

### Performances lentes

```bash
# Vérifier l'utilisation CPU/RAM
htop

# Vérifier la température
vcgencmd measure_temp
```

### Vidéo saccadée

```bash
# Vérifier les codecs VAAPI
vainfo

# Installer les codecs si manquants
sudo apt install va-driver-all
```

### L'application ne démarre pas

```bash
# Vérifier Node.js
node --version  # Doit être v20.x

# Réinstaller les dépendances
cd /opt/seedisplay
rm -rf node_modules
npm install --production
```

---

## 🔄 Mise à jour

```bash
cd /opt/seedisplay
git pull origin raspberry
npm install --production
sudo systemctl restart seedisplay
```

---

## 📁 Structure des fichiers

```
/opt/seedisplay/
├── main.js                 # Point d'entrée Electron
├── preload.js              # API sécurisée
├── index.html              # Interface principale
├── js/                     # Modules JavaScript
├── data/                   # Données utilisateur
│   ├── configSEE.json      # Configuration
│   ├── media/              # Cache médias
│   └── logs/               # Logs locaux
└── node_modules/           # Dépendances npm
```

---

## 🆘 Support

- **Documentation** : [docs/](../docs/)
- **Issues** : [GitHub Issues](https://github.com/AslakFAVREAU/seedisplay/issues)
- **Logs** : `journalctl -u seedisplay -f`

---

## 📝 Changelog Raspberry Pi

### v1.10.0-raspberry
- ✅ Support cross-platform (Windows/Linux/macOS)
- ✅ Détection automatique Raspberry Pi
- ✅ Optimisations mémoire et GPU pour ARM64
- ✅ Script d'installation automatique
- ✅ Service systemd pré-configuré
- ✅ Build targets Linux ARM64 (.deb, AppImage, tar.gz)

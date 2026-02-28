#!/bin/bash
# ============================================================
# SEE Display - Script d'installation pour Debian 12/13 (x64)
# ============================================================
# Usage: sudo bash install-see.sh
# Ou après chmod +x: sudo ./install-see.sh
# ============================================================

set -e

APP_NAME="seedisplay"
APP_DIR="/opt/seedisplay"
DATA_DIR="/opt/seedisplay/data"
DESKTOP_FILE="/usr/share/applications/seedisplay.desktop"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=========================================="
echo "  SEE Display - Installation Debian"
echo "=========================================="

# Vérifier les droits root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Ce script doit être exécuté en root (sudo)"
  exit 1
fi

# Détecter l'utilisateur réel (pas root)
REAL_USER="${SUDO_USER:-$(logname 2>/dev/null || echo $USER)}"
REAL_HOME=$(eval echo ~$REAL_USER)
echo "📋 Utilisateur: $REAL_USER (home: $REAL_HOME)"

# 1. Installer les dépendances
echo ""
echo "📦 Installation des dépendances..."
apt-get update -qq
apt-get install -y -qq \
  libgtk-3-0 libgtk-3-0t64 \
  libnotify4 \
  libnss3 \
  libxss1 \
  libxtst6 \
  xdg-utils \
  libatspi2.0-0 \
  libuuid1 \
  libsecret-1-0 \
  libgbm1 \
  libasound2 \
  fonts-noto-color-emoji \
  2>/dev/null || true

echo "✅ Dépendances installées"

# 2. Créer les répertoires
echo ""
echo "📁 Création des répertoires..."
mkdir -p "$APP_DIR"
mkdir -p "$DATA_DIR/media"
mkdir -p "$DATA_DIR/fonds"

# 3. Copier les fichiers de l'application
echo ""
echo "📋 Copie des fichiers..."

# Chercher les fichiers de l'app (soit dans le même dossier, soit dans linux-unpacked)
if [ -f "$SCRIPT_DIR/seedisplay" ]; then
  SOURCE_DIR="$SCRIPT_DIR"
elif [ -f "$SCRIPT_DIR/../seedisplay" ]; then
  SOURCE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
elif [ -f "$SCRIPT_DIR/linux-unpacked/seedisplay" ]; then
  SOURCE_DIR="$SCRIPT_DIR/linux-unpacked"
else
  echo "❌ Impossible de trouver l'exécutable 'seedisplay'"
  echo "   Placez ce script dans le même dossier que l'exécutable"
  exit 1
fi

echo "   Source: $SOURCE_DIR"
cp -rf "$SOURCE_DIR"/* "$APP_DIR/"
chmod +x "$APP_DIR/seedisplay"
# chrome-sandbox nécessite les bons droits
if [ -f "$APP_DIR/chrome-sandbox" ]; then
  chmod 4755 "$APP_DIR/chrome-sandbox"
fi

echo "✅ Fichiers copiés dans $APP_DIR"

# 4. Créer le répertoire de données avec les bons droits
echo ""
echo "🔧 Configuration des permissions..."
chown -R "$REAL_USER:$REAL_USER" "$DATA_DIR"
echo "✅ Permissions configurées pour $REAL_USER"

# 5. Créer le fichier .desktop
echo ""
echo "🖥️  Création du raccourci bureau..."
cat > "$DESKTOP_FILE" << EOF
[Desktop Entry]
Name=SEE Display
Comment=Application d'affichage dynamique
Exec=$APP_DIR/seedisplay --no-sandbox %U
Terminal=false
Type=Application
Icon=$APP_DIR/resources/app/build/icon.png
Categories=Utility;
StartupWMClass=seedisplay
EOF

# Copier aussi sur le bureau de l'utilisateur
DESKTOP_DIR="$REAL_HOME/Desktop"
if [ -d "$DESKTOP_DIR" ]; then
  cp "$DESKTOP_FILE" "$DESKTOP_DIR/seedisplay.desktop"
  chown "$REAL_USER:$REAL_USER" "$DESKTOP_DIR/seedisplay.desktop"
  chmod +x "$DESKTOP_DIR/seedisplay.desktop"
fi

# Aussi essayer le bureau en français
DESKTOP_DIR_FR="$REAL_HOME/Bureau"
if [ -d "$DESKTOP_DIR_FR" ]; then
  cp "$DESKTOP_FILE" "$DESKTOP_DIR_FR/seedisplay.desktop"
  chown "$REAL_USER:$REAL_USER" "$DESKTOP_DIR_FR/seedisplay.desktop"
  chmod +x "$DESKTOP_DIR_FR/seedisplay.desktop"
fi

echo "✅ Raccourci créé"

# 6. Créer un lien symbolique dans /usr/local/bin
echo ""
echo "🔗 Création du lien dans /usr/local/bin..."
ln -sf "$APP_DIR/seedisplay" /usr/local/bin/seedisplay
echo "✅ Commande 'seedisplay' disponible"

# 7. Créer un service systemd pour démarrage automatique (optionnel)
echo ""
echo "📝 Création du service systemd (auto-start)..."
cat > /etc/systemd/system/seedisplay.service << EOF
[Unit]
Description=SEE Display - Affichage dynamique
After=graphical.target
Wants=graphical.target

[Service]
Type=simple
User=$REAL_USER
Environment=DISPLAY=:0
Environment=XAUTHORITY=$REAL_HOME/.Xauthority
ExecStart=$APP_DIR/seedisplay --no-sandbox
Restart=on-failure
RestartSec=5

[Install]
WantedBy=graphical.target
EOF

echo "✅ Service systemd créé (seedisplay.service)"
echo "   Pour activer le démarrage auto: sudo systemctl enable seedisplay"
echo "   Pour démarrer maintenant:       sudo systemctl start seedisplay"

# 8. Script de désinstallation
cat > "$APP_DIR/uninstall.sh" << 'UNINSTALL'
#!/bin/bash
echo "Désinstallation de SEE Display..."
sudo systemctl stop seedisplay 2>/dev/null
sudo systemctl disable seedisplay 2>/dev/null
sudo rm -f /etc/systemd/system/seedisplay.service
sudo rm -f /usr/share/applications/seedisplay.desktop
sudo rm -f /usr/local/bin/seedisplay
sudo rm -rf /opt/seedisplay
echo "✅ SEE Display désinstallé"
echo "   Les données utilisateur dans ~/.seedisplay/ ont été conservées"
UNINSTALL
chmod +x "$APP_DIR/uninstall.sh"

echo ""
echo "=========================================="
echo "  ✅ Installation terminée !"
echo "=========================================="
echo ""
echo "  Dossier app:     $APP_DIR"
echo "  Dossier données: $DATA_DIR"
echo "  Commande:        seedisplay"
echo "  Désinstaller:    sudo $APP_DIR/uninstall.sh"
echo ""
echo "  Pour lancer: seedisplay --no-sandbox"
echo "  Ou via le raccourci bureau"
echo ""

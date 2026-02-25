#!/bin/bash
# ============================================================
# SEE Display - Générateur de .deb pour Debian 12/13 (x64)
# ============================================================
# Ce script crée un package .deb propre à partir des fichiers
# de l'application. À exécuter SUR la machine Debian.
#
# Usage: bash build-deb.sh
# Résultat: seedisplay-1.10.8-amd64.deb dans le dossier courant
# ============================================================

set -e

VERSION="1.10.8"
ARCH="amd64"
PKG_NAME="seedisplay"
OUTPUT="${PKG_NAME}-${VERSION}-${ARCH}.deb"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=========================================="
echo "  SEE Display - Build .deb v${VERSION}"
echo "=========================================="

# Trouver le dossier avec les fichiers de l'app
if [ -f "$SCRIPT_DIR/seedisplay" ]; then
  APP_DIR="$SCRIPT_DIR"
elif [ -f "$SCRIPT_DIR/linux-unpacked/seedisplay" ]; then
  APP_DIR="$SCRIPT_DIR/linux-unpacked"
else
  echo "❌ Impossible de trouver l'exécutable 'seedisplay'"
  echo "   Ce script doit être dans le même dossier que les fichiers de l'app"
  exit 1
fi

echo "📋 Source: $APP_DIR"

# Vérifier dpkg-deb
if ! command -v dpkg-deb &>/dev/null; then
  echo "❌ dpkg-deb non trouvé. Installez-le avec: sudo apt install dpkg"
  exit 1
fi

# Créer la structure du package
WORK_DIR=$(mktemp -d)
PKG_DIR="$WORK_DIR/${PKG_NAME}_${VERSION}_${ARCH}"
echo "📁 Création de la structure du package..."

# Répertoires
mkdir -p "$PKG_DIR/DEBIAN"
mkdir -p "$PKG_DIR/opt/seedisplay"
mkdir -p "$PKG_DIR/opt/seedisplay/data/media"
mkdir -p "$PKG_DIR/opt/seedisplay/data/fonds"
mkdir -p "$PKG_DIR/usr/share/applications"
mkdir -p "$PKG_DIR/usr/share/icons/hicolor/256x256/apps"
mkdir -p "$PKG_DIR/usr/local/bin"

# Copier les fichiers de l'application
echo "📋 Copie des fichiers de l'application..."
cp -a "$APP_DIR"/* "$PKG_DIR/opt/seedisplay/"

# Supprimer ce script lui-même du package s'il est dedans
rm -f "$PKG_DIR/opt/seedisplay/build-deb.sh"
rm -f "$PKG_DIR/opt/seedisplay/install-debian.sh"

# Permissions
chmod 755 "$PKG_DIR/opt/seedisplay/seedisplay"
if [ -f "$PKG_DIR/opt/seedisplay/chrome-sandbox" ]; then
  chmod 4755 "$PKG_DIR/opt/seedisplay/chrome-sandbox"
fi

# Icône
if [ -f "$PKG_DIR/opt/seedisplay/resources/app/build/icon.png" ]; then
  cp "$PKG_DIR/opt/seedisplay/resources/app/build/icon.png" \
     "$PKG_DIR/usr/share/icons/hicolor/256x256/apps/seedisplay.png"
fi

# Lien symbolique pour la commande
ln -sf /opt/seedisplay/seedisplay "$PKG_DIR/usr/local/bin/seedisplay"

# Fichier .desktop
cat > "$PKG_DIR/usr/share/applications/seedisplay.desktop" << EOF
[Desktop Entry]
Name=SEE Display
Comment=Application d'affichage dynamique pour écrans connectés
Exec=/opt/seedisplay/seedisplay --no-sandbox %U
Terminal=false
Type=Application
Icon=seedisplay
Categories=Utility;
StartupWMClass=seedisplay
MimeType=x-scheme-handler/seedisplay;
EOF

# Fichier control
cat > "$PKG_DIR/DEBIAN/control" << EOF
Package: ${PKG_NAME}
Version: ${VERSION}
Section: utils
Priority: optional
Architecture: ${ARCH}
Depends: libgtk-3-0 | libgtk-3-0t64, libnotify4, libnss3, libxss1, libxtst6, xdg-utils, libatspi2.0-0 | libatspi2.0-0t64, libuuid1, libsecret-1-0, libgbm1, libasound2 | libasound2t64
Recommends: libappindicator3-1
Maintainer: SEE <contact@soek.fr>
Homepage: https://github.com/AslakFAVREAU/seedisplay
Description: SEE Display - Affichage dynamique
 Application d'affichage dynamique pour écrans connectés.
 Compatible Windows, Linux et Raspberry Pi.
 Gère images, vidéos, templates et météo en temps réel.
Installed-Size: $(du -sk "$PKG_DIR/opt/seedisplay" | cut -f1)
EOF

# Script post-installation
cat > "$PKG_DIR/DEBIAN/postinst" << 'EOF'
#!/bin/bash
set -e

# Créer les répertoires de données
mkdir -p /opt/seedisplay/data/media
mkdir -p /opt/seedisplay/data/fonds

# Donner les bon droits au sandbox Chrome
if [ -f /opt/seedisplay/chrome-sandbox ]; then
  chmod 4755 /opt/seedisplay/chrome-sandbox
fi

# Mettre à jour le cache des icônes
if command -v update-icon-caches &>/dev/null; then
  update-icon-caches /usr/share/icons/hicolor/ 2>/dev/null || true
fi

# Mettre à jour le bureau
if command -v update-desktop-database &>/dev/null; then
  update-desktop-database /usr/share/applications/ 2>/dev/null || true
fi

echo ""
echo "✅ SEE Display installé avec succès !"
echo "   Commande:  seedisplay --no-sandbox"
echo "   Données:   /opt/seedisplay/data/"
echo ""
EOF
chmod 755 "$PKG_DIR/DEBIAN/postinst"

# Script de suppression
cat > "$PKG_DIR/DEBIAN/postrm" << 'EOF'
#!/bin/bash
set -e

if [ "$1" = "purge" ]; then
  rm -rf /opt/seedisplay/data
  echo "Données SEE Display supprimées"
fi

# Mettre à jour le cache des icônes
if command -v update-icon-caches &>/dev/null; then
  update-icon-caches /usr/share/icons/hicolor/ 2>/dev/null || true
fi
EOF
chmod 755 "$PKG_DIR/DEBIAN/postrm"

# Construire le .deb
echo ""
echo "📦 Construction du package .deb..."
dpkg-deb --build --root-owner-group "$PKG_DIR" "$SCRIPT_DIR/$OUTPUT"

# Nettoyage
rm -rf "$WORK_DIR"

echo ""
echo "=========================================="
echo "  ✅ Package créé: $OUTPUT"
echo "=========================================="
echo ""
echo "  Taille: $(du -h "$SCRIPT_DIR/$OUTPUT" | cut -f1)"
echo ""
echo "  Pour installer:"
echo "    sudo dpkg -i $OUTPUT"
echo "    sudo apt-get install -f  # si dépendances manquantes"
echo ""
echo "  Pour désinstaller:"
echo "    sudo dpkg -r seedisplay"
echo "    sudo dpkg --purge seedisplay  # supprime aussi les données"
echo ""

#!/bin/bash
#
# SEE Display - Installation Script for Raspberry Pi
# Compatible: Raspberry Pi 4/5 (4GB+ RAM), Raspberry Pi OS 64-bit (Bookworm)
#
# Usage:
#   curl -sSL https://raw.githubusercontent.com/AslakFAVREAU/seedisplay/raspberry/scripts/install-raspberry-pi.sh | bash
#   or
#   wget -qO- https://raw.githubusercontent.com/AslakFAVREAU/seedisplay/raspberry/scripts/install-raspberry-pi.sh | bash
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="seedisplay"
INSTALL_DIR="/opt/seedisplay"
DATA_DIR="/opt/seedisplay/data"
SERVICE_NAME="seedisplay"
GITHUB_REPO="AslakFAVREAU/seedisplay"
BRANCH="raspberry"

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║   🖥️  SEE Display - Raspberry Pi Installer                   ║"
echo "║                                                              ║"
echo "║   Compatible: Raspberry Pi 4/5 (4GB+ RAM)                    ║"
echo "║   OS: Raspberry Pi OS 64-bit (Bookworm)                      ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo -e "${RED}❌ Please do not run as root. Use a regular user with sudo access.${NC}"
    exit 1
fi

# Check architecture
ARCH=$(uname -m)
if [ "$ARCH" != "aarch64" ] && [ "$ARCH" != "arm64" ]; then
    echo -e "${YELLOW}⚠️  Warning: This script is designed for ARM64 (aarch64).${NC}"
    echo -e "${YELLOW}   Current architecture: $ARCH${NC}"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo -e "${GREEN}✅ Architecture: $ARCH${NC}"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Step 1: Update system
echo -e "\n${BLUE}📦 Step 1/6: Updating system packages...${NC}"
sudo apt update && sudo apt upgrade -y

# Step 2: Install dependencies
echo -e "\n${BLUE}📦 Step 2/6: Installing dependencies...${NC}"
sudo apt install -y \
    git \
    curl \
    wget \
    build-essential \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    libgtk-3-0 \
    libxss1 \
    libxtst6 \
    xdg-utils

# Step 3: Install Node.js 20.x
echo -e "\n${BLUE}📦 Step 3/6: Installing Node.js 20.x...${NC}"
if command_exists node; then
    NODE_VERSION=$(node --version)
    echo -e "${YELLOW}   Node.js already installed: $NODE_VERSION${NC}"
    
    # Check if version is 20.x or higher
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
    if [ "$NODE_MAJOR" -lt 20 ]; then
        echo -e "${YELLOW}   Upgrading Node.js to 20.x...${NC}"
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt install -y nodejs
    fi
else
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi

echo -e "${GREEN}✅ Node.js: $(node --version)${NC}"
echo -e "${GREEN}✅ npm: $(npm --version)${NC}"

# Step 4: Create directories and clone repository
echo -e "\n${BLUE}📦 Step 4/6: Setting up application...${NC}"

# Create install directory
sudo mkdir -p $INSTALL_DIR
sudo mkdir -p $DATA_DIR
sudo mkdir -p $DATA_DIR/media
sudo mkdir -p $DATA_DIR/logs
sudo chown -R $USER:$USER $INSTALL_DIR

# Clone or update repository
if [ -d "$INSTALL_DIR/.git" ]; then
    echo -e "${YELLOW}   Repository exists, updating...${NC}"
    cd $INSTALL_DIR
    git fetch origin
    git checkout $BRANCH
    git pull origin $BRANCH
else
    echo -e "${YELLOW}   Cloning repository...${NC}"
    git clone https://github.com/$GITHUB_REPO.git $INSTALL_DIR
    cd $INSTALL_DIR
    git checkout $BRANCH
fi

# Install npm dependencies
echo -e "\n${BLUE}📦 Step 5/6: Installing npm dependencies (this may take a while)...${NC}"
cd $INSTALL_DIR
npm install --production

# Rebuild native modules for ARM64
echo -e "${YELLOW}   Rebuilding native modules for ARM64...${NC}"
npm rebuild

# Step 6: Create systemd service
echo -e "\n${BLUE}📦 Step 6/6: Creating systemd service...${NC}"

sudo tee /etc/systemd/system/${SERVICE_NAME}.service > /dev/null << EOF
[Unit]
Description=SEE Display - Digital Signage Application
After=graphical.target
Wants=graphical.target

[Service]
Type=simple
User=$USER
Environment=DISPLAY=:0
Environment=NODE_ENV=production
Environment=XAUTHORITY=/home/$USER/.Xauthority
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=graphical.target
EOF

# Reload systemd
sudo systemctl daemon-reload

# Create example config if not exists
if [ ! -f "$DATA_DIR/configSEE.json" ]; then
    echo -e "${YELLOW}   Creating example configuration...${NC}"
    cat > $DATA_DIR/configSEE.json << 'EOF'
{
    "ecranUuid": "YOUR-ECRAN-UUID-HERE",
    "apiToken": "YOUR-API-TOKEN-HERE",
    "env": "beta",
    "meteo": true,
    "meteoLat": 48.8566,
    "meteoLon": 2.3522
}
EOF
    echo -e "${YELLOW}   ⚠️  Edit $DATA_DIR/configSEE.json with your screen credentials${NC}"
fi

echo -e "\n${GREEN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║   ✅ Installation Complete!                                  ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${BLUE}📁 Installation directory:${NC} $INSTALL_DIR"
echo -e "${BLUE}📁 Data directory:${NC} $DATA_DIR"
echo -e "${BLUE}📁 Config file:${NC} $DATA_DIR/configSEE.json"
echo ""
echo -e "${YELLOW}📝 Next steps:${NC}"
echo ""
echo "   1. Edit configuration with your screen credentials:"
echo "      ${GREEN}nano $DATA_DIR/configSEE.json${NC}"
echo ""
echo "   2. Test the application manually:"
echo "      ${GREEN}cd $INSTALL_DIR && npm start${NC}"
echo ""
echo "   3. Enable auto-start on boot:"
echo "      ${GREEN}sudo systemctl enable $SERVICE_NAME${NC}"
echo ""
echo "   4. Start the service:"
echo "      ${GREEN}sudo systemctl start $SERVICE_NAME${NC}"
echo ""
echo "   5. Check status:"
echo "      ${GREEN}sudo systemctl status $SERVICE_NAME${NC}"
echo ""
echo "   6. View logs:"
echo "      ${GREEN}journalctl -u $SERVICE_NAME -f${NC}"
echo ""
echo -e "${BLUE}🔄 To update later, run:${NC}"
echo "   ${GREEN}cd $INSTALL_DIR && git pull && npm install${NC}"
echo ""
echo -e "${BLUE}🗑️  To uninstall:${NC}"
echo "   ${GREEN}sudo systemctl disable $SERVICE_NAME${NC}"
echo "   ${GREEN}sudo rm /etc/systemd/system/${SERVICE_NAME}.service${NC}"
echo "   ${GREEN}sudo rm -rf $INSTALL_DIR${NC}"
echo ""

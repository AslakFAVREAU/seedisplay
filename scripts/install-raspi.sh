#!/bin/bash
# SEE Display - Raspberry Pi Installation Script
# This script automates the installation process on Raspberry Pi 5

set -e  # Exit on error

echo "=============================================="
echo "  SEE Display - Raspberry Pi 5 Installation"
echo "=============================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running on Raspberry Pi
if [ ! -f /proc/device-tree/model ]; then
    echo -e "${RED}Error: This script must be run on a Raspberry Pi${NC}"
    exit 1
fi

MODEL=$(cat /proc/device-tree/model)
echo -e "${GREEN}Detected: $MODEL${NC}"
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo -e "${RED}Error: Do not run this script as root${NC}"
    echo "Run as normal user (pi) instead"
    exit 1
fi

# Variables
INSTALL_DIR="/opt/seedisplay"
SERVICE_FILE="/etc/systemd/system/seedisplay.service"
USER=$(whoami)

echo "Installation directory: $INSTALL_DIR"
echo "Service file: $SERVICE_FILE"
echo "User: $USER"
echo ""

# Ask for confirmation
read -p "Continue with installation? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Installation cancelled"
    exit 0
fi

# Update system
echo -e "${YELLOW}[1/8] Updating system packages...${NC}"
sudo apt update
sudo apt upgrade -y

# Install dependencies
echo -e "${YELLOW}[2/8] Installing dependencies...${NC}"
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
    libasound2

# Install Node.js 20
echo -e "${YELLOW}[3/8] Installing Node.js 20...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo "Node.js already installed: $(node --version)"
fi

# Verify Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${RED}Error: Node.js 20 or higher is required${NC}"
    echo "Current version: $(node --version)"
    exit 1
fi

# Create installation directory
echo -e "${YELLOW}[4/8] Creating installation directory...${NC}"
sudo mkdir -p $INSTALL_DIR
sudo chown -R $USER:$USER $INSTALL_DIR

# Clone or copy repository
echo -e "${YELLOW}[5/8] Setting up application files...${NC}"
if [ -d "$INSTALL_DIR/.git" ]; then
    echo "Repository already exists, pulling latest changes..."
    cd $INSTALL_DIR
    git pull origin feature/raspberry-pi5-support
else
    echo "Cloning repository..."
    git clone -b feature/raspberry-pi5-support https://github.com/AslakFAVREAU/seedisplay.git $INSTALL_DIR
    cd $INSTALL_DIR
fi

# Install npm packages
echo -e "${YELLOW}[6/8] Installing npm packages (this may take 20-30 minutes)...${NC}"
npm install

# Check if Electron installed correctly
if [ ! -f "node_modules/.bin/electron" ]; then
    echo -e "${YELLOW}Electron not found, attempting build from source...${NC}"
    npm install electron --build-from-source
fi

# Copy configuration
echo -e "${YELLOW}[7/8] Setting up configuration...${NC}"
if [ ! -f "$INSTALL_DIR/configSEE.json" ]; then
    if [ -f "$INSTALL_DIR/config.raspi.json" ]; then
        cp config.raspi.json configSEE.json
        echo "Raspberry Pi configuration copied"
        echo -e "${YELLOW}IMPORTANT: Edit $INSTALL_DIR/configSEE.json and set your API URL${NC}"
    else
        cp config.example.json configSEE.json
        echo "Example configuration copied"
    fi
else
    echo "Configuration already exists: $INSTALL_DIR/configSEE.json"
fi

# Install systemd service
echo -e "${YELLOW}[8/8] Installing systemd service...${NC}"
if [ -f "$INSTALL_DIR/systemd/seedisplay.service" ]; then
    sudo cp $INSTALL_DIR/systemd/seedisplay.service $SERVICE_FILE
    
    # Update User in service file
    sudo sed -i "s/User=pi/User=$USER/" $SERVICE_FILE
    sudo sed -i "s/Group=pi/Group=$USER/" $SERVICE_FILE
    sudo sed -i "s|WorkingDirectory=.*|WorkingDirectory=$INSTALL_DIR|" $SERVICE_FILE
    sudo sed -i "s|XAUTHORITY=.*|XAUTHORITY=/home/$USER/.Xauthority|" $SERVICE_FILE
    sudo sed -i "s|HOME=.*|HOME=/home/$USER|" $SERVICE_FILE
    
    sudo systemctl daemon-reload
    sudo systemctl enable seedisplay.service
    
    echo -e "${GREEN}Service installed and enabled${NC}"
else
    echo -e "${YELLOW}Warning: Service file not found, skipping${NC}"
fi

# Disable screen blanking
echo ""
echo -e "${YELLOW}Disabling screen blanking...${NC}"
mkdir -p /home/$USER/.config/lxsession/LXDE-pi
cat > /home/$USER/.config/lxsession/LXDE-pi/autostart <<EOF
@xset s off
@xset -dpms
@xset s noblank
EOF

# GPU memory configuration
echo ""
echo -e "${YELLOW}Checking GPU memory configuration...${NC}"
if ! grep -q "gpu_mem" /boot/firmware/config.txt; then
    echo "Adding gpu_mem=256 to /boot/firmware/config.txt"
    echo "gpu_mem=256" | sudo tee -a /boot/firmware/config.txt > /dev/null
    REBOOT_REQUIRED=true
fi

# Summary
echo ""
echo "=============================================="
echo -e "${GREEN}Installation completed successfully!${NC}"
echo "=============================================="
echo ""
echo "Installation directory: $INSTALL_DIR"
echo "Configuration file: $INSTALL_DIR/configSEE.json"
echo "Service: seedisplay.service"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Edit configuration: nano $INSTALL_DIR/configSEE.json"
echo "2. Set your API URL in the configuration"
echo "3. Test the application: cd $INSTALL_DIR && npm start"
echo "4. Start service: sudo systemctl start seedisplay.service"
echo "5. View logs: journalctl -u seedisplay.service -f"
echo ""

if [ "$REBOOT_REQUIRED" = true ]; then
    echo -e "${YELLOW}IMPORTANT: A reboot is required to apply GPU memory settings${NC}"
    read -p "Reboot now? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sudo reboot
    fi
fi

echo "Installation complete!"

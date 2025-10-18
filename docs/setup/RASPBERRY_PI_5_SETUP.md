# SEE Display - Raspberry Pi 5 Setup Guide

**Target:** Raspberry Pi 5 (4GB RAM)  
**OS:** Raspberry Pi OS 64-bit (Debian Bookworm)  
**Mode:** Kiosk Display (Production)  
**Last Updated:** October 18, 2025

---

## 📋 Table of Contents

1. [Hardware Requirements](#hardware-requirements)
2. [System Preparation](#system-preparation)
3. [Installation Steps](#installation-steps)
4. [Configuration Optimization](#configuration-optimization)
5. [Auto-start Setup](#auto-start-setup)
6. [Performance Tuning](#performance-tuning)
7. [Troubleshooting](#troubleshooting)

---

## 🖥️ Hardware Requirements

### Minimum Configuration
- **Raspberry Pi 5** with **4GB RAM** (recommended: 8GB for video-heavy displays)
- **MicroSD Card:** 32GB+ (Class 10/A1)
- **Display:** HDMI monitor (1920x1080 recommended)
- **Network:** Ethernet or WiFi
- **Power:** Official Raspberry Pi 5 USB-C Power Supply (5V/5A)

### Optional
- **Cooling:** Active cooling fan (recommended for 24/7 operation)
- **Case:** Ventilated case for thermal management
- **RTC Module:** For accurate time without internet

---

## 🔧 System Preparation

### 1. Install Raspberry Pi OS 64-bit

```bash
# Download Raspberry Pi Imager
# https://www.raspberrypi.com/software/

# Flash Raspberry Pi OS (64-bit) to SD card
# Enable SSH during setup
# Set hostname: seedisplay
```

### 2. First Boot Configuration

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essential tools
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

# Install Node.js 20.x (required for Electron 38)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should be v20.x
npm --version   # Should be 10.x
```

---

## 📦 Installation Steps

### 1. Clone Repository

```bash
# Create application directory
sudo mkdir -p /opt/seedisplay
sudo chown -R $USER:$USER /opt/seedisplay

# Clone repository
cd /opt/seedisplay
git clone https://github.com/AslakFAVREAU/seedisplay.git .

# Checkout master branch
git checkout master
```

### 2. Install Dependencies

```bash
# Install npm packages (this takes ~30 minutes on Pi 5)
npm install

# If Electron build fails, try:
npm install electron --build-from-source

# For ARM64 native build
npm rebuild --runtime=electron --target=38.2.2 --disturl=https://electronjs.org/headers --abi=128
```

### 3. Configuration

```bash
# Copy example config
cp config.example.json configSEE.json

# Edit configuration
nano configSEE.json

# Minimal config for Raspberry Pi:
{
  "api_url": "YOUR_API_URL",
  "refresh_interval": 300000,
  "media_cache_limit": 150,
  "enable_weather": true,
  "debug_mode": false
}
```

---

## ⚙️ Configuration Optimization

### 1. Optimize main.js for ARM64

Create optimization patch file:

```bash
nano /opt/seedisplay/patches/raspi-optimize.js
```

Add content:

```javascript
// Raspberry Pi 5 optimizations
const isRaspberryPi = process.platform === 'linux' && process.arch === 'arm64';

if (isRaspberryPi) {
  // Limit memory usage
  app.commandLine.appendSwitch('--max-old-space-size=512');
  app.commandLine.appendSwitch('--renderer-process-limit=2');
  
  // Disable unnecessary features
  app.commandLine.appendSwitch('--disable-extensions');
  app.commandLine.appendSwitch('--disable-sync');
  app.commandLine.appendSwitch('--disable-background-networking');
  
  // Optimize rendering
  app.commandLine.appendSwitch('--enable-low-end-device-mode');
  app.commandLine.appendSwitch('--disable-software-rasterizer');
  
  console.log('[Raspberry Pi] Optimizations applied');
}

module.exports = { isRaspberryPi };
```

Apply patch in main.js (add at top after requires):

```javascript
// Load Raspberry Pi optimizations
if (require('fs').existsSync('./patches/raspi-optimize.js')) {
  require('./patches/raspi-optimize');
}
```

### 2. Reduce Media Cache Limit

Edit `preload.js`:

```javascript
// Original: 500MB
const MEDIA_CACHE_LIMIT = 150 * 1024 * 1024; // 150MB for Raspberry Pi
```

### 3. Disable Auto-Update (optional)

If network is slow or updates are manual:

```javascript
// main.js - Comment out auto-updater
// autoUpdater.checkForUpdatesAndNotify();
```

---

## 🚀 Auto-start Setup

### 1. Create Systemd Service

```bash
sudo nano /etc/systemd/system/seedisplay.service
```

Add content:

```ini
[Unit]
Description=SEE Display Kiosk
After=graphical.target
Wants=graphical.target

[Service]
Type=simple
User=pi
Environment=DISPLAY=:0
Environment=NODE_ENV=production
Environment=XAUTHORITY=/home/pi/.Xauthority
WorkingDirectory=/opt/seedisplay
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=graphical.target
```

### 2. Enable Service

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service
sudo systemctl enable seedisplay.service

# Start service
sudo systemctl start seedisplay.service

# Check status
sudo systemctl status seedisplay.service

# View logs
journalctl -u seedisplay.service -f
```

### 3. Auto-Login (Kiosk Mode)

```bash
# Enable auto-login for user 'pi'
sudo raspi-config
# Navigate to: System Options → Boot / Auto Login → Desktop Autologin

# Or manually edit:
sudo nano /etc/lightdm/lightdm.conf

# Add/modify:
[Seat:*]
autologin-user=pi
autologin-user-timeout=0
```

---

## 🎯 Performance Tuning

### 1. GPU Memory Allocation

```bash
sudo nano /boot/firmware/config.txt

# Add/modify:
gpu_mem=256  # Allocate 256MB to GPU (for video decode)
dtoverlay=vc4-kms-v3d
max_framebuffers=2
```

### 2. Disable Unnecessary Services

```bash
# Disable Bluetooth (if not used)
sudo systemctl disable bluetooth.service

# Disable WiFi (if using Ethernet)
sudo rfkill block wifi

# Disable GUI login screen (already done with auto-login)
sudo systemctl set-default multi-user.target
sudo systemctl set-default graphical.target  # Re-enable for kiosk
```

### 3. Optimize Swap

```bash
# Disable swap (optional, reduces SD wear)
sudo dphys-swapfile swapoff
sudo systemctl disable dphys-swapfile

# Or reduce swap size
sudo nano /etc/dphys-swapfile
# Set: CONF_SWAPSIZE=512
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
```

### 4. Screen Blanking

```bash
# Disable screen blanking
sudo nano /etc/xdg/lxsession/LXDE-pi/autostart

# Add:
@xset s off
@xset -dpms
@xset s noblank
```

---

## 🔍 Troubleshooting

### Issue: Electron fails to start

**Symptom:** `Error: Electron failed to install correctly`

**Solution:**
```bash
cd /opt/seedisplay
rm -rf node_modules
npm cache clean --force
npm install electron --build-from-source
npm install
```

### Issue: Out of Memory (OOM)

**Symptom:** App crashes with `JavaScript heap out of memory`

**Solution:**
```bash
# Add to package.json scripts:
"start": "node --max-old-space-size=512 node_modules/.bin/electron ."

# Or export environment variable:
export NODE_OPTIONS="--max-old-space-size=512"
```

### Issue: Video playback stuttering

**Symptom:** Videos lag or stutter

**Solution:**
1. Reduce video resolution to 720p max
2. Check GPU memory allocation (`gpu_mem=256`)
3. Verify hardware acceleration:
```bash
# Check if using hardware decoder
cat /sys/kernel/debug/dri/0/state
```

### Issue: Display doesn't start on boot

**Symptom:** Black screen or no display

**Solution:**
```bash
# Check X server is running
ps aux | grep X

# Check systemd service logs
journalctl -u seedisplay.service -n 50

# Verify DISPLAY variable
echo $DISPLAY  # Should be :0

# Restart X server
sudo systemctl restart lightdm
```

### Issue: Network timeout during npm install

**Symptom:** `ETIMEDOUT` or `ENOTFOUND` errors

**Solution:**
```bash
# Use different registry mirror
npm config set registry https://registry.npmmirror.com

# Increase timeout
npm config set fetch-timeout 300000

# Retry install
npm install
```

---

## 📊 Performance Monitoring

### Check Memory Usage

```bash
# Real-time memory monitor
htop

# SEE Display process only
ps aux | grep electron

# Memory summary
free -h
```

### Check CPU Temperature

```bash
# Current temperature
vcgencmd measure_temp

# Monitor continuously
watch -n 1 vcgencmd measure_temp

# If temp > 80°C, add active cooling
```

### Check Disk Usage

```bash
# Overall disk space
df -h

# node_modules size
du -sh /opt/seedisplay/node_modules

# Media cache size
du -sh C:/SEE/media  # Adjust path if needed
```

---

## 🔄 Updates & Maintenance

### Manual Update

```bash
cd /opt/seedisplay

# Stop service
sudo systemctl stop seedisplay.service

# Pull latest changes
git pull origin master

# Install new dependencies
npm install

# Restart service
sudo systemctl start seedisplay.service
```

### Backup Configuration

```bash
# Backup config
cp configSEE.json configSEE.json.backup

# Backup media cache (optional)
tar -czf see-media-backup.tar.gz C:/SEE/media
```

---

## 📈 Resource Usage Summary

| Component | RAM Usage | CPU Usage (idle) |
|-----------|-----------|------------------|
| OS (Raspberry Pi OS) | ~450 MB | ~5% |
| Electron Runtime | ~250 MB | ~10% |
| Node.js + App | ~150 MB | ~5% |
| Media Cache | ~150 MB | ~2% |
| **Total** | **~1000 MB** | **~22%** |
| **Available** | **~3000 MB** | **~78%** |

**Verdict:** ✅ Comfortable margin for 4GB Raspberry Pi 5

---

## 🎯 Production Checklist

Before deploying to production:

- [ ] System updated and rebooted
- [ ] Node.js 20+ installed
- [ ] Dependencies installed successfully
- [ ] Configuration tested (`npm start`)
- [ ] Auto-start service enabled
- [ ] Screen blanking disabled
- [ ] Network connectivity verified
- [ ] Media cache limit set (150MB)
- [ ] GPU memory allocated (256MB)
- [ ] Active cooling installed
- [ ] Backup configuration saved
- [ ] Logs monitored for errors

---

## 📚 Additional Resources

- [Raspberry Pi Documentation](https://www.raspberrypi.com/documentation/)
- [Electron on ARM](https://www.electronjs.org/docs/latest/tutorial/arm)
- [Node.js ARM Builds](https://nodejs.org/en/download/)
- [SEE Display Main README](../../README.md)
- [Kiosk Mode Setup Guide](./KIOSK_MODE_SETUP.md)

---

**Questions or Issues?**  
Open an issue on GitHub: https://github.com/AslakFAVREAU/seedisplay/issues

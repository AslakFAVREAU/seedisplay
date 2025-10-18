// Raspberry Pi 5 Platform Optimizations
// This module detects ARM64 architecture and applies memory/performance optimizations

const os = require('os');
const log = require('electron-log');

/**
 * Detect if running on Raspberry Pi
 * @returns {boolean}
 */
function isRaspberryPi() {
  const platform = process.platform;
  const arch = process.arch;
  
  // Check if Linux ARM64
  if (platform === 'linux' && arch === 'arm64') {
    // Try to read Raspberry Pi model info
    try {
      const fs = require('fs');
      if (fs.existsSync('/proc/device-tree/model')) {
        const model = fs.readFileSync('/proc/device-tree/model', 'utf8');
        return model.toLowerCase().includes('raspberry pi');
      }
    } catch (err) {
      log.warn('Could not read /proc/device-tree/model:', err.message);
    }
    
    // Fallback: assume ARM64 Linux is Pi
    return true;
  }
  
  return false;
}

/**
 * Get Raspberry Pi model (4 or 5)
 * @returns {number|null}
 */
function getRaspberryPiModel() {
  try {
    const fs = require('fs');
    if (fs.existsSync('/proc/device-tree/model')) {
      const model = fs.readFileSync('/proc/device-tree/model', 'utf8');
      if (model.includes('Raspberry Pi 5')) return 5;
      if (model.includes('Raspberry Pi 4')) return 4;
    }
  } catch (err) {
    log.warn('Could not detect Pi model:', err.message);
  }
  return null;
}

/**
 * Get system RAM in GB
 * @returns {number}
 */
function getSystemRAM() {
  return Math.round(os.totalmem() / (1024 ** 3));
}

/**
 * Apply Raspberry Pi optimizations
 * @param {Electron.App} app
 */
function applyOptimizations(app) {
  if (!isRaspberryPi()) {
    log.info('[Pi Optimizer] Not running on Raspberry Pi, skipping optimizations');
    return false;
  }
  
  const model = getRaspberryPiModel();
  const ram = getSystemRAM();
  
  log.info(`[Pi Optimizer] Detected: Raspberry Pi ${model || 'Unknown'} with ${ram}GB RAM`);
  
  // Memory limits based on available RAM
  const heapSize = ram <= 4 ? 512 : 1024;
  app.commandLine.appendSwitch('--max-old-space-size', heapSize.toString());
  log.info(`[Pi Optimizer] Set heap size limit: ${heapSize}MB`);
  
  // Limit renderer processes
  app.commandLine.appendSwitch('--renderer-process-limit', '2');
  log.info('[Pi Optimizer] Limited renderer processes to 2');
  
  // Disable unnecessary features
  app.commandLine.appendSwitch('--disable-extensions');
  app.commandLine.appendSwitch('--disable-sync');
  app.commandLine.appendSwitch('--disable-background-networking');
  app.commandLine.appendSwitch('--disable-breakpad');
  log.info('[Pi Optimizer] Disabled unnecessary features');
  
  // Enable low-end device mode for Pi 4
  if (model === 4 || ram <= 4) {
    app.commandLine.appendSwitch('--enable-low-end-device-mode');
    log.info('[Pi Optimizer] Enabled low-end device mode');
  }
  
  // GPU optimizations (ensure hardware acceleration)
  app.commandLine.appendSwitch('--ignore-gpu-blocklist');
  app.commandLine.appendSwitch('--enable-gpu-rasterization');
  app.commandLine.appendSwitch('--enable-zero-copy');
  log.info('[Pi Optimizer] GPU acceleration enabled');
  
  // Video codec optimizations
  app.commandLine.appendSwitch('--enable-features', 'VaapiVideoDecoder');
  log.info('[Pi Optimizer] Hardware video decoding enabled');
  
  // Disable software rasterizer (force hardware)
  app.commandLine.appendSwitch('--disable-software-rasterizer');
  
  // Memory pressure handling
  app.commandLine.appendSwitch('--enable-aggressive-domstorage-flushing');
  
  log.info('[Pi Optimizer] All optimizations applied successfully');
  
  return true;
}

/**
 * Get recommended configuration for Raspberry Pi
 * @returns {object}
 */
function getRecommendedConfig() {
  const model = getRaspberryPiModel();
  const ram = getSystemRAM();
  
  // Base config for Pi 5
  let config = {
    media_cache_limit: 150, // 150MB
    refresh_interval: 300000, // 5 minutes
    max_concurrent_downloads: 2,
    enable_hardware_acceleration: true,
    video_quality: '1080p'
  };
  
  // Adjust for Pi 4 or low RAM
  if (model === 4 || ram <= 4) {
    config = {
      ...config,
      media_cache_limit: 100, // 100MB
      refresh_interval: 600000, // 10 minutes
      max_concurrent_downloads: 1,
      video_quality: '720p'
    };
  }
  
  return config;
}

/**
 * Monitor system resources (for debugging)
 */
function logSystemInfo() {
  if (!isRaspberryPi()) return;
  
  const model = getRaspberryPiModel();
  const ram = getSystemRAM();
  const cpus = os.cpus();
  const loadavg = os.loadavg();
  const freemem = Math.round(os.freemem() / (1024 ** 2));
  const totalmem = Math.round(os.totalmem() / (1024 ** 2));
  
  log.info('[Pi System Info]');
  log.info(`  Model: Raspberry Pi ${model || 'Unknown'}`);
  log.info(`  CPUs: ${cpus.length}x ${cpus[0]?.model || 'Unknown'}`);
  log.info(`  RAM: ${freemem}MB free / ${totalmem}MB total (${ram}GB)`);
  log.info(`  Load: ${loadavg[0].toFixed(2)}, ${loadavg[1].toFixed(2)}, ${loadavg[2].toFixed(2)}`);
  
  // Try to read CPU temperature
  try {
    const { execSync } = require('child_process');
    const temp = execSync('vcgencmd measure_temp', { encoding: 'utf8' });
    log.info(`  Temperature: ${temp.trim()}`);
  } catch (err) {
    // vcgencmd not available or failed
  }
}

/**
 * Setup periodic system monitoring
 * @param {number} intervalMs - Monitoring interval in milliseconds
 */
function startSystemMonitoring(intervalMs = 300000) { // Default: 5 minutes
  if (!isRaspberryPi()) return;
  
  logSystemInfo(); // Log once at startup
  
  setInterval(() => {
    logSystemInfo();
  }, intervalMs);
}

module.exports = {
  isRaspberryPi,
  getRaspberryPiModel,
  getSystemRAM,
  applyOptimizations,
  getRecommendedConfig,
  logSystemInfo,
  startSystemMonitoring
};

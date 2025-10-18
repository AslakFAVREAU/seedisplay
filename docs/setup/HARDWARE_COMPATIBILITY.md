# Hardware Compatibility Matrix

**Last Updated:** October 18, 2025  
**Application:** SEE Display v1.9.3+

---

## 🖥️ Supported Platforms

| Platform | Status | RAM Min | RAM Recommended | Notes |
|----------|--------|---------|-----------------|-------|
| **Windows 10/11 (x64)** | ✅ Fully Supported | 4GB | 8GB | Primary development platform |
| **Raspberry Pi 5 (ARM64)** | ⚠️ Supported* | 4GB | 8GB | Requires manual build, see [setup guide](./RASPBERRY_PI_5_SETUP.md) |
| **Raspberry Pi 4 (ARM64)** | ⚠️ Limited | 4GB | 8GB | Video performance may be reduced |
| **Linux (x64)** | ✅ Supported | 4GB | 8GB | Ubuntu 20.04+, Debian 11+ |
| **macOS (ARM64)** | ⚠️ Untested | 8GB | 16GB | M1/M2 chips should work |
| **macOS (x64)** | ✅ Supported | 8GB | 16GB | Intel-based Macs |

*Requires compilation from source

---

## 📊 Performance Expectations

### Windows 10/11 (x64) - ⭐⭐⭐⭐⭐
- **Smooth 4K video playback:** Yes
- **Multiple displays:** Yes (up to 4)
- **Auto-update:** Yes
- **Build complexity:** Easy (prebuilt binaries)

### Raspberry Pi 5 (4GB RAM) - ⭐⭐⭐⭐☆
- **Smooth 1080p video:** Yes
- **Smooth 4K video:** No (30fps max)
- **Multiple displays:** Limited (1-2 recommended)
- **Auto-update:** Manual recommended
- **Build complexity:** Medium (requires compilation)

### Raspberry Pi 4 (4GB RAM) - ⭐⭐⭐☆☆
- **Smooth 1080p video:** Limited (720p recommended)
- **Smooth 4K video:** No
- **Multiple displays:** No (single display only)
- **Auto-update:** Manual only
- **Build complexity:** Medium (requires compilation)

### Linux x64 (Ubuntu/Debian) - ⭐⭐⭐⭐⭐
- **Smooth 4K video:** Yes
- **Multiple displays:** Yes
- **Auto-update:** Yes
- **Build complexity:** Easy

---

## 🎥 Video Codec Support

| Codec | Windows x64 | Raspberry Pi 5 | Raspberry Pi 4 | Notes |
|-------|-------------|----------------|----------------|-------|
| **H.264/AVC** | ✅ HW | ✅ HW | ✅ HW | Hardware accelerated on all platforms |
| **H.265/HEVC** | ✅ HW | ⚠️ SW | ⚠️ SW | Windows hardware, Pi software decode |
| **VP9** | ✅ HW | ⚠️ SW | ❌ | Limited support on ARM |
| **AV1** | ⚠️ | ❌ | ❌ | Not recommended |
| **MP4** | ✅ | ✅ | ✅ | Container format, codec dependent |
| **WebM** | ✅ | ⚠️ | ⚠️ | Depends on VP8/VP9 codec |

**Legend:**  
✅ HW = Hardware accelerated  
⚠️ SW = Software decode (CPU intensive)  
❌ = Not supported or very slow

---

## 💾 Storage Requirements

| Component | Size | Notes |
|-----------|------|-------|
| **Application** | ~150 MB | Includes Electron + dependencies |
| **node_modules** | ~300 MB | ARM builds may be larger |
| **Media Cache** | Configurable | Default: 500MB (Windows), 150MB (Pi) |
| **Logs** | ~10 MB/month | Rotated automatically |
| **OS + System** | 4-8 GB | Raspberry Pi OS minimal |
| **Recommended Total** | 32 GB+ | SD card or SSD for Pi |

---

## 🌐 Network Requirements

| Feature | Bandwidth | Latency | Notes |
|---------|-----------|---------|-------|
| **API Polling** | ~100 KB/min | <500ms | Config updates |
| **Media Download** | Variable | <2s | Images: ~500KB, Videos: 5-50MB |
| **Auto-Update** | ~100 MB | N/A | Windows only, infrequent |
| **Weather API** | ~5 KB/min | <1s | Open-Meteo (optional) |

**Minimum Connection:** 5 Mbps download  
**Recommended:** 10+ Mbps with wired Ethernet

---

## 🔌 Display Requirements

### Supported Resolutions
- **1920x1080 (Full HD)** - ✅ Recommended
- **1280x720 (HD)** - ✅ Supported
- **3840x2160 (4K)** - ⚠️ Windows only, not Pi
- **Portrait Mode** - ⚠️ Requires manual config

### Refresh Rates
- **60Hz** - Recommended
- **30Hz** - Minimum for smooth video
- **Variable** - Not recommended

---

## 🎛️ Configuration Recommendations

### Raspberry Pi 5 (4GB)
```json
{
  "media_cache_limit": 150,
  "refresh_interval": 300000,
  "video_quality": "720p",
  "enable_hardware_acceleration": true,
  "max_concurrent_downloads": 2
}
```

### Raspberry Pi 4 (4GB)
```json
{
  "media_cache_limit": 100,
  "refresh_interval": 600000,
  "video_quality": "480p",
  "enable_hardware_acceleration": true,
  "max_concurrent_downloads": 1
}
```

### Windows (8GB+)
```json
{
  "media_cache_limit": 500,
  "refresh_interval": 60000,
  "video_quality": "1080p",
  "enable_hardware_acceleration": true,
  "max_concurrent_downloads": 4
}
```

---

## ⚠️ Known Limitations

### All Platforms
- Maximum 4 displays per instance
- Media cache limited by available RAM
- Network interruption requires manual recovery

### Raspberry Pi Specific
- No prebuilt binaries (must compile)
- 4K video playback not smooth
- Limited to 1-2 displays
- Thermal throttling possible without cooling
- Auto-update not recommended (manual preferred)

### Windows Specific
- Requires Windows 10 version 1903 or later
- .NET Framework 4.7.2+ required for installer

---

## 🔧 Optimization by Platform

### Windows
✅ Enable hardware acceleration (default)  
✅ Use NSIS installer for easy updates  
✅ Configure auto-update  
✅ Use 4K displays if available  

### Raspberry Pi 5
✅ Reduce media cache to 150MB  
✅ Use 1080p displays max  
✅ Enable active cooling  
✅ Use wired Ethernet  
⚠️ Compile from source  
⚠️ Disable auto-update  

### Raspberry Pi 4
✅ Reduce media cache to 100MB  
✅ Use 720p displays max  
✅ Enable active cooling  
✅ Use wired Ethernet  
✅ Overclock CPU (optional)  
⚠️ Avoid video-heavy content  

---

## 📈 Benchmark Results

### Raspberry Pi 5 (4GB)
```
Boot Time:           ~30 seconds
App Launch:          ~8 seconds
Image Load (1MB):    ~200ms
Video Load (10MB):   ~1.5 seconds
API Response:        ~300ms
Memory Usage (idle): ~1.2 GB
CPU Usage (idle):    ~22%
```

### Windows 10 (8GB)
```
Boot Time:           N/A
App Launch:          ~3 seconds
Image Load (1MB):    ~50ms
Video Load (10MB):   ~500ms
API Response:        ~100ms
Memory Usage (idle): ~800 MB
CPU Usage (idle):    ~5%
```

---

## 🆘 Getting Help

- **Raspberry Pi Setup Issues:** See [RASPBERRY_PI_5_SETUP.md](./RASPBERRY_PI_5_SETUP.md)
- **Performance Issues:** Check [Performance Tuning](#) section
- **Hardware Questions:** Open GitHub issue with hardware specs

---

## 📝 Testing Checklist

Before deploying on new hardware:

- [ ] Node.js version compatible (20.x+)
- [ ] RAM meets minimum requirements
- [ ] Display resolution tested
- [ ] Network speed verified (5+ Mbps)
- [ ] Video playback tested
- [ ] Temperature monitored (Pi only)
- [ ] Auto-start configured
- [ ] Backup/restore tested

---

**Need support for unlisted hardware?**  
Open a GitHub issue: https://github.com/AslakFAVREAU/seedisplay/issues

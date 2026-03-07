// Fonction appeler a chaque tour de boucle pour update l'ecran
// Local safe logger (defined once)
if (typeof window !== 'undefined') {
    window.__log = window.__log || function(level, tag, ...args) { try { if (window.logger && typeof window.logger[level] === 'function') return window.logger[level](tag, ...args); if (console && typeof console[level] === 'function') return console[level](tag, ...args); return console.log(tag, ...args) } catch(e){ try{ console.log(tag, ...args) }catch(_){} } }
    var __log = window.__log
} else {
    var __log = function(level, tag, ...args) { try { if (console && typeof console[level] === 'function') return console[level](tag, ...args); return console.log(tag, ...args) } catch(e){ try{ console.log(tag, ...args) }catch(_){} } }
}

// Ajuste l'affichage des tuiles météo selon la largeur utile (custom ou viewport)
function applyMeteoLayout() {
    try {
        const isCustom = (window.IS_CUSTOM_MODE && window.CUSTOM_WIDTH)
        const width = isCustom ? window.CUSTOM_WIDTH : window.innerWidth
        const height = isCustom && window.CUSTOM_HEIGHT ? window.CUSTOM_HEIGHT : window.innerHeight
        let maxCards = 5
        // En mode custom petit: limiter à 2 tuiles pour garder le footer visible
        if (isCustom && (height <= 900 || width <= 600)) maxCards = 2
        else if (width < 500) maxCards = 2
        else if (width < 700) maxCards = 3
        else if (width < 900) maxCards = 4

        const cards = ['today', 'd+1', 'd+2', 'd+3', 'd+4']
        cards.forEach((id, idx) => {
            const el = document.getElementById(id)
            if (!el) return
            const shouldShow = idx < maxCards
            el.style.display = shouldShow ? 'flex' : 'none'
        })
    } catch (e) {
        __log('warn', 'defaultScreen', 'applyMeteoLayout error: ' + e.message)
    }
}

// Fallback pour garantir la visibilité du logo footer si activé
function ensureFooterVisibility() {
    try {
        const footerEl = document.getElementById('footer')
        const bottomBarEl = document.getElementById('bottomBar')
        if (!footerEl && !bottomBarEl) return
        const apiLogo = window.affichageConfig && window.affichageConfig.logoSOE
        const confLogo = window.configSEE && window.configSEE.logoSOE
        const raw = (apiLogo !== undefined && apiLogo !== null) ? apiLogo : (confLogo !== undefined && confLogo !== null ? confLogo : window.logoSOE)
        const showLogo = !(raw === false || raw === 'false' || raw === 0 || raw === '0')
        if (footerEl) footerEl.style.display = showLogo ? 'flex' : 'none'
        if (bottomBarEl) bottomBarEl.style.display = showLogo ? 'flex' : 'none'
    } catch (e) {
        __log('warn', 'defaultScreen', 'ensureFooterVisibility error: ' + e.message)
    }
}

/**
 * Apply the default layout mode: 'vertical' (default) or 'horizontal' (3 columns)
 * Reads from window.affichageConfig.defaultLayout or window.configSEE.defaultLayout
 */
function applyDefaultLayout() {
    try {
        var layout = 'horizontal' // default
        // Priority: affichageConfig > _defaultLayout (set by processConfig) > configSEE
        if (window.affichageConfig && window.affichageConfig.defaultLayout) {
            layout = window.affichageConfig.defaultLayout
        } else if (window._defaultLayout) {
            layout = window._defaultLayout
        } else if (window.configSEE && window.configSEE.defaultLayout) {
            layout = window.configSEE.defaultLayout
        }
        
        var pageDefault = document.getElementById('pageDefault')
        if (!pageDefault) return
        
        if (layout === 'horizontal') {
            pageDefault.classList.remove('layout-vertical')
            pageDefault.classList.add('layout-horizontal')
            // Immediately sync data to horizontal elements
            syncHorizontalLayout()
        } else {
            pageDefault.classList.remove('layout-horizontal')
            pageDefault.classList.add('layout-vertical')
        }
        
        __log('info', 'defaultScreen', 'applyDefaultLayout: ' + layout)
    } catch (e) {
        __log('warn', 'defaultScreen', 'applyDefaultLayout error: ' + e.message)
    }
}

/**
 * Sync data from vertical layout elements to horizontal layout elements.
 * Called periodically so horizontal layout stays up-to-date with meteo/ephe/date data.
 */
function syncHorizontalLayout() {
    try {
        var pageDefault = document.getElementById('pageDefault')
        if (!pageDefault || !pageDefault.classList.contains('layout-horizontal')) return

        // Sync heure sans recréer le ":" pour conserver l'animation fluide
        var heureEl = document.getElementById('heure')
        var hzHeure = document.getElementById('hzHeure')
        if (heureEl && hzHeure) {
            var timeText = (heureEl.textContent || '').trim() // ex: "12:34"
            var parts = timeText.split(':')
            var hzHH = document.getElementById('hzHeureHH')
            var hzMM = document.getElementById('hzHeureMM')
            if (!hzHH || !hzMM) {
                hzHeure.innerHTML = '<span id="hzHeureHH"></span><span class="colon-blink">:</span><span id="hzHeureMM"></span>'
                hzHH = document.getElementById('hzHeureHH')
                hzMM = document.getElementById('hzHeureMM')
            }
            if (hzHH) hzHH.textContent = parts[0] || ''
            if (hzMM) hzMM.textContent = parts[1] || ''
        }

        // Sync date — split into jour name + rest
        var dateEl = document.getElementById('date')
        var hzJour = document.getElementById('hzJour')
        var hzDate = document.getElementById('hzDate')
        if (dateEl && hzJour && hzDate) {
            var parts = (dateEl.textContent || '').trim().split(' ')
            if (parts.length >= 4) {
                hzJour.textContent = parts[0] // jour name (e.g. "samedi")
                hzDate.textContent = parts.slice(1).join(' ') // "7 mars 2026"
            } else {
                hzJour.textContent = ''
                hzDate.textContent = dateEl.textContent || ''
            }
        }

        // Sync météo aujourd'hui
        var todayTemp = document.getElementById('todayTemp')
        var hzTemp = document.getElementById('hzMeteoTemp')
        if (todayTemp && hzTemp) {
            var tempText = todayTemp.textContent || '--°'
            hzTemp.textContent = tempText.replace('°', '°C')
        }
        
        var todayImg = document.getElementById('todayImgMeteo')
        var hzImg = document.getElementById('hzMeteoImg')
        if (todayImg && hzImg && todayImg.src !== hzImg.src) {
            hzImg.src = todayImg.src
        }

        // Sync weather description (from weathercode mapped name if available)
        var hzDesc = document.getElementById('hzMeteoDesc')
        if (hzDesc && hzDesc.textContent === 'Chargement...') {
            hzDesc.textContent = '' // Clear loading text once meteo loads
        }

        // Sync min/max temperature
        var hzMinMax = document.getElementById('hzMeteoMinMax')
        if (hzMinMax && typeof window._meteoTodayMin !== 'undefined' && typeof window._meteoTodayMax !== 'undefined') {
            hzMinMax.textContent = '↓ ' + window._meteoTodayMin + '° / ↑ ' + window._meteoTodayMax + '°'
        }

        // Sync wind speed
        var hzWind = document.getElementById('hzMeteoWind')
        if (hzWind && typeof window._meteoWindSpeed !== 'undefined') {
            hzWind.innerHTML = '<svg class="hz-wind-icon" viewBox="0 0 24 24"><path d="M3.5 9h10a3.5 3.5 0 1 0-3.5-3.5M3.5 15h12a3.5 3.5 0 0 1-3.5 3.5M3.5 12h7a2.5 2.5 0 1 1-2.5 2.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg> ' + window._meteoWindSpeed + ' km/h'
        }

        // Sync éphéméride — utilise window._epheData si disponible
        var hzEphe = document.getElementById('hzEphe')
        var hzFeteContainer = document.getElementById('hzFeteContainer')
        var hzFeteIcon = document.getElementById('hzFeteIcon')
        var hzFeteName = document.getElementById('hzFeteName')
        var hzFerieBadge = document.getElementById('hzFerieBadge')

        if (window._epheData) {
            // Fête du jour
            if (window._epheData.hasFete && window._epheData.fete && hzFeteContainer) {
                hzFeteContainer.style.display = 'flex'
                if (hzFeteIcon) hzFeteIcon.textContent = window._epheData.fete.icon || ''
                if (hzFeteName) hzFeteName.textContent = window._epheData.fete.name || ''
                if (hzFerieBadge) hzFerieBadge.style.display = window._epheData.isFerie ? 'inline-block' : 'none'
            } else if (hzFeteContainer) {
                hzFeteContainer.style.display = 'none'
            }
            // Saint du jour
            if (hzEphe) hzEphe.textContent = window._epheData.saint || ''
        } else {
            // Fallback: copier depuis l'ancien élément #ephe
            var epheEl = document.getElementById('ephe')
            if (epheEl && hzEphe) hzEphe.textContent = epheEl.textContent || ''
            if (hzFeteContainer) hzFeteContainer.style.display = 'none'
        }

        // Sync semaine
        var semaineEl = document.getElementById('semainePaireImpaire')
        var hzSemaine = document.getElementById('hzSemaine')
        if (semaineEl && hzSemaine) hzSemaine.textContent = semaineEl.textContent || ''

        // Sync jour de l'année
        var hzJourNum = document.getElementById('hzJourNum')
        if (hzJourNum) {
            var now = new Date()
            var start = new Date(now.getFullYear(), 0, 0)
            var diff = now - start
            var oneDay = 1000 * 60 * 60 * 24
            var dayOfYear = Math.floor(diff / oneDay)
            hzJourNum.textContent = 'Jour n°' + dayOfYear
        }

    } catch (e) {
        __log('warn', 'defaultScreen', 'syncHorizontalLayout error: ' + e.message)
    }
}

if (typeof window !== 'undefined') {
    window.addEventListener('resize', function() { applyMeteoLayout(); detectPortrait(); })
    document.addEventListener('DOMContentLoaded', () => {
        applyMeteoLayout()
        ensureFooterVisibility()
        applyDefaultLayout()
        detectPortrait()
        setTimeout(() => {
            applyMeteoLayout()
            ensureFooterVisibility()
            applyDefaultLayout()
            syncHorizontalLayout()
            detectPortrait()
        }, 1000)
        setInterval(ensureFooterVisibility, 2000)
        // Sync horizontal layout data every second (same as clock)
        setInterval(syncHorizontalLayout, 1000)
    })
    // Re-apply layout if config changes
    window.applyDefaultLayout = applyDefaultLayout
    window.syncHorizontalLayout = syncHorizontalLayout
}

/**
 * Detect portrait orientation based on custom dims or viewport.
 * Adds .hz-portrait class to #pageDefault when height > width.
 */
function detectPortrait() {
    try {
        var w = window.IS_CUSTOM_MODE && window.CUSTOM_WIDTH ? window.CUSTOM_WIDTH : window.innerWidth
        var h = window.IS_CUSTOM_MODE && window.CUSTOM_HEIGHT ? window.CUSTOM_HEIGHT : window.innerHeight
        var pageDefault = document.getElementById('pageDefault')
        if (!pageDefault) return
        if (h > w) {
            pageDefault.classList.add('hz-portrait')
        } else {
            pageDefault.classList.remove('hz-portrait')
        }
    } catch (e) {
        __log('warn', 'defaultScreen', 'detectPortrait error: ' + e.message)
    }
}
if (typeof window !== 'undefined') window.detectPortrait = detectPortrait

/**
 * Get base URL for media files based on environment
 * Uses window.configSEE.env to determine local vs production
 */
function getMediaBaseUrl() {
    try {
        if (typeof window !== 'undefined' && window.configSEE) {
            if (window.configSEE.env === 'local') {
                return 'http://localhost:8000/uploads/see/media/'
            }
            if (window.configSEE.env === 'beta') {
                return 'https://beta.soek.fr/uploads/see/media/'
            }
        }
    } catch(e) {}
    return 'https://soek.fr/uploads/see/media/'
}

/**
 * Download and cache background image locally
 * @param {string} fondEcran - path of background image from API
 * @returns {Promise<string|null>} - local path if downloaded, null if failed
 */
async function downloadFondEcran(fondEcran) {
    if (!fondEcran) return null
    
    try {
        // Extract filename from path (e.g. /uploads/see/fonds/fond_ecran1_rose.jpg -> fond_ecran1_rose.jpg)
        var filename = fondEcran.split('/').pop()
        var relativePath = 'fonds/' + filename
        
        // Build full URL
        var env = window.configSEE?.env || window.env || 'prod'
        var domain = env === 'local' ? 'http://localhost:8000' : env === 'beta' ? 'https://beta.soek.fr' : 'https://soek.fr'
        var fullUrl = fondEcran.startsWith('/') ? domain + fondEcran : fondEcran
        
        __log('debug', 'defaultScreen', 'downloadFondEcran: downloading ' + filename + ' from ' + fullUrl)
        
        // Download using preload API with cache
        if (window.api && typeof window.api.saveBinaryWithCache === 'function') {
            var result = await window.api.saveBinaryWithCache(relativePath, fullUrl)
            if (result && result.success) {
                __log('info', 'defaultScreen', 'downloadFondEcran: cached ' + filename + ' (' + result.size + ' bytes, cached=' + result.cached + ')')
                return relativePath
            }
        }
        
        // Fallback to saveBinary
        if (window.api && typeof window.api.saveBinary === 'function') {
            var success = await window.api.saveBinary(relativePath, fullUrl)
            if (success) {
                __log('info', 'defaultScreen', 'downloadFondEcran: saved ' + filename)
                return relativePath
            }
        }
        
        __log('warn', 'defaultScreen', 'downloadFondEcran: could not download ' + filename)
        return null
    } catch(e) {
        __log('error', 'defaultScreen', 'downloadFondEcran error: ' + e.message)
        return null
    }
}

/**
 * Apply background image to pageDefault from API
 * Called when fondEcran is received from API
 * Downloads to local cache first, falls back to remote URL
 * @param {string} fondEcran - filename or path of background image
 */
async function applyPageDefaultBackground(fondEcran) {
    __log('info','defaultScreen','applyPageDefaultBackground: ' + fondEcran)
    try {
        var pageDefault = document.getElementById('pageDefault')
        if (!pageDefault) {
            __log('warn','defaultScreen','pageDefault element not found')
            return
        }
        
        var imageUrl
        
        // Try to download and cache locally first
        var localPath = await downloadFondEcran(fondEcran)
        
        if (localPath && window.api && typeof window.api.existsSync === 'function') {
            // Check if local file exists
            var exists = window.api.existsSync(localPath)
            if (exists) {
                // Use local file
                imageUrl = 'file:///C:/SEE/' + localPath.replace(/\\/g, '/')
                __log('info','defaultScreen','Using local background: ' + imageUrl)
            }
        }
        
        // Fallback to remote URL if local not available
        if (!imageUrl) {
            if (fondEcran.startsWith('/')) {
                // Full path from API (e.g. /uploads/see/fonds/...)
                var env = window.configSEE?.env || window.env || 'prod'
                var domain = env === 'local' ? 'http://localhost:8000' : env === 'beta' ? 'https://beta.soek.fr' : 'https://soek.fr'
                imageUrl = domain + fondEcran
            } else {
                // Just filename - use media base URL
                var baseUrl = getMediaBaseUrl()
                imageUrl = baseUrl + encodeURIComponent(fondEcran)
            }
            __log('info','defaultScreen','Using remote background: ' + imageUrl)
        }
        
        pageDefault.style.backgroundImage = 'url("' + imageUrl + '")'
        __log('info','defaultScreen','Background applied: ' + imageUrl)
    } catch(e) {
        __log('error','defaultScreen','Error applying background: ' + e.message)
    }
}

// Expose globally for listeDiapo.js
if (typeof window !== 'undefined') {
    window.applyPageDefaultBackground = applyPageDefaultBackground
}

/**
 * Télécharge tous les médias d'une liste (await-able).
 * Résout une fois que tous les fichiers sont téléchargés ou que le timeout global est atteint.
 * @param {Array} mediaList - ArrayDiapo format [[type, file, duration, ...], ...]
 * @param {number} [timeoutMs=30000] - timeout max global en ms
 * @returns {Promise<{downloaded: number, skipped: number, failed: number}>}
 */
async function downloadAllMedia(mediaList, timeoutMs) {
    timeoutMs = timeoutMs || 30000
    const stats = { downloaded: 0, skipped: 0, failed: 0 }
    if (!mediaList || !Array.isArray(mediaList) || !mediaList.length) return stats
    if (!window.api) return stats

    const baseUrl = typeof getMediaBaseUrl === 'function' ? getMediaBaseUrl() : 'https://soek.fr/uploads/see/media/'

    // Collecter les noms de fichiers uniques (ignorer templates/planning)
    const fileSet = new Set()
    for (const item of mediaList) {
        if (!item || !Array.isArray(item) || item.length < 2) continue
        const type = item[0]
        const file = item[1]
        if (!file || typeof file !== 'string') continue
        if (type === 'template' || type === 'planning') continue
        fileSet.add(file)
    }

    if (!fileSet.size) return stats

    const files = Array.from(fileSet)
    __log('info', 'download', 'downloadAllMedia: ' + files.length + ' unique files to check')

    // Télécharger en parallèle (max 3 simultanés) avec timeout global
    const concurrency = 3
    let idx = 0
    let done = false

    const globalTimeout = new Promise(resolve => setTimeout(() => {
        if (!done) __log('warn', 'download', 'downloadAllMedia: global timeout reached (' + timeoutMs + 'ms)')
        done = true
        resolve()
    }, timeoutMs))

    async function worker() {
        while (idx < files.length && !done) {
            const file = files[idx++]
            // Decode URI-encoded filename for disk path
            let decodedFile
            try { decodedFile = decodeURIComponent(file) } catch(e) { decodedFile = file }
            const relativePath = 'media/' + decodedFile
            const url = baseUrl + file
            try {
                // Vérifier si le fichier existe déjà localement
                const exists = window.api.existsSync ? window.api.existsSync(relativePath) : false
                if (exists) {
                    stats.skipped++
                    continue
                }
                // Télécharger
                if (window.api.saveBinaryWithCache) {
                    const res = await window.api.saveBinaryWithCache(relativePath, url)
                    if (res && res.success) {
                        stats.downloaded++
                        __log('debug', 'download', 'OK: ' + file + (res.cached ? ' (cached)' : ' (' + res.size + 'b)'))
                    } else {
                        stats.failed++
                        __log('warn', 'download', 'FAIL: ' + file)
                    }
                } else if (window.api.saveBinary) {
                    await window.api.saveBinary(relativePath, url)
                    stats.downloaded++
                } else {
                    stats.skipped++
                }
            } catch (e) {
                stats.failed++
                __log('warn', 'download', 'error downloading ' + file + ': ' + (e && e.message))
            }
        }
    }

    const workers = []
    for (let i = 0; i < concurrency; i++) workers.push(worker())

    await Promise.race([Promise.all(workers), globalTimeout])
    done = true

    __log('info', 'download', 'downloadAllMedia complete: ' + stats.downloaded + ' new, ' + stats.skipped + ' cached, ' + stats.failed + ' failed')
    return stats
}

if (typeof window !== 'undefined') {
    window.downloadAllMedia = downloadAllMedia
}

/**
 * Show sleep screen when API returns status "sleep"
 * Uses typeHorsPlage to determine display type:
 * - "noir" (default): black screen
 * - "logo": SEE logo (/uploads/see/common/logo_see.png)
 * - "image": custom image or video from imageHorsPlage
 * Shows next wakeup time if available (prochainDemarrage)
 * 
 * Supported formats for imageHorsPlage:
 * - Images: JPG, PNG, GIF, WebP
 * - Videos: MP4, WebM (loop playback)
 */
function showSleepScreen() {
    __log('info','sleep','showSleepScreen called')
    
    // Hide all media displays
    try { document.getElementById("divImg1").style.display = "none" } catch(e) {}
    try { document.getElementById("divImg2").style.display = "none" } catch(e) {}
    try { document.getElementById("divVideo1").style.display = "none" } catch(e) {}
    try { document.getElementById("divVideo2").style.display = "none" } catch(e) {}
    try { document.getElementById("pageDefault").style.display = "none" } catch(e) {}
    try { document.getElementById("pagePsaume").style.display = "none" } catch(e) {}
    try { document.getElementById("mediaContainer").classList.remove("active") } catch(e) {}
    
    // Get or create sleep screen container
    let sleepScreen = document.getElementById("sleepScreen")
    if (!sleepScreen) {
        sleepScreen = document.createElement("div")
        sleepScreen.id = "sleepScreen"
        // En mode custom, utiliser les dimensions custom au lieu de 100%
        const w = window.IS_CUSTOM_MODE ? window.CUSTOM_WIDTH + 'px' : '100%'
        const h = window.IS_CUSTOM_MODE ? window.CUSTOM_HEIGHT + 'px' : '100%'
        sleepScreen.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: ${w};
            height: ${h};
            background: #000;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 9000;
        `
        // En mode custom, ajouter dans le wrapper au lieu de body
        const wrapper = window.IS_CUSTOM_MODE ? document.getElementById('appWrapper') : null
        if (wrapper) {
            wrapper.appendChild(sleepScreen)
        } else {
            document.body.appendChild(sleepScreen)
        }
    }
    
    const typeHorsPlage = window.typeHorsPlage || 'noir'
    const imageHorsPlage = window.imageHorsPlage || null
    const prochainDemarrage = window.prochainDemarrage || null
    
    __log('info','sleep','typeHorsPlage=' + typeHorsPlage + ', imageHorsPlage=' + imageHorsPlage + ', prochainDemarrage=' + prochainDemarrage)
    
    // Helper to build full URL from API path
    function buildMediaUrl(path) {
        if (!path) return null
        var env = window.configSEE?.env || window.env || 'prod'
        var domain = env === 'local' ? 'http://localhost:8000' : env === 'beta' ? 'https://beta.soek.fr' : 'https://soek.fr'
        return path.startsWith('/') ? domain + path : path
    }
    
    // Helper to check if file is a video
    function isVideo(path) {
        if (!path) return false
        var ext = path.split('.').pop().toLowerCase()
        return ['mp4', 'webm'].includes(ext)
    }
    
    // Clear previous content
    sleepScreen.innerHTML = ''
    sleepScreen.style.backgroundImage = 'none'
    sleepScreen.style.background = '#000'
    
    if (typeHorsPlage === 'logo') {
        // Show SEE logo - use imageHorsPlage from API (e.g. /uploads/see/common/logo_see.png)
        var logoUrl = imageHorsPlage ? buildMediaUrl(imageHorsPlage) : null
        if (!logoUrl) {
            // Fallback to local logo if API didn't provide path
            logoUrl = 'assets/logo-see.png'
        }
        __log('info','sleep','showing logo: ' + logoUrl)
        sleepScreen.innerHTML = `
            <img src="${logoUrl}" alt="SEE" style="max-width: 300px; max-height: 300px; opacity: 0.5;">
        `
        if (prochainDemarrage) {
            sleepScreen.innerHTML += `
                <div style="color: #444; font-size: 1.2em; font-family: Arial, sans-serif; margin-top: 20px;">
                    Prochain démarrage : ${prochainDemarrage}
                </div>
            `
        }
    } else if ((typeHorsPlage === 'image' || typeHorsPlage === 'logo') && imageHorsPlage) {
        // Show custom image or video
        var mediaUrl = buildMediaUrl(imageHorsPlage)
        __log('info','sleep','showing media: ' + mediaUrl)
        
        if (isVideo(imageHorsPlage)) {
            // Video - loop playback
            sleepScreen.innerHTML = `
                <video autoplay muted loop playsinline style="width: 100%; height: 100%; object-fit: cover;">
                    <source src="${mediaUrl}" type="video/${imageHorsPlage.split('.').pop().toLowerCase()}">
                </video>
            `
        } else {
            // Image - use background
            sleepScreen.style.backgroundImage = 'url("' + mediaUrl + '")'
            sleepScreen.style.backgroundSize = 'cover'
            sleepScreen.style.backgroundPosition = 'center'
        }
    } else {
        // "noir" or default - black screen with moon icon anti burn-in
        var wakeupHtml = prochainDemarrage 
            ? `<div id="sleep-wakeup-text" style="margin-top:12px; color:#666; font-size:0.3em; font-family:Arial,sans-serif;">Prochain démarrage : ${prochainDemarrage}</div>` 
            : ''
        sleepScreen.innerHTML = `
            <div id="sleep-moon-icon" style="
                position: absolute;
                opacity: 0;
                transition: opacity 3s ease-in-out;
                display: flex;
                flex-direction: column;
                align-items: center;
                font-size: 5em;
                pointer-events: none;
                filter: grayscale(1) brightness(0.25);
            ">🌙${wakeupHtml}</div>
        `
        // Start moon position cycling after layout
        setTimeout(function() { _startMoonCycle() }, 100)
    }
    
    sleepScreen.style.display = "flex"
    __log('info','sleep','sleep screen displayed')
    
    // Schedule wakeup based on prochainDemarrage time
    if (typeof window !== 'undefined') {
        // Clear any existing timers
        if (window.sleepCheckTimer) {
            clearTimeout(window.sleepCheckTimer)
        }
        if (window.sleepRefreshTimer) {
            clearInterval(window.sleepRefreshTimer)
        }
        
        // 1. Schedule exact wakeup call if prochainDemarrage is provided
        if (prochainDemarrage) {
            var parts = prochainDemarrage.split(':')
            if (parts.length >= 2) {
                var wakeHour = parseInt(parts[0], 10)
                var wakeMin = parseInt(parts[1], 10)
                
                var now = new Date()
                var wakeTime = new Date()
                wakeTime.setHours(wakeHour, wakeMin, 0, 0)
                
                // If wake time is earlier today, it's tomorrow
                if (wakeTime <= now) {
                    wakeTime.setDate(wakeTime.getDate() + 1)
                }
                
                var msUntilWake = wakeTime.getTime() - now.getTime()
                var minUntilWake = Math.round(msUntilWake / 60000)
                
                __log('info','sleep','wakeup scheduled at ' + prochainDemarrage + ' (in ' + minUntilWake + ' min)')
                
                // Schedule API call at wakeup time (+ small buffer)
                window.sleepCheckTimer = setTimeout(function() {
                    __log('info','sleep','wakeup time reached, calling API...')
                    requestJsonDiapo()
                }, msUntilWake + 5000) // +5s buffer
            }
        }
        
        // 2. Also refresh every 5 minutes to detect any config changes
        window.sleepRefreshTimer = setInterval(function() {
            __log('debug','sleep','periodic refresh during sleep...')
            requestJsonDiapo()
        }, 300000) // 5 minutes
    }
}

/**
 * Moon icon anti burn-in cycle for sleep screen.
 * Alternates between positions with smooth 3s fade transitions.
 */
var _moonPositions = [
    { top: '15%', left: '20%' },
    { top: '70%', left: '75%' },
    { top: '25%', left: '70%' },
    { top: '65%', left: '15%' },
    { top: '45%', left: '50%' },
    { top: '10%', left: '50%' },
    { top: '80%', left: '40%' },
]
var _moonIndex = 0

function _startMoonCycle() {
    var moon = document.getElementById('sleep-moon-icon')
    if (!moon) return

    // Place initial position + fade in
    var pos = _moonPositions[0]
    moon.style.top = pos.top
    moon.style.left = pos.left
    requestAnimationFrame(function() {
        moon.style.opacity = '1'
    })

    // Clear existing timer
    if (window._moonCycleTimer) clearInterval(window._moonCycleTimer)

    // Cycle every 30 seconds: fade out → move → fade in
    window._moonCycleTimer = setInterval(function() {
        var m = document.getElementById('sleep-moon-icon')
        if (!m) { clearInterval(window._moonCycleTimer); return }

        // Fade out
        m.style.opacity = '0'

        // After fade-out (3s), move to next position + fade in
        setTimeout(function() {
            _moonIndex = (_moonIndex + 1) % _moonPositions.length
            var p = _moonPositions[_moonIndex]
            m.style.top = p.top
            m.style.left = p.left
            // Fade in
            requestAnimationFrame(function() {
                m.style.opacity = '1'
            })
        }, 3200) // Slightly longer than the 3s CSS transition
    }, 30000) // Move every 30s
}

/**
 * Hide sleep screen (called when exiting sleep mode)
 */
function hideSleepScreen() {
    __log('info','sleep','hideSleepScreen called')
    
    const sleepScreen = document.getElementById("sleepScreen")
    if (sleepScreen) {
        sleepScreen.style.display = "none"
    }
    
    // Clear sleep timers
    if (window.sleepCheckTimer) {
        clearTimeout(window.sleepCheckTimer)
        window.sleepCheckTimer = null
    }
    if (window.sleepRefreshTimer) {
        clearInterval(window.sleepRefreshTimer)
        window.sleepRefreshTimer = null
    }
    // Clear moon cycle timer
    if (window._moonCycleTimer) {
        clearInterval(window._moonCycleTimer)
        window._moonCycleTimer = null
    }
}

function defaultScreen() {
    if (window._sl) window._sl('defaultScreen() called (init=' + init + ', ArrayDiapo=' + (typeof ArrayDiapo !== 'undefined' && ArrayDiapo ? ArrayDiapo.length : 'null') + ' items)')

    const dateGif = new Date();

const monthGif = dateGif.getMonth();
__log('debug','default','monthGif=' + monthGif)

// Afficher GIF uniquement en décembre (mois 11), sinon le cacher
if (monthGif == 11)
{
    document.getElementById("gifNoel").style.display = "block";   
    __log('info','default','December detected - showing Christmas GIF');
    restart("imgGif","logo/gifNoel.gif")
} else {
    document.getElementById("gifNoel").style.display = "none";
    __log('debug','default','Not December - hiding Christmas GIF');
}
    // On remet le compteur de la loop à 0
    numImage = 0;
    __log('debug','default','init=' + init)
    // On passe par la fonction pour recup le diapo si Init est a false
    // MAIS on évite de boucler infiniment si l'API vient d'être appelée
    if (init == false) {
        __log('info','default','init false')
    // Double DIV IMG
     imgShow= 1
     imgLoad= 1

    // Double DIV VIDEO
     player = 1
     noplayer = 2
     playerLoad = 1

        // Protection anti-boucle infinie : ne pas relancer l'API si elle vient d'être appelée
        var now = Date.now()
        var minDelayBetweenCalls = 10000 // 10 secondes minimum entre les appels
        if (!window._lastApiCallTime || (now - window._lastApiCallTime) > minDelayBetweenCalls) {
            window._lastApiCallTime = now
            requestJsonDiapo()
        } else {
            __log('debug','default','API call skipped (anti-loop protection, last call was ' + Math.round((now - window._lastApiCallTime)/1000) + 's ago)')
        }
    }
    init= false
    // Mise a jour si le lastUdpate est superieur a refresh time
    if (lastUdpateMeteo + refresh - Date.now() < 0) {
        lastUdpateMeteo = Date.now()
        requestJsonMeteo()
        ephe()
    }

    /*Affichage et met à jour la date et de la semaine et de l'heure sur la page par défaut*/
    document.getElementById("date").innerHTML = dateFr()
    if (document.getElementById("heure")) updateHeureElement()

    // Affichage semaine paire ou impaire
    returnSemainePaireImpaire = semainePaireImpaire(new Date())
    if (weekNo == true) {
        document.getElementById("semainePaireImpaire").innerHTML = "Semaine" + " (" + returnSemainePaireImpaire[0] + ")"
        if (weekType == true) {
            document.getElementById("semainePaireImpaire").innerHTML = returnSemainePaireImpaire[1] + " (" + returnSemainePaireImpaire[0] + ")"
        }
    }


    document.getElementById("divImg1").style.display = "none";
    document.getElementById("divImg2").style.display = "none";
    document.getElementById("divVideo1").style.display = "none";
    document.getElementById("divVideo2").style.display = "none";
    document.getElementById("pagePsaume").style.display = "none";
    
    // Cacher le conteneur de médias et afficher pageDefault
    try { document.getElementById("mediaContainer").classList.remove("active") } catch(e){}
    document.getElementById("pageDefault").style.display = "flex";
    url = "blank.jpg";
    document.getElementById("divImg1").style.backgroundImage = "url(" + url + ")";
    document.getElementById("divImg2").style.backgroundImage = "url(" + url + ")";


    // Téléchargement robuste : télécharger TOUS les médias, attendre, puis lancer la boucle
    setTimeout(async function () {
        if (!ArrayDiapo || !ArrayDiapo.length) {
            __log('warn','default','aucun media dans ArrayDiapo, rien a telecharger')
            return
        }

        __log('info','default','downloading all media before starting loop (' + ArrayDiapo.length + ' items)...')
        await window.downloadAllMedia(ArrayDiapo)
        __log('info','default','all media downloads complete, starting loop')

        // Précharger le premier média
        try {
            if (ArrayDiapo[0][0] === 'video') {
                urlVideo = pathMedia + ArrayDiapo[0][1].replace("%20", '%2520')
                document.getElementById("srcVideo" + playerLoad).src = urlVideo
                document.getElementById("video" + playerLoad).load()
                playerLoad = 2
            } else if (ArrayDiapo[0][0] === 'img') {
                url = pathMedia + ArrayDiapo[0][1].replace("%20", '%2520')
                document.getElementById("divImg" + imgLoad).style.backgroundImage = "url('" + url + "')";
                imgShow = 1
                imgLoad = 2
            }
        } catch (e) { __log('error','default','preload first media error: ' + e.message) }

        // Lancer la boucle (pageDefault sera caché par showMedia quand le 1er média est prêt)
        LoopDiapo()
    }, 2500);



}
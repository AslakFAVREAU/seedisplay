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

if (typeof window !== 'undefined') {
    window.addEventListener('resize', applyMeteoLayout)
    document.addEventListener('DOMContentLoaded', () => {
        applyMeteoLayout()
        ensureFooterVisibility()
        setTimeout(() => {
            applyMeteoLayout()
            ensureFooterVisibility()
        }, 1000)
        setInterval(ensureFooterVisibility, 2000)
    })
}

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
        // "noir" or default - black screen with optional wakeup info
        if (prochainDemarrage) {
            sleepScreen.innerHTML = `
                <div style="color: #333; font-size: 1.5em; font-family: Arial, sans-serif;">
                    Prochain démarrage : ${prochainDemarrage}
                </div>
            `
        }
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
}

function defaultScreen() {

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

    /*Affichage et met à jour la date et de la semaine et de l heure sur la page par default*/
    document.getElementById("date").innerHTML = dateFr()
    document.getElementById("heure").innerHTML = heure()

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


    // Avant de demarer la boucle on lance le telechargement des medias
    setTimeout(function () {
        if (!ArrayDiapo || !ArrayDiapo.length) {
            __log('warn','default','aucun media dans ArrayDiapo, rien a telecharger')
        } else {
        for (downloadIndex = 0; downloadIndex < ArrayDiapo.length; downloadIndex++) {
                try {
                    const mediaName = ArrayDiapo[downloadIndex] && ArrayDiapo[downloadIndex][1]
                    __log('debug','default','checking media', mediaName)
                if (mediaName) {
                    const exists = (window && window.api && typeof window.api.existsSync === 'function') ? window.api.existsSync('media/' + mediaName) : false
                    if (!exists) {
                        // use preload saveBinary when available
                        if (window && window.api && typeof window.api.saveBinary === 'function') {
                            const urlMedia = getMediaBaseUrl() + mediaName
                            window.api.saveBinary('media/' + mediaName, urlMedia)
                            __log('info','default','launching download via api.saveBinary for ' + mediaName + ' from ' + getMediaBaseUrl())
                        } else {
                            // fallback to renderer download (may not work without nodeIntegration)
                            download(mediaName)
                            __log('info','default','launching download fallback for ' + mediaName)
                        }
                    }
                }
            }
            catch (err) { __log('error','default', err && err.message) }
        }
        }
    }, 2500)


    setTimeout(function () {
        // Test si on a au moins un élément et si le 0 de la boucle est une video
        if (ArrayDiapo && ArrayDiapo.length > 0 && ArrayDiapo[0][0] === 'video') {
            __log('debug','default', playerLoad + ' player chargé dans boucle init')     
            urlVideo = pathMedia + ArrayDiapo[0][1].replace("%20", '%2520')
            document.getElementById("srcVideo" + playerLoad).src = urlVideo;
            document.getElementById("video" + playerLoad).load()
            playerLoad = 2
             
          
        }
        else if (ArrayDiapo && ArrayDiapo.length > 0 && ArrayDiapo[0][0] === 'img') {
            url = pathMedia + ArrayDiapo[0][1].replace("%20", '%2520')
            urlFinal = "url('" + url + "')"
            document.getElementById("divImg" + imgLoad).style.backgroundImage = urlFinal;
            __log('debug','default','on charge le imgLoad '+ imgLoad + ' le imgShow sera '+ imgShow)
        
                imgShow = 1
                imgLoad = 2
             
                
        
            }
        
        

    }, 4000)




    // Au bout de 5 Seconde on passe a la loop
    setTimeout(function () {
        document.getElementById("pageDefault").style.display = "none";        
        LoopDiapo()

       
       
    },
        10000);



}
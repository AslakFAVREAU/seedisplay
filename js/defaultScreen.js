// Fonction appeler a chaque tour de boucle pour update l'ecran
// Local safe logger (defined once)
if (typeof window !== 'undefined') {
    window.__log = window.__log || function(level, tag, ...args) { try { if (window.logger && typeof window.logger[level] === 'function') return window.logger[level](tag, ...args); if (console && typeof console[level] === 'function') return console[level](tag, ...args); return console.log(tag, ...args) } catch(e){ try{ console.log(tag, ...args) }catch(_){} } }
    var __log = window.__log
} else {
    var __log = function(level, tag, ...args) { try { if (console && typeof console[level] === 'function') return console[level](tag, ...args); return console.log(tag, ...args) } catch(e){ try{ console.log(tag, ...args) }catch(_){} } }
}

/**
 * Get base URL for media files based on environment
 * Uses window.configSEE.env to determine local vs production
 */
function getMediaBaseUrl() {
    try {
        if (typeof window !== 'undefined' && window.configSEE && window.configSEE.env === 'local') {
            return 'http://127.0.0.1:8000/uploads/see/media/'
        }
    } catch(e) {}
    return 'https://soek.fr/uploads/see/media/'
}

/**
 * Show sleep screen when API returns status "sleep"
 * Uses typeHorsPlage to determine display type:
 * - "noir" (default): black screen
 * - "image": show imageHorsPlage
 * Shows next wakeup time if available (prochainDemarrage)
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
        sleepScreen.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: #000;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 9000;
        `
        document.body.appendChild(sleepScreen)
    }
    
    const typeHorsPlage = window.typeHorsPlage || 'noir'
    const imageHorsPlage = window.imageHorsPlage || null
    const prochainDemarrage = window.prochainDemarrage || null
    
    __log('info','sleep','typeHorsPlage=' + typeHorsPlage + ', prochainDemarrage=' + prochainDemarrage)
    
    if (typeHorsPlage === 'image' && imageHorsPlage) {
        // Show image
        const baseUrl = getMediaBaseUrl()
        sleepScreen.style.backgroundImage = 'url(' + baseUrl + encodeURIComponent(imageHorsPlage) + ')'
        sleepScreen.style.backgroundSize = 'cover'
        sleepScreen.style.backgroundPosition = 'center'
        sleepScreen.innerHTML = ''
    } else {
        // Show black screen with optional wakeup info
        sleepScreen.style.backgroundImage = 'none'
        sleepScreen.style.background = '#000'
        
        if (prochainDemarrage) {
            sleepScreen.innerHTML = `
                <div style="color: #333; font-size: 1.5em; font-family: Arial, sans-serif;">
                    Prochain démarrage : ${prochainDemarrage}
                </div>
            `
        } else {
            sleepScreen.innerHTML = ''
        }
    }
    
    sleepScreen.style.display = "flex"
    __log('info','sleep','sleep screen displayed')
    
    // Schedule next API check to detect wakeup
    // Use shorter interval during sleep for responsive wakeup
    if (typeof window !== 'undefined') {
        window.sleepCheckTimer = setTimeout(function() {
            __log('debug','sleep','checking for wakeup...')
            requestJsonDiapo()
        }, 60000) // Check every minute
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
    
    // Clear sleep check timer
    if (window.sleepCheckTimer) {
        clearTimeout(window.sleepCheckTimer)
        window.sleepCheckTimer = null
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
    // On passe par la fontion pour recup le diapo si Init est a false
    if (init == false) {
        __log('info','default','init false')
    // Double DIV IMG
     imgShow= 1
     imgLoad= 1

    // Double DIV VIDEO
     player = 1
     noplayer = 2
     playerLoad = 1


        requestJsonDiapo()
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

// Local safe logger
if (typeof window !== 'undefined') {
    window.__log = window.__log || function(level, tag, ...args) { try { if (window.logger && typeof window.logger[level] === 'function') return window.logger[level](tag, ...args); if (console && typeof console[level] === 'function') return console[level](tag, ...args); return console.log(tag, ...args) } catch(e){ try{ console.log(tag, ...args) }catch(_){} } }
    var __log = window.__log
} else {
    var __log = function(level, tag, ...args) { try { if (console && typeof console[level] === 'function') return console[level](tag, ...args); return console.log(tag, ...args) } catch(e){ try{ console.log(tag, ...args) }catch(_){} } }
}

/**
 * Système d'affichage ultra-simple avec display: block/none
 * Pas de CSS transitions complexes, juste show/hide direct
 * 
 * Note: imgShow, imgLoad, player sont déclarés globalement dans index.html
 * pour être accessibles par defaultScreen.js et autres scripts
 */

let currentMediaIndex = 0;
let mediaLoop = [];
let loopTimeout = null;

// imgShow, player sont maintenant des variables globales (déclarées dans index.html)

/**
 * Cache TOUS les éléments média
 */
function hideAllMedia() {
    __log('debug', 'diapo', 'hiding all media');
    try {
        document.getElementById('divImg1').style.display = 'none';
        document.getElementById('divImg2').style.display = 'none';
        document.getElementById('divVideo1').style.display = 'none';
        document.getElementById('divVideo2').style.display = 'none';
    } catch(e) {
        __log('error', 'diapo', 'hideAllMedia error: ' + e.message);
    }
}

/**
 * Affiche un média - version ultra-simple
 */
function showMedia(mediaIndex) {
    if (!mediaLoop || mediaLoop.length === 0) {
        __log('warn', 'diapo', 'no media to display');
        defaultScreen();
        return;
    }
    
    // Wrap-around - afficher pageDefault entre chaque cycle
    if (mediaIndex >= mediaLoop.length) {
        __log('info', 'diapo', 'end of loop, showing pageDefault then restarting');
        
        // Cacher tous les médias
        hideAllMedia();
        
        // Cacher le container, afficher pageDefault
        document.getElementById('mediaContainer').style.display = 'none';
        document.getElementById('pageDefault').style.display = 'flex';
        
        // Redémarrer après 5 secondes
        loopTimeout = setTimeout(() => {
            document.getElementById('pageDefault').style.display = 'none';
            document.getElementById('mediaContainer').style.display = 'block';
            showMedia(0);
        }, 5000);
        
        return;
    }
    
    const media = mediaLoop[mediaIndex];
    const mediaType = media[0];
    const mediaFile = media[1];
    const delay = (media[2] && Number(media[2]) > 0) ? Number(media[2]) * 1000 : 5000;
    
    currentMediaIndex = mediaIndex;
    
    __log('info', 'diapo', 'showing #' + mediaIndex + '/' + mediaLoop.length + ' type=' + mediaType + ' file=' + mediaFile + ' delay=' + (delay/1000) + 's');
    
    // Pas de hideAllMedia ici - on le fait juste avant d'afficher le nouveau média pour éviter le flash noir
    
    if (mediaType === 'video') {
        // Utiliser player (1 ou 2)
        const videoId = 'video' + player;
        const divId = 'divVideo' + player;
        const sourceId = 'srcVideo' + player;
        
        __log('debug', 'diapo', 'loading video in ' + divId);
        
        try {
            const url = pathMedia + mediaFile.replace("%20", '%2520');
            const sourceEl = document.getElementById(sourceId);
            const videoEl = document.getElementById(videoId);
            const divEl = document.getElementById(divId);
            
            // Charger
            sourceEl.src = url;
            videoEl.load();
            
            // Cacher l'ancien, afficher le nouveau - pas de délai pour éviter le flash noir
            hideAllMedia();
            divEl.style.display = 'block';
            __log('debug', 'diapo', divId + ' displayed');
            
            // Lancer la vidéo
            videoEl.play().catch(e => {
                __log('error', 'diapo', 'video play failed: ' + e.message);
            });
            
            // Toggle pour la prochaine
            player = (player === 1) ? 2 : 1;
            
        } catch(e) {
            __log('error', 'diapo', 'video error: ' + e.message);
        }
        
    } else if (mediaType === 'img') {
        // Utiliser imgShow (1 ou 2)
        const divId = 'divImg' + imgShow;
        
        __log('debug', 'diapo', 'loading image in ' + divId);
        
        try {
            const url = pathMedia + mediaFile.replace("%20", '%2520');
            __log('debug', 'diapo', 'pathMedia=' + pathMedia + ' full URL=' + url);
            
            const divEl = document.getElementById(divId);
            if (!divEl) {
                __log('error', 'diapo', divId + ' NOT FOUND in DOM!');
                return;
            }
            
            __log('debug', 'diapo', divId + ' element found, setting backgroundImage');
            
            // Charger l'image en background
            divEl.style.backgroundImage = "url('" + url + "')";
            
            __log('debug', 'diapo', 'backgroundImage set, current display=' + divEl.style.display);
            
            // Cacher l'ancien, afficher le nouveau - pas de délai pour éviter le flash noir
            hideAllMedia();
            divEl.style.display = 'block';
            __log('info', 'diapo', divId + ' NOW DISPLAYED! display=' + divEl.style.display);
            
            // Toggle pour la prochaine
            imgShow = (imgShow === 1) ? 2 : 1;
            
        } catch(e) {
            __log('error', 'diapo', 'image error: ' + e.message);
        }
    }
    
    // Programmer le prochain
    __log('debug', 'diapo', 'scheduling next in ' + (delay/1000) + 's');
    loopTimeout = setTimeout(() => {
        showMedia(currentMediaIndex + 1);
    }, delay);
}

/**
 * Démarre la boucle
 */
function LoopDiapo() {
    __log('info', 'diapo', 'LoopDiapo starting');
    
    // Annuler timeout précédent
    if (loopTimeout) {
        clearTimeout(loopTimeout);
        loopTimeout = null;
    }
    
    // Charger les médias
    mediaLoop = (ArrayMedia && ArrayMedia.length) ? ArrayMedia : (ArrayDiapo || []);
    
    __log('info', 'diapo', 'loaded ' + mediaLoop.length + ' media');
    
    if (!mediaLoop || mediaLoop.length === 0) {
        __log('warn', 'diapo', 'no media available');
        defaultScreen();
        return;
    }
    
    // Cacher pageDefault, afficher mediaContainer
    try {
        const pageDefault = document.getElementById('pageDefault');
        pageDefault.style.display = 'none';
        __log('info', 'diapo', 'pageDefault hidden');
        
        const container = document.getElementById('mediaContainer');
        if (!container) {
            __log('error', 'diapo', 'mediaContainer NOT FOUND!');
            return;
        }
        
        container.style.display = 'block';
        __log('info', 'diapo', 'mediaContainer displayed, computed style: ' + window.getComputedStyle(container).display);
        
    } catch(e) {
        __log('error', 'diapo', 'container display error: ' + e.message);
    }
    
    // Démarrer à l'index 0
    currentMediaIndex = 0;
    imgShow = 1;
    player = 1;
    
    __log('info', 'diapo', 'calling showMedia(0)');
    showMedia(0);
}

/**
 * Arrête la boucle
 */
function stopLoopDiapo() {
    __log('info', 'diapo', 'stopping LoopDiapo');
    
    if (loopTimeout) {
        clearTimeout(loopTimeout);
        loopTimeout = null;
    }
    
    // Cacher tous les médias
    hideAllMedia();
    
    // Cacher le container, afficher pageDefault
    try {
        const container = document.getElementById('mediaContainer');
        if (container) {
            container.style.display = 'none';
        }
        document.getElementById('pageDefault').style.display = 'flex';
    } catch(e) {
        __log('error', 'diapo', 'stop error: ' + e.message);
    }
}


// Local safe logger
if (typeof window !== 'undefined') {
    window.__log = window.__log || function(level, tag, ...args) { try { if (window.logger && typeof window.logger[level] === 'function') return window.logger[level](tag, ...args); if (console && typeof console[level] === 'function') return console[level](tag, ...args); return console.log(tag, ...args) } catch(e){ try{ console.log(tag, ...args) }catch(_){} } }
    var __log = window.__log
} else {
    var __log = function(level, tag, ...args) { try { if (console && typeof console[level] === 'function') return console[level](tag, ...args); return console.log(tag, ...args) } catch(e){ try{ console.log(tag, ...args) }catch(_){} } }
}

/**
 * Système d'affichage séquentiel simplifié avec slides
 * - Un seul élément actif à la fois (classe .active)
 * - Transitions CSS pures (opacity via .active)
 * - Pas de manipulation complexe de display
 */

// Variables globales
let currentMediaIndex = 0; // Index dans ArrayLoop
let mediaLoop = [];
let loopTimeout = null;

// Toggle pour alternance simple entre divs
let useVideoSlot = 1;  // 1 ou 2 pour video1/video2
let useImgSlot = 1;    // 1 ou 2 pour divImg1/divImg2

/**
 * Cache tous les slides
 */
function hideAllSlides() {
    try {
        document.getElementById('divVideo1').classList.remove('active');
        document.getElementById('divVideo2').classList.remove('active');
        document.getElementById('divImg1').classList.remove('active');
        document.getElementById('divImg2').classList.remove('active');
    } catch(e) {
        __log('error', 'diapo', 'hideAllSlides error: ' + e.message);
    }
}

/**
 * Charge et affiche un média de manière synchrone simple
 */
function loadAndShowMedia(media) {
    if (!media) {
        __log('error', 'diapo', 'no media to load');
        return;
    }
    
    const mediaType = media[0];
    const mediaFile = media[1];
    const url = pathMedia + mediaFile.replace("%20", '%2520');
    
    __log('info', 'diapo', 'loading ' + mediaType + ': ' + mediaFile);
    
    // Cacher tous les slides
    hideAllSlides();
    
    if (mediaType === 'video') {
        // Alterner entre video1 et video2
        const videoId = 'video' + useVideoSlot;
        const divId = 'divVideo' + useVideoSlot;
        const sourceId = 'srcVideo' + useVideoSlot;
        
        __log('debug', 'diapo', 'using ' + divId);
        
        try {
            // Charger la vidéo
            document.getElementById(sourceId).src = url;
            const videoEl = document.getElementById(videoId);
            videoEl.load();
            
            // Afficher le div après un court délai
            setTimeout(() => {
                document.getElementById(divId).classList.add('active');
                videoEl.play().catch(e => {
                    __log('error', 'diapo', 'video play error: ' + e.message);
                });
            }, 100);
            
            // Toggle pour la prochaine vidéo
            useVideoSlot = (useVideoSlot === 1) ? 2 : 1;
            
        } catch(e) {
            __log('error', 'diapo', 'video load error: ' + e.message);
        }
        
    } else if (mediaType === 'img') {
        // Alterner entre divImg1 et divImg2
        const divId = 'divImg' + useImgSlot;
        
        __log('debug', 'diapo', 'using ' + divId);
        
        try {
            const urlFinal = "url('" + url + "')";
            const divEl = document.getElementById(divId);
            
            // Charger l'image
            divEl.style.backgroundImage = urlFinal;
            
            // Afficher après un court délai
            setTimeout(() => {
                divEl.classList.add('active');
            }, 100);
            
            // Toggle pour la prochaine image
            useImgSlot = (useImgSlot === 1) ? 2 : 1;
            
        } catch(e) {
            __log('error', 'diapo', 'image load error: ' + e.message);
        }
    }
}

/**
 * Affiche un média (version simplifiée)
 */
function showMedia(mediaIndex) {
    if (!mediaLoop || mediaLoop.length === 0) {
        __log('warn', 'diapo', 'mediaLoop empty, falling back to default screen');
        defaultScreen();
        return;
    }
    
    // Wrap-around pour boucle continue
    if (mediaIndex >= mediaLoop.length) {
        __log('info', 'diapo', 'end of loop, wrapping to start');
        mediaIndex = 0;
    }
    
    const media = mediaLoop[mediaIndex];
    currentMediaIndex = mediaIndex;
    
    __log('info', 'diapo', 'showing media ' + mediaIndex + '/' + mediaLoop.length + ': type=' + media[0] + ' file=' + media[1]);
    
    // Charger et afficher directement
    loadAndShowMedia(media);
    
    // Programmer le prochain média
    const delay = (media[2] && Number(media[2]) > 0) ? Number(media[2]) * 1000 : 5000;
    __log('debug', 'diapo', 'scheduling next media in ' + (delay/1000) + ' seconds');
    
    loopTimeout = setTimeout(() => {
        showMedia(currentMediaIndex + 1);
    }, delay);
}

/**
 * Démarre la boucle d'affichage
 */
function LoopDiapo() {
    // Annuler tout timeout précédent
    if (loopTimeout) {
        clearTimeout(loopTimeout);
        loopTimeout = null;
    }
    
    // Charger la liste des médias (préférer ArrayMedia, fallback à ArrayDiapo)
    mediaLoop = (ArrayMedia && ArrayMedia.length) ? ArrayMedia : (ArrayDiapo || []);
    
    __log('info', 'diapo', 'LoopDiapo start with ' + mediaLoop.length + ' media');
    
    if (!mediaLoop || mediaLoop.length === 0) {
        __log('warn', 'diapo', 'no media to display');
        defaultScreen();
        return;
    }
    
    // Cacher pageDefault et afficher le conteneur de médias
    try {
        document.getElementById('pageDefault').style.display = 'none';
        document.getElementById('mediaContainer').classList.add('active');
    } catch(e) {
        __log('error', 'diapo', 'failed to show mediaContainer: ' + e.message);
    }
    
    // Commencer à l'index 0
    currentMediaIndex = 0;
    showMedia(0);
}

/**
 * Arrête la boucle d'affichage
 */
function stopLoopDiapo() {
    if (loopTimeout) {
        clearTimeout(loopTimeout);
        loopTimeout = null;
    }
    
    // Cacher tous les slides
    hideAllSlides();
    
    // Cacher le conteneur de médias et réafficher pageDefault
    try {
        document.getElementById('mediaContainer').classList.remove('active');
        document.getElementById('pageDefault').style.display = 'flex';
    } catch(e) {
        __log('error', 'diapo', 'failed to hide mediaContainer: ' + e.message);
    }
    
    __log('info', 'diapo', 'LoopDiapo stopped');
}

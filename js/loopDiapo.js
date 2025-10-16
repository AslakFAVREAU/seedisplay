
// Local safe logger
if (typeof window !== 'undefined') {
    window.__log = window.__log || function(level, tag, ...args) { try { if (window.logger && typeof window.logger[level] === 'function') return window.logger[level](tag, ...args); if (console && typeof console[level] === 'function') return console[level](tag, ...args); return console.log(tag, ...args) } catch(e){ try{ console.log(tag, ...args) }catch(_){} } }
    var __log = window.__log
} else {
    var __log = function(level, tag, ...args) { try { if (console && typeof console[level] === 'function') return console[level](tag, ...args); return console.log(tag, ...args) } catch(e){ try{ console.log(tag, ...args) }catch(_){} } }
}

/**
 * Système d'affichage OPTIMISÉ avec préchargement et transitions CUT
 * ZERO flash noir - précharge le suivant puis transition instantanée
 * 
 * Note: imgShow, imgLoad, player sont déclarés globalement dans index.html
 * pour être accessibles par defaultScreen.js et autres scripts
 */

let currentMediaIndex = 0;
let mediaLoop = [];
let loopTimeout = null;
let currentVisibleDiv = null; // Track quel div est actuellement visible

// imgShow, player sont maintenant des variables globales (déclarées dans index.html)

/**
 * Cache TOUS les éléments média SAUF celui spécifié
 */
function hideAllMediaExcept(exceptId) {
    try {
        const ids = ['divImg1', 'divImg2', 'divVideo1', 'divVideo2'];
        ids.forEach(id => {
            if (id !== exceptId) {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            }
        });
    } catch(e) {
        __log('error', 'diapo', 'hideAllMediaExcept error: ' + e.message);
    }
}

/**
 * Cache TOUS les éléments média
 */
function hideAllMedia() {
    hideAllMediaExcept(null);
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
    
    if (mediaType === 'video') {
        // Utiliser player (1 ou 2)
        const videoId = 'video' + player;
        const divId = 'divVideo' + player;
        const sourceId = 'srcVideo' + player;
        
        __log('debug', 'diapo', 'loading video in ' + divId);
        
        try {
            const url = pathMedia + mediaFile.replace("%20", '%2520');
            const divEl = document.getElementById(divId);
            const sourceEl = document.getElementById(sourceId);
            const videoEl = document.getElementById(videoId);
            
            // S'assurer que loop est désactivé
            videoEl.loop = false;
            videoEl.removeAttribute('loop');
            
            // Nettoyer les anciens event listeners en clonant
            const newVideoEl = videoEl.cloneNode(true);
            videoEl.parentNode.replaceChild(newVideoEl, videoEl);
            
            // Récupérer les nouveaux éléments
            const freshVideoEl = document.getElementById(videoId);
            const freshSourceEl = document.getElementById(sourceId);
            const freshDivEl = document.getElementById(divId);
            
            // S'assurer que loop est OFF
            freshVideoEl.loop = false;
            freshVideoEl.removeAttribute('loop');
            
            // Charger la vidéo
            freshSourceEl.src = url;
            freshVideoEl.load();
            
            __log('info', 'diapo', 'video load() called, waiting for loadeddata event');
            
            // Fonction pour afficher la vidéo quand prête
            const showVideo = () => {
                __log('debug', 'diapo', 'video ready (loadeddata), displaying');
                hideAllMediaExcept(divId);
                freshDivEl.style.display = 'block';
                currentVisibleDiv = divId;
                
                __log('info', 'diapo', 'video display set, duration=' + freshVideoEl.duration + 's, canplay=' + (freshVideoEl.readyState >= 3));
                
                freshVideoEl.play().catch(e => {
                    __log('error', 'diapo', 'video play() failed: ' + e.message);
                    setTimeout(() => showMedia(currentMediaIndex + 1), 2000);
                });
            };
            
            // Écouter plusieurs événements pour robustesse
            freshVideoEl.addEventListener('loadeddata', showVideo, { once: true });
            
            // Logger le chargement des données
            freshVideoEl.addEventListener('loadstart', () => {
                __log('debug', 'diapo', 'video loadstart event');
            }, { once: true });
            
            freshVideoEl.addEventListener('canplay', () => {
                __log('debug', 'diapo', 'video canplay event (readyState=' + freshVideoEl.readyState + ')');
            });
            
            // Écouter la fin de la vidéo
            freshVideoEl.addEventListener('ended', () => {
                __log('info', 'diapo', 'video ended, next in 200ms');
                setTimeout(() => showMedia(currentMediaIndex + 1), 200);
            }, { once: true });
            
            // Écouter les erreurs
            freshVideoEl.addEventListener('error', (e) => {
                __log('error', 'diapo', 'video error: ' + (e.message || 'load failed'));
                setTimeout(() => showMedia(currentMediaIndex + 1), 2000);
            }, { once: true });
            
            // Toggle pour la prochaine
            player = (player === 1) ? 2 : 1;
            
            // NE PAS programmer de timeout pour les vidéos
            return;
            
        } catch(e) {
            __log('error', 'diapo', 'video error: ' + e.message);
            // Passer au suivant en cas d'erreur
            setTimeout(() => showMedia(currentMediaIndex + 1), 2000);
            return;
        }
        
    } else if (mediaType === 'img') {
        // Utiliser imgShow (1 ou 2)
        const divId = 'divImg' + imgShow;
        
        __log('debug', 'diapo', 'preloading image in ' + divId);
        
        try {
            const url = pathMedia + mediaFile.replace("%20", '%2520');
            const divEl = document.getElementById(divId);
            
            if (!divEl) {
                __log('error', 'diapo', divId + ' NOT FOUND in DOM!');
                return;
            }
            
            // Précharger l'image EN ARRIÈRE-PLAN
            divEl.style.display = 'none';
            
            // Créer un Image object pour précharger
            const img = new Image();
            img.onload = () => {
                __log('debug', 'diapo', 'image preloaded, applying background and switching');
                
                // Appliquer le background
                divEl.style.backgroundImage = "url('" + url + "')";
                
                // TRANSITION CUT : cacher l'ancien, afficher le nouveau INSTANTANÉMENT
                hideAllMediaExcept(divId);
                divEl.style.display = 'block';
                currentVisibleDiv = divId;
                
                __log('info', 'diapo', divId + ' NOW DISPLAYED! (CUT transition)');
            };
            
            img.onerror = () => {
                __log('error', 'diapo', 'image preload failed, trying direct display');
                // Fallback : afficher quand même
                divEl.style.backgroundImage = "url('" + url + "')";
                hideAllMediaExcept(divId);
                divEl.style.display = 'block';
                currentVisibleDiv = divId;
            };
            
            img.src = url;
            
            // Toggle pour la prochaine
            imgShow = (imgShow === 1) ? 2 : 1;
            
        } catch(e) {
            __log('error', 'diapo', 'image error: ' + e.message);
        }
        
        // Programmer le prochain (seulement pour les images)
        __log('debug', 'diapo', 'scheduling next in ' + (delay/1000) + 's');
        loopTimeout = setTimeout(() => {
            showMedia(currentMediaIndex + 1);
        }, delay);
    }
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

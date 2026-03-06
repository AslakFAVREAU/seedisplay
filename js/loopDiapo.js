
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
let pauseLoop = false; // NEW: Flag pour rester sur pageDefault en mode édition
let mediaLoopSignature = '';

// AbortControllers pour nettoyer les event listeners vidéo sans cloner le DOM
let videoAbortControllers = { 1: null, 2: null };

// Expose pour DebugOverlay (trame de lecture)
window._getMediaLoop = () => mediaLoop;
window._getCurrentMediaIndex = () => currentMediaIndex;
window._isOnPageDefault = () => {
    // On est sur pageDefault si l'index dépasse la boucle ou si pageDefault est visible
    try {
        const pd = document.getElementById('pageDefault');
        return pd && pd.style.display !== 'none';
    } catch(e) { return false; }
};

// DEBUG: Variable globale accessible de la console
// Lire DEBUG_MODE depuis preload API si disponible
window.DEBUG_MODE = false; // Change à true pour bloquer sur pageDefault

// Au démarrage, vérifier si DEBUG_MODE est passé par npm
(async () => {
    try {
        if (window.api && window.api.getEnv) {
            const debugEnv = await window.api.getEnv('DEBUG_MODE');
            if (debugEnv === 'true') {
                window.DEBUG_MODE = true;
                __log('info', 'diapo', '🔧 DEBUG_MODE activated via npm start:debug');
            }
        }
    } catch(e) {
        // Silently fail if API not available
    }
})();

/**
 * Cache TOUS les éléments média SAUF celui spécifié
 */
function hideAllMediaExcept(exceptId) {
    try {
        const ids = ['divImg1', 'divImg2', 'divVideo1', 'divVideo2'];
        ids.forEach(id => {
            if (id !== exceptId) {
                const el = document.getElementById(id);
                if (el) {
                    el.style.display = 'none';
                    // Libérer la mémoire des images en arrière-plan (utile sur machines à 8 Go)
                    if (id.startsWith('divImg') && el.style.backgroundImage && el.style.backgroundImage !== "url('default.jpg')") {
                        el.style.backgroundImage = '';
                    }
                }
            }
        });
        // Cacher aussi le template sauf si c'est lui qu'on veut afficher
        if (exceptId !== 'templateContainer' && window.templateRenderer) {
            window.templateRenderer.hide();
        }
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
 * Précharge la prochaine vidéo dans le player inactif
 * pendant que la vidéo courante est en lecture.
 * Réduit le temps de transition entre deux vidéos consécutives.
 */
function _preloadNextVideo(currentIndex) {
    try {
        if (!mediaLoop || mediaLoop.length === 0) return;
        
        // Trouver le prochain média
        const nextIndex = currentIndex + 1;
        if (nextIndex >= mediaLoop.length) return; // fin de boucle, pas de preload
        
        const nextMedia = mediaLoop[nextIndex];
        if (!nextMedia || !Array.isArray(nextMedia) || nextMedia.length < 2) return;
        if (nextMedia[0] !== 'video') return; // preload seulement les vidéos
        
        const nextFile = nextMedia[1];
        // Le player inactif est celui qu'on va utiliser (déjà toggleé)
        const nextPlayer = player; // player a déjà été toggleé
        const nextVideoId = 'video' + nextPlayer;
        const nextSourceId = 'srcVideo' + nextPlayer;
        const nextVideoEl = document.getElementById(nextVideoId);
        const nextSourceEl = document.getElementById(nextSourceId);
        
        if (!nextVideoEl || !nextSourceEl) return;
        
        const nextUrl = typeof getMediaUrl === 'function' ? getMediaUrl(nextFile) : pathMedia + nextFile;
        
        // Ne précharger que si la source est différente
        if (nextSourceEl.src && nextSourceEl.src.endsWith(nextFile)) return;
        
        __log('debug', 'diapo', 'preloading next video in ' + nextVideoId + ': ' + nextFile);
        nextVideoEl.preload = 'auto';
        nextVideoEl.muted = window.sonActif !== true;
        nextSourceEl.src = nextUrl;
        nextVideoEl.load();
    } catch (e) {
        __log('warn', 'diapo', 'preloadNextVideo error (non-fatal): ' + e.message);
    }
}

/**
 * Affiche un média - version robuste avec vérification de téléchargement
 */
async function showMedia(mediaIndex) {
    if (window.DEBUG_MODE) {
        __log('info', 'diapo', 'DEBUG_MODE=true - staying on pageDefault');
        return;
    }
    
    if (pauseLoop) {
        __log('info', 'diapo', 'pauseLoop is TRUE - staying on pageDefault');
        return;
    }
    
    if (!mediaLoop || mediaLoop.length === 0) {
        __log('warn', 'diapo', 'no media to display');
        defaultScreen();
        return;
    }
    
    // Wrap-around - afficher pageDefault entre chaque cycle (sauf si masquerPageDefault)
    if (mediaIndex >= mediaLoop.length) {
        __log('info', 'diapo', 'wrap-around detected: index=' + mediaIndex + ' length=' + mediaLoop.length);
        
        // Vérifier les mises à jour à chaque fin de boucle (non bloquant)
        try {
            if (window.api && typeof window.api.checkForUpdates === 'function') {
                __log('debug', 'diapo', 'loop end: checking for app updates...');
                window.api.checkForUpdates().then(res => {
                    if (res && res.updateInfo && res.updateInfo.version) {
                        __log('info', 'diapo', 'update available: v' + res.updateInfo.version);
                    }
                }).catch(() => {});
            }
        } catch (e) { /* silently ignore */ }
        
        // Si masquerPageDefault est activé, boucler directement sans pause
        if (window.masquerPageDefault) {
            __log('info', 'diapo', 'end of loop, masquerPageDefault=true, looping immediately');
            showMedia(0);
            return;
        }
        
        __log('info', 'diapo', 'end of loop, showing pageDefault then restarting');
        
        // Cacher tous les médias
        hideAllMedia();
        
        // Cacher le container, afficher pageDefault
        document.getElementById('mediaContainer').style.display = 'none';
        document.getElementById('pageDefault').style.display = 'flex';
        
        // Redémarrer après 10 secondes
        loopTimeout = setTimeout(() => {
            // pageDefault sera caché par showMedia() une fois le premier média prêt (évite flash noir)
            document.getElementById('mediaContainer').style.display = 'block';
            showMedia(0);
        }, 10000);
        
        return;
    }
    
    const media = mediaLoop[mediaIndex];
    
    // Protection: vérifier que le média existe et a le bon format
    if (!media || !Array.isArray(media) || media.length < 2) {
        __log('error', 'diapo', 'Invalid media at index ' + mediaIndex + ':', JSON.stringify(media));
        // Passer au suivant ou redémarrer la boucle
        if (mediaIndex + 1 < mediaLoop.length) {
            setTimeout(() => showMedia(mediaIndex + 1), 100);
        } else {
            __log('warn', 'diapo', 'End of loop reached with invalid media, restarting');
            setTimeout(() => showMedia(0), 1000);
        }
        return;
    }
    
    const mediaType = media[0];
    const mediaFile = media[1];
    const delay = (media[2] && Number(media[2]) > 0) ? Number(media[2]) * 1000 : 5000;
    const metadata = media[3] || {}; // Métadonnées enrichies (mediaId, diapoId, etc.)
    
    currentMediaIndex = mediaIndex;
    
    __log('info', 'diapo', 'showing #' + mediaIndex + '/' + mediaLoop.length + ' type=' + mediaType + ' file=' + mediaFile + ' delay=' + (delay/1000) + 's');
    
    // Playback Logger: Enregistrement précis pour régie pub
    if (window.playbackLogger) {
        window.playbackLogger.startMedia({
            mediaId: metadata.mediaId,
            mediaNom: metadata.mediaNom,
            mediaFichier: decodeURIComponent(mediaFile),
            mediaType: mediaType,
            diapoId: metadata.diapoId,
            diapoNom: metadata.diapoNom,
            duree: delay / 1000
        });
    }
    
    // Stats: Track media display (legacy)
    if (window.statsManager) {
        const mediaId = metadata.mediaId || mediaFile;
        window.statsManager.startMedia(mediaId, mediaFile, mediaType);
    }
    
    if (mediaType === 'video') {
        // Utiliser player (1 ou 2)
        const videoId = 'video' + player;
        const divId = 'divVideo' + player;
        const sourceId = 'srcVideo' + player;
        
        __log('debug', 'diapo', 'loading video in ' + divId);
        
        // Vérifier que la vidéo existe localement, sinon télécharger
        try {
            const decodedVideoFile = decodeURIComponent(mediaFile);
            const relativePath = 'media/' + decodedVideoFile;
            const exists = window.api && window.api.existsSync ? window.api.existsSync(relativePath) : true;
            if (!exists) {
                __log('warn', 'diapo', 'video not cached, downloading: ' + decodedVideoFile);
                const baseUrl = typeof getMediaBaseUrl === 'function' ? getMediaBaseUrl() : 'https://soek.fr/uploads/see/media/';
                if (window.api && window.api.saveBinaryWithCache) {
                    await window.api.saveBinaryWithCache(relativePath, baseUrl + mediaFile);
                } else if (window.api && window.api.saveBinary) {
                    await window.api.saveBinary(relativePath, baseUrl + mediaFile);
                }
            }
        } catch (dlErr) {
            __log('warn', 'diapo', 'video download check failed: ' + dlErr.message);
        }
        
        try {
            const url = typeof getMediaUrl === 'function' ? getMediaUrl(mediaFile) : pathMedia + mediaFile;
            const videoEl = document.getElementById(videoId);
            const sourceEl = document.getElementById(sourceId);
            const divEl = document.getElementById(divId);
            
            // Annuler les listeners précédents via AbortController (plus léger que cloneNode)
            if (videoAbortControllers[player]) {
                videoAbortControllers[player].abort();
            }
            const ac = new AbortController();
            videoAbortControllers[player] = ac;
            const signal = ac.signal;
            
            // S'assurer que loop est désactivé
            videoEl.loop = false;
            videoEl.removeAttribute('loop');
            
            // Gérer le son selon sonActif de l'API
            videoEl.muted = window.sonActif !== true;
            __log('info', 'diapo', 'video muted=' + videoEl.muted + ' (sonActif=' + window.sonActif + ')');
            
            // Charger la vidéo
            sourceEl.src = url;
            videoEl.load();
            
            __log('info', 'diapo', 'video load() called, waiting for loadeddata event');
            
            // Fonction pour afficher la vidéo quand prête
            const showVideo = () => {
                if (signal.aborted) return;
                __log('debug', 'diapo', 'video ready (loadeddata), displaying');
                // Afficher le nouveau div AVANT de cacher les anciens (évite flash noir)
                divEl.style.display = 'block';
                currentVisibleDiv = divId;
                hideAllMediaExcept(divId);
                // Cacher pageDefault maintenant que le média est prêt
                try { const pd = document.getElementById('pageDefault'); if (pd && pd.style.display !== 'none') { pd.style.display = 'none'; __log('info', 'diapo', 'pageDefault hidden (first media ready)'); } } catch(e) {}
                
                __log('info', 'diapo', 'video display set, duration=' + videoEl.duration + 's, canplay=' + (videoEl.readyState >= 3));
                
                videoEl.play().catch(e => {
                    __log('error', 'diapo', 'video play() failed: ' + e.message);
                    setTimeout(() => showMedia(currentMediaIndex + 1), 2000);
                });
                
                // Précharger le prochain média dans le player inactif
                _preloadNextVideo(mediaIndex);
            };
            
            // Flag pour éviter double exécution
            let videoStarted = false;
            
            // Écouter plusieurs événements pour robustesse (via AbortController)
            videoEl.addEventListener('loadeddata', () => {
                if (!videoStarted && !signal.aborted) {
                    videoStarted = true;
                    showVideo();
                }
            }, { once: true, signal });
            
            // Fallback sur canplaythrough si loadeddata ne se déclenche pas
            videoEl.addEventListener('canplaythrough', () => {
                if (!videoStarted && !signal.aborted) {
                    __log('warn', 'diapo', 'video canplaythrough fallback (loadeddata missed)');
                    videoStarted = true;
                    showVideo();
                }
            }, { once: true, signal });
            
            // TIMEOUT FALLBACK: si la vidéo ne charge pas en 10s, passer au suivant
            const videoTimeout = setTimeout(() => {
                if (!videoStarted && !signal.aborted) {
                    __log('error', 'diapo', 'video timeout after 10s, skipping to next');
                    videoStarted = true;
                    showMedia(currentMediaIndex + 1);
                }
            }, 10000);
            
            // Annuler le timeout si la vidéo démarre
            videoEl.addEventListener('playing', () => clearTimeout(videoTimeout), { once: true, signal });
            
            // Logger le chargement des données
            videoEl.addEventListener('loadstart', () => {
                __log('debug', 'diapo', 'video loadstart event');
            }, { once: true, signal });
            
            videoEl.addEventListener('canplay', () => {
                __log('debug', 'diapo', 'video canplay event (readyState=' + videoEl.readyState + ')');
            }, { signal });
            
            // Écouter la fin de la vidéo
            videoEl.addEventListener('ended', () => {
                if (signal.aborted) return;
                __log('info', 'diapo', 'video ended, next in 100ms');
                clearTimeout(videoTimeout);
                setTimeout(() => showMedia(currentMediaIndex + 1), 100);
            }, { once: true, signal });
            
            // Écouter les erreurs
            videoEl.addEventListener('error', (e) => {
                if (signal.aborted) return;
                __log('error', 'diapo', 'video error: ' + (e.message || 'load failed'));
                clearTimeout(videoTimeout);
                setTimeout(() => showMedia(currentMediaIndex + 1), 2000);
            }, { once: true, signal });
            
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
        
        // Vérifier que le fichier existe localement, sinon le télécharger d'abord
        const ensureMediaReady = async (fileName) => {
            try {
                // Decode URI-encoded filename for disk path
                const decodedFile = decodeURIComponent(fileName);
                const relativePath = 'media/' + decodedFile;
                const exists = window.api && window.api.existsSync ? window.api.existsSync(relativePath) : true;
                if (exists) return true;
                
                __log('warn', 'diapo', 'media not cached locally, downloading: ' + decodedFile);
                const baseUrl = typeof getMediaBaseUrl === 'function' ? getMediaBaseUrl() : 'https://soek.fr/uploads/see/media/';
                if (window.api && window.api.saveBinaryWithCache) {
                    const res = await window.api.saveBinaryWithCache(relativePath, baseUrl + fileName);
                    return res && res.success;
                } else if (window.api && window.api.saveBinary) {
                    await window.api.saveBinary(relativePath, baseUrl + fileName);
                    return true;
                }
                return false;
            } catch (e) {
                __log('error', 'diapo', 'ensureMediaReady error: ' + e.message);
                return false;
            }
        };
        
        // Lancer le check+download en async, mais ne PAS attendre indéfiniment
        const doShowImage = () => {
            try {
                const url = typeof getMediaUrl === 'function' ? getMediaUrl(mediaFile) : pathMedia + mediaFile;
                const divEl = document.getElementById(divId);
                
                if (!divEl) {
                    __log('error', 'diapo', divId + ' NOT FOUND in DOM!');
                    return;
                }
                
                // Créer un Image object pour précharger
                const img = new Image();
                let imageHandled = false;
                
                img.onload = () => {
                    if (imageHandled) return;
                    imageHandled = true;
                    __log('debug', 'diapo', 'image preloaded OK, switching');
                    divEl.style.backgroundImage = "url('" + url + "')";
                    // Afficher le nouveau div AVANT de cacher les anciens (évite flash noir)
                    divEl.style.display = 'block';
                    currentVisibleDiv = divId;
                    hideAllMediaExcept(divId);
                    // Cacher pageDefault maintenant que le média est prêt
                    try { const pd = document.getElementById('pageDefault'); if (pd && pd.style.display !== 'none') { pd.style.display = 'none'; __log('info', 'diapo', 'pageDefault hidden (first media ready)'); } } catch(e) {}
                    __log('info', 'diapo', divId + ' NOW DISPLAYED! (CUT transition)');
                    
                    // Programmer le prochain APRÈS affichage réel (pas avant)
                    __log('debug', 'diapo', 'scheduling next in ' + (delay/1000) + 's (after display)');
                    loopTimeout = setTimeout(() => {
                        showMedia(currentMediaIndex + 1);
                    }, delay);
                };
                
                img.onerror = () => {
                    if (imageHandled) return;
                    imageHandled = true;
                    __log('error', 'diapo', 'image preload failed for ' + mediaFile + ', skipping');
                    // Annuler le timer de défilement normal
                    if (loopTimeout) { clearTimeout(loopTimeout); loopTimeout = null; }
                    // Passer au suivant au lieu d'afficher un écran noir
                    setTimeout(() => showMedia(currentMediaIndex + 1), 500);
                };
                
                // Timeout de sécurité : si l'image ne charge pas en 8s, skip
                setTimeout(() => {
                    if (!imageHandled) {
                        imageHandled = true;
                        __log('error', 'diapo', 'image load timeout for ' + mediaFile + ', skipping');
                        if (loopTimeout) { clearTimeout(loopTimeout); loopTimeout = null; }
                        setTimeout(() => showMedia(currentMediaIndex + 1), 200);
                    }
                }, 8000);
                
                img.src = url;
            } catch(e) {
                __log('error', 'diapo', 'image error: ' + e.message);
                setTimeout(() => showMedia(currentMediaIndex + 1), 500);
            }
        };
        
        // Vérifier et télécharger si nécessaire, puis afficher
        ensureMediaReady(mediaFile).then(ok => {
            if (!ok) {
                __log('warn', 'diapo', 'media still not available after download attempt: ' + mediaFile);
            }
            doShowImage();
        }).catch(() => doShowImage());
        
        // Toggle pour la prochaine
        imgShow = (imgShow === 1) ? 2 : 1;
        
        // Le timer est maintenant programmé dans img.onload (après affichage réel)
        
    } else if (mediaType === 'template') {
        // Afficher un template dynamique (événement, planning, etc.)
        const templateData = media[1]; // templateData object from API
        
        __log('info', 'diapo', 'rendering template type=' + (templateData.type || 'unknown'));
        
        try {
            // Cacher tous les autres médias
            hideAllMedia();
            // Cacher pageDefault si encore visible (template a z-index supérieur mais on nettoie)
            try { const pd = document.getElementById('pageDefault'); if (pd && pd.style.display !== 'none') pd.style.display = 'none'; } catch(e) {}
            
            // Utiliser le TemplateRenderer global
            if (window.templateRenderer) {
                // await la Promise de show() — elle se résout quand le template a fini
                // (inclut le temps de fetch pour trafic/meteo + la durée d'affichage)
                window.templateRenderer.show(templateData, delay / 1000).then(() => {
                    showMedia(currentMediaIndex + 1);
                }).catch((e) => {
                    __log('error', 'diapo', 'template show error: ' + (e && e.message));
                    showMedia(currentMediaIndex + 1);
                });
            } else {
                __log('error', 'diapo', 'templateRenderer not available');
                // Fallback: passer au suivant
                setTimeout(() => showMedia(currentMediaIndex + 1), 2000);
                return;
            }
            
        } catch(e) {
            __log('error', 'diapo', 'template render error: ' + e.message);
            setTimeout(() => showMedia(currentMediaIndex + 1), 2000);
            return;
        }
        
        // Le passage au suivant est géré par le .then() ci-dessus
        // (plus besoin de setTimeout dupliqué)
        
    } else if (mediaType === 'planning') {
        // Afficher le planning du jour (mode fullscreen intégré à la boucle)
        __log('info', 'diapo', 'rendering planning in loop mode');
        
        try {
            // Cacher tous les autres médias
            hideAllMedia();
            // Cacher pageDefault si encore visible
            try { const pd = document.getElementById('pageDefault'); if (pd && pd.style.display !== 'none') pd.style.display = 'none'; } catch(e) {}
            
            // Utiliser le PlanningManager global
            if (window.planningManager) {
                // Initialiser si pas encore fait
                if (!window.planningManager.container) {
                    window.planningManager.init();
                }
                
                // Configurer le style fullscreen
                const container = window.planningManager.container;
                if (container) {
                    container.style.cssText = `
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        z-index: 500;
                        background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ed 100%);
                    `;
                }
                
                // Afficher le planning (avec la durée)
                window.planningManager.show(delay / 1000);
            } else {
                __log('error', 'diapo', 'planningManager not available');
                // Fallback: passer au suivant
                setTimeout(() => showMedia(currentMediaIndex + 1), 2000);
                return;
            }
            
        } catch(e) {
            __log('error', 'diapo', 'planning render error: ' + e.message);
            setTimeout(() => showMedia(currentMediaIndex + 1), 2000);
            return;
        }
        
        // Programmer le prochain après la durée du planning
        __log('debug', 'diapo', 'scheduling next after planning in ' + (delay/1000) + 's');
        loopTimeout = setTimeout(() => {
            // Cacher le planning avant de passer au suivant
            if (window.planningManager) {
                window.planningManager.hide();
            }
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
    
    // CHECK DEBUG_MODE FIRST - si activé, rester sur pageDefault
    if (window.DEBUG_MODE) {
        __log('info', 'diapo', '🔧 DEBUG_MODE=true - staying on pageDefault, NOT starting loop');
        try {
            document.getElementById('pageDefault').style.display = 'flex';
            const container = document.getElementById('mediaContainer');
            if (container) container.style.display = 'none';
        } catch(e) {
            __log('error', 'diapo', 'debug mode setup error: ' + e.message);
        }
        return;
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
        // pageDefault reste visible en arrière-plan pendant le chargement du premier média
        // Il sera caché par showMedia() une fois le média prêt (évite flash noir)
        __log('info', 'diapo', 'pageDefault kept visible until first media ready');
        
        const container = document.getElementById('mediaContainer');
        if (!container) {
            __log('error', 'diapo', 'mediaContainer NOT FOUND!');
            return;
        }
        
        container.style.display = 'block';
        __log('info', 'diapo', 'mediaContainer displayed (transparent bg), computed style: ' + window.getComputedStyle(container).display);
        
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

/**
 * Calculer une signature simple de la boucle pour détecter les changements
 */
function computeMediaSignature(list) {
    try {
        if (!list || !Array.isArray(list)) return ''
        return list.map(item => {
            if (!item || !Array.isArray(item)) return ''
            const type = item[0] || ''
            const file = item[1] || ''
            const duration = item[2] || ''
            return `${type}:${file}:${duration}`
        }).join('|')
    } catch (e) {
        return ''
    }
}

/**
 * Appliquer une mise à jour de diapos à chaud
 * Télécharge les nouveaux médias AVANT de relancer la boucle
 */
async function applyDiapoUpdate(newList) {
    try {
        const nextSignature = computeMediaSignature(newList)
        const hasChanged = nextSignature !== mediaLoopSignature

        if (!newList || !Array.isArray(newList) || newList.length === 0) {
            __log('warn', 'diapo', 'applyDiapoUpdate: no media available, stopping loop')
            if (loopTimeout) {
                clearTimeout(loopTimeout)
                loopTimeout = null
            }
            hideAllMedia()

            const container = document.getElementById('mediaContainer')
            const pageDefault = document.getElementById('pageDefault')
            if (window.masquerPageDefault) {
                if (container) container.style.display = 'none'
                if (pageDefault) pageDefault.style.display = 'none'
            } else {
                if (container) container.style.display = 'none'
                if (pageDefault) pageDefault.style.display = 'flex'
            }
            mediaLoop = []
            mediaLoopSignature = nextSignature
            return
        }

        if (!hasChanged) {
            return
        }

        __log('info', 'diapo', 'applyDiapoUpdate: media list changed (' + newList.length + ' items)')

        // Télécharger les nouveaux médias AVANT de relancer la boucle
        if (typeof window.downloadAllMedia === 'function') {
            __log('info', 'diapo', 'applyDiapoUpdate: downloading new media before restart...')
            await window.downloadAllMedia(newList, 20000)
        }

        mediaLoop = newList
        mediaLoopSignature = nextSignature

        if (window.DEBUG_MODE || pauseLoop) {
            __log('info', 'diapo', 'applyDiapoUpdate: loop paused/debug, not auto-starting')
            return
        }

        // Prefetch les données trafic pour éviter le spinner
        _prefetchTraficTemplates(newList);
        
        __log('info', 'diapo', 'applyDiapoUpdate: restarting loop')
        LoopDiapo()
    } catch (e) {
        __log('error', 'diapo', 'applyDiapoUpdate error: ' + e.message)
    }
}

/**
 * Prefetch les données trafic si la boucle contient un template trafic.
 * Appelé dès que la liste de médias est chargée, AVANT affichage.
 */
function _prefetchTraficTemplates(mediaList) {
    if (!mediaList || !Array.isArray(mediaList)) return;
    try {
        for (const item of mediaList) {
            if (!item || item[0] !== 'template') continue;
            const tplData = item[1];
            if (tplData && tplData.type === 'trafic' && tplData.arrets && tplData.apiKey) {
                __log('info', 'diapo', 'prefetching trafic departures in background...');
                if (window.templateRenderer) {
                    window.templateRenderer.prefetchTrafic(tplData);
                }
                break; // Un seul template trafic à la fois
            }
        }
    } catch(e) {
        __log('debug', 'diapo', 'prefetch trafic error: ' + e.message);
    }
}

// Expose helpers for refresh logic
if (typeof window !== 'undefined') {
    window.LoopDiapo = LoopDiapo
    window.stopLoopDiapo = stopLoopDiapo
    window.applyDiapoUpdate = applyDiapoUpdate
}

/**
 * PAUSE sur pageDefault - reste bloqué pour édition graphique via DevTools
 * Utilisation: pauseOnPageDefault() dans la console DevTools
 */
function pauseOnPageDefault() {
    __log('info', 'diapo', 'PAUSE: locking on pageDefault for graphic editing');
    
    pauseLoop = true;
    
    if (loopTimeout) {
        clearTimeout(loopTimeout);
        loopTimeout = null;
    }
    
    // Cacher tous les médias
    hideAllMedia();
    
    // Afficher pageDefault et le garder visible
    try {
        const container = document.getElementById('mediaContainer');
        if (container) {
            container.style.display = 'none';
        }
        const pageDefault = document.getElementById('pageDefault');
        pageDefault.style.display = 'flex';
        __log('info', 'diapo', 'PAUSED on pageDefault - use resumeLoop() to continue');
    } catch(e) {
        __log('error', 'diapo', 'pause error: ' + e.message);
    }
}

/**
 * Reprend la boucle après pauseOnPageDefault()
 * Utilisation: resumeLoop() dans la console DevTools
 */
function resumeLoop() {
    __log('info', 'diapo', 'RESUME: unlocking loop');
    
    pauseLoop = false;
    
    // Redémarrer la boucle
    try {
        // pageDefault sera caché par showMedia() quand le premier média est prêt
        const container = document.getElementById('mediaContainer');
        if (container) {
            container.style.display = 'block';
        }
        showMedia(0);
        __log('info', 'diapo', 'loop resumed');
    } catch(e) {
        __log('error', 'diapo', 'resume error: ' + e.message);
    }
}

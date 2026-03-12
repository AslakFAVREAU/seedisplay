
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

// ─── Santé vidéo — exposé au heartbeat via window._videoHealth ───────────────
window._videoHealth = {
    errorCount:      0,   // total erreurs MediaError cette session
    skippedCount:    0,   // vidéos sautées (erreur non récupérable)
    redownloadCount: 0,   // re-téléchargements forcés réussis
    lastError:       null, // { file, code, label, reason, ts }
    lastSuccess:     null, // ISO timestamp de la dernière vidéo lue jusqu'au bout
    lastFile:        null  // dernier fichier tenté
};

// ─── Blacklist vidéo — skip auto après N échecs DECODE/SRC_NOT_SUPPORTED ─────
// Clé: filename, Valeur: { count, label, reason, ts }
window._videoBlacklist = {};
const VIDEO_BLACKLIST_THRESHOLD = 3; // après 3 DECODE → skip immédiat

// ─── Détection codecs supportés — remonté dans le heartbeat ─────────────────
(function _detectSupportedCodecs() {
    try {
        const v = document.createElement('video');
        const codecs = {
            'h264-baseline': v.canPlayType('video/mp4; codecs="avc1.42E01E"'),
            'h264-main':     v.canPlayType('video/mp4; codecs="avc1.4D401E"'),
            'h264-high':     v.canPlayType('video/mp4; codecs="avc1.640028"'),
            'h265':          v.canPlayType('video/mp4; codecs="hev1.1.6.L93.B0"'),
            'vp8':           v.canPlayType('video/webm; codecs="vp8"'),
            'vp9':           v.canPlayType('video/webm; codecs="vp9"'),
            'av1':           v.canPlayType('video/mp4; codecs="av01.0.01M.08"'),
            'aac':           v.canPlayType('audio/mp4; codecs="mp4a.40.2"'),
            'opus':          v.canPlayType('audio/webm; codecs="opus"'),
            'mp3':           v.canPlayType('audio/mpeg'),
            'ac3':           v.canPlayType('audio/mp4; codecs="ac-3"'),
            'eac3':          v.canPlayType('audio/mp4; codecs="ec-3"')
        };
        const supported = {};
        const unsupported = [];
        for (const [name, result] of Object.entries(codecs)) {
            if (result) { supported[name] = result; } else { unsupported.push(name); }
        }
        window._supportedCodecs = { supported, unsupported, raw: codecs };
        __log('info', 'diapo', 'Codecs supportés: ' + Object.keys(supported).join(', '));
        if (unsupported.length) __log('info', 'diapo', 'Codecs NON supportés: ' + unsupported.join(', '));
    } catch (e) {
        window._supportedCodecs = null;
    }
})();

/**
 * Signale une erreur vidéo dans window._videoHealth ET dans ErrorHandler.
 * Toutes les erreurs vidéo remontent ainsi dans le heartbeat SOEK.
 */
function _reportVideoError(file, code, label, reason) {
    const ts = new Date().toISOString();
    if (!window._videoHealth) window._videoHealth = { errorCount: 0, skippedCount: 0, redownloadCount: 0 };
    window._videoHealth.errorCount++;
    window._videoHealth.lastError = { file, code, label, reason, ts };
    if (window.errorHandler && typeof window.errorHandler.logError === 'function') {
        window.errorHandler.logError(
            new Error('[video:' + label + '] ' + reason + ' — ' + file),
            { operation: 'video-playback', type: label, source: file }
        );
    }
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── Santé image — exposé au heartbeat via window._imageHealth ───────────────
window._imageHealth = {
    errorCount:   0,   // total erreurs de chargement cette session
    skippedCount: 0,   // images sautées (erreur non récupérable)
    lastError:    null, // { file, label, reason, ts }
    lastSuccess:  null, // ISO timestamp de la dernière image affichée avec succès
    lastFile:     null  // dernier fichier tenté
};

/**
 * Signale une erreur image dans window._imageHealth ET dans ErrorHandler.
 */
function _reportImageError(file, label, reason) {
    const ts = new Date().toISOString();
    if (!window._imageHealth) window._imageHealth = { errorCount: 0, skippedCount: 0 };
    window._imageHealth.errorCount++;
    window._imageHealth.lastError = { file, label, reason, ts };
    if (window.errorHandler && typeof window.errorHandler.logError === 'function') {
        window.errorHandler.logError(
            new Error('[image:' + label + '] ' + reason + ' — ' + file),
            { operation: 'image-display', type: label, source: file }
        );
    }
}
// ─────────────────────────────────────────────────────────────────────────────

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
    // Préchargement désactivé — chaque lecture crée un élément vidéo neuf (cloneNode)
    // Le preload sur un élément réutilisé corrompt le pipeline décodeur de Chromium
    // → PIPELINE_ERROR_DECODE audio/vidéo au passage suivant
    return;
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
            // setTimeout pour éviter un stack overflow si tous les médias échouent (recursion infinie)
            setTimeout(() => showMedia(0), 100);
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
        // ── Blacklist check: skip immédiat si DECODE/SRC échoue N fois ──
        const bl = window._videoBlacklist && window._videoBlacklist[mediaFile];
        if (bl && bl.count >= VIDEO_BLACKLIST_THRESHOLD) {
            __log('warn', 'diapo', 'video BLACKLISTED (' + bl.count + ' x ' + bl.label + '), skip: ' + mediaFile);
            if (window._videoHealth) window._videoHealth.skippedCount++;
            setTimeout(() => showMedia(currentMediaIndex + 1), 100);
            return;
        }

        // Utiliser player (1 ou 2)
        const videoId = 'video' + player;
        const divId = 'divVideo' + player;
        
        __log('debug', 'diapo', 'loading video in ' + divId);
        
        // Tracker le fichier courant pour le health monitoring
        if (window._videoHealth) window._videoHealth.lastFile = mediaFile;

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
            _reportVideoError(mediaFile, 0, 'DOWNLOAD_FAILED', dlErr.message);
        }
        
        try {
            const url = typeof getMediaUrl === 'function' ? getMediaUrl(mediaFile) : pathMedia + mediaFile;
            const divEl = document.getElementById(divId);
            
            // Annuler les listeners/timers du player précédent
            if (videoAbortControllers[player]) {
                videoAbortControllers[player].abort();
            }
            const ac = new AbortController();
            videoAbortControllers[player] = ac;
            const signal = ac.signal;
            
            // ── CLONE NODE: créer un élément vidéo neuf à chaque lecture ──
            // C'est la SEULE solution fiable pour éviter PIPELINE_ERROR_DECODE
            // Chromium réutilise les décodeurs matériels audio/vidéo sur un même
            // élément, ce qui corrompt le pipeline au 2ème passage.
            const oldVideoEl = document.getElementById(videoId);
            const newVideoEl = document.createElement('video');
            newVideoEl.id = videoId;
            newVideoEl.className = 'videoPlayer';
            newVideoEl.setAttribute('width', '100%');
            newVideoEl.setAttribute('height', '100%');
            newVideoEl.setAttribute('preload', 'auto');
            newVideoEl.setAttribute('playsinline', '');
            newVideoEl.setAttribute('disablePictureInPicture', '');
            newVideoEl.setAttribute('disableRemotePlayback', '');
            newVideoEl.loop = false;
            newVideoEl.muted = window.sonActif !== true;
            
            // Remplacer l'ancien élément dans le DOM
            if (oldVideoEl && oldVideoEl.parentNode) {
                oldVideoEl.pause();
                oldVideoEl.removeAttribute('src');
                oldVideoEl.load(); // libérer le décodeur
                oldVideoEl.parentNode.replaceChild(newVideoEl, oldVideoEl);
            } else {
                divEl.innerHTML = '';
                divEl.appendChild(newVideoEl);
            }
            
            // Utiliser video.src directement (pas de <source>)
            const videoEl = newVideoEl;
            
            __log('info', 'diapo', 'video muted=' + videoEl.muted + ' (sonActif=' + window.sonActif + ')');
            
            // Charger la vidéo
            videoEl.src = url;
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
                    if (signal.aborted) return; // déjà géré par un autre chemin
                    __log('error', 'diapo', 'video play() failed: ' + e.message);
                    _reportVideoError(mediaFile, 0, 'PLAY_FAILED', e.message);
                    if (window._videoHealth) window._videoHealth.skippedCount++;
                    ac.abort(); // empêche error/ended de doubler l'avance
                    setTimeout(() => showMedia(currentMediaIndex + 1), 2000);
                });
                
                // Précharger le prochain média dans le player inactif
                _preloadNextVideo(mediaIndex);
            };
            
            // Flag pour éviter double exécution
            let videoStarted = false;
            // Flag pour n'effectuer qu'un seul retry de re-téléchargement
            let videoRetried = false;
            // Timer stalled (lecture bloquée réseau)
            let stalledTimer = null;
            
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
                    _reportVideoError(mediaFile, 0, 'LOAD_TIMEOUT', 'no loadeddata after 10s');
                    if (window._videoHealth) window._videoHealth.skippedCount++;
                    // Abort AVANT showMedia pour empêcher l'event 'error' de doubler l'avance
                    ac.abort();
                    showMedia(currentMediaIndex + 1);
                }
            }, 10000);
            
            // Nettoyer tous les timers quand la lecture (re)démarre
            videoEl.addEventListener('playing', () => {
                clearTimeout(videoTimeout);
                if (stalledTimer) { clearTimeout(stalledTimer); stalledTimer = null; }
            }, { signal });
            
            // STALLED: lecture bloquée réseau en cours de lecture
            videoEl.addEventListener('stalled', () => {
                if (signal.aborted) return;
                __log('warn', 'diapo', 'video stalled (network blocked) — ' + mediaFile);
                if (stalledTimer) clearTimeout(stalledTimer);
                stalledTimer = setTimeout(() => {
                    if (signal.aborted) return;
                    __log('error', 'diapo', 'video stalled timeout (10s), skipping to next');
                    _reportVideoError(mediaFile, 2, 'STALLED_TIMEOUT', 'playback stalled >10s');
                    if (window._videoHealth) window._videoHealth.skippedCount++;
                    // Abort AVANT showMedia pour empêcher l'event 'ended' de doubler l'avance
                    ac.abort();
                    showMedia(currentMediaIndex + 1);
                }, 10000);
            }, { signal });
            
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
                if (stalledTimer) { clearTimeout(stalledTimer); stalledTimer = null; }
                // Marquer le succès de lecture complète
                if (window._videoHealth) window._videoHealth.lastSuccess = new Date().toISOString();
                setTimeout(() => showMedia(currentMediaIndex + 1), 100);
            }, { once: true, signal });
            
            // Écouter les erreurs — avec retry automatique (re-téléchargement)
            videoEl.addEventListener('error', async (e) => {
                if (signal.aborted) return;
                clearTimeout(videoTimeout);
                if (stalledTimer) { clearTimeout(stalledTimer); stalledTimer = null; }
                
                // MediaError codes: 1=ABORTED 2=NETWORK 3=DECODE 4=SRC_NOT_SUPPORTED
                const errCode  = videoEl.error ? videoEl.error.code : 0;
                const errMsg   = videoEl.error ? videoEl.error.message : (e.message || 'unknown');
                const errLabel = ['', 'ABORTED', 'NETWORK', 'DECODE', 'SRC_NOT_SUPPORTED'][errCode] || 'UNKNOWN';
                
                // ABORTED (code 1) = déclenché par notre propre videoEl.load() lors d'un retry.
                // Ce n'est pas une vraie erreur — ignorer pour laisser le nouveau load() aboutir.
                if (errCode === 1) {
                    __log('debug', 'diapo', 'video ABORTED (code 1) — ignoré (propre à load() interne)');
                    return;
                }
                
                __log('error', 'diapo', 'video error code=' + errCode + ' (' + errLabel + '): ' + errMsg + ' file=' + mediaFile);
                
                // Signaler l'erreur immédiatement (avant retry) → remonte dans heartbeat
                _reportVideoError(mediaFile, errCode, errLabel, errMsg);
                
                // DECODE (3) et SRC_NOT_SUPPORTED (4) : peut être codec incompatible
                // OU fichier corrompu/tronqué. On tente UN re-download avant de blacklister.
                if (errCode === 3 || errCode === 4) {
                    if (!window._videoBlacklist) window._videoBlacklist = {};
                    const blEntry = window._videoBlacklist[mediaFile] || { count: 0, redownloaded: false };
                    blEntry.count++;
                    blEntry.label = errLabel;
                    blEntry.reason = errMsg;
                    blEntry.ts = new Date().toISOString();
                    window._videoBlacklist[mediaFile] = blEntry;
                    __log('warn', 'diapo', 'video ' + errLabel + ' blacklist count=' + blEntry.count + '/' + VIDEO_BLACKLIST_THRESHOLD + ' — ' + mediaFile);

                    // Premier DECODE/SRC → forcer re-download (fichier peut-être corrompu)
                    if (!videoRetried && !blEntry.redownloaded) {
                        videoRetried = true;
                        blEntry.redownloaded = true;
                        __log('warn', 'diapo', 'video DECODE: forcing re-download (file may be corrupt)...');
                        try {
                            const decodedFile = decodeURIComponent(mediaFile);
                            const relativePath = 'media/' + decodedFile;
                            const baseUrl = typeof getMediaBaseUrl === 'function' ? getMediaBaseUrl() : 'https://soek.fr/uploads/see/media/';
                            if (window.api && window.api.saveBinary) {
                                const ok = await window.api.saveBinary(relativePath, baseUrl + mediaFile);
                                if (ok) {
                                    __log('info', 'diapo', 'video re-downloaded OK after DECODE, retrying playback...');
                                    if (window._videoHealth) window._videoHealth.redownloadCount++;
                                    videoStarted = false;
                                    videoEl.src = url;
                                    videoEl.load();
                                    return; // laisser les events reprendre
                                } else {
                                    __log('error', 'diapo', 'video re-download returned false');
                                    _reportVideoError(mediaFile, errCode, 'REDOWNLOAD_FAILED', 'saveBinary returned false');
                                }
                            }
                        } catch (retryErr) {
                            __log('error', 'diapo', 'video re-download exception: ' + retryErr.message);
                            _reportVideoError(mediaFile, errCode, 'REDOWNLOAD_FAILED', retryErr.message);
                        }
                    }
                }

                // Retry re-download pour NETWORK (2) ou erreurs inconnues (0)
                if (!videoRetried && (errCode === 2 || errCode === 0)) {
                    videoRetried = true;
                    __log('warn', 'diapo', 'video error: forcing re-download and retry (once)...');
                    try {
                        const decodedFile = decodeURIComponent(mediaFile);
                        const relativePath = 'media/' + decodedFile;
                        const baseUrl = typeof getMediaBaseUrl === 'function' ? getMediaBaseUrl() : 'https://soek.fr/uploads/see/media/';
                        if (window.api && window.api.saveBinary) {
                            const ok = await window.api.saveBinary(relativePath, baseUrl + mediaFile);
                            if (ok) {
                                __log('info', 'diapo', 'video re-downloaded OK, retrying playback...');
                                if (window._videoHealth) window._videoHealth.redownloadCount++;
                                videoStarted = false;
                                videoEl.src = url;
                                videoEl.load(); // va déclencher ABORTED (code 1) → ignoré ci-dessus
                                return; // laisser les events reprendre
                            } else {
                                __log('error', 'diapo', 'video re-download returned false');
                                _reportVideoError(mediaFile, errCode, 'REDOWNLOAD_FAILED', 'saveBinary returned false');
                            }
                        }
                    } catch (retryErr) {
                        __log('error', 'diapo', 'video re-download exception: ' + retryErr.message);
                        _reportVideoError(mediaFile, errCode, 'REDOWNLOAD_FAILED', retryErr.message);
                    }
                }
                
                // Erreur non-récupérable ou retry épuisé → skip
                if (window._videoHealth) window._videoHealth.skippedCount++;
                __log('error', 'diapo', 'video non-recoverable, skipping (total skipped=' + (window._videoHealth && window._videoHealth.skippedCount) + ')');
                ac.abort(); // empêche ended/autres events de doubler l'avance
                setTimeout(() => showMedia(currentMediaIndex + 1), 1000);
            }, { signal });
            
            // Toggle pour la prochaine
            player = (player === 1) ? 2 : 1;
            
            // NE PAS programmer de timeout pour les vidéos
            return;
            
        } catch(e) {
            __log('error', 'diapo', 'video error: ' + e.message);
            _reportVideoError(mediaFile, 0, 'EXCEPTION', e.message);
            if (window._videoHealth) window._videoHealth.skippedCount++;
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
                    _reportImageError(mediaFile, 'DOM_MISSING', divId + ' not found in DOM');
                    if (window._imageHealth) window._imageHealth.skippedCount++;
                    setTimeout(() => showMedia(currentMediaIndex + 1), 500);
                    return;
                }

                if (window._imageHealth) window._imageHealth.lastFile = mediaFile;
                
                // Créer un Image object pour précharger
                const img = new Image();
                let imageHandled = false;
                
                img.onload = () => {
                    if (imageHandled) return;
                    imageHandled = true;
                    __log('debug', 'diapo', 'image preloaded OK, switching');
                    if (window._imageHealth) window._imageHealth.lastSuccess = new Date().toISOString();
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
                
                img.onerror = async () => {
                    if (imageHandled) return;
                    imageHandled = true;
                    __log('error', 'diapo', 'image preload failed for ' + mediaFile + ', retrying with re-download...');
                    _reportImageError(mediaFile, 'LOAD_ERROR', 'img.onerror fired');
                    if (loopTimeout) { clearTimeout(loopTimeout); loopTimeout = null; }
                    // Retry : re-télécharger le fichier (bypass ETag) puis retenter l'affichage
                    try {
                        const decodedFile = decodeURIComponent(mediaFile);
                        const relativePath = 'media/' + decodedFile;
                        const baseUrl = typeof getMediaBaseUrl === 'function' ? getMediaBaseUrl() : 'https://soek.fr/uploads/see/media/';
                        if (window.api && window.api.saveBinary) {
                            const ok = await window.api.saveBinary(relativePath, baseUrl + mediaFile);
                            if (ok) {
                                __log('info', 'diapo', 'image re-downloaded OK, retrying display...');
                                // Retenter le chargement dans un nouvel objet Image
                                const retryImg = new Image();
                                retryImg.onload = () => {
                                    __log('info', 'diapo', 'image retry OK after re-download');
                                    if (window._imageHealth) window._imageHealth.lastSuccess = new Date().toISOString();
                                    divEl.style.backgroundImage = "url('" + url + "')";
                                    divEl.style.display = 'block';
                                    currentVisibleDiv = divId;
                                    hideAllMediaExcept(divId);
                                    try { const pd = document.getElementById('pageDefault'); if (pd && pd.style.display !== 'none') pd.style.display = 'none'; } catch(e2) {}
                                    loopTimeout = setTimeout(() => showMedia(currentMediaIndex + 1), delay);
                                };
                                retryImg.onerror = () => {
                                    __log('error', 'diapo', 'image retry failed even after re-download, skipping');
                                    _reportImageError(mediaFile, 'REDOWNLOAD_FAILED', 'onerror after saveBinary');
                                    if (window._imageHealth) window._imageHealth.skippedCount++;
                                    setTimeout(() => showMedia(currentMediaIndex + 1), 500);
                                };
                                retryImg.src = url + '#nocache=' + Date.now();
                                return;
                            }
                        }
                    } catch (retryErr) {
                        __log('error', 'diapo', 'image re-download exception: ' + retryErr.message);
                        _reportImageError(mediaFile, 'REDOWNLOAD_EXCEPTION', retryErr.message);
                    }
                    // Re-download impossible ou échoué → skip
                    if (window._imageHealth) window._imageHealth.skippedCount++;
                    setTimeout(() => showMedia(currentMediaIndex + 1), 500);
                };
                
                // Timeout de sécurité : si l'image ne charge pas en 8s, skip
                setTimeout(() => {
                    if (!imageHandled) {
                        imageHandled = true;
                        __log('error', 'diapo', 'image load timeout for ' + mediaFile + ', skipping');
                        _reportImageError(mediaFile, 'LOAD_TIMEOUT', 'no onload after 8s');
                        if (window._imageHealth) window._imageHealth.skippedCount++;
                        if (loopTimeout) { clearTimeout(loopTimeout); loopTimeout = null; }
                        setTimeout(() => showMedia(currentMediaIndex + 1), 200);
                    }
                }, 8000);
                
                img.src = url;
            } catch(e) {
                __log('error', 'diapo', 'image error: ' + e.message);
                _reportImageError(mediaFile, 'EXCEPTION', e.message);
                if (window._imageHealth) window._imageHealth.skippedCount++;
                setTimeout(() => showMedia(currentMediaIndex + 1), 500);
            }
        };
        
        // Vérifier et télécharger si nécessaire, puis afficher
        ensureMediaReady(mediaFile).then(ok => {
            if (!ok) {
                __log('warn', 'diapo', 'media still not available after download attempt: ' + mediaFile);
                _reportImageError(mediaFile, 'DOWNLOAD_FAILED', 'ensureMediaReady returned false');
                // Ne pas incrémenter skippedCount ici : doShowImage va tenter quand même
            }
            doShowImage();
        }).catch(err => {
            __log('error', 'diapo', 'ensureMediaReady threw: ' + (err && err.message));
            _reportImageError(mediaFile, 'DOWNLOAD_EXCEPTION', err && err.message);
            doShowImage();
        });
        
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

    } else {
        // Type de média inconnu → la boucle ne doit PAS se bloquer silencieusement
        __log('error', 'diapo', 'unknown mediaType="' + mediaType + '" at index=' + mediaIndex + ', skipping');
        if (window.errorHandler && typeof window.errorHandler.logError === 'function') {
            window.errorHandler.logError(
                new Error('[loop] unknown mediaType="' + mediaType + '" — ' + mediaFile),
                { operation: 'showMedia', index: mediaIndex }
            );
        }
        setTimeout(() => showMedia(currentMediaIndex + 1), 500);
    }
}

/**
 * Aborte tous les AbortControllers vidéo en cours.
 * Empêche les events (ended, error, stalled) de relancer la boucle après stop ou relance.
 */
function _abortAllVideoControllers() {
    for (const key of Object.keys(videoAbortControllers)) {
        if (videoAbortControllers[key]) {
            videoAbortControllers[key].abort();
            videoAbortControllers[key] = null;
        }
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
    
    // Aborter les vidéos en cours pour empêcher les events fantômes de relancer la boucle
    _abortAllVideoControllers();
    
    // Réinitialiser la blacklist vidéo (nouvelle trame = potentiellement nouveaux encodages)
    window._videoBlacklist = {};
    
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
    
    // Aborter les vidéos en cours (empêche ended/error de relancer showMedia)
    _abortAllVideoControllers();
    
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


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

// ─── Génération de boucle — empêche les chaînes de timers "fantômes" ─────────
// Chaque (re)démarrage ou arrêt de la boucle incrémente le compteur. Un timer
// planifié par une génération précédente est abandonné au moment où il se
// déclenche. Sans ça, deux LoopDiapo() concurrents (ex: sortie de veille avec
// sleepCheckTimer + refreshTimer qui tirent ensemble) font défiler les diapos
// deux fois trop vite, car la plupart des setTimeout ne sont pas stockés dans
// loopTimeout et survivent donc au clearTimeout de LoopDiapo().
let loopGeneration = 0;

function _bumpLoopGeneration() {
    loopGeneration++;
    return loopGeneration;
}

/**
 * setTimeout lié à la génération courante de la boucle.
 * Retourne un id de timer classique (utilisable avec clearTimeout).
 */
function _scheduleLoop(fn, ms) {
    const gen = loopGeneration;
    return setTimeout(() => {
        if (gen !== loopGeneration) {
            __log('debug', 'diapo', 'ghost timer dropped (gen ' + gen + ' != ' + loopGeneration + ')');
            return;
        }
        fn();
    }, ms);
}

// ─── Incidents remontés au monitoring SOEK ───────────────────────────────────
// Journal persistant côté main (lib/IncidentLog.js) : survit à un reload/relaunch.
// Types documentés dans docs/HEARTBEAT_SYSTEM.md § Incidents.
function _incident(type, niveau, message, contexte) {
    try {
        if (window.api && typeof window.api.reportIncident === 'function') {
            window.api.reportIncident(type, niveau, message, contexte || {});
        }
    } catch (e) { /* ne jamais casser la boucle pour un incident */ }
}

// ─── Succès d'affichage — distinct de _lastMediaChange (simple tentative) ─────
// Sert au backoff "tous les médias échouent" et à la remise à zéro de
// l'escalade du watchdog : seule une diapo réellement affichée compte.
let cycleSuccesses = 0;
let failedCycles = 0;
window._lastMediaSuccess = 0;

function _markMediaSuccess() {
    cycleSuccesses++;
    failedCycles = 0;
    window._lastMediaSuccess = Date.now();
}

// ─── Limite de re-téléchargement après erreur ────────────────────────────────
// Une vidéo corrompue côté serveur serait sinon re-téléchargée à chaque cycle.
const REDOWNLOAD_MIN_INTERVAL_MS = 30 * 60 * 1000;
const _lastRedownloadAt = new Map();

function _canRedownload(file) {
    const last = _lastRedownloadAt.get(file);
    if (last !== undefined && Date.now() - last < REDOWNLOAD_MIN_INTERVAL_MS) return false;
    _lastRedownloadAt.set(file, Date.now());
    return true;
}

// ─── Arrêt volontaire de la boucle (veille, liste vide…) ──────────────────────
// Le watchdog ne doit pas relancer une boucle arrêtée exprès. Filet de sécurité :
// arrêtée depuis plus de 15 min hors veille alors qu'il y a des diapos → relance.
let loopStoppedAt = 0;
const STOPPED_RESCUE_MS = 15 * 60 * 1000;

// ─── Mode sûr imposé par le watchdog main (trop de relances en 1h) ───────────
// La boucle reste arrêtée sur pageDefault ; le polling API continue.
window._watchdogSafeMode = false;

// ─── Santé vidéo — exposé au heartbeat via window._videoHealth ───────────────
window._videoHealth = {
    errorCount:      0,   // total erreurs MediaError cette session
    skippedCount:    0,   // vidéos sautées (erreur non récupérable)
    redownloadCount: 0,   // re-téléchargements forcés réussis
    lastError:       null, // { file, code, label, reason, ts }
    lastSuccess:     null, // ISO timestamp de la dernière vidéo lue jusqu'au bout
    lastFile:        null  // dernier fichier tenté
};

// ─── Blacklist vidéo — SUPPRIMÉE v2.10.3 ─────────────────────────────────────
// Le vrai problème était le manque de byte-range dans see-media://
// Plus besoin de blacklist maintenant que le protocol handler gère les Range requests
// ─────────────────────────────────────────────────────────────────────────────

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
 * Précharge la prochaine vidéo dans le player inactif (désactivé).
 */
function _preloadNextVideo(currentIndex) {
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

    if (window._watchdogSafeMode) {
        __log('warn', 'diapo', 'watchdog safe mode - staying on pageDefault');
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

        // Cycle complet sans AUCUN média affiché (fichiers corrompus, absents,
        // types inconnus…) : sans backoff la boucle repartirait en 100ms-1s,
        // en martelant le disque et le réseau. 10s, puis 30s, puis 60s.
        const cycleHadSuccess = cycleSuccesses > 0;
        cycleSuccesses = 0;
        if (!cycleHadSuccess) {
            failedCycles++;
            const backoff = [10000, 30000, 60000][Math.min(failedCycles - 1, 2)];
            __log('error', 'diapo', 'cycle complet sans aucun média affiché (#' + failedCycles + '), nouvel essai dans ' + (backoff / 1000) + 's');
            _incident('TOUS_MEDIAS_EN_ECHEC', 'critique',
                'Aucun des ' + mediaLoop.length + ' médias n\'a pu être affiché (cycle #' + failedCycles + ')',
                { medias: mediaLoop.length, cyclesEnEchec: failedCycles, backoffS: backoff / 1000 });
            hideAllMedia();
            if (!window.masquerPageDefault) {
                document.getElementById('mediaContainer').style.display = 'none';
                document.getElementById('pageDefault').style.display = 'flex';
            }
            loopTimeout = _scheduleLoop(() => {
                document.getElementById('mediaContainer').style.display = 'block';
                showMedia(0);
            }, backoff);
            return;
        }

        // Si masquerPageDefault est activé, boucler directement sans pause
        if (window.masquerPageDefault) {
            __log('info', 'diapo', 'end of loop, masquerPageDefault=true, looping immediately');
            // setTimeout pour éviter un stack overflow si tous les médias échouent (recursion infinie)
            _scheduleLoop(() => showMedia(0), 100);
            return;
        }
        
        __log('info', 'diapo', 'end of loop, showing pageDefault then restarting');
        
        // Cacher tous les médias
        hideAllMedia();
        
        // Cacher le container, afficher pageDefault
        document.getElementById('mediaContainer').style.display = 'none';
        document.getElementById('pageDefault').style.display = 'flex';
        
        // Redémarrer après 10 secondes
        loopTimeout = _scheduleLoop(() => {
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
        // Toujours passer par l'index suivant : le wrap-around gère la fin de
        // liste (pageDefault, backoff si tout le cycle a échoué)
        _scheduleLoop(() => showMedia(mediaIndex + 1), 100);
        return;
    }
    
    const mediaType = media[0];
    const mediaFile = media[1];
    const delay = (media[2] && Number(media[2]) > 0) ? Number(media[2]) * 1000 : 5000;
    const metadata = media[3] || {}; // Métadonnées enrichies (mediaId, diapoId, etc.)

    // Génération de boucle au démarrage de CE média. Les callbacks asynchrones
    // (téléchargement, img.onload, fin de template) peuvent se déclencher après
    // un LoopDiapo() : _scheduleLoop capturerait alors la NOUVELLE génération et
    // la vieille chaîne repartirait en parallèle. On les abandonne explicitement.
    const gen = loopGeneration;
    const isStale = () => gen !== loopGeneration;

    currentMediaIndex = mediaIndex;

    // Marqueur de progression pour le watchdog de boucle
    window._lastMediaChange = Date.now();
    window._lastMediaDelay = delay;

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
        const videoId = 'video' + player;
        const divId = 'divVideo' + player;
        
        if (window._videoHealth) window._videoHealth.lastFile = mediaFile;

        // S'assurer que le fichier existe localement
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

        if (isStale()) return;

        try {
            const url = typeof getMediaUrl === 'function' ? getMediaUrl(mediaFile) : pathMedia + mediaFile;
            const divEl = document.getElementById(divId);
            
            // Annuler le player précédent
            if (videoAbortControllers[player]) {
                videoAbortControllers[player].abort();
            }
            const ac = new AbortController();
            videoAbortControllers[player] = ac;
            const signal = ac.signal;
            
            // Réutiliser l'élément <video> existant (reset propre)
            const videoEl = document.getElementById(videoId);
            videoEl.pause();
            videoEl.removeAttribute('src');
            videoEl.load();
            
            videoEl.muted = window.sonActif !== true;
            videoEl.loop = false;
            videoEl.src = url;
            videoEl.load();
            
            let videoStarted = false;
            let videoRetried = false;
            
            // Afficher et lancer la lecture
            const showVideo = () => {
                if (signal.aborted) return;
                divEl.style.display = 'block';
                currentVisibleDiv = divId;
                hideAllMediaExcept(divId);
                try { const pd = document.getElementById('pageDefault'); if (pd && pd.style.display !== 'none') { pd.style.display = 'none'; } } catch(e) {}
                
                _markMediaSuccess();
                videoEl.play().catch(e => {
                    if (signal.aborted) return;
                    __log('error', 'diapo', 'video play() failed: ' + e.message);
                    _reportVideoError(mediaFile, 0, 'PLAY_FAILED', e.message);
                    _incident('VIDEO_SAUTEE', 'warn', 'play() refusé : ' + e.message, { fichier: decodeURIComponent(mediaFile), code: 'PLAY_FAILED' });
                    ac.abort();
                    _scheduleLoop(() => showMedia(currentMediaIndex + 1), 1000);
                });
            };
            
            // Quand prêt → afficher. Pas de { once } : après un retry (re-download
            // suite à une erreur en cours de lecture) il faut pouvoir redémarrer.
            videoEl.addEventListener('canplaythrough', () => {
                if (!videoStarted && !signal.aborted) {
                    videoStarted = true;
                    lastProgressTime = -1;
                    lastProgressAt = Date.now();
                    showVideo();
                }
            }, { signal });
            
            // Timeout 10s si rien ne se passe (réarmé lors du retry après re-download)
            let videoTimeout = null;
            const armLoadTimeout = () => {
                clearTimeout(videoTimeout);
                videoTimeout = _scheduleLoop(() => {
                    if (!videoStarted && !signal.aborted) {
                        __log('error', 'diapo', 'video timeout 10s: ' + mediaFile);
                        _reportVideoError(mediaFile, 0, 'LOAD_TIMEOUT', 'no canplaythrough after 10s');
                        _incident('VIDEO_SAUTEE', 'warn', 'Vidéo non prête après 10s', { fichier: decodeURIComponent(mediaFile), code: 'LOAD_TIMEOUT' });
                        ac.abort();
                        showMedia(currentMediaIndex + 1);
                    }
                }, 10000);
            };
            armLoadTimeout();
            signal.addEventListener('abort', () => clearTimeout(videoTimeout));

            // Détection de lecture figée : décodeur bloqué ou 'stalled' sans 'error'
            // ni 'ended'. Sans ça, seul le watchdog global (≥ 90s) débloque l'écran.
            const STALL_LIMIT_MS = 10000;
            let lastProgressTime = -1;
            let lastProgressAt = Date.now();
            const stallTimer = setInterval(() => {
                if (signal.aborted || !videoStarted || videoEl.ended) return;
                if (videoEl.currentTime !== lastProgressTime) {
                    lastProgressTime = videoEl.currentTime;
                    lastProgressAt = Date.now();
                    return;
                }
                if (Date.now() - lastProgressAt > STALL_LIMIT_MS) {
                    __log('error', 'diapo', 'video stalled ' + (STALL_LIMIT_MS / 1000) + 's at t=' + videoEl.currentTime.toFixed(1) + ' (readyState=' + videoEl.readyState + '): ' + mediaFile);
                    _reportVideoError(mediaFile, 0, 'STALLED', 'no progress for ' + (STALL_LIMIT_MS / 1000) + 's at t=' + videoEl.currentTime.toFixed(1));
                    if (window._videoHealth) window._videoHealth.skippedCount++;
                    _incident('VIDEO_FIGEE', 'warn',
                        'Lecture figée ' + (STALL_LIMIT_MS / 1000) + 's à t=' + videoEl.currentTime.toFixed(1) + 's',
                        { fichier: decodeURIComponent(mediaFile), position: Number(videoEl.currentTime.toFixed(1)), readyState: videoEl.readyState });
                    ac.abort();
                    showMedia(currentMediaIndex + 1);
                }
            }, 2000);
            signal.addEventListener('abort', () => clearInterval(stallTimer));

            // Le watchdog se base sur _lastMediaChange. La durée déclarée dans la
            // timeline peut être bien plus courte que la vidéo réelle (la suite est
            // déclenchée par 'ended', pas par un timer) : tant que la lecture avance
            // vraiment, on repousse l'échéance du watchdog.
            videoEl.addEventListener('timeupdate', () => {
                if (signal.aborted) return;
                window._lastMediaChange = Date.now();
            }, { signal });

            // Fin de vidéo → suivant
            videoEl.addEventListener('ended', () => {
                if (signal.aborted) return;
                clearTimeout(videoTimeout);
                clearInterval(stallTimer);
                if (window._videoHealth) window._videoHealth.lastSuccess = new Date().toISOString();
                _scheduleLoop(() => showMedia(currentMediaIndex + 1), 100);
            }, { once: true, signal });

            // Erreur → un seul retry (re-download), puis skip
            videoEl.addEventListener('error', async () => {
                if (signal.aborted) return;

                const errCode = videoEl.error ? videoEl.error.code : 0;
                const errMsg = videoEl.error ? videoEl.error.message : 'unknown';
                const errLabel = ['', 'ABORTED', 'NETWORK', 'DECODE', 'SRC_NOT_SUPPORTED'][errCode] || 'UNKNOWN';

                // ABORTED = notre propre load(), pas une erreur.
                // Ne PAS annuler le timeout de chargement : il reste le seul filet.
                if (errCode === 1) return;

                clearTimeout(videoTimeout);

                __log('error', 'diapo', 'video error ' + errLabel + ': ' + errMsg + ' — ' + mediaFile);
                _reportVideoError(mediaFile, errCode, errLabel, errMsg);
                
                // Un seul retry : re-download puis rejouer (au plus 1 fois / 30 min par fichier)
                if (!videoRetried && _canRedownload(mediaFile)) {
                    videoRetried = true;
                    try {
                        const decodedFile = decodeURIComponent(mediaFile);
                        const baseUrl = typeof getMediaBaseUrl === 'function' ? getMediaBaseUrl() : 'https://soek.fr/uploads/see/media/';
                        if (window.api && window.api.saveBinary) {
                            const ok = await window.api.saveBinary('media/' + decodedFile, baseUrl + mediaFile);
                            if (signal.aborted) return;
                            if (ok) {
                                __log('info', 'diapo', 'video re-downloaded, retrying...');
                                if (window._videoHealth) window._videoHealth.redownloadCount++;
                                videoStarted = false;
                                videoEl.src = url;
                                videoEl.load();
                                armLoadTimeout();
                                return;
                            }
                        }
                    } catch (e) {
                        __log('error', 'diapo', 'video re-download failed: ' + e.message);
                    }
                }
                
                // Skip
                if (window._videoHealth) window._videoHealth.skippedCount++;
                _incident('VIDEO_SAUTEE', 'warn', 'Erreur ' + errLabel + ' : ' + errMsg, { fichier: decodeURIComponent(mediaFile), code: errLabel });
                ac.abort();
                _scheduleLoop(() => showMedia(currentMediaIndex + 1), 1000);
            }, { signal });
            
            // Toggle player
            player = (player === 1) ? 2 : 1;
            return;
            
        } catch(e) {
            __log('error', 'diapo', 'video error: ' + e.message);
            _reportVideoError(mediaFile, 0, 'EXCEPTION', e.message);
            _scheduleLoop(() => showMedia(currentMediaIndex + 1), 1000);
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
            if (isStale()) return;
            try {
                const url = typeof getMediaUrl === 'function' ? getMediaUrl(mediaFile) : pathMedia + mediaFile;
                const divEl = document.getElementById(divId);
                
                if (!divEl) {
                    __log('error', 'diapo', divId + ' NOT FOUND in DOM!');
                    _reportImageError(mediaFile, 'DOM_MISSING', divId + ' not found in DOM');
                    if (window._imageHealth) window._imageHealth.skippedCount++;
                    _scheduleLoop(() => showMedia(currentMediaIndex + 1), 500);
                    return;
                }

                if (window._imageHealth) window._imageHealth.lastFile = mediaFile;
                
                // Créer un Image object pour précharger
                const img = new Image();
                let imageHandled = false;
                
                img.onload = () => {
                    if (imageHandled || isStale()) return;
                    imageHandled = true;
                    __log('debug', 'diapo', 'image preloaded OK, switching');
                    if (window._imageHealth) window._imageHealth.lastSuccess = new Date().toISOString();
                    _markMediaSuccess();
                    divEl.style.backgroundImage = "url('" + url + "')";
                    // Afficher le nouveau div AVANTde cacher les anciens (évite flash noir)
                    divEl.style.display = 'block';
                    currentVisibleDiv = divId;
                    hideAllMediaExcept(divId);
                    // Cacher pageDefault maintenant que le média est prêt
                    try { const pd = document.getElementById('pageDefault'); if (pd && pd.style.display !== 'none') { pd.style.display = 'none'; __log('info', 'diapo', 'pageDefault hidden (first media ready)'); } } catch(e) {}
                    __log('info', 'diapo', divId + ' NOW DISPLAYED! (CUT transition)');
                    
                    // Programmer le prochain APRÈS affichage réel (pas avant)
                    __log('debug', 'diapo', 'scheduling next in ' + (delay/1000) + 's (after display)');
                    loopTimeout = _scheduleLoop(() => {
                        showMedia(currentMediaIndex + 1);
                    }, delay);
                };
                
                img.onerror = async () => {
                    if (imageHandled || isStale()) return;
                    imageHandled = true;
                    __log('error', 'diapo', 'image preload failed for ' + mediaFile + ', retrying with re-download...');
                    _reportImageError(mediaFile, 'LOAD_ERROR', 'img.onerror fired');
                    if (loopTimeout) { clearTimeout(loopTimeout); loopTimeout = null; }
                    // Retry : re-télécharger le fichier (bypass ETag) puis retenter l'affichage
                    try {
                        const decodedFile = decodeURIComponent(mediaFile);
                        const relativePath = 'media/' + decodedFile;
                        const baseUrl = typeof getMediaBaseUrl === 'function' ? getMediaBaseUrl() : 'https://soek.fr/uploads/see/media/';
                        if (window.api && window.api.saveBinary && _canRedownload(mediaFile)) {
                            const ok = await window.api.saveBinary(relativePath, baseUrl + mediaFile);
                            if (isStale()) return;
                            if (ok) {
                                __log('info', 'diapo', 'image re-downloaded OK, retrying display...');
                                // Retenter le chargement dans un nouvel objet Image
                                const retryImg = new Image();
                                retryImg.onload = () => {
                                    if (isStale()) return;
                                    __log('info', 'diapo', 'image retry OK after re-download');
                                    if (window._imageHealth) window._imageHealth.lastSuccess = new Date().toISOString();
                                    _markMediaSuccess();
                                    divEl.style.backgroundImage= "url('" + url + "')";
                                    divEl.style.display = 'block';
                                    currentVisibleDiv = divId;
                                    hideAllMediaExcept(divId);
                                    try { const pd = document.getElementById('pageDefault'); if (pd && pd.style.display !== 'none') pd.style.display = 'none'; } catch(e2) {}
                                    loopTimeout = _scheduleLoop(() => showMedia(currentMediaIndex + 1), delay);
                                };
                                retryImg.onerror = () => {
                                    if (isStale()) return;
                                    __log('error', 'diapo', 'image retry failed even after re-download, skipping');
                                    _reportImageError(mediaFile, 'REDOWNLOAD_FAILED', 'onerror after saveBinary');
                                    if (window._imageHealth) window._imageHealth.skippedCount++;
                                    _incident('IMAGE_SAUTEE', 'warn', 'Image illisible même après re-téléchargement', { fichier: decodeURIComponent(mediaFile), code: 'REDOWNLOAD_FAILED' });
                                    _scheduleLoop(() => showMedia(currentMediaIndex + 1), 500);
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
                    _incident('IMAGE_SAUTEE', 'warn', 'Image illisible', { fichier: decodeURIComponent(mediaFile), code: 'LOAD_ERROR' });
                    _scheduleLoop(() => showMedia(currentMediaIndex + 1), 500);
                };
                
                // Timeout de sécurité : si l'image ne charge pas en 8s, skip
                _scheduleLoop(() => {
                    if (!imageHandled) {
                        imageHandled = true;
                        __log('error', 'diapo', 'image load timeout for ' + mediaFile + ', skipping');
                        _reportImageError(mediaFile, 'LOAD_TIMEOUT', 'no onload after 8s');
                        if (window._imageHealth) window._imageHealth.skippedCount++;
                        _incident('IMAGE_SAUTEE', 'warn', 'Image non chargée après 8s', { fichier: decodeURIComponent(mediaFile), code: 'LOAD_TIMEOUT' });
                        if (loopTimeout) { clearTimeout(loopTimeout); loopTimeout = null; }
                        _scheduleLoop(() => showMedia(currentMediaIndex + 1), 200);
                    }
                }, 8000);
                
                img.src = url;
            } catch(e) {
                __log('error', 'diapo', 'image error: ' + e.message);
                _reportImageError(mediaFile, 'EXCEPTION', e.message);
                if (window._imageHealth) window._imageHealth.skippedCount++;
                _scheduleLoop(() => showMedia(currentMediaIndex + 1), 500);
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
                // (inclut le temps de fetch pour trafic/meteo + la durée d'affichage).
                // Garde : un fetch pendu ne doit pas bloquer la boucle indéfiniment.
                const TEMPLATE_GRACE_MS = 20000;
                let templateTimer = null;
                const templateTimeout = new Promise(resolve => {
                    templateTimer = setTimeout(() => resolve('timeout'), delay + TEMPLATE_GRACE_MS);
                });
                Promise.race([
                    Promise.resolve().then(() => window.templateRenderer.show(templateData, delay / 1000)),
                    templateTimeout
                ]).then((result) => {
                    clearTimeout(templateTimer);
                    if (isStale()) return;
                    // Succès seulement si le template s'est terminé normalement
                    if (result !== 'timeout') _markMediaSuccess();
                    if (result === 'timeout') {
                        __log('error', 'diapo', 'template timeout after ' + ((delay + TEMPLATE_GRACE_MS) / 1000) + 's (type=' + (templateData.type || '?') + ')');
                        _incident('TEMPLATE_TIMEOUT', 'warn',
                            'Le template « ' + (templateData.type || '?') + ' » ne s\'est pas terminé après ' + ((delay + TEMPLATE_GRACE_MS) / 1000) + 's',
                            { typeTemplate: templateData.type || null, dureeS: delay / 1000 });
                        try { window.templateRenderer.hide(); } catch (e) { /* ignore */ }
                    }
                    showMedia(currentMediaIndex + 1);
                }).catch((e) => {
                    clearTimeout(templateTimer);
                    if (isStale()) return;
                    __log('error', 'diapo', 'template show error: ' + (e && e.message));
                    showMedia(currentMediaIndex + 1);
                });
            } else {
                __log('error', 'diapo', 'templateRenderer not available');
                // Fallback: passer au suivant
                _scheduleLoop(() => showMedia(currentMediaIndex + 1), 2000);
                return;
            }
            
        } catch(e) {
            __log('error', 'diapo', 'template render error: ' + e.message);
            _scheduleLoop(() => showMedia(currentMediaIndex + 1), 2000);
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
                _markMediaSuccess();
            } else {
                __log('error', 'diapo', 'planningManager not available');
                // Fallback: passer au suivant
                _scheduleLoop(() => showMedia(currentMediaIndex + 1), 2000);
                return;
            }
            
        } catch(e) {
            __log('error', 'diapo', 'planning render error: ' + e.message);
            _scheduleLoop(() => showMedia(currentMediaIndex + 1), 2000);
            return;
        }
        
        // Programmer le prochain après la durée du planning
        __log('debug', 'diapo', 'scheduling next after planning in ' + (delay/1000) + 's');
        loopTimeout = _scheduleLoop(() => {
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
        _scheduleLoop(() => showMedia(currentMediaIndex + 1), 500);
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
    __log('info', 'diapo', 'LoopDiapo starting (gen ' + (loopGeneration + 1) + ')');

    // Annuler timeout précédent
    if (loopTimeout) {
        clearTimeout(loopTimeout);
        loopTimeout = null;
    }

    // Invalider toutes les chaînes de timers de la génération précédente :
    // clearTimeout(loopTimeout) ne suffit pas, la plupart des relances passent
    // par des setTimeout non stockés.
    _bumpLoopGeneration();

    // Aborter les vidéos en cours pour empêcher les events fantômes de relancer la boucle
    _abortAllVideoControllers();

    // Réarmer le watchdog sur ce nouveau départ
    window._lastMediaChange = Date.now();
    cycleSuccesses = 0;
    loopStoppedAt = 0;

    // Mode sûr imposé par le watchdog main : rester sur pageDefault
    if (window._watchdogSafeMode) {
        __log('warn', 'diapo', 'watchdog safe mode - NOT starting loop');
        try {
            hideAllMedia();
            document.getElementById('pageDefault').style.display = 'flex';
            const container = document.getElementById('mediaContainer');
            if (container) container.style.display = 'none';
        } catch (e) { /* ignore */ }
        return;
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

    // Invalider les timers déjà planifiés (voir _scheduleLoop)
    _bumpLoopGeneration();
    loopStoppedAt = Date.now();

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
 * @returns {Promise<boolean>} true si la boucle a été (re)démarrée par cet appel
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
            _bumpLoopGeneration()
            _abortAllVideoControllers()
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
            return false
        }

        if (!hasChanged) {
            return false
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
            return false
        }

        // Prefetch les données trafic pour éviter le spinner
        _prefetchTraficTemplates(newList);
        
        __log('info', 'diapo', 'applyDiapoUpdate: restarting loop')
        LoopDiapo()
        return true
    } catch (e) {
        __log('error', 'diapo', 'applyDiapoUpdate error: ' + e.message)
        return false
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

// ─── Watchdog de boucle ──────────────────────────────────────────────────────
// Filet de sécurité : si plus aucun média n'a été affiché depuis largement plus
// longtemps que la durée attendue, c'est que la chaîne de timers est cassée
// (vidéo bloquée, exception avalée, sortie de veille ratée) → on relance.
// C'est ce qui évite les écrans figés qui ne se débloquent qu'au redémarrage.
window._lastMediaChange = Date.now();
window._lastMediaDelay = 5000;
window._loopWatchdogRestarts = 0;
window._loopWatchdogLevel = 0;      // niveau d'escalade courant (0 = rien en cours)
let _lastEscalationAt = 0;

// Verrou considéré comme abandonné au-delà de ce délai (voir _forceSafeState)
const STALE_LOCK_MS = 5 * 60 * 1000;

/**
 * Niveau 2 de l'escalade : ramène la page dans un état connu.
 * Boucle arrêtée, lecteurs vidés, overlays cachés, pageDefault affiché,
 * verrous abandonnés libérés, puis rechargement de la liste et relance.
 */
function _forceSafeState(reason) {
    __log('error', 'diapo', 'WATCHDOG niveau 2 : remise à zéro de l\'état (' + reason + ')');
    try { stopLoopDiapo(); } catch (e) { /* ignore */ }

    ['video1', 'video2'].forEach(id => {
        try {
            const v = document.getElementById(id);
            if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
        } catch (e) { /* ignore */ }
    });
    try { if (window.templateRenderer) window.templateRenderer.hide(); } catch (e) { /* ignore */ }
    try { if (window.planningManager) window.planningManager.hide(); } catch (e) { /* ignore */ }

    // Verrous pris il y a trop longtemps : la promesse qui devait les libérer est perdue
    const now = Date.now();
    const freed = [];
    if (window._diapoRequestInFlight && now - (window._diapoRequestInFlightAt || 0) > STALE_LOCK_MS) {
        window._diapoRequestInFlight = false; freed.push('requestJsonDiapo');
    }
    if (window._mediaSyncInProgress && now - (window._mediaSyncInProgressAt || 0) > STALE_LOCK_MS) {
        window._mediaSyncInProgress = false; freed.push('syncMediaCache');
    }
    if (window._downloadAllInFlight && now - (window._downloadAllInFlightAt || 0) > STALE_LOCK_MS) {
        window._downloadAllInFlight = null; freed.push('downloadAllMedia');
    }
    if (freed.length) __log('warn', 'diapo', 'verrous abandonnés libérés : ' + freed.join(', '));

    // Recharger la liste (borné à 30s), puis relancer — sauf si on est passé en veille
    const refresh = (typeof window.requestJsonDiapo === 'function')
        ? Promise.race([Promise.resolve().then(() => window.requestJsonDiapo()), new Promise(r => setTimeout(r, 30000))])
        : Promise.resolve();
    refresh.catch(() => {}).then(() => {
        if (window.screenStatus === 'sleep' || window._watchdogSafeMode) return;
        LoopDiapo();
    });
    return freed;
}

/**
 * Watchdog de boucle à escalade. Un niveau de plus à chaque passage où la
 * boucle est toujours bloquée ; remise à zéro dès qu'un média s'affiche
 * réellement (_lastMediaSuccess postérieur à la dernière escalade).
 *   1 → LoopDiapo()
 *   2 → _forceSafeState()
 *   3 → restart de l'app via le watchdog main (anti-boucle de relance)
 */
function _loopWatchdogCheck() {
    try {
        // Situations où l'absence de changement est normale
        if (window.DEBUG_MODE || pauseLoop || window._watchdogSafeMode) { window._loopWatchdogLevel = 0; return; }
        if (window.screenStatus === 'sleep') { window._loopWatchdogLevel = 0; return; }
        if (!mediaLoop || mediaLoop.length === 0) return;

        // Boucle arrêtée volontairement : pas d'escalade, sauf arrêt anormalement
        // long hors veille alors que des diapos sont disponibles (réveil raté…)
        if (loopStoppedAt) {
            const available = (typeof ArrayDiapo !== 'undefined' && ArrayDiapo && ArrayDiapo.length) ||
                              (typeof ArrayMedia !== 'undefined' && ArrayMedia && ArrayMedia.length);
            const stoppedMs = Date.now() - loopStoppedAt;
            if (available && stoppedMs > STOPPED_RESCUE_MS) {
                __log('error', 'diapo', 'WATCHDOG: boucle arrêtée depuis ' + Math.round(stoppedMs / 60000) + ' min hors veille, relance');
                _incident('BOUCLE_BLOQUEE', 'warn',
                    'Boucle arrêtée depuis ' + Math.round(stoppedMs / 60000) + ' min hors veille alors que des diapos sont disponibles — relance',
                    { niveau: 'arret', minutesArretee: Math.round(stoppedMs / 60000) });
                LoopDiapo();
            }
            return;
        }

        // Un média réellement affiché depuis la dernière escalade : tout va bien
        if (window._loopWatchdogLevel > 0 && (window._lastMediaSuccess || 0) > _lastEscalationAt) {
            __log('info', 'diapo', 'WATCHDOG: affichage rétabli après niveau ' + window._loopWatchdogLevel);
            window._loopWatchdogLevel = 0;
        }

        // Tolérance : 3x la durée du média courant, au minimum 90s
        // (le wrap-around sur pageDefault dure déjà 10s, une vidéo peut être longue)
        const tolerance = Math.max(3 * (window._lastMediaDelay || 5000), 90000);
        const idle = Date.now() - (window._lastMediaChange || 0);
        if (idle <= tolerance) return;

        const level = Math.min(window._loopWatchdogLevel + 1, 3);
        window._loopWatchdogLevel = level;
        window._loopWatchdogRestarts++;
        _lastEscalationAt = Date.now();
        const idleS = Math.round(idle / 1000);

        __log('error', 'diapo',
            'WATCHDOG niveau ' + level + ' : aucun média affiché depuis ' + idleS + 's ' +
            '(tolérance ' + Math.round(tolerance / 1000) + 's) [restart #' + window._loopWatchdogRestarts + ']');
        if (window.errorHandler && typeof window.errorHandler.logError === 'function') {
            window.errorHandler.logError(
                new Error('[loop] watchdog level ' + level + ' after ' + idleS + 's idle'),
                { operation: 'loop-watchdog', idleSeconds: idleS, level }
            );
        }
        const actions = { 1: 'relance de la boucle', 2: 'remise à zéro de l\'état', 3: 'redémarrage de l\'application' };
        _incident('BOUCLE_BLOQUEE', level === 1 ? 'warn' : 'critique',
            'Aucun média affiché depuis ' + idleS + 's — niveau ' + level + ' : ' + actions[level],
            { niveau: level, secondesSansMedia: idleS, index: currentMediaIndex, medias: mediaLoop.length });

        if (level === 1) {
            LoopDiapo();
        } else if (level === 2) {
            _forceSafeState('boucle bloquée ' + idleS + 's');
        } else {
            window._lastMediaChange = Date.now();   // laisser au main le temps d'agir
            if (window.api && typeof window.api.watchdogRequestRestart === 'function') {
                window.api.watchdogRequestRestart('boucle bloquée ' + idleS + 's après remise à zéro');
            } else if (window.api && typeof window.api.restartApp === 'function') {
                window.api.restartApp();
            } else {
                window.location.reload();
            }
        }
    } catch (e) {
        __log('error', 'diapo', 'watchdog error: ' + e.message);
    }
}

function _startLoopWatchdog() {
    if (window._loopWatchdogTimer) clearInterval(window._loopWatchdogTimer);
    window._loopWatchdogTimer = setInterval(_loopWatchdogCheck, 60000);
    __log('info', 'diapo', 'loop watchdog started (check every 60s)');
}

// ─── Signe de vie vers le watchdog main ──────────────────────────────────────
// Si le JS de la page se fige, ces pings cessent : le main recharge la page,
// puis relance l'app (lib/MainWatchdog.js).
function _sendWatchdogPing() {
    try {
        if (!window.api || typeof window.api.watchdogPing !== 'function') return;
        window.api.watchdogPing({
            secondsSinceLastMedia: Math.round((Date.now() - (window._lastMediaChange || Date.now())) / 1000),
            screenStatus: window.screenStatus || null,
            loopActive: !!(mediaLoop && mediaLoop.length && !pauseLoop && !loopStoppedAt && !window.DEBUG_MODE && !window._watchdogSafeMode),
            watchdogLevel: window._loopWatchdogLevel || 0
        });
    } catch (e) { /* ignore */ }
}

function _startWatchdogPing() {
    if (window._watchdogPingTimer) clearInterval(window._watchdogPingTimer);
    _sendWatchdogPing();
    window._watchdogPingTimer = setInterval(_sendWatchdogPing, 10000);
}

// ─── Mode sûr piloté par le main ─────────────────────────────────────────────
function _applyWatchdogSafeMode(on) {
    if (on === window._watchdogSafeMode) return;
    window._watchdogSafeMode = on;
    if (on) {
        __log('error', 'diapo', 'MODE SÛR activé par le watchdog : boucle arrêtée sur pageDefault');
        try { stopLoopDiapo(); } catch (e) { /* ignore */ }
    } else {
        __log('info', 'diapo', 'mode sûr désactivé : reprise de la boucle');
        if (window.screenStatus !== 'sleep') LoopDiapo();
    }
}

// Expose helpers for refresh logic
if (typeof window !== 'undefined') {
    window.LoopDiapo = LoopDiapo
    window.stopLoopDiapo = stopLoopDiapo
    window.applyDiapoUpdate = applyDiapoUpdate
    window._forceSafeState = _forceSafeState
    window._loopWatchdogCheck = _loopWatchdogCheck
    _startLoopWatchdog()
    _startWatchdogPing()
    if (window.api && typeof window.api.onWatchdogSafeMode === 'function') {
        window.api.onWatchdogSafeMode(_applyWatchdogSafeMode)
    }
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

    _bumpLoopGeneration();
    _abortAllVideoControllers();

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

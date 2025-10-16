
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
let currentSlideIndex = 0; // Index du slide actuellement affiché (0=divVideo1, 1=divVideo2, 2=divImg1, 3=divImg2)
let currentMediaIndex = 0; // Index dans ArrayLoop
let mediaLoop = [];
let loopTimeout = null;

// Mapping des slides
const SLIDES = {
    VIDEO1: { id: 'divVideo1', index: 0, type: 'video', videoId: 'video1', sourceId: 'srcVideo1' },
    VIDEO2: { id: 'divVideo2', index: 1, type: 'video', videoId: 'video2', sourceId: 'srcVideo2' },
    IMG1: { id: 'divImg1', index: 2, type: 'image' },
    IMG2: { id: 'divImg2', index: 3, type: 'image' }
};

const SLIDE_ORDER = [SLIDES.VIDEO1, SLIDES.VIDEO2, SLIDES.IMG1, SLIDES.IMG2];

/**
 * Active un slide et désactive tous les autres
 */
function activateSlide(slideIndex) {
    __log('info', 'diapo', 'activating slide index ' + slideIndex);
    
    SLIDE_ORDER.forEach((slide, idx) => {
        const element = document.getElementById(slide.id);
        if (element) {
            if (idx === slideIndex) {
                element.classList.add('active');
            } else {
                element.classList.remove('active');
            }
        }
    });
    
    currentSlideIndex = slideIndex;
}

/**
 * Trouve le prochain slide disponible pour un type de média donné
 */
function getNextSlideForMediaType(mediaType) {
    const isVideo = mediaType === 'video';
    const availableSlides = SLIDE_ORDER.filter(s => 
        isVideo ? s.type === 'video' : s.type === 'image'
    );
    
    // Trouver le prochain slide du bon type qui n'est pas actif
    let nextSlide = availableSlides.find(s => s.index !== currentSlideIndex);
    
    // Si tous les slides du type sont utilisés, prendre le premier disponible
    if (!nextSlide) {
        nextSlide = availableSlides[0];
    }
    
    return nextSlide;
}

/**
 * Précharge un média dans un slide (avec callback optionnel)
 */
function preloadMedia(media, slide, callback) {
    if (!media || !slide) {
        if (callback) callback();
        return;
    }
    
    const url = pathMedia + media[1].replace("%20", '%2520');
    
    if (slide.type === 'video') {
        __log('info', 'diapo', 'preloading video in ' + slide.id + ': ' + media[1]);
        try {
            const videoEl = document.getElementById(slide.videoId);
            document.getElementById(slide.sourceId).src = url;
            videoEl.load();
            // Vidéo prête quand 'loadeddata' se déclenche
            videoEl.addEventListener('loadeddata', function onLoaded() {
                videoEl.removeEventListener('loadeddata', onLoaded);
                __log('debug', 'diapo', 'video loaded: ' + media[1]);
                if (callback) callback();
            }, { once: true });
            // Timeout de sécurité
            setTimeout(() => {
                if (callback) callback();
            }, 2000);
        } catch(e) {
            __log('error', 'diapo', 'failed to preload video: ' + e.message);
            if (callback) callback();
        }
    } else {
        __log('info', 'diapo', 'preloading image in ' + slide.id + ': ' + media[1]);
        try {
            const urlFinal = "url('" + url + "')";
            const slideEl = document.getElementById(slide.id);
            
            // Créer une image temporaire pour détecter le chargement
            const img = new Image();
            img.onload = function() {
                slideEl.style.backgroundImage = urlFinal;
                __log('debug', 'diapo', 'image loaded: ' + media[1]);
                if (callback) callback();
            };
            img.onerror = function() {
                __log('error', 'diapo', 'failed to load image: ' + media[1]);
                slideEl.style.backgroundImage = urlFinal; // Charger quand même
                if (callback) callback();
            };
            img.src = url;
        } catch(e) {
            __log('error', 'diapo', 'failed to preload image: ' + e.message);
            if (callback) callback();
        }
    }
}

/**
 * Affiche un média
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
    
    __log('info', 'diapo', 'showing media ' + mediaIndex + ': type=' + media[0] + ' file=' + media[1]);
    
    // Déterminer le slide à utiliser
    const slide = getNextSlideForMediaType(media[0]);
    
    // Précharger le média dans le slide, puis l'activer une fois chargé
    preloadMedia(media, slide, function() {
        __log('debug', 'diapo', 'media ready, activating slide');
        
        // Activer le slide (déclenche la transition CSS)
        activateSlide(slide.index);
        
        // Si c'est une vidéo, la lancer
        if (slide.type === 'video') {
            try {
                const videoEl = document.getElementById(slide.videoId);
                videoEl.play().catch(e => {
                    __log('error', 'diapo', 'failed to play video: ' + e.message);
                });
            } catch(e) {
                __log('error', 'diapo', 'video play error: ' + e.message);
            }
        }
        
        // Précharger le prochain média (pendant que celui-ci s'affiche)
        const nextMediaIndex = (mediaIndex + 1) % mediaLoop.length;
        const nextMedia = mediaLoop[nextMediaIndex];
        if (nextMedia) {
            const nextSlide = getNextSlideForMediaType(nextMedia[0]);
            // Attendre 500ms (après la transition) avant de précharger
            setTimeout(() => {
                preloadMedia(nextMedia, nextSlide);
            }, 500);
        }
    });
    
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
    
    // Désactiver tous les slides
    SLIDE_ORDER.forEach(slide => {
        const element = document.getElementById(slide.id);
        if (element) {
            element.classList.remove('active');
        }
    });
    
    // Cacher le conteneur de médias et réafficher pageDefault
    try {
        document.getElementById('mediaContainer').classList.remove('active');
        document.getElementById('pageDefault').style.display = 'flex';
    } catch(e) {
        __log('error', 'diapo', 'failed to hide mediaContainer: ' + e.message);
    }
    
    __log('info', 'diapo', 'LoopDiapo stopped');
}


// Local safe logger
if (typeof window !== 'undefined') {
    window.__log = window.__log || function(level, tag, ...args) { try { if (window.logger && typeof window.logger[level] === 'function') return window.logger[level](tag, ...args); if (console && typeof console[level] === 'function') return console[level](tag, ...args); return console.log(tag, ...args) } catch(e){ try{ console.log(tag, ...args) }catch(_){} } }
    var __log = window.__log
} else {
    var __log = function(level, tag, ...args) { try { if (console && typeof console[level] === 'function') return console[level](tag, ...args); return console.log(tag, ...args) } catch(e){ try{ console.log(tag, ...args) }catch(_){} } }
}

function LoopDiapo() {

    // Resolve source array for playback (prefer ArrayMedia, fallback to ArrayDiapo)
    ArrayLoop = (ArrayMedia && ArrayMedia.length) ? ArrayMedia : (ArrayDiapo || []);

    __log('info','diapo','LoopDiapo: start numImage=' + numImage + ' player=' + player + ' playerLoad=' + playerLoad + ' imgShow=' + imgShow + ' imgLoad=' + imgLoad)
    __log('debug','diapo','playerLoad=' + playerLoad + ' player=' + player)

    // Vérification de la disponibilité des médias
    if (!ArrayLoop || ArrayLoop.length === 0) {
        __log('warn','diapo','ArrayLoop empty, falling back to default screen')
        defaultScreen()
        return
    }

    // If we've reached end of loop, wrap to start for continuous sequential playback
    if (numImage >= ArrayLoop.length) {
        __log('info','diapo','fin de boucle, wrapping to start')
        numImage = 0
        // continue playback from beginning
    }

    // Affichage du media courant
    const current = ArrayLoop[numImage]
    if (!current) {
        __log('warn','diapo','no current media at index', numImage)
        defaultScreen()
        return
    }

    __log('info','diapo','displaying media at index ' + numImage + ': type=' + current[0] + ' file=' + current[1])

    if (current[0] === 'video') {
        __log('info','diapo','video player '+ player + ' start for index ' + numImage)
        
        // Masquer les divs d'images et afficher le player vidéo
        if (typeof smoothTransition === 'function') {
            smoothTransition('divImg1', 'divVideo' + player, () => {
                try { document.getElementById("video" + player).play() } catch(e){ __log('error','diapo','video play failed', e) }
            })
            smoothTransition('divImg2', 'divVideo' + player)
        } else {
            try { document.getElementById("divImg1").style.display = "none" } catch(e){}
            try { document.getElementById("divImg2").style.display = "none" } catch(e){}
            try { document.getElementById("divVideo" + player).style.display = "block" } catch(e){}
            try { document.getElementById("video" + player).play() } catch(e){ __log('error','diapo','video play failed', e) }
        }
        
        __log('debug','diapo','video displayed on player ' + player)
        
        // Précharger le média suivant (wrap-around)
        const nextIndex = (numImage + 1) % ArrayLoop.length;
        const nextPlayerLoad = (player == 1) ? 2 : 1;
        if (ArrayLoop[nextIndex]) {
            if (ArrayLoop[nextIndex][0] === 'video') {
                __log('info','diapo','preloading next video at index ' + nextIndex + ' to player ' + nextPlayerLoad)
                const urlVideo = pathMedia + ArrayLoop[nextIndex][1].replace("%20", '%2520')
                try { document.getElementById("srcVideo" + nextPlayerLoad).src = urlVideo } catch(e){}
                try { document.getElementById("video" + nextPlayerLoad).load() } catch(e){}
            } else if (ArrayLoop[nextIndex][0] === 'img') {
                __log('info','diapo','preloading next image at index ' + nextIndex + ' to divImg' + imgLoad)
                const url = pathMedia + ArrayLoop[nextIndex][1].replace("%20", '%2520')
                const urlFinal = "url('" + url + "')"
                try { document.getElementById("divImg" + imgLoad).style.backgroundImage = urlFinal } catch(e){}
            }
        }
        
        // Toggle player pour le prochain affichage
        player = nextPlayerLoad
        numImage++
        
    } else if (current[0] === 'img') {
        __log('info','diapo','displaying image at index ' + numImage + ' on divImg' + imgShow)
        
        // Calculer le div opposé (celui qu'on va cacher)
        const prevImgDiv = (imgShow == 1) ? 2 : 1;
        
        // 1. Cacher immédiatement les vidéos (sans transition pour éviter les interférences)
        try { 
            document.getElementById("divVideo1").style.display = "none"
            document.getElementById("divVideo2").style.display = "none" 
        } catch(e){}
        
        // 2. Cross-fade propre entre les deux divs d'image
        const currentImgDiv = document.getElementById("divImg" + imgShow)
        const oldImgDiv = document.getElementById("divImg" + prevImgDiv)
        
        try {
            // Préparer le nouveau div (visible mais transparent)
            currentImgDiv.style.display = "block"
            currentImgDiv.style.opacity = "0"
            
            // Faire apparaître le nouveau en fade-in
            setTimeout(() => {
                currentImgDiv.style.opacity = "1"
                // Simultanément, faire disparaître l'ancien en fade-out
                if (oldImgDiv) {
                    oldImgDiv.style.opacity = "0"
                    // Après la transition, cacher complètement l'ancien div
                    setTimeout(() => {
                        oldImgDiv.style.display = "none"
                    }, 300)
                }
                
                // Précharger le média suivant APRÈS la transition (400ms total = 50 + 300 + 50 de marge)
                setTimeout(() => {
                    const nextIndex = (numImage + 1) % ArrayLoop.length;
                    const nextImgLoad = (imgShow == 1) ? 2 : 1;
                    if (ArrayLoop[nextIndex]) {
                        if (ArrayLoop[nextIndex][0] === 'img') {
                            __log('info','diapo','preloading next image at index ' + nextIndex + ' to divImg' + nextImgLoad)
                            const url = pathMedia + ArrayLoop[nextIndex][1].replace("%20", '%2520')
                            const urlFinal = "url('" + url + "')"
                            try { document.getElementById("divImg" + nextImgLoad).style.backgroundImage = urlFinal } catch(e){}
                        } else if (ArrayLoop[nextIndex][0] === 'video') {
                            __log('info','diapo','preloading next video at index ' + nextIndex + ' to player ' + playerLoad)
                            const urlVideo = pathMedia + ArrayLoop[nextIndex][1].replace("%20", '%2520')
                            try { document.getElementById("srcVideo" + playerLoad).src = urlVideo } catch(e){}
                            try { document.getElementById("video" + playerLoad).load() } catch(e){}
                        }
                    }
                }, 350)
            }, 50)
        } catch(e) {
            __log('error','diapo','transition error: ' + e.message)
        }
        
        // Toggle imgLoad et imgShow pour le prochain affichage
        const nextImgLoad = (imgShow == 1) ? 2 : 1;
        imgLoad = nextImgLoad
        imgShow = nextImgLoad
        
        // Programmer le prochain média
        const delay = (current[2] && Number(current[2]) > 0) ? Number(current[2]) * 1000 : 5000
        __log('debug','diapo','scheduling next media in ' + (delay/1000) + ' seconds')
        setTimeout(function () {
            numImage++
            LoopDiapo()
        }, delay);
        
    } else {
        __log('warn','diapo','unknown media type at index ' + numImage + ': ' + current[0])
        numImage++
        // Retry avec le prochain média au lieu de s'arrêter
        setTimeout(() => LoopDiapo(), 100)
    }
}






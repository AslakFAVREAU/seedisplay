
// Local safe logger
if (typeof window !== 'undefined') {
    window.__log = window.__log || function(level, tag, ...args) { try { if (window.logger && typeof window.logger[level] === 'function') return window.logger[level](tag, ...args); if (console && typeof console[level] === 'function') return console[level](tag, ...args); return console.log(tag, ...args) } catch(e){ try{ console.log(tag, ...args) }catch(_){} } }
    var __log = window.__log
} else {
    var __log = function(level, tag, ...args) { try { if (console && typeof console[level] === 'function') return console[level](tag, ...args); return console.log(tag, ...args) } catch(e){ try{ console.log(tag, ...args) }catch(_){} } }
}

function LoopDiapo() {

    // Partie en fin de boucle
    ArrayLoop = ArrayMedia

    __log('info','diapo','LoopDiapo: start numImage=' + numImage + ' player=' + player + ' playerLoad=' + playerLoad + ' imgShow=' + imgShow + ' imgLoad=' + imgLoad)
    __log('debug','diapo','playerLoad=' + playerLoad + ' player=' + player)

    // Si on est en fin de boucle on renvoi vers l'affichage par default
    if (numImage == ArrayLoop.length) {
        __log('info','diapo','fin de boucle on repart dans default')
        numImage = 0
        defaultScreen()
        return
    }

    // Préchargement du media suivant si présent
    if ((numImage + 1) < ArrayLoop.length) {
        if (ArrayLoop[numImage + 1][0] === 'video') {
            __log('debug','diapo','index+1 existe et est video at index ' + (numImage+1))
            __log('info','diapo','preloading next video at index ' + (numImage+1))
            const urlVideo = pathMedia + ArrayLoop[numImage + 1][1].replace("%20", '%2520')
            try { document.getElementById("srcVideo" + playerLoad).src = urlVideo } catch(e){}
            try { document.getElementById("video" + playerLoad).load() } catch(e){}
            // toggle playerLoad
            playerLoad = (playerLoad == 1) ? 2 : 1
            __log('info','diapo','New player load is player' + playerLoad)
            __log('debug','diapo','video preloaded to player ' + playerLoad)
        } else if (ArrayLoop[numImage + 1][0] === 'img') {
            __log('info','diapo','preloading next image at index ' + (numImage+1))
            const url = pathMedia + ArrayLoop[numImage + 1][1].replace("%20", '%2520')
            const urlFinal = "url('" + url + "')"
            try { document.getElementById("divImg" + imgLoad).style.backgroundImage = urlFinal } catch(e){}
            imgLoad = (imgLoad == 1) ? 2 : 1
            __log('debug','diapo','image preloaded to divImg' + (imgLoad == 1 ? 2 : 1))
        }
    }

    // Affichage du media courant
    const current = ArrayLoop[numImage]
    if (!current) {
        __log('warn','diapo','no current media at index', numImage)
        defaultScreen()
        return
    }

    if (current[0] === 'video') {
        __log('info','diapo','video player '+ player + ' start for index ' + numImage)
        try { document.getElementById("divImg1").style.display = "none" } catch(e){}
        try { document.getElementById("divImg2").style.display = "none" } catch(e){}
        try { document.getElementById("divVideo" + player).style.display = "block" } catch(e){}
        try { document.getElementById("video" + player).play() } catch(e){}
        __log('debug','diapo','video play called for player ' + player)
        // advance
        player = (player == 1) ? 2 : 1
        numImage++
    } else if (current[0] === 'img') {
        __log('info','diapo','img show: ' + imgShow + ' index: ' + numImage)
        try { document.getElementById("divImg1").style.display = "none" } catch(e){}
        try { document.getElementById("divImg2").style.display = "none" } catch(e){}
        try { document.getElementById("divImg" + imgShow).style.display = "block" } catch(e){}
        // schedule next
        const delay = (current[2] && Number(current[2])) ? Number(current[2]) * 1000 : 5000
        setTimeout(function () {
            numImage++
            LoopDiapo()
        }, delay);
        __log('debug','diapo','scheduled next image in ' + (delay/1000) + ' seconds')
        imgShow = (imgShow == 1) ? 2 : 1
    } else {
        __log('warn','diapo','unknown media type', current[0])
        numImage++
    }
}






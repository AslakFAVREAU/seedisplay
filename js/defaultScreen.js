// Fonction appeler a chaque tour de boucle pour update l'ecran
// Local safe logger (defined once)
if (typeof window !== 'undefined') {
    window.__log = window.__log || function(level, tag, ...args) { try { if (window.logger && typeof window.logger[level] === 'function') return window.logger[level](tag, ...args); if (console && typeof console[level] === 'function') return console[level](tag, ...args); return console.log(tag, ...args) } catch(e){ try{ console.log(tag, ...args) }catch(_){} } }
    var __log = window.__log
} else {
    var __log = function(level, tag, ...args) { try { if (console && typeof console[level] === 'function') return console[level](tag, ...args); return console.log(tag, ...args) } catch(e){ try{ console.log(tag, ...args) }catch(_){} } }
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
                            const urlMedia = 'https://soek.fr/uploads/see/media/' + mediaName
                            window.api.saveBinary('media/' + mediaName, urlMedia)
                            __log('info','default','launching download via api.saveBinary for ' + mediaName)
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
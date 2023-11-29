// Fonction appeler a chaque tour de boucle pour update l'ecran
function defaultScreen() {
    console.log("default")
    const dateGif = new Date();

const monthGif = dateGif.getMonth();
console.log("fgdfgfdg" + monthGif);
if (monthGif == 11)
{
    document.getElementById("gifNoel").style.display = "block";   
}
    restart("imgGif","logo/gifNoel.gif")
    // On remet le compteur de la loop à 0
    numImage = 0;
    console.log(init)
    // On passe par la fontion pour recup le diapo si Init est a false
    if (init == false) {
        console.log("init false")
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
    document.getElementById("pageDefault").style.display = "block";
    url = "blank.jpg";
    document.getElementById("divImg1").style.backgroundImage = "url(" + url + ")";
    document.getElementById("divImg2").style.backgroundImage = "url(" + url + ")";


    // Avant de  demarer la boucle on lance le telechargement des medias
    setTimeout(function () {
        for (downloadIndex = 0; downloadIndex < ArrayDiapo.length; downloadIndex++) {
            try {
                if (!fs.existsSync(pathMedia + ArrayDiapo[downloadIndex][1])) {
                    download(ArrayDiapo[downloadIndex][1])
                }
            }
            catch (err) { console.error(err) }
        }
    }, 2500)


    setTimeout(function () {
        // Test si le 0 de la boucle est une video
        if (ArrayDiapo[0][0] === 'video') {
            console.log(playerLoad + 'player chargé dans boucle init')     
            urlVideo = pathMedia + ArrayDiapo[0][1].replace("%20", '%2520')
            document.getElementById("srcVideo" + playerLoad).src = urlVideo;
            document.getElementById("video" + playerLoad).load()
            playerLoad = 2
             
          
        }
        else if (ArrayDiapo[0][0] === 'img') {
            url = pathMedia + ArrayDiapo[0][1].replace("%20", '%2520')
            urlFinal = "url('" + url + "')"
            document.getElementById("divImg" + imgLoad).style.backgroundImage = urlFinal;
            console.log('on charge le imgLoad '+ imgLoad + 'le img SHow sera '+ imgShow )  
        
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
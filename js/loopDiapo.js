function LoopDiapo() {


    // Partie en fin de boucle
    ArrayLoop = ArrayMedia

    console.log("longeur diapo = " + ArrayLoop.length + " num = " + numImage)
    console.log("player loard = "+ playerLoad + " player is " +player)


    //Si on est en fin de boucle on renvoi vers l'affichage par default
    if (numImage == ArrayLoop.length) {
        console.log("fin de boucle on repart dans default")
        numImage = 0
        defaultScreen()

    }
    //Fonction en cours de boucle
    else {

        // Test sur INDEX+1 de la boucle est une video ou img si index+1 exciste sinon rien
        if ((numImage + 1) < ArrayLoop.length && ArrayLoop[numImage + 1][0] === 'video') {
            console.log("index+1 exciste est video")
            urlVideo = pathMedia + ArrayLoop[numImage + 1][1].replace("%20", '%2520')
            
            document.getElementById("srcVideo" + playerLoad).src = urlVideo
            document.getElementById("video" + playerLoad).load()
            //On change l'odre des player à loader
          
            if (playerLoad == 1) {
                playerLoad = 2
            }
            else {
                playerLoad = 1
            }
            console.log('New player load is player'+ playerLoad)
        }
        else if ((numImage + 1) < ArrayLoop.length && ArrayLoop[numImage + 1][0] === 'img') {
           

            url = pathMedia + ArrayLoop[numImage + 1][1].replace("%20", '%2520')
            urlFinal = "url('" + url + "')"
     
            
            document.getElementById("divImg" + imgLoad).style.backgroundImage = urlFinal;
            if (imgLoad == 1) {

                imgLoad = 2
            }
            else {

                imgLoad = 1
            }

        }
   

    
    // Affichage si video 
    if (ArrayLoop[numImage][0] === 'video') {
        console.log("video player "+ player + 'start')
        
        document.getElementById("divImg1").style.display = "none"
        document.getElementById("divImg2").style.display = "none"
        document.getElementById("divVideo" + player).style.display = "block"
        document.getElementById("video" + player).play()

        if (player == 1) {
            player = 2
            numImage++
        }
        else {
            player = 1
            numImage++
        }



    }
    // Affichage si img
    else if (ArrayLoop[numImage][0] === 'img') {

        console.log("img "+ imgShow )
       document.getElementById("divImg1").style.display = "none";
        document.getElementById("divImg2").style.display = "none";
        document.getElementById("divImg" + imgShow).style.display = "block";
        if (imgShow == 1) {
            imgShow = 2
        }
        else {
            imgShow = 1
        }

        setTimeout(function (p) {
            numImage++
            LoopDiapo(ArrayLoop)
    
        }, ArrayLoop[numImage][2] * 1000);

    }

}
  


}







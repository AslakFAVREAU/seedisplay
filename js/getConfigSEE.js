function getConfigSEE(){
    console.log("getconfig")
    fs.readFile((pathSEE +"configSEE.json"), function(erreur, fichier) {
        configSEE = JSON.parse(fichier)        
        showMeteo = configSEE.meteo
        idEcran = configSEE.idEcran
        weekDisplay = configSEE.weekDisplay
        weekNo = configSEE.weekNo
        weekType = configSEE.weekType
        logoSOE = configSEE.logoSOE
        env = configSEE.env
        console.log('toto' + env)

        if(env == 'prod'){
            urlAPI = 'https://soek.fr/see/API/diapo/'+idEcran
        }
        else if (env == 'local'){
            urlAPI = 'http://127.0.0.1:8000/see/API/diapo/' +idEcran
        }
        
        if(weekDisplay ==false){
            document.getElementById("week").style.display = "none";
        }
        else{
            document.getElementById("week").style.display = "block";
        }

        if(showMeteo ==false){
            document.getElementById("zone_meteo").style.display = "none";
        }
        else{
            document.getElementById("zone_meteo").style.display = "block";
        }
     
        if(logoSOE ==false){
            document.getElementById("footer").style.display = "none";
        }
        else{
            document.getElementById("footer").style.display = "block";
        }

        requestJsonDiapo()

     })
     return "OK"
}
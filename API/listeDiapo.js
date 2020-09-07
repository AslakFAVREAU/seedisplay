function listeDiapo(data)
{
    var ArrayImg=[];
    var indexDiapo = 0;
    
    for (;data[indexDiapo];) {
        var indexLigne = 0;

for(;data[indexDiapo].ligneMedia[indexLigne];){

if (Date.parse(data[indexDiapo].DateDebutDiapo) < Date.now() && Date.now() < Date.parse(data[indexDiapo].DateFinDiapo)){
 
ArrayImg.push([data[indexDiapo].ligneMedia[indexLigne].MediaLigneMedia.TypeMedia, encodeURIComponent(data[indexDiapo].ligneMedia[indexLigne].MediaLigneMedia.FichierMedia), data[indexDiapo].ligneMedia[indexLigne].DureeLigneMedia ]);
}
indexLigne++;
}
indexDiapo++;
}
return ArrayImg;
}

const getDiapoJson = async () => {

  if(env == 'prod'){
    url = 'https://soek.fr/see/API/diapo/'+idEcran 
  }
  else if (env == 'local'){
    url = 'http://127.0.0.1:8000/see/API/diapo/'+idEcran 
    console.log("local")
  }

    try {
      return await axios.get(url)
    } catch (error) {
      console.error(error)
    }
  }

  const requestJsonDiapo = async () => {
    const JsonDiapo = await getDiapoJson()
    if (JsonDiapo) {
      ArrayDiapo = listeDiapo(JsonDiapo.data)
      console.log(ArrayDiapo)
      LoopDiapo(ArrayDiapo)

    }
  }
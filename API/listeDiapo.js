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



    try {
      console.log(urlAPI)
      return await axios.get(urlAPI)
    } catch (error) {
      console.error(error)
    }
  }

  const requestJsonDiapo = async () => {
    const JsonDiapo = await getDiapoJson()
    if (JsonDiapo) {
      ArrayDiapo = listeDiapo(JsonDiapo.data)
      console.log(ArrayDiapo)
    //  defaultScreen()

    }
  }
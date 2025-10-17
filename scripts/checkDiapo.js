const axios = require('axios');
(async () => {
  try {
    const url = 'https://soek.fr/see/API/diapo/13';
    console.log('Fetching', url);
    const res = await axios.get(url, { timeout: 10000 });
    const data = res.data;
    if (!Array.isArray(data)) {
      console.error('API did not return an array');
      return;
    }
    const ArrayImg = [];
    const now = Date.now();
    for (let indexDiapo = 0; indexDiapo < data.length; indexDiapo++) {
      const item = data[indexDiapo];
      if (!item || !item.ligneMedia || !Array.isArray(item.ligneMedia)) continue;
      for (let indexLigne = 0; indexLigne < item.ligneMedia.length; indexLigne++) {
        try {
          const ligne = item.ligneMedia[indexLigne];
          const start = item.DateDebutDiapo ? Date.parse(item.DateDebutDiapo) : 0;
          const end = item.DateFinDiapo ? Date.parse(item.DateFinDiapo) : Number.MAX_SAFE_INTEGER;
          if (start < now && now < end) {
            const mediaType = (ligne && ligne.MediaLigneMedia && ligne.MediaLigneMedia.TypeMedia) ? ligne.MediaLigneMedia.TypeMedia : null;
            const fichier = (ligne && ligne.MediaLigneMedia && ligne.MediaLigneMedia.FichierMedia) ? ligne.MediaLigneMedia.FichierMedia : null;
            const duree = (ligne && ligne.DureeLigneMedia) ? ligne.DureeLigneMedia : null;
            if (mediaType && fichier) {
              ArrayImg.push([mediaType, encodeURIComponent(fichier), duree, item.id || null]);
            }
          }
        } catch (e) {
          // skip
        }
      }
    }
    console.log('Active entries count:', ArrayImg.length);
    console.log(JSON.stringify(ArrayImg.slice(0, 30), null, 2));
  } catch (e) {
    console.error('Error', e && e.message);
  }
})();
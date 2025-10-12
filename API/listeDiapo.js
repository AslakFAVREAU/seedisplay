// Safe logger for this module (works in renderer or Node tests)
var _log = (function(){
  try {
    if (typeof window !== 'undefined' && window.logger) return function(level, tag, ...args){ try { if (window.logger && typeof window.logger[level] === 'function') return window.logger[level](tag, ...args); } catch(e){} }
  } catch(e) {}
  return function(level, tag, ...args){ try { if (console && typeof console[level] === 'function') return console[level](tag, ...args); return console.log(tag, ...args) } catch(e){ try{ console.log(tag, ...args) }catch(_){} }
  }
})()

function listeDiapo(data) {
  var ArrayImg = [];
  _log('info','diapo','listeDiapo: start parsing diapo data')

  if (!data || !Array.isArray(data) || data.length === 0) {
    _log('warn','diapo','listeDiapo: no data provided or empty')
    ArrayMedia = []
    return ArrayImg
  }

  for (var indexDiapo = 0; indexDiapo < data.length; indexDiapo++) {
    var item = data[indexDiapo]
    if (!item || !item.ligneMedia || !Array.isArray(item.ligneMedia)) continue
    for (var indexLigne = 0; indexLigne < item.ligneMedia.length; indexLigne++) {
      try {
        var ligne = item.ligneMedia[indexLigne]
        // only include media currently active based on DateDebutDiapo/DateFinDiapo
        var start = item.DateDebutDiapo ? Date.parse(item.DateDebutDiapo) : 0
        var end = item.DateFinDiapo ? Date.parse(item.DateFinDiapo) : Number.MAX_SAFE_INTEGER
        var now = Date.now()
        if (start < now && now < end) {
          var mediaType = (ligne && ligne.MediaLigneMedia && ligne.MediaLigneMedia.TypeMedia) ? ligne.MediaLigneMedia.TypeMedia : null
          var fichier = (ligne && ligne.MediaLigneMedia && ligne.MediaLigneMedia.FichierMedia) ? ligne.MediaLigneMedia.FichierMedia : null
          var duree = (ligne && ligne.DureeLigneMedia) ? ligne.DureeLigneMedia : null
          if (mediaType && fichier) {
            ArrayImg.push([mediaType, encodeURIComponent(fichier), duree])
          }
        }
      } catch (e) {
        // skip malformed line
      }
    }
  }

  _log('debug','diapo','parsed array', ArrayImg)
  ArrayMedia = ArrayImg
  if (ArrayImg.length === 0) {
    _log('warn','diapo','parsed 0 media entries - check API data / date ranges')
  } else {
    _log('info','diapo','parsed ' + ArrayImg.length + ' media entries')
  }
  return ArrayImg
}

// Exports for testability when running under Node (mocha)
try { module.exports = { listeDiapo } } catch (e) { }

const getDiapoJson = async () => {
    try {
  _log('info','diapo','getDiapoJson: fetching ' + urlAPI)
      const res = await axios.get(urlAPI)
  _log('info','diapo','getDiapoJson: fetch success ' + (res && res.status))
      return res
    } catch (error) {
  _log('error','diapo','getDiapoJson: error', error && error.message)
    }
  }

  const requestJsonDiapo = async () => {
    const JsonDiapo = await getDiapoJson()
    if (JsonDiapo) {
      ArrayDiapo = listeDiapo(JsonDiapo.data)

      // Si aucune diapo n'est fournie, afficher l'écran par défaut pour éviter écran vide
      if (!ArrayDiapo || ArrayDiapo.length === 0) {
        _log('warn','diapo','no diapo entries returned, falling back to defaultScreen')
        defaultScreen()
        return
      }

      // On ne fait l'instantiation de default screen que si on est sur la phase d'init sinon on ne fait que metre a jour le ArrayDiapo
      if (init == true){   
        _log('info','diapo','boucle init appelle defaultScreen')
        defaultScreen()
      }
    }
  }
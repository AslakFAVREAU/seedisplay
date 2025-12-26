// Safe logger for this module (works in renderer or Node tests)
var _log = (function(){
  try {
    if (typeof window !== 'undefined' && window.logger) return function(level, tag, ...args){ try { if (window.logger && typeof window.logger[level] === 'function') return window.logger[level](tag, ...args); } catch(e){} }
  } catch(e) {}
  return function(level, tag, ...args){ try { if (console && typeof console[level] === 'function') return console[level](tag, ...args); return console.log(tag, ...args) } catch(e){ try{ console.log(tag, ...args) }catch(_){} }
  }
})()

/**
 * Parse API v2 format (new unified timeline format)
 * API v2 returns: { status, timeline: [...], diapos: [...], serverTime, ... }
 * status can be: "active" (show media), "sleep" (show sleep screen), "offline"
 * The timeline is pre-computed by the server with only active medias
 */
function listeDiapoV2(data) {
  var ArrayImg = [];
  _log('info','diapo','listeDiapoV2: parsing new API format')

  // Store full API response for potential future use (config, diapos metadata)
  if (typeof window !== 'undefined') {
    window.apiV2Response = data
    
    // Store screen status - crucial for sleep mode detection
    if (data.status) {
      window.screenStatus = data.status
      _log('info','diapo','listeDiapoV2: screen status = ' + data.status)
    }
    
    // Store sleep mode config
    if (data.typeHorsPlage) window.typeHorsPlage = data.typeHorsPlage
    if (data.imageHorsPlage) window.imageHorsPlage = data.imageHorsPlage
    if (data.prochainDemarrage) window.prochainDemarrage = data.prochainDemarrage
    
    // Store screen config
    if (data.luminosite !== undefined) window.luminosite = data.luminosite
    if (data.refreshInterval) window.refreshInterval = parseInt(data.refreshInterval) || 300
    _log('debug','diapo','listeDiapoV2: stored apiV2Response, refreshInterval=' + window.refreshInterval)
  }
  
  // If status is sleep, return empty array (caller will handle sleep mode)
  if (data.status === 'sleep') {
    _log('info','diapo','listeDiapoV2: screen is in sleep mode, no media to display')
    return ArrayImg
  }

  if (!data || !data.timeline || !Array.isArray(data.timeline)) {
    _log('warn','diapo','listeDiapoV2: no timeline in response')
    return ArrayImg
  }

  // Check if priority mode is active (from API field or by scanning timeline)
  var hasPrioritaire = data.modePrioritaire === true
  if (!hasPrioritaire) {
    // Fallback: scan timeline for priority diapos (backward compatibility)
    for (var i = 0; i < data.timeline.length; i++) {
      if (data.timeline[i] && data.timeline[i].diapoType === 'prioritaire') {
        hasPrioritaire = true
        break
      }
    }
  }
  
  if (hasPrioritaire) {
    _log('info','diapo','listeDiapoV2: priority mode active - filtering to show only priority media')
  }

  // Parse timeline items - server already computed which medias are active
  for (var i = 0; i < data.timeline.length; i++) {
    try {
      var item = data.timeline[i]
      if (!item) continue
      
      // If priority diapo exists, skip non-priority items
      if (hasPrioritaire && item.diapoType !== 'prioritaire') {
        continue
      }
      
      // API v2 fields: mediaType, mediaFichier, duree
      var mediaType = item.mediaType || null
      var fichier = item.mediaFichier || null
      var duree = item.duree || 5  // default 5 seconds
      
      if (mediaType && fichier) {
        ArrayImg.push([mediaType, encodeURIComponent(fichier), duree])
      }
    } catch (e) {
      _log('warn','diapo','listeDiapoV2: skipping malformed timeline item', e.message)
    }
  }

  _log('info','diapo','listeDiapoV2: parsed ' + ArrayImg.length + ' media entries from timeline' + (hasPrioritaire ? ' (priority only)' : ''))
  return ArrayImg
}

/**
 * Parse API v1 format (legacy format with ligneMedia structure)
 * API v1 returns: [ { DateDebutDiapo, DateFinDiapo, ligneMedia: [...] }, ... ]
 */
function listeDiapoV1(data) {
  var ArrayImg = [];
  _log('info','diapo','listeDiapoV1: parsing legacy API format')

  if (!data || !Array.isArray(data) || data.length === 0) {
    _log('warn','diapo','listeDiapoV1: no data provided or empty')
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

  _log('debug','diapo','listeDiapoV1: parsed array', ArrayImg)
  return ArrayImg
}

/**
 * Main parser - auto-detects API version and delegates
 * @param {Object|Array} data - API response data
 * @returns {Array} - Array of [mediaType, fichier, duree] tuples
 */
function listeDiapo(data) {
  _log('info','diapo','listeDiapo: start parsing diapo data')

  if (!data) {
    _log('warn','diapo','listeDiapo: no data provided')
    ArrayMedia = []
    return []
  }

  var ArrayImg = []
  
  // Detect API version by response structure
  // API v2 indicators: has 'status' field, or 'timeline' array, or 'ecranId'
  if (data.status || (data.timeline && Array.isArray(data.timeline)) || data.ecranId !== undefined) {
    // API v2: new format with status field
    _log('info','diapo','listeDiapo: detected API v2 format')
    ArrayImg = listeDiapoV2(data)
  } else if (Array.isArray(data)) {
    // API v1: root is array of diapos
    _log('info','diapo','listeDiapo: detected API v1 format')
    ArrayImg = listeDiapoV1(data)
  } else {
    _log('warn','diapo','listeDiapo: unknown data format', typeof data)
  }

  ArrayMedia = ArrayImg
  if (ArrayImg.length === 0) {
    _log('warn','diapo','parsed 0 media entries - check API data / date ranges')
  } else {
    _log('info','diapo','parsed ' + ArrayImg.length + ' media entries')
  }
  return ArrayImg
}

// Exports for testability when running under Node (mocha)
try { module.exports = { listeDiapo, listeDiapoV1, listeDiapoV2 } } catch (e) { }

const getDiapoJson = async () => {
    try {
  _log('info','diapo','getDiapoJson: fetching ' + urlAPI)
      
      // Phase 2 Week 2: Use ApiManager if available (with ErrorHandler resilience)
      if (typeof window !== 'undefined' && window.apiManager) {
        const res = await window.apiManager.getDiapoWithErrorHandling(urlAPI)
        _log('info','diapo','getDiapoJson: fetch success via ApiManager ' + (res && res.status))
        return res
      }
      
      // Fallback to direct axios call if ApiManager not available
      const res = await axios.get(urlAPI)
      _log('info','diapo','getDiapoJson: fetch success (direct axios) ' + (res && res.status))
      return res
    } catch (error) {
  _log('error','diapo','getDiapoJson: error', error && error.message)
    }
  }

  const requestJsonDiapo = async () => {
    const JsonDiapo = await getDiapoJson()
    if (JsonDiapo) {
      ArrayDiapo = listeDiapo(JsonDiapo.data)

      // Check for sleep mode (API v2)
      if (typeof window !== 'undefined' && window.screenStatus === 'sleep') {
        _log('info','diapo','screen is in sleep mode - showing sleep screen')
        showSleepScreen()
        return
      }
      
      // If we were sleeping but now active, hide sleep screen
      if (typeof window !== 'undefined' && typeof hideSleepScreen === 'function') {
        hideSleepScreen()
      }

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
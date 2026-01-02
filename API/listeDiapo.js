// Safe logger for this module (works in renderer or Node tests)
var _log = (function(){
  try {
    if (typeof window !== 'undefined' && window.logger) return function(level, tag, ...args){ try { if (window.logger && typeof window.logger[level] === 'function') return window.logger[level](tag, ...args); } catch(e){} }
  } catch(e) {}
  return function(level, tag, ...args){ try { if (console && typeof console[level] === 'function') return console[level](tag, ...args); return console.log(tag, ...args) } catch(e){ try{ console.log(tag, ...args) }catch(_){} }
  }
})()

/**
 * Initialise et affiche le planning selon la configuration
 * @param {Object} planningConfig - { actif, position, refreshInterval, duree, ... }
 * 
 * Modes de position:
 * - fullscreen: Le planning est intégré dans la boucle comme un média (avec duree)
 * - overlay-bottom/right: Le planning reste affiché par-dessus les diapos
 * - split-left/right: Le planning est affiché à côté des diapos
 */
function initPlanningDisplay(planningConfig) {
  if (!window.planningManager) {
    _log('warn','planning','initPlanningDisplay: planningManager not available')
    return
  }
  
  _log('info','planning','initPlanningDisplay: position=' + planningConfig.position)
  
  // En mode fullscreen, ne pas afficher en permanence - sera géré par la boucle
  if (planningConfig.position === 'fullscreen') {
    _log('info','planning','initPlanningDisplay: fullscreen mode - planning will be in diapo loop, not permanent overlay')
    return
  }
  
  // Initialiser le manager si pas encore fait
  if (!window.planningManager.container) {
    window.planningManager.init()
  }
  
  // Configurer la position
  var container = window.planningManager.container
  if (container) {
    switch (planningConfig.position) {        
      case 'overlay-bottom':
        // Barre en bas sur les diapos
        container.style.cssText = `
          position: fixed;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 200px;
          z-index: 600;
          background: rgba(0, 0, 0, 0.85);
        `
        break
        
      case 'overlay-right':
        // Panneau à droite sur les diapos
        container.style.cssText = `
          position: fixed;
          top: 0;
          right: 0;
          width: 400px;
          height: 100%;
          z-index: 600;
          background: rgba(0, 0, 0, 0.85);
        `
        break
        
      case 'split-left':
        // Planning à gauche, diapos à droite
        container.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 35%;
          height: 100%;
          z-index: 500;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        `
        // Ajuster le container des médias
        var mediaContainer = document.getElementById('mediaContainer')
        if (mediaContainer) {
          mediaContainer.style.width = '65%'
          mediaContainer.style.left = '35%'
        }
        break
        
      case 'split-right':
        // Diapos à gauche, planning à droite
        container.style.cssText = `
          position: fixed;
          top: 0;
          right: 0;
          width: 35%;
          height: 100%;
          z-index: 500;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        `
        // Ajuster le container des médias
        var mediaContainer = document.getElementById('mediaContainer')
        if (mediaContainer) {
          mediaContainer.style.width = '65%'
          mediaContainer.style.right = '35%'
          mediaContainer.style.left = '0'
        }
        break
        
      default:
        _log('warn','planning','initPlanningDisplay: unknown position, not showing overlay')
        return
    }
  }
  
  // Configurer l'intervalle de refresh
  if (planningConfig.refreshInterval) {
    window.planningManager.refreshInterval = planningConfig.refreshInterval * 1000
  }
  
  // Afficher le planning en overlay permanent (0 = pas de timeout)
  window.planningManager.show(0)
}

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
    
    // Store programmation for client-side fallback
    if (data.programmation) window.lastProgrammation = data.programmation
    
    // Store screen config
    if (data.luminosite !== undefined) window.luminosite = data.luminosite
    if (data.refreshInterval) window.refreshInterval = parseInt(data.refreshInterval) || 300
    _log('debug','diapo','listeDiapoV2: stored apiV2Response, refreshInterval=' + window.refreshInterval)
    
    // Store and handle planning config (can be in data.planning or data.config.planning)
    var planningConfig = data.planning || (data.config && data.config.planning) || null
    if (planningConfig) {
      window.planningConfig = planningConfig
      _log('info','diapo','listeDiapoV2: planning config received, actif=' + planningConfig.actif)
      
      // Trigger planning display if actif
      if (planningConfig.actif && window.planningManager) {
        _log('info','diapo','listeDiapoV2: planning is active, triggering PlanningManager')
        // Defer to allow DOM to be ready
        setTimeout(function() {
          initPlanningDisplay(planningConfig)
        }, 100)
      } else if (!planningConfig.actif && window.planningManager) {
        // Hide planning if it was previously visible
        window.planningManager.hide()
      }
    }
  }
  
  // If status is sleep, return empty array (caller will handle sleep mode)
  if (data.status === 'sleep') {
    _log('info','diapo','listeDiapoV2: screen is in sleep mode, no media to display')
    return ArrayImg
  }
  
  // CLIENT-SIDE FALLBACK: Si le serveur dit "active" mais on est hors plage, forcer le sleep
  if (data.status === 'active' && data.programmation) {
    if (typeof isWithinSchedule === 'function' && !isWithinSchedule(data.programmation)) {
      _log('warn','diapo','listeDiapoV2: server says active but client detects we are outside schedule - forcing sleep')
      window.screenStatus = 'sleep'
      return ArrayImg
    }
  }

  // If timeline is empty or missing, try to build it from diapos with isEventTemplate
  if (!data.timeline || !Array.isArray(data.timeline) || data.timeline.length === 0) {
    _log('info','diapo','listeDiapoV2: timeline empty, checking for event templates in diapos')
    
    // Look for active diapos with isEventTemplate and evenement data
    if (data.diapos && Array.isArray(data.diapos)) {
      for (var i = 0; i < data.diapos.length; i++) {
        var diapo = data.diapos[i]
        if (diapo && diapo.actif && diapo.isEventTemplate && diapo.evenement) {
          _log('info','diapo','listeDiapoV2: found event template diapo: ' + diapo.nom)
          // Check if event is still valid (not finished)
          var now = new Date()
          var eventDate = diapo.evenement.date || ''
          var eventHeureFin = diapo.evenement.heureFin || ''
          
          // Build end datetime to check if event is over
          var isEventOver = false
          if (eventDate && eventHeureFin) {
            try {
              var endDateTime = new Date(eventDate + 'T' + eventHeureFin + ':00')
              isEventOver = now > endDateTime
              if (isEventOver) {
                _log('info','diapo','listeDiapoV2: skipping finished event "' + diapo.nom + '" (ended at ' + eventHeureFin + ')')
              }
            } catch(e) {
              _log('warn','diapo','listeDiapoV2: could not parse event end time')
            }
          }
          
          if (!isEventOver) {
            // Build templateData from evenement
            var templateData = {
              type: 'evenement',
              titre: diapo.evenement.nom || diapo.nom,
              lieu: diapo.evenement.salle || '',
              heureDebut: diapo.evenement.heureDebut || '',
              heureFin: diapo.evenement.heureFin || '',
              date: diapo.evenement.date || '',
              description: diapo.evenement.description || '',
              couleur: diapo.evenement.couleur || '#3498db'
            }
            
            // Add to ArrayImg as template type (15 seconds default for events)
            ArrayImg.push(['template', templateData, 15, diapo.id])
            _log('info','diapo','listeDiapoV2: generated template for event "' + templateData.titre + '"')
          }
        }
      }
    }
    
    // If we found event templates, add planning to the loop if fullscreen mode
    if (ArrayImg.length > 0) {
      _log('info','diapo','listeDiapoV2: generated ' + ArrayImg.length + ' event templates from diapos')
      
      // In fullscreen mode, add planning as a media item in the loop
      var planningConfig = window.planningConfig
      if (planningConfig && planningConfig.actif && planningConfig.position === 'fullscreen') {
        var planningDuree = planningConfig.duree || 20 // 20 seconds default for planning
        ArrayImg.push(['planning', { type: 'planning' }, planningDuree, 'planning-item'])
        _log('info','diapo','listeDiapoV2: added planning to loop with duree=' + planningDuree + 's')
      }
      
      return ArrayImg
    }
    
    _log('warn','diapo','listeDiapoV2: no timeline and no event templates found')
    return ArrayImg
  }
  
  // In fullscreen mode with timeline, also add planning to the loop
  var planningConfig = window.planningConfig
  if (planningConfig && planningConfig.actif && planningConfig.position === 'fullscreen') {
    // We'll add planning after processing the timeline
    window._addPlanningToLoop = true
    window._planningDuree = planningConfig.duree || 20
    // TODO SERVER: Ajouter paramètre "slideDuree" dans planning config API
    // Durée de chaque slide/page du carousel (en secondes)
    window._planningSlideDuree = planningConfig.slideDuree || 10
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

  // Store diapos with templateData for template rendering
  if (typeof window !== 'undefined') {
    window.diaposWithTemplates = []
    if (data.diapos && Array.isArray(data.diapos)) {
      window.diaposWithTemplates = data.diapos.filter(function(d) {
        return d && d.templateData && typeof d.templateData === 'object'
      })
      if (window.diaposWithTemplates.length > 0) {
        _log('info','diapo','listeDiapoV2: found ' + window.diaposWithTemplates.length + ' diapos with templateData')
      }
    }
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
      
      // Check if this timeline item has templateData (dynamic template instead of media file)
      if (item.templateData && typeof item.templateData === 'object') {
        // Template type: store as special entry [type='template', templateData, duree]
        var templateDuree = item.duree || 15  // default 15 seconds for templates
        ArrayImg.push(['template', item.templateData, templateDuree, item.diapoId])
        _log('info','diapo','listeDiapoV2: added template item type=' + item.templateData.type)
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
  
  // Add planning to loop if fullscreen mode is active
  if (window._addPlanningToLoop && ArrayImg.length > 0) {
    ArrayImg.push(['planning', { type: 'planning' }, window._planningDuree, 'planning-item'])
    _log('info','diapo','listeDiapoV2: added planning to loop with duree=' + window._planningDuree + 's')
  }
  
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

  // Timer de refresh automatique
  var refreshTimer = null
  
  function startRefreshTimer() {
    if (refreshTimer) {
      clearInterval(refreshTimer)
    }
    
    // Utiliser l'intervalle fourni par l'API (défaut: 300 secondes = 5 minutes)
    var intervalMs = (window.refreshInterval || 300) * 1000
    _log('info','diapo','startRefreshTimer: scheduling API refresh every ' + (intervalMs/1000) + 's')
    
    refreshTimer = setInterval(async function() {
      _log('info','diapo','refreshTimer: refreshing diapo data from API...')
      await requestJsonDiapo()
      _log('info','diapo','refreshTimer: refresh complete, ArrayDiapo has ' + (ArrayDiapo ? ArrayDiapo.length : 0) + ' items')
    }, intervalMs)
  }
  
  function stopRefreshTimer() {
    if (refreshTimer) {
      clearInterval(refreshTimer)
      refreshTimer = null
      _log('info','diapo','stopRefreshTimer: timer stopped')
    }
  }
  
  // Exposer les fonctions globalement pour pouvoir les contrôler
  if (typeof window !== 'undefined') {
    window.startDiapoRefreshTimer = startRefreshTimer
    window.stopDiapoRefreshTimer = stopRefreshTimer
  }

  const requestJsonDiapo = async () => {
    const JsonDiapo = await getDiapoJson()
    if (JsonDiapo) {
      // Sauvegarder dans le cache pour le mode offline
      if (typeof window !== 'undefined' && window.apiCache && JsonDiapo.data) {
        window.apiCache.set('diapo', JsonDiapo.data)
        _log('info','diapo','API response cached for offline mode')
        
        // Indiquer si on est en mode offline
        if (JsonDiapo.offline) {
          _log('warn','diapo','Using CACHED data (offline mode)')
        }
      }
      
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
        // Démarrer le timer de refresh automatique après l'init
        startRefreshTimer()
      }
    }
  }
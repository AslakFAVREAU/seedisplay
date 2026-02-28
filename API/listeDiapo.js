// Safe logger for this module (works in renderer or Node tests)
var _log = (function(){
  try {
    if (typeof window !== 'undefined' && window.logger) return function(level, tag, ...args){ try { if (window.logger && typeof window.logger[level] === 'function') return window.logger[level](tag, ...args); } catch(e){} }
  } catch(e) {}
  return function(level, tag, ...args){ try { if (console && typeof console[level] === 'function') return console[level](tag, ...args); return console.log(tag, ...args) } catch(e){ try{ console.log(tag, ...args) }catch(_){} }
  }
})()

/**
 * Applique les dimensions d'affichage reçues de l'API
 * Adapte le container media aux dimensions configurées dans SOEK
 * Position: haut-gauche, taille exacte en pixels
 * Sauvegarde dans la config locale pour persistence au redémarrage
 * @param {Object} data - Réponse API avec dimensions, customResolution, orientation, ratio
 */
function applyScreenDimensions(data) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  
  var width = null
  var height = null
  var orientation = data.orientation || 'landscape'
  var ratio = data.ratio || '16:9'
  var isCustomResolution = false  // true seulement si customResolution est défini
  
  // Priorité aux dimensions custom si présentes
  if (data.customResolution && data.customResolution.largeur && data.customResolution.hauteur) {
    width = data.customResolution.largeur
    height = data.customResolution.hauteur
    isCustomResolution = true  // Format personnalisé → pas de fullscreen
    _log('info', 'screen', 'applyScreenDimensions: using customResolution ' + width + 'x' + height + ' (isCustom=true)')
  } else if (data.dimensions) {
    // Parse "1920x1080" format - c'est un format standard, on reste en fullscreen
    var parts = data.dimensions.split('x')
    if (parts.length === 2) {
      width = parseInt(parts[0], 10)
      height = parseInt(parts[1], 10)
      isCustomResolution = false  // Format standard → fullscreen
      _log('info', 'screen', 'applyScreenDimensions: using dimensions ' + width + 'x' + height + ' (isCustom=false, fullscreen)')
    }
  }
  
  // Store for later use
  window.screenDimensions = {
    width: width,
    height: height,
    orientation: orientation,
    ratio: ratio,
    isCustomResolution: isCustomResolution
  }
  
  // Sauvegarder dans la config locale pour le prochain démarrage
  if (window.configManager && window.configManager.isLoaded) {
    var configUpdates = {
      screenWidth: width,
      screenHeight: height,
      screenOrientation: orientation,
      screenRatio: ratio,
      isCustomResolution: isCustomResolution  // Important: détermine si fullscreen ou pas au démarrage
    }
    window.configManager.setMultiple(configUpdates, true).then(function() {
      _log('info', 'screen', 'applyScreenDimensions: saved to config (isCustomResolution=' + isCustomResolution + ')')
    }).catch(function(e) {
      _log('warn', 'screen', 'applyScreenDimensions: failed to save config: ' + e.message)
    })
  }
  
  if (!width || !height) {
    _log('debug', 'screen', 'applyScreenDimensions: no valid dimensions, using fullscreen')
    return
  }
  
  // Ne redimensionner que si c'est un format personnalisé, sinon on reste en fullscreen
  if (isCustomResolution) {
    _applyDimensionsToDOM(width, height)
  } else {
    _log('info', 'screen', 'applyScreenDimensions: standard format ' + width + 'x' + height + ', keeping fullscreen (no resize)')
  }
}

/**
 * Applique les dimensions au DOM et redimensionne la fenêtre Electron
 */
function _applyDimensionsToDOM(width, height) {
  if (!width || !height) return
  
  // En mode custom, les dimensions sont gérées par main.js via insertCSS - ne rien toucher
  if (window.IS_CUSTOM_MODE) {
    _log('info', 'screen', '_applyDimensionsToDOM: SKIPPED - custom mode active, dimensions managed by main.js')
    return
  }
  
  _log('info', 'screen', '_applyDimensionsToDOM: applying ' + width + 'x' + height)
  
  // Redimensionner la fenêtre Electron elle-même
  if (window.api && typeof window.api.resizeWindow === 'function') {
    window.api.resizeWindow(width, height).then(function(success) {
      if (success) {
        _log('info', 'screen', '_applyDimensionsToDOM: window resized to ' + width + 'x' + height)
      } else {
        _log('warn', 'screen', '_applyDimensionsToDOM: window resize failed, applying CSS fallback')
        _applyCssDimensions(width, height)
      }
    }).catch(function(e) {
      _log('warn', 'screen', '_applyDimensionsToDOM: resize error, applying CSS fallback: ' + e.message)
      _applyCssDimensions(width, height)
    })
  } else {
    // Fallback CSS si l'API n'est pas disponible
    _log('debug', 'screen', '_applyDimensionsToDOM: no resizeWindow API, using CSS')
    _applyCssDimensions(width, height)
  }
  
  // Store applied dimensions for debug overlay
  window.appliedDimensions = {
    width: width,
    height: height,
    position: 'top-left'
  }
}

/**
 * Fallback CSS si le resize de fenêtre ne fonctionne pas
 */
function _applyCssDimensions(width, height) {
  // En mode custom, ne pas toucher aux dimensions CSS
  if (window.IS_CUSTOM_MODE) {
    _log('info', 'screen', '_applyCssDimensions: SKIPPED - custom mode active')
    return
  }
  
  // Apply to main containers - top-left position, exact dimensions
  var mainContainers = ['mediaContainer', 'pageDefault']
  
  mainContainers.forEach(function(id) {
    var el = document.getElementById(id)
    if (el) {
      el.style.setProperty('width', width + 'px', 'important')
      el.style.setProperty('height', height + 'px', 'important')
      el.style.setProperty('top', '0', 'important')
      el.style.setProperty('left', '0', 'important')
      el.style.setProperty('right', 'auto', 'important')
      el.style.setProperty('bottom', 'auto', 'important')
    }
  })
  
  // Child elements fill their parent (100%)
  var childContainers = ['divImg1', 'divImg2', 'divVideo1', 'divVideo2', 'templateContainer']
  
  childContainers.forEach(function(id) {
    var el = document.getElementById(id)
    if (el) {
      el.style.setProperty('width', '100%', 'important')
      el.style.setProperty('height', '100%', 'important')
    }
  })
  
  // Black background for any overflow
  document.body.style.setProperty('background-color', '#000', 'important')
  document.body.style.setProperty('overflow', 'hidden', 'important')
  
  _log('info', 'screen', '_applyCssDimensions: done')
}

/**
 * Applique les dimensions sauvegardées dans la config (appelé au démarrage)
 */
function applyScreenDimensionsFromConfig() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  
  if (!window.configManager || !window.configManager.isLoaded) {
    _log('debug', 'screen', 'applyScreenDimensionsFromConfig: configManager not ready')
    return
  }
  
  var dims = window.configManager.screenDimensions
  var isCustom = window.configManager.config && window.configManager.config.isCustomResolution === true
  
  if (dims.width && dims.height) {
    _log('info', 'screen', 'applyScreenDimensionsFromConfig: found saved dimensions ' + dims.width + 'x' + dims.height + ', isCustomResolution=' + isCustom)
    
    // Store for later use
    window.screenDimensions = dims
    
    // Apply to DOM ONLY if custom resolution, otherwise stay fullscreen
    if (isCustom) {
      _applyDimensionsToDOM(dims.width, dims.height)
    } else {
      _log('info', 'screen', 'applyScreenDimensionsFromConfig: standard format, keeping fullscreen')
    }
  } else {
    _log('debug', 'screen', 'applyScreenDimensionsFromConfig: no saved dimensions')
  }
}

/**
 * Vérifie si un template est actuellement actif (dates et programmation)
 * @param {Object} template - Template avec dates et programmation optionnelles
 * @returns {boolean}
 */
function isTemplateActive(template) {
  if (!template) return false
  
  var now = new Date()
  var currentTime = now.toTimeString().slice(0, 5) // "HH:mm"
  var currentDay = now.getDay() // 0=Dim, 1=Lun, ...
  
  // Check date range
  if (template.dateDebut) {
    var debut = new Date(template.dateDebut)
    if (now < debut) return false
  }
  if (template.dateFin) {
    var fin = new Date(template.dateFin)
    // Si dateFin est une date sans heure, elle doit inclure toute la journée
    if (template.dateFin.length === 10) { // "YYYY-MM-DD"
      fin.setHours(23, 59, 59, 999)
    }
    if (now > fin) return false
  }
  
  // Check specific date (for anniversaries, menus)
  if (template.date && !template.dateDebut && !template.dateFin) {
    var targetDate = new Date(template.date)
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    var target = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate())
    if (today.getTime() !== target.getTime()) return false
  }
  
  // Check programmation (hours / days)
  if (template.programmation) {
    var prog = template.programmation
    
    // Check days
    if (prog.joursSemaine && Array.isArray(prog.joursSemaine) && prog.joursSemaine.length > 0) {
      if (!prog.joursSemaine.includes(currentDay)) return false
    }
    
    // Check hours
    if (prog.heureDebut && prog.heureFin) {
      if (currentTime < prog.heureDebut || currentTime > prog.heureFin) return false
    }
  }
  
  return true
}

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
      case 'footer':
      case 'overlay-bottom':
        // Barre en bas sur les diapos - forcer avec setAttribute pour écraser le CSS
        container.setAttribute('style', `
          position: fixed !important;
          bottom: 0 !important;
          top: auto !important;
          left: 0 !important;
          width: 100% !important;
          height: 200px !important;
          z-index: 600 !important;
          background: linear-gradient(135deg, #f5f7fa, #e4e8ed) !important;
          display: block !important;
        `)
        // Ajuster le container des médias pour ne pas être caché par le planning
        var heightRef = window.IS_CUSTOM_MODE ? window.CUSTOM_HEIGHT + 'px' : '100vh'
        var mediaContainer = document.getElementById('mediaContainer')
        if (mediaContainer) {
          mediaContainer.style.setProperty('height', 'calc(' + heightRef + ' - 200px)', 'important')
          mediaContainer.style.setProperty('max-height', 'calc(' + heightRef + ' - 200px)', 'important')
          mediaContainer.style.setProperty('overflow', 'hidden', 'important')
        }
        // Ajuster aussi les divImg pour le resize
        var divImg1 = document.getElementById('divImg1')
        var divImg2 = document.getElementById('divImg2')
        if (divImg1) {
          divImg1.style.setProperty('height', 'calc(' + heightRef + ' - 200px)', 'important')
          divImg1.style.setProperty('max-height', 'calc(' + heightRef + ' - 200px)', 'important')
        }
        if (divImg2) {
          divImg2.style.setProperty('height', 'calc(' + heightRef + ' - 200px)', 'important')
          divImg2.style.setProperty('max-height', 'calc(' + heightRef + ' - 200px)', 'important')
        }
        // Ajuster pageDefault aussi
        var pageDefault = document.getElementById('pageDefault')
        if (pageDefault) {
          pageDefault.style.setProperty('height', 'calc(' + heightRef + ' - 200px)', 'important')
          pageDefault.style.setProperty('max-height', 'calc(' + heightRef + ' - 200px)', 'important')
        }
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
      
      case 'sidebar':
      case 'split-right':
        // Diapos à gauche, planning à droite
        container.setAttribute('style', `
          position: fixed !important;
          top: 0 !important;
          right: 0 !important;
          left: auto !important;
          width: 35% !important;
          height: 100% !important;
          z-index: 500 !important;
          background: linear-gradient(135deg, #f5f7fa, #e4e8ed) !important;
          display: block !important;
        `)
        // Ajuster le container des médias pour occuper 65% à gauche
        var mediaContainer = document.getElementById('mediaContainer')
        if (mediaContainer) {
          mediaContainer.style.setProperty('width', '65%', 'important')
          mediaContainer.style.setProperty('left', '0', 'important')
          mediaContainer.style.setProperty('right', 'auto', 'important')
          mediaContainer.style.setProperty('overflow', 'hidden', 'important')
        }
        // Ajuster les divImg pour couvrir tout l'espace disponible
        var divImg1 = document.getElementById('divImg1')
        var divImg2 = document.getElementById('divImg2')
        if (divImg1) {
          divImg1.style.setProperty('width', '100%', 'important')
          divImg1.style.setProperty('height', '100%', 'important')
          divImg1.style.setProperty('background-size', 'contain', 'important')
          divImg1.style.setProperty('background-position', 'center', 'important')
        }
        if (divImg2) {
          divImg2.style.setProperty('width', '100%', 'important')
          divImg2.style.setProperty('height', '100%', 'important')
          divImg2.style.setProperty('background-size', 'contain', 'important')
          divImg2.style.setProperty('background-position', 'center', 'important')
        }
        // Ajuster pageDefault aussi
        var pageDefault = document.getElementById('pageDefault')
        if (pageDefault) {
          pageDefault.style.setProperty('width', '65%', 'important')
          pageDefault.style.setProperty('overflow', 'hidden', 'important')
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
    
    // Apply screen dimensions from API (resolution/ratio adaptation)
    if (data.dimensions || data.customResolution) {
      applyScreenDimensions(data)
    }
    
    // Store sleep mode config
    if (data.typeHorsPlage) window.typeHorsPlage = data.typeHorsPlage
    if (data.imageHorsPlage) window.imageHorsPlage = data.imageHorsPlage
    if (data.prochainDemarrage) window.prochainDemarrage = data.prochainDemarrage
    
    // Store background image for pageDefault (fond d'écran via API)
    if (data.fondEcran) {
      window.fondEcran = data.fondEcran
      applyPageDefaultBackground(data.fondEcran)
    }
    
    // Store hide default page setting (boucle continue sans pageDefault)
    if (data.masquerPageDefault !== undefined) {
      window.masquerPageDefault = data.masquerPageDefault
      _log('info','diapo','listeDiapoV2: masquerPageDefault=' + data.masquerPageDefault)
    }
    
    // Store programmation for client-side fallback
    if (data.programmation) window.lastProgrammation = data.programmation
    
    // Store screen config
    if (data.luminosite !== undefined) window.luminosite = data.luminosite
    if (data.refreshInterval) {
      // Limiter entre 60s (1 min) et 600s (10 min) pour éviter des valeurs aberrantes
      var apiInterval = parseInt(data.refreshInterval) || 300
      window.refreshInterval = Math.min(600, Math.max(60, apiInterval))
      if (apiInterval !== window.refreshInterval) {
        _log('warn','diapo','listeDiapoV2: refreshInterval clamped from ' + apiInterval + ' to ' + window.refreshInterval)
      }
    }
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
    
    // Apply meteo config from API (overrides local config if present)
    var meteoConfig = data.config && data.config.meteo
    if (meteoConfig) {
      _log('info','diapo','listeDiapoV2: meteo config from API: actif=' + meteoConfig.actif + ', lat=' + meteoConfig.latitude + ', lon=' + meteoConfig.longitude)
      // Apply latitude/longitude if provided by API
      if (meteoConfig.latitude !== null && meteoConfig.latitude !== undefined) {
        window.meteoLat = meteoConfig.latitude
      }
      if (meteoConfig.longitude !== null && meteoConfig.longitude !== undefined) {
        window.meteoLon = meteoConfig.longitude
      }
      if (meteoConfig.units) {
        window.meteoUnits = meteoConfig.units
      }
      // Apply meteo visibility
      if (meteoConfig.actif === false) {
        var zoneMeteo = document.getElementById('zone_meteo')
        if (zoneMeteo) zoneMeteo.style.display = 'none'
        _log('info','diapo','listeDiapoV2: météo désactivée via API')
      } else if (meteoConfig.actif === true) {
        var zoneMeteo = document.getElementById('zone_meteo')
        if (zoneMeteo) zoneMeteo.style.display = 'flex'
      }
    }
    
    // Apply affichage config from API (week, logo, etc.)
    var affichageConfig = data.config && data.config.affichage
    if (affichageConfig) {
      _log('info','diapo','listeDiapoV2: affichage config from API:', JSON.stringify(affichageConfig))
      window.affichageConfig = affichageConfig
      // Week display
      if (affichageConfig.weekDisplay === false) {
        var weekDiv = document.getElementById('weekDiv')
        if (weekDiv) weekDiv.style.display = 'none'
      } else if (affichageConfig.weekDisplay === true) {
        var weekDiv = document.getElementById('weekDiv')
        if (weekDiv) weekDiv.style.display = 'flex'
      }
      // Logo SOE
      if (affichageConfig.logoSOE !== undefined && affichageConfig.logoSOE !== null) {
        var footer = document.getElementById('footer')
        var bottomBar = document.getElementById('bottomBar')
        var showLogo = (affichageConfig.logoSOE === true || affichageConfig.logoSOE === 'true' || affichageConfig.logoSOE === 1 || affichageConfig.logoSOE === '1')
        if (footer) footer.style.display = showLogo ? 'flex' : 'none'
        if (bottomBar) bottomBar.style.display = showLogo ? 'flex' : 'none'
      }
      // Store for later use
      if (affichageConfig.weekNo !== undefined) window.weekNo = affichageConfig.weekNo
      if (affichageConfig.weekType !== undefined) window.weekType = affichageConfig.weekType
    }
    
    // Son actif (audio vidéos) - à la racine de la réponse API
    if (data.sonActif !== undefined) {
      window.sonActif = data.sonActif
      _log('info','diapo','listeDiapoV2: sonActif set to', data.sonActif)
    }
    
    // Update SleepManager with current config (luminosity, night mode, etc.)
    if (window.sleepManager) {
      const ecranConfig = {
        luminosite: data.luminosite ?? window.luminosite ?? 100,
        sleepMode: data.sleepMode || null
      }
      window.sleepManager.updateConfig(ecranConfig)
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
  
  // NEW: Process dynamic templates from 'templates' array in API response
  // Templates dynamiques: anniversaires, menus, annonces avec ordre et durée
  if (data.templates && Array.isArray(data.templates) && data.templates.length > 0) {
    _log('info','diapo','listeDiapoV2: processing ' + data.templates.length + ' dynamic templates')
    
    // Log all received templates for debugging
    for (var td = 0; td < data.templates.length; td++) {
      var tdbg = data.templates[td]
      _log('info','diapo','listeDiapoV2: template[' + td + '] type="' + (tdbg.type || 'NONE') + '" nom="' + (tdbg.nom || '') + '" actif=' + tdbg.actif + ' dataKeys=' + (tdbg.data ? Object.keys(tdbg.data).join(',') : 'NO_DATA'))
    }
    
    // Sort templates by ordre
    var sortedTemplates = data.templates.slice().sort(function(a, b) {
      return (a.ordre || 0) - (b.ordre || 0)
    })
    
    for (var t = 0; t < sortedTemplates.length; t++) {
      var template = sortedTemplates[t]
      if (!template || !template.type) continue
      
      // Check if template is active (actif flag from API)
      if (template.actif === false) {
        _log('debug','diapo','listeDiapoV2: skipping inactive template "' + (template.nom) + '"')
        continue
      }
      
      // Normalize type to lowercase for comparison
      var templateType = (template.type || '').toLowerCase()
      // Handle plural types from API (ANNIVERSAIRES -> anniversaire)
      if (templateType === 'anniversaires') templateType = 'anniversaire'
      if (templateType === 'menus') templateType = 'menu'
      if (templateType === 'annonces') templateType = 'annonce'
      if (templateType === 'trafic') templateType = 'trafic'
      
      // API uses dureeAffichage, fallback to duree
      var templateDuree = template.dureeAffichage || template.duree || 15 // Default 15 seconds
      
      // Get presentation/config from API
      var presentation = template.presentation || {}
      var config = template.config || {}
      
      var templateData = {
        type: templateType,
        titre: config.titre || template.nom,
        sousTitre: template.sousTitre,
        message: template.message,
        // Couleurs from presentation
        couleur: presentation.couleurPrimaire || presentation.couleur_texte || template.couleur,
        backgroundColor: presentation.backgroundColor || presentation.couleur_fond,
        emoji: presentation.emoji,
        icon: template.icon,
        image: template.image,
        backgroundImage: template.backgroundImage,
        date: template.date,
        dateDebut: template.dateDebut,
        dateFin: template.dateFin,
        lieu: template.lieu,
        contact: template.contact,
        // Pass full config/presentation for advanced rendering
        config: config,
        presentation: presentation
      }
      
      // Type-specific data from template.data (API structure)
      var apiData = template.data || {}
      
      switch (templateType) {
        case 'anniversaire':
          // API sends data.anniversairesDuJour and data.personnes
          templateData.personnes = apiData.anniversairesDuJour || apiData.personnes || []
          templateData.totalPersonnes = apiData.totalPersonnes || templateData.personnes.length
          templateData.afficherAge = config.afficherAge || config.afficher_age
          templateData.afficherClasse = config.afficherClasse
          
          // Skip if no birthdays today
          if (!templateData.personnes || templateData.personnes.length === 0) {
            _log('info','diapo','listeDiapoV2: skipping anniversaire template - no birthdays today')
            continue
          }
          break
          
        case 'menu':
          // API sends data.menus (array with dates), data.menuDuJour, data.menusDeLaSemaine
          var menuDuJour = apiData.menuDuJour || {}
          var menuItems = menuDuJour.items || apiData.items || []
          
          // Include full menus array for week mode
          templateData.menus = apiData.menus || []
          templateData.menusDeLaSemaine = apiData.menusDeLaSemaine || []
          templateData.menuDuJour = apiData.menuDuJour
          
          // Parse items by category from API format (fallback for compatibility)
          templateData.entrees = []
          templateData.plats = []
          templateData.accompagnements = []
          templateData.fromages = []
          templateData.desserts = []
          templateData.boissons = []
          templateData.gouters = []
          
          // Map API categories to template arrays
          for (var mi = 0; mi < menuItems.length; mi++) {
            var item = menuItems[mi]
            if (!item || !item.nom) continue
            var cat = (item.categorie || '').toLowerCase()
            if (cat === 'entrée' || cat === 'entree' || cat === 'entrées') {
              templateData.entrees.push(item.nom)
            } else if (cat === 'plat' || cat === 'plats') {
              templateData.plats.push(item.nom)
            } else if (cat === 'accompagnement' || cat === 'accompagnements' || cat === 'garniture') {
              templateData.accompagnements.push(item.nom)
            } else if (cat === 'fromage' || cat === 'fromages') {
              templateData.fromages.push(item.nom)
            } else if (cat === 'dessert' || cat === 'desserts') {
              templateData.desserts.push(item.nom)
            } else if (cat === 'boisson' || cat === 'boissons') {
              templateData.boissons.push(item.nom)
            } else if (cat === 'goûter' || cat === 'gouter' || cat === 'gouters') {
              templateData.gouters.push(item.nom)
            }
          }
          
          // Fallback to direct arrays if provided
          if (templateData.entrees.length === 0 && apiData.entrees) templateData.entrees = apiData.entrees
          if (templateData.plats.length === 0 && apiData.plats) templateData.plats = apiData.plats
          if (templateData.accompagnements.length === 0 && apiData.accompagnements) templateData.accompagnements = apiData.accompagnements
          if (templateData.desserts.length === 0 && apiData.desserts) templateData.desserts = apiData.desserts
          
          templateData.date = menuDuJour.date || template.date
          templateData.prix = apiData.prix || template.prix
          templateData.info = apiData.info || template.info
          templateData.allergenes = config.listeAllergenes || []
          templateData.afficherAllergenes = config.afficherAllergenes
          break
          
        case 'annonce':
          templateData.typeAnnonce = apiData.typeAnnonce || template.typeAnnonce || 'info'
          templateData.label = apiData.label || template.label
          templateData.contenu = apiData.contenu || template.contenu
          break
          
        case 'trafic':
          // Look for arrets/apiKey at multiple levels (data, config, template root)
          templateData.arrets = apiData.arrets || template.arrets || config.arrets || []
          templateData.apiKey = apiData.apiKey || config.apiKey || template.apiKey || ''
          
          _log('info','diapo','listeDiapoV2: trafic template "' + templateData.titre + '" - arrets=' + (templateData.arrets ? templateData.arrets.length : 0) + ', apiKey=' + (templateData.apiKey ? 'yes(' + templateData.apiKey.substring(0,6) + '...)' : 'MISSING'))
          _log('info','diapo','listeDiapoV2: trafic FULL arrets JSON: ' + JSON.stringify(templateData.arrets, null, 0))
          _log('info','diapo','listeDiapoV2: trafic raw apiData: ' + JSON.stringify(apiData, null, 0).substring(0, 500))
          _log('info','diapo','listeDiapoV2: trafic raw config: ' + JSON.stringify(config, null, 0).substring(0, 500))
          _log('debug','diapo','listeDiapoV2: trafic raw data keys: ' + Object.keys(apiData).join(',') + ' | config keys: ' + Object.keys(config).join(',') + ' | template keys: ' + Object.keys(template).join(','))
          
          // Warn but don't skip - show template with error state
          if (!templateData.arrets || templateData.arrets.length === 0) {
            _log('warn','diapo','listeDiapoV2: trafic template has no stops configured - will show empty state')
          }
          if (!templateData.apiKey) {
            _log('warn','diapo','listeDiapoV2: trafic template has no API key - will show error state')
          }
          break
      }
      
      ArrayImg.push(['template', templateData, templateDuree, { templateId: template.id, ordre: template.ordre }])
      _log('info','diapo','listeDiapoV2: added template "' + templateData.titre + '" (type=' + templateType + ', duree=' + templateDuree + 's, ordre=' + template.ordre + ')')
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
        // Structure enrichie: [type, fichier, duree, metadata]
        // metadata pour le playback logging (régie pub)
        var metadata = {
          mediaId: item.mediaId || null,
          mediaNom: item.mediaNom || null,
          diapoId: item.diapoId || null,
          diapoNom: item.diapoNom || null,
          transition: item.transition || 'cut'
        }
        ArrayImg.push([mediaType, encodeURIComponent(fichier), duree, metadata])
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
      
      // Last-resort fallback: try offline cache if ApiManager didn't already
      try {
        if (typeof window !== 'undefined' && window.apiCache) {
          var cachedData = window.apiCache.get('diapo', true) // Allow expired
          if (cachedData) {
            _log('warn','diapo','getDiapoJson: ALL requests failed, using OFFLINE CACHE as last resort')
            return { data: cachedData, status: 200, offline: true }
          }
        }
      } catch (cacheErr) {
        _log('error','diapo','getDiapoJson: cache fallback also failed: ' + (cacheErr && cacheErr.message))
      }
      
      return null
    }
  }

  // Timer de refresh automatique
  var refreshTimer = null

  // Utilitaire: extraire le nom de fichier média d'une entrée ArrayDiapo
  function getMediaFilename(item) {
    try {
      if (!item || !Array.isArray(item) || item.length < 2) return null
      const type = item[0]
      const filename = item[1]
      if (!filename || typeof filename !== 'string') return null
      if (type === 'template' || type === 'planning') return null
      // Decode URI-encoded filename so disk path uses real characters (spaces etc)
      try { return decodeURIComponent(filename) } catch(e) { return filename }
    } catch (e) { return null }
  }

  // Synchronisation robuste des médias (ETag/Last-Modified) à chaque refresh
  async function syncMediaCache(items) {
    try {
      if (window._mediaSyncInProgress) return
      if (!window.api || (!window.api.saveBinaryWithCache && !window.api.saveBinary)) return

      window._mediaSyncInProgress = true
      const mediaList = (items || []).map(getMediaFilename).filter(Boolean)
      if (!mediaList.length) { window._mediaSyncInProgress = false; return }

      for (const mediaName of mediaList) {
        try {
          const urlMedia = getMediaBaseUrl() + mediaName
          const relativePath = 'media/' + mediaName

          if (window.api.saveBinaryWithCache) {
            const res = await window.api.saveBinaryWithCache(relativePath, urlMedia)
            if (res && res.success) {
              _log('debug','diapo','syncMediaCache: ' + (res.cached ? 'up-to-date' : 'updated') + ' ' + mediaName)
            }
          } else if (window.api.saveBinary) {
            await window.api.saveBinary(relativePath, urlMedia)
            _log('debug','diapo','syncMediaCache: downloaded ' + mediaName)
          }
        } catch (e) {
          _log('warn','diapo','syncMediaCache failed for ' + mediaName + ': ' + (e && e.message))
        }
      }
    } catch (e) {
      _log('warn','diapo','syncMediaCache error: ' + (e && e.message))
    } finally {
      window._mediaSyncInProgress = false
    }
  }
  
  function startRefreshTimer() {
    if (refreshTimer) {
      clearInterval(refreshTimer)
    }
    
    // Utiliser l'intervalle fourni par l'API (défaut: 300 secondes = 5 minutes)
    var intervalMs = (window.refreshInterval || 300) * 1000
    _log('info','diapo','startRefreshTimer: scheduling API refresh every ' + (intervalMs/1000) + 's')
    
    // Enregistrer l'heure du prochain refresh prévu
    window.lastApiPullTime = Date.now()
    
    refreshTimer = setInterval(async function() {
      _log('info','diapo','refreshTimer: refreshing diapo data from API...')
      window.lastApiPullTime = Date.now()  // Mettre à jour l'heure du pull
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
    window.requestJsonDiapo = null  // Sera défini après la déclaration de requestJsonDiapo
  }

  const requestJsonDiapo = async () => {
    // Mettre à jour l'heure du dernier pull et incrémenter le compteur
    if (typeof window !== 'undefined') {
      window.lastApiPullTime = Date.now()
      window.apiPullCount = (window.apiPullCount || 0) + 1
      _log('info','diapo','requestJsonDiapo: pull #' + window.apiPullCount)
    }
    
    const JsonDiapo = await getDiapoJson()
    _log('debug','diapo','requestJsonDiapo: JsonDiapo=', JsonDiapo ? 'object' : 'null', 'JsonDiapo.data=', JsonDiapo && JsonDiapo.data ? 'present' : 'missing')
    
    // === FAILURE HANDLING: API returned nothing ===
    if (!JsonDiapo || !JsonDiapo.data) {
      if (typeof window !== 'undefined') {
        window.apiConsecutiveErrors = (window.apiConsecutiveErrors || 0) + 1
        window.lastApiError = Date.now()
        _log('error','diapo','requestJsonDiapo: API FAILURE #' + window.apiConsecutiveErrors + ' - no data received')
        
        // Keep existing diapos alive - don't wipe ArrayDiapo
        if (ArrayDiapo && ArrayDiapo.length > 0) {
          _log('warn','diapo','requestJsonDiapo: keeping current ' + ArrayDiapo.length + ' diapos alive during API failure')
        } else if (init === true) {
          // First load and API is already down: show defaultScreen as fallback
          _log('warn','diapo','requestJsonDiapo: init with no data, showing defaultScreen')
          defaultScreen()
          // Start refresh timer so we keep retrying
          startRefreshTimer()
        }
      }
      return
    }
    
    // === SUCCESS: reset consecutive error counter ===
    if (typeof window !== 'undefined') {
      if (window.apiConsecutiveErrors > 0) {
        _log('info','diapo','requestJsonDiapo: API recovered after ' + window.apiConsecutiveErrors + ' consecutive errors')
      }
      window.apiConsecutiveErrors = 0
      window.lastApiError = null
    }

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

    // Sync media cache on every refresh to pick up modified files
    await syncMediaCache(ArrayDiapo)

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
      if (window.masquerPageDefault) {
        try {
          if (window.stopLoopDiapo) window.stopLoopDiapo()
          const container = document.getElementById('mediaContainer')
          const pageDefault = document.getElementById('pageDefault')
          if (container) container.style.display = 'none'
          if (pageDefault) pageDefault.style.display = 'none'
        } catch (e) {}
      } else {
        defaultScreen()
      }
      return
    }

    // On ne fait l'instantiation de default screen que si on est sur la phase d'init sinon on ne fait que metre a jour le ArrayDiapo
    if (init == true){   
      _log('info','diapo','boucle init appelle defaultScreen')
      defaultScreen()
      // Démarrer le timer de refresh automatique après l'init
      startRefreshTimer()
    }

    // Rafraîchir la boucle même si pageDefault est masquée
    if (init !== true && typeof window !== 'undefined' && typeof window.applyDiapoUpdate === 'function') {
      window.applyDiapoUpdate(ArrayDiapo)
    }

    // S'assurer que le timer de refresh tourne même si init est déjà passé
    if (!refreshTimer) {
      startRefreshTimer()
    }
  }
  
  // Exposer requestJsonDiapo sur window pour le raccourci R (refresh manuel)
  if (typeof window !== 'undefined') {
    window.requestJsonDiapo = requestJsonDiapo
  }
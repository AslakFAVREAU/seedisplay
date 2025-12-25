// Safe logger for this module (works in renderer or Node tests)
var _log = (function(){
  try {
    if (typeof window !== 'undefined' && window.logger) return function(level, tag, ...args){ try { if (window.logger && typeof window.logger[level] === 'function') return window.logger[level](tag, ...args); } catch(e){} }
  } catch(e) {}
  return function(level, tag, ...args){ try { if (console && typeof console[level] === 'function') return console[level](tag, ...args); return console.log(tag, ...args) } catch(e){ try{ console.log(tag, ...args) }catch(_){} }
  }
})()

// Noms des jours pour PlagesHoraires (correspondance avec getDay())
var DAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

/**
 * Normalise un diapo pour supporter les deux formats d'API
 * Format legacy (doc): DateDebutDiapo, TypeDiapo, ligneMedia, etc.
 * Format réel (API): dateDebut, type, medias, programmation, etc.
 * @param {Object} diapo - Diapo brut de l'API
 * @returns {Object} - Diapo normalisé
 */
function normalizeDiapo(diapo) {
  return {
    id: diapo.id,
    nom: diapo.nom || diapo.NomDiapo,
    // Dates - supporte les deux formats
    dateDebut: diapo.dateDebut || diapo.DateDebutDiapo,
    dateFin: diapo.dateFin || diapo.DateFinDiapo,
    // Type et priorité
    type: diapo.type || diapo.TypeDiapo || 'standard',
    priorite: diapo.priorite || diapo.Priorite || 0,
    // Programmation - format nouveau (imbriqué) ou ancien (plat)
    programmation: diapo.programmation || {
      mode: 'simple',
      heureDebut: diapo.HeureDebut,
      heureFin: diapo.HeureFin,
      joursSemaine: diapo.JoursSemaine || [],
      plagesHoraires: diapo.PlagesHoraires || []
    },
    // Médias - format nouveau (medias) ou ancien (ligneMedia)
    medias: diapo.medias || (diapo.ligneMedia ? diapo.ligneMedia.map(function(l) {
      var m = l.MediaLigneMedia || {};
      return {
        ordre: l.OrdreLigneMedia || 0,
        duree: l.DureeLigneMedia || 10,
        type: m.TypeMedia || 'img',
        fichier: m.FichierMedia,
        url: m.FichierMedia ? '/uploads/see/media/' + m.FichierMedia : null
      };
    }) : [])
  };
}

/**
 * Vérifie si un diapo est dans sa période de validité
 * @param {Object} diapo - Diapo normalisé avec dateDebut/dateFin
 * @param {number} now - Timestamp actuel
 * @returns {boolean}
 */
function isInDateRange(diapo, now) {
  var start = diapo.dateDebut ? Date.parse(diapo.dateDebut) : 0;
  var end = diapo.dateFin ? Date.parse(diapo.dateFin) : Number.MAX_SAFE_INTEGER;
  return start <= now && now <= end;
}

/**
 * Vérifie si le diapo est actif selon sa programmation horaire
 * @param {Object} diapo - Objet diapo
 * @param {Date} nowDate - Objet Date actuel
 * @returns {boolean}
 */
function isInSchedule(diapo, nowDate) {
  var typeDiapo = diapo.type || 'standard';
  
  // Type standard : pas de vérification horaire
  if (typeDiapo === 'standard') {
    return true;
  }
  
  var prog = diapo.programmation || {};
  var currentDay = nowDate.getDay(); // 0=Dim, 1=Lun, ...
  var currentDayName = DAY_NAMES[currentDay];
  var currentTime = nowDate.toTimeString().slice(0, 5); // "HH:mm"
  
  // Mode avancé: plagesHoraires (tableau ou objet par jour)
  var plages = prog.plagesHoraires;
  if (plages && typeof plages === 'object' && !Array.isArray(plages)) {
    // Format objet par jour (doc legacy)
    var plagesDuJour = plages[currentDayName];
    if (!plagesDuJour || !Array.isArray(plagesDuJour) || plagesDuJour.length === 0) {
      return false;
    }
    return plagesDuJour.some(function(plage) {
      return currentTime >= plage.debut && currentTime <= plage.fin;
    });
  }
  
  // Mode simple: joursSemaine + heureDebut/heureFin
  var jours = prog.joursSemaine;
  if (jours && Array.isArray(jours) && jours.length > 0) {
    if (jours.indexOf(currentDay) === -1) {
      return false; // Pas le bon jour
    }
  }
  
  var heureDebut = prog.heureDebut;
  var heureFin = prog.heureFin;
  if (heureDebut && heureFin) {
    var hd = heureDebut.slice(0, 5); // "HH:mm"
    var hf = heureFin.slice(0, 5);
    if (currentTime < hd || currentTime > hf) {
      return false; // Hors plage horaire
    }
  }
  
  return true;
}

/**
 * Filtre les diapos selon les règles de programmation API v2.0
 * @param {Array} diapos - Liste des diapos de l'API
 * @param {Date} [nowDate] - Date actuelle (optionnel, pour tests)
 * @returns {Array} - Diapos à afficher maintenant
 */
function filterActiveDiapos(diapos, nowDate) {
  if (!nowDate) nowDate = new Date();
  var now = nowDate.getTime();
  
  return diapos.filter(function(diapo) {
    // 1. Vérifier la période de validité (DateDebut → DateFin)
    if (!isInDateRange(diapo, now)) {
      return false;
    }
    
    // 2. Vérifier la programmation horaire (TypeDiapo, JoursSemaine, Heures, PlagesHoraires)
    if (!isInSchedule(diapo, nowDate)) {
      return false;
    }
    
    return true;
  });
}

/**
 * Trie les diapos par priorité (prioritaires en premier, puis par niveau Priorite)
 * @param {Array} diapos - Liste des diapos
 * @returns {Array} - Diapos triés
 */
function sortDiaposByPriority(diapos) {
  return diapos.slice().sort(function(a, b) {
    // Prioritaires en premier
    var aIsPrio = a.type === 'prioritaire';
    var bIsPrio = b.type === 'prioritaire';
    if (aIsPrio && !bIsPrio) return -1;
    if (bIsPrio && !aIsPrio) return 1;
    
    // Ensuite par niveau de priorité (décroissant)
    return (b.priorite || 0) - (a.priorite || 0);
  });
}

/**
 * Extrait la liste des médias d'une liste de diapos
 * @param {Array} diapos - Diapos filtrés et triés
 * @returns {Array} - Liste plate des médias [type, fichier, durée, diapoId]
 */
function extractMediaList(diapos) {
  var mediaList = [];
  
  for (var i = 0; i < diapos.length; i++) {
    var diapo = diapos[i];
    var medias = diapo.medias;
    if (!medias || !Array.isArray(medias)) continue;
    
    for (var j = 0; j < medias.length; j++) {
      var media = medias[j];
      if (!media.fichier) continue;
      
      mediaList.push([
        media.type || 'img',
        encodeURIComponent(media.fichier),
        media.duree || 10,
        diapo.id
      ]);
    }
  }
  
  return mediaList;
}

/**
 * Extrait les médias depuis la timeline pré-calculée par l'API
 * @param {Array} timeline - Timeline de l'API
 * @returns {Array} - Liste des médias [type, fichier, durée, diapoId]
 */
function extractFromTimeline(timeline) {
  return timeline.map(function(item) {
    return [
      item.mediaType || 'img',
      encodeURIComponent(item.mediaFichier),
      item.duree || 10,
      item.diapoId
    ];
  });
}

/**
 * Fonction principale : filtre, trie et extrait les médias
 * Supporte les deux formats d'API (legacy doc + API réelle)
 * Utilise timeline si disponible (optimisé côté serveur)
 * @param {Array|Object} data - Réponse API (diapos array OU objet complet avec timeline)
 * @param {Date} [nowDate] - Date actuelle (optionnel, pour tests)
 * @returns {Array} - Liste des médias à afficher [type, fichier, durée]
 */
function listeDiapo(data, nowDate) {
  _log('info','diapo','listeDiapo: start parsing diapo data (API v2.0)')

  // Cas 1: Réponse objet complet avec timeline (format API réel optimisé)
  if (data && !Array.isArray(data) && data.timeline && Array.isArray(data.timeline)) {
    _log('info','diapo','Using pre-computed timeline from API (' + data.timeline.length + ' items)');
    var ArrayImg = extractFromTimeline(data.timeline);
    if (typeof ArrayMedia !== 'undefined') ArrayMedia = ArrayImg;
    _log('info','diapo','parsed ' + ArrayImg.length + ' media entries from timeline');
    return ArrayImg;
  }
  
  // Cas 2: Réponse objet avec diapos array (format API réel)
  var diaposRaw = Array.isArray(data) ? data : (data && data.diapos ? data.diapos : null);
  
  if (!diaposRaw || !Array.isArray(diaposRaw) || diaposRaw.length === 0) {
    _log('warn','diapo','listeDiapo: no diapos data provided or empty')
    if (typeof ArrayMedia !== 'undefined') ArrayMedia = [];
    return [];
  }

  // Normaliser les diapos pour supporter les deux formats
  var diapos = diaposRaw.map(normalizeDiapo);
  
  // 1. Filtrer les diapos actifs (période + programmation horaire)
  var activeDiapos = filterActiveDiapos(diapos, nowDate);
  _log('info','diapo','Active diapos after filter: ' + activeDiapos.length + '/' + diapos.length);
  
  // 2. Trier par priorité
  var sortedDiapos = sortDiaposByPriority(activeDiapos);
  
  // 3. Extraire la liste des médias
  var ArrayImg = extractMediaList(sortedDiapos);
  
  _log('debug','diapo','parsed array', ArrayImg)
  if (typeof ArrayMedia !== 'undefined') ArrayMedia = ArrayImg;
  
  if (ArrayImg.length === 0) {
    _log('warn','diapo','parsed 0 media entries - check API data / date ranges / schedule')
  } else {
    _log('info','diapo','parsed ' + ArrayImg.length + ' media entries')
  }
  return ArrayImg;
}

// Exports for testability when running under Node (mocha)
try { 
  module.exports = { 
    listeDiapo, 
    filterActiveDiapos, 
    sortDiaposByPriority, 
    extractMediaList,
    extractFromTimeline,
    normalizeDiapo,
    isInDateRange,
    isInSchedule
  } 
} catch (e) { }

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
      const apiData = JsonDiapo.data;
      
      // Vérifier si l'écran est en mode sleep
      if (apiData && apiData.status === 'sleep') {
        _log('info', 'diapo', 'API returned sleep status');
        if (typeof window !== 'undefined' && window.sleepManager) {
          window.sleepManager.enterSleepMode(apiData);
        }
        return;
      }
      
      // Si on était en sleep et maintenant actif, sortir du mode sleep
      if (typeof window !== 'undefined' && window.sleepManager && window.sleepManager.isSleeping) {
        _log('info', 'diapo', 'Exiting sleep mode - API now active');
        window.sleepManager.exitSleepMode();
      }
      
      // Appliquer la luminosité si présente
      if (apiData && typeof apiData.luminosite === 'number' && typeof window !== 'undefined') {
        if (window.sleepManager) {
          window.sleepManager.applyLuminosity(apiData.luminosite);
        }
      }
      
      ArrayDiapo = listeDiapo(apiData)

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
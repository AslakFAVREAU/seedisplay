// Meteo module — utilises Open-Meteo (https://open-meteo.com) — pas de clé requise
// Lit meteoLat, meteoLon et meteoUnits depuis la configuration (définie par getConfigSEE)

// Local safe logger
if (typeof window !== 'undefined') {
  window.__log = window.__log || function(level, tag, ...args) { try { if (window.logger && typeof window.logger[level] === 'function') return window.logger[level](tag, ...args); if (console && typeof console[level] === 'function') return console[level](tag, ...args); return console.log(tag, ...args) } catch(e){ try{ console.log(tag, ...args) }catch(_){} } }
  var __log = window.__log
} else {
  var __log = function(level, tag, ...args) { try { if (console && typeof console[level] === 'function') return console[level](tag, ...args); return console.log(tag, ...args) } catch(e){ try{ console.log(tag, ...args) }catch(_){} } }
}

function format_time_iso(ts) {
  if (!ts) return ''
  try {
    // Open-Meteo fournit parfois des timestamps en seconds ou des ISO strings.
    if (typeof ts === 'number') return new Date(ts * 1000).toISOString().slice(-13, -5)
    return new Date(ts).toISOString().slice(-13, -5)
  } catch (e) {
    return ''
  }
}

// Map Open-Meteo / generic weather codes to icon filenames available in logo/meteo
function mapCodeToIcon(code, isDay = true) {
  // Open-Meteo returns numeric weather codes (0..n). We'll map a few common ones.
  // Fallback: use clear/sunny icons (01d/01n) or generic icons present in repo.
  const daySuffix = isDay ? 'd' : 'n'
  const map = {
    0: '01' + daySuffix, // Clear sky
    1: '02' + daySuffix, // Mainly clear
    2: '03' + daySuffix, // Partly cloudy
    3: '04' + daySuffix, // Overcast
    45: '50' + daySuffix, // Fog
    48: '50' + daySuffix, // Depositing rime fog
    51: '09' + daySuffix, // Drizzle: light
    53: '09' + daySuffix, // Drizzle: moderate
    55: '09' + daySuffix, // Drizzle: dense
    61: '10' + daySuffix, // Rain: slight
    63: '10' + daySuffix,
    65: '10' + daySuffix,
    71: '13' + daySuffix, // Snow
    73: '13' + daySuffix,
    75: '13' + daySuffix,
    80: '09' + daySuffix, // Rain showers
    81: '10' + daySuffix,
    82: '11' + daySuffix,
    95: '11' + daySuffix, // Thunderstorm
    96: '11' + daySuffix,
    99: '11' + daySuffix
  }
  return map[code] ? ('logo/meteo/' + map[code] + '.png') : ('logo/meteo/01' + daySuffix + '.png')
}

// Calcule la phase lunaire à partir d'une date donnée (algorithme de Conway)
// Retourne { emoji, name, illum (0-100), age (jours depuis nouvelle lune) }
function getMoonPhase(date) {
  date = date || new Date()
  // Référence : nouvelle lune connue du 6 janvier 2000 à 18h14 UTC
  const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14, 0)
  const SYNODIC = 29.53059 // jours

  const elapsed = (date.getTime() - KNOWN_NEW_MOON) / (1000 * 60 * 60 * 24)
  const age = ((elapsed % SYNODIC) + SYNODIC) % SYNODIC // 0..29.53
  const fraction = age / SYNODIC // 0..1

  // Illumination (0 % à nouvelle lune, 100 % à pleine lune)
  const illum = Math.round((1 - Math.cos(2 * Math.PI * fraction)) / 2 * 100)

  // 8 phases avec emoji Unicode et labels français
  let emoji, name
  if (fraction < 0.0625 || fraction >= 0.9375) {
    emoji = '🌑'; name = 'Nouvelle lune'
  } else if (fraction < 0.1875) {
    emoji = '🌒'; name = 'Croissant'
  } else if (fraction < 0.3125) {
    emoji = '🌓'; name = '1er quartier'
  } else if (fraction < 0.4375) {
    emoji = '🌔'; name = 'Gibbeuse +'
  } else if (fraction < 0.5625) {
    emoji = '🌕'; name = 'Pleine lune'
  } else if (fraction < 0.6875) {
    emoji = '🌖'; name = 'Gibbeuse −'
  } else if (fraction < 0.8125) {
    emoji = '🌗'; name = 'Der. quartier'
  } else {
    emoji = '🌘'; name = 'Croissant −'
  }

  return { emoji, name, illum, age }
}

// Sauvegarde la réponse météo dans le cache disque (offline resilience)
async function _saveMeteoCache(data) {
  try {
    if (!window.api || typeof window.api.writeFile !== 'function') return
    await window.api.writeFile('cache/lastMeteo.json', JSON.stringify({ data, ts: Date.now() }))
    __log('debug', 'meteo', 'cache saved')
  } catch (e) {
    __log('debug', 'meteo', 'cache save error', e && e.message)
  }
}

// Charge et applique les dernières données météo cachées (mode offline)
async function _loadMeteoCache() {
  try {
    if (!window.api || typeof window.api.readFile !== 'function') return
    const raw = await window.api.readFile('cache/lastMeteo.json')
    if (!raw) return
    const cached = JSON.parse(raw)
    if (!cached || !cached.data) return
    const ageMin = Math.round((Date.now() - cached.ts) / 60000)
    __log('info', 'meteo', 'using cached data (' + ageMin + ' min old)')
    _applyMeteoData(cached.data)
  } catch (e) {
    __log('debug', 'meteo', 'cache load error', e && e.message)
  }
}

// Applique les données météo au DOM (factorisé pour cache offline)
function _applyMeteoData(data) {
  try {
    if (data.current_weather) {
      const cur = data.current_weather
      const tempElem = document.getElementById('todayTemp')
      if (tempElem && typeof cur.temperature !== 'undefined') tempElem.innerHTML = Math.round(cur.temperature) + '°'
      const iconElem = document.getElementById('todayImgMeteo')
      if (iconElem && typeof cur.weathercode !== 'undefined') iconElem.src = mapCodeToIcon(cur.weathercode, true)
      if (typeof cur.windspeed !== 'undefined') window._meteoWindSpeed = Math.round(cur.windspeed)
    }
    if (data.daily) {
      const todayMin = data.daily.temperature_2m_min && data.daily.temperature_2m_min[0]
      const todayMax = data.daily.temperature_2m_max && data.daily.temperature_2m_max[0]
      if (typeof todayMin !== 'undefined') window._meteoTodayMin = Math.round(todayMin)
      if (typeof todayMax !== 'undefined') window._meteoTodayMax = Math.round(todayMax)
      const days = data.daily
      for (let j = 1; j <= 4; j++) {
        try {
          const tempMax = days.temperature_2m_max && days.temperature_2m_max[j]
          const code    = days.weathercode && days.weathercode[j]
          const tempElem = document.getElementById('Tempd+' + j)
          if (tempElem && typeof tempMax !== 'undefined') tempElem.innerHTML = Math.round(tempMax) + '°'
          const imgElem = document.getElementById('ImgMeteod+' + j)
          if (imgElem && typeof code !== 'undefined') imgElem.src = mapCodeToIcon(code, true)
          if (j >= 2) {
            const dateEl = document.getElementById('dateJourd+' + j)
            if (dateEl && days.time && days.time[j]) {
              const dayName = (typeof jourFr === 'function') ? jourFr(new Date(days.time[j]).getTime() / 1000) : days.time[j]
              dateEl.innerHTML = dayName
            }
          }
        } catch (e) { /* skip daily slot */ }
      }
    }
  } catch (e) {
    __log('warn', 'meteo', '_applyMeteoData error', e && e.message)
  }
}

// Bascule l'état offline/online du bloc météo
function _meteoSetOffline(isOffline) {
  try {
    const zone = document.getElementById('zone_meteo')
    if (zone) {
      if (isOffline) zone.classList.add('meteo-offline')
      else zone.classList.remove('meteo-offline')
    }
    const hzCard = document.querySelector('.hz-card-meteo')
    if (hzCard) {
      if (isOffline) hzCard.classList.add('meteo-offline')
      else hzCard.classList.remove('meteo-offline')
    }
  } catch (e) { __log('warn', 'meteo', '_meteoSetOffline error', e) }
}

// Build Open-Meteo URL and fetch data
const getMeteo = async () => {
  const lat = (typeof meteoLat !== 'undefined') ? meteoLat : 48.75
  const lon = (typeof meteoLon !== 'undefined') ? meteoLon : 2.3
  // Request current weather plus daily summary (max 4 days)
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&daily=temperature_2m_max,temperature_2m_min,weathercode,sunrise,sunset&current_weather=true&hourly=windspeed_10m&timezone=auto&forecast_days=5`
  
  // Phase 2 Week 2: Use ApiManager if available (with ErrorHandler resilience)
  if (typeof window !== 'undefined' && window.apiManager) {
    return await window.apiManager.getMeteoWithErrorHandling(url)
  }
  
  // Fallback to direct axios call if ApiManager not available
  try {
    const res = await axios.get(url)
    return res && res.data ? res.data : null
  } catch (e) {
    __log('warn','meteo','getMeteo failed', e && e.message)
    return null
  }
}

// requestJsonMeteo : récupère les données météo via Open-Meteo et met à jour le DOM
const requestJsonMeteo = async () => {
  // Phase lunaire : calcul local, indépendant du réseau — toujours mis à jour en premier
  try {
    const moon = getMoonPhase(new Date())
    // Layout par défaut
    const moonEmoji = document.getElementById('moonPhaseEmoji')
    const moonName  = document.getElementById('moonPhaseName')
    if (moonEmoji) moonEmoji.textContent = moon.emoji
    if (moonName)  moonName.textContent  = moon.name
    // Layout horizontal
    const hzMoonEmoji = document.getElementById('hzMoonEmoji')
    const hzMoonName  = document.getElementById('hzMoonName')
    if (hzMoonEmoji) hzMoonEmoji.textContent = moon.emoji
    if (hzMoonName)  hzMoonName.textContent  = moon.name
    __log('info','meteo','Phase lunaire:', moon.name, moon.emoji, moon.illum + '%')
  } catch (e) { __log('warn','meteo','moon phase update error', e) }

  try {
    __log('info','meteo','requestJsonMeteo: début de la récupération météo')
    const data = await getMeteo()
    if (!data) {
      __log('warn','meteo','requestJsonMeteo: aucune donnée reçue, tentative cache offline')
      _meteoSetOffline(true)
      await _loadMeteoCache()
      return
    }
    _meteoSetOffline(false)

    __log('info','meteo','requestJsonMeteo: données reçues')
    _applyMeteoData(data)

    // Sauvegarder pour usage offline
    await _saveMeteoCache(data)

    // Démarrer le scheduler 30min (une seule fois)
    if (!window._meteoSchedulerStarted) {
      window._meteoSchedulerStarted = true
      setInterval(requestJsonMeteo, 30 * 60 * 1000)
      __log('info', 'meteo', 'scheduler started (refresh every 30min)')
    }

  } catch (e) {
    __log('error','meteo','Error in requestJsonMeteo', e)
  }
}

// Export for testing
try { module.exports = { requestJsonMeteo, getMeteo, _saveMeteoCache, _loadMeteoCache, _applyMeteoData } } catch (e) { }

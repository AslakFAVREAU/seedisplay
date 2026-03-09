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
  try {
    __log('info','meteo','requestJsonMeteo: début de la récupération météo')
    const data = await getMeteo()
    if (!data) {
      __log('warn','meteo','requestJsonMeteo: aucune donnée reçue')
      _meteoSetOffline(true)
      return
    }
    _meteoSetOffline(false)

    __log('info','meteo','requestJsonMeteo: données reçues', data)

    // Current weather (aujourd'hui)
    try {
      if (data.current_weather) {
        const cur = data.current_weather
        const tempElem = document.getElementById('todayTemp')
        if (tempElem && typeof cur.temperature !== 'undefined') {
          tempElem.innerHTML = Math.round(cur.temperature) + '°'
          __log('info','meteo','Température aujourd\'hui mise à jour:', Math.round(cur.temperature) + '°')
        }
        const iconElem = document.getElementById('todayImgMeteo')
        if (iconElem && typeof cur.weathercode !== 'undefined') {
          iconElem.src = mapCodeToIcon(cur.weathercode, true)
          __log('info','meteo','Icône aujourd\'hui mise à jour:', cur.weathercode)
        }
        // Store wind speed for horizontal layout
        if (typeof cur.windspeed !== 'undefined') {
          window._meteoWindSpeed = Math.round(cur.windspeed)
          __log('info','meteo','Vent actuel:', cur.windspeed, 'km/h')
        }
      }
    } catch (e) { __log('warn','meteo','current update error', e) }

    // Store today's min/max from daily data for horizontal layout
    if (data.daily) {
      const todayMin = data.daily.temperature_2m_min && data.daily.temperature_2m_min[0]
      const todayMax = data.daily.temperature_2m_max && data.daily.temperature_2m_max[0]
      if (typeof todayMin !== 'undefined') window._meteoTodayMin = Math.round(todayMin)
      if (typeof todayMax !== 'undefined') window._meteoTodayMax = Math.round(todayMax)
      __log('info','meteo','Min/Max aujourd\'hui:', todayMin, '/', todayMax)
    }

    // Daily forecasts: use daily arrays
    if (data.daily) {
      const days = data.daily
      __log('info','meteo','Daily data:', days)
      
      // Loop through j=1 to 4 (demain, d+2, d+3, d+4)
      for (let j = 1; j <= 4; j++) {
        const idx = j // Index dans le tableau daily (0=aujourd'hui, 1=demain, etc.)
        try {
          const tempMax = days.temperature_2m_max && days.temperature_2m_max[idx]
          const code = days.weathercode && days.weathercode[idx]

          // Mise à jour température
          const tempElem = document.getElementById('Tempd+' + j)
          if (tempElem && typeof tempMax !== 'undefined') {
            tempElem.innerHTML = Math.round(tempMax) + '°'
            __log('info','meteo','Température d+' + j + ' mise à jour:', Math.round(tempMax) + '°')
          }
          
          // Mise à jour icône
          const imgElem = document.getElementById('ImgMeteod+' + j)
          if (imgElem && typeof code !== 'undefined') {
            imgElem.src = mapCodeToIcon(code, true)
            __log('info','meteo','Icône d+' + j + ' mise à jour:', code)
          }
          
          // Mise à jour jour (pour d+2, d+3, d+4)
          if (j >= 2) {
            const dateEl = document.getElementById('dateJourd+' + j)
            if (dateEl && days.time && days.time[idx]) {
              const dayName = jourFr(new Date(days.time[idx]).getTime() / 1000)
              dateEl.innerHTML = dayName
              __log('info','meteo','Jour d+' + j + ' mis à jour:', dayName)
            }
          }
        } catch (e) { __log('warn','meteo','daily update error for d+' + j, e) }
      }
    }
  } catch (e) {
    __log('error','meteo','Error in requestJsonMeteo', e)
  }
}

// Export for testing
try { module.exports = { requestJsonMeteo, getMeteo } } catch (e) { }

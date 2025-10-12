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

// Build Open-Meteo URL and fetch data
const getMeteo = async () => {
  const lat = (typeof meteoLat !== 'undefined') ? meteoLat : 48.75
  const lon = (typeof meteoLon !== 'undefined') ? meteoLon : 2.3
  // Request current weather plus daily summary (max 4 days)
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&daily=temperature_2m_max,temperature_2m_min,weathercode,sunrise,sunset&current_weather=true&timezone=auto&forecast_days=5`
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
    const data = await getMeteo()
    if (!data) return

    // Current
    try {
      if (data.current_weather) {
        const cur = data.current_weather
        const tempElem = document.getElementById('todayTemp')
        if (tempElem && typeof cur.temperature !== 'undefined') tempElem.innerHTML = Math.round(cur.temperature) + ' \u00b0C'
        const iconElem = document.getElementById('todayImgMeteo')
        // Open-Meteo current_weather does not give sunrise/sunset; use daily[0]
        const isDay = true
        if (iconElem && typeof cur.weathercode !== 'undefined') iconElem.src = mapCodeToIcon(cur.weathercode, isDay)
      }
  } catch (e) { __log('warn','meteo','current update error', e) }

    // Daily forecasts: use daily arrays
    if (data.daily) {
      const days = data.daily
      // daily arrays: temperature_2m_max, temperature_2m_min, weathercode, sunrise, sunset
      for (let i = 0; i <= 4; i++) {
        const idx = i
        try {
          const tempMax = days.temperature_2m_max && days.temperature_2m_max[idx]
          const tempMin = days.temperature_2m_min && days.temperature_2m_min[idx]
          const code = days.weathercode && days.weathercode[idx]
          const sunrise = days.sunrise && days.sunrise[idx]
          const sunset = days.sunset && days.sunset[idx]

          if (i === 0) {
            // Today sunrise/sunset
            const sr = document.getElementById('todaySunRise')
            const ss = document.getElementById('todaySunSet')
            if (sr) sr.innerHTML = format_time_iso(sunrise)
            if (ss) ss.innerHTML = format_time_iso(sunset)
          } else {
            const j = i
            const tempElem = document.getElementById('Tempd+' + j)
            if (tempElem && typeof tempMax !== 'undefined') tempElem.innerHTML = Math.round(tempMax) + ' \u00b0C'
            const imgElem = document.getElementById('ImgMeteod+' + j)
            if (imgElem && typeof code !== 'undefined') imgElem.src = mapCodeToIcon(code, true)
            const sr = document.getElementById('SunRise+' + j)
            const ss = document.getElementById('SunSet+' + j)
            if (sr) sr.innerHTML = format_time_iso(sunrise)
            if (ss) ss.innerHTML = format_time_iso(sunset)
            if (j > 1) {
              const dateEl = document.getElementById('dateJourd+' + j)
              if (dateEl && days.time && days.time[idx]) dateEl.innerHTML = jourFr(new Date(days.time[idx]).getTime() / 1000)
            }
          }
  } catch (e) { __log('warn','meteo','daily update error', e) }
      }
    }
  } catch (e) {
    __log('error','meteo','Error in requestJsonMeteo', e)
  }
}

// Export for testing
try { module.exports = { requestJsonMeteo, getMeteo } } catch (e) { }

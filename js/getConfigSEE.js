// getConfigSEE.js
// Preload-aware configuration loader. It prefers window.configSEE (set by preload)
// or calls window.api.getConfig() (preload) and falls back to legacy fs.readFile when available.

// Local safe logger helper to avoid repeating typeof checks
if (typeof window !== 'undefined') {
    window.__log = window.__log || function(level, tag, ...args) { try { if (window.logger && typeof window.logger[level] === 'function') return window.logger[level](tag, ...args); if (console && typeof console[level] === 'function') return console[level](tag, ...args); return console.log(tag, ...args) } catch(e){ try{ console.log(tag, ...args) }catch(_){} } }
    var __log = window.__log
} else {
    var __log = function(level, tag, ...args) { try { if (console && typeof console[level] === 'function') return console[level](tag, ...args); return console.log(tag, ...args) } catch(e){ try{ console.log(tag, ...args) }catch(_){} } }
}

function getConfigSEE() {
    __log('info','config','getConfigSEE: start')

    // If preload already pushed a config object to window, use it synchronously
    if (window && window.configSEE) {
        __log('info','config','getConfigSEE: using window.configSEE')
        configSEE = window.configSEE
        processConfig(configSEE)
        return 'OK'
    }

    // If preload exposes an async getConfig(), use it
    if (window && window.api && typeof window.api.getConfig === 'function') {
        window.api.getConfig().then((conf) => {
            __log('info','config','getConfigSEE: api.getConfig returned', conf)
            configSEE = conf
            processConfig(configSEE)
    }).catch((e) => { __log('error','config','getConfigSEE: api.getConfig error', e) })
        return 'OK'
    }

    // Legacy fallback: try to read via fs if available in renderer
    try {
        fs.readFile((pathSEE + 'configSEE.json'), function (erreur, fichier) {
            if (erreur) { __log('error','config','getConfigSEE fs.readFile error', erreur); return }
            try {
                configSEE = JSON.parse(fichier)
            } catch (e) {
                __log('error','config','getConfigSEE JSON parse error', e)
                return
            }
            processConfig(configSEE)
        })
    } catch (e) {
        __log('error','config','getConfigSEE: no method to load config', e)
    }
    return 'OK'
}

function processConfig(configSEE) {
    try {
    // Options d'affichage
    // Respecter la configuration : si configSEE.meteo est true, on pourra afficher la météo
    showMeteo = (typeof configSEE.meteo !== 'undefined') ? configSEE.meteo : true
    __log('info','config','processConfig: showMeteo=' + showMeteo)

    // Lecture des paramètres météo (peuvent être fournis depuis config ou via la variable d'environnement METEO_API_KEY)
    // Priorité : variable d'environnement (via preload.getEnv) pour éviter d'exposer process
    var envKey = null
    try { envKey = (window && window.api && typeof window.api.getEnv === 'function') ? window.api.getEnv('METEO_API_KEY') : null } catch (e) { envKey = null }
    // Open-Meteo n'exige pas de clé; conserver meteoApiKey pour compatibilité mais ne l'impose pas
    meteoApiKey = envKey || configSEE.meteoApiKey || null
    if (!meteoApiKey) {
        __log('debug','config','processConfig: pas de METEO_API_KEY fournie (OK pour Open-Meteo)')
    }
        meteoLat = configSEE.meteoLat || 48.75
        meteoLon = configSEE.meteoLon || 2.3
        meteoUnits = configSEE.meteoUnits || 'metric'

        // Paramètres généraux
        idEcran = configSEE.idEcran
        weekDisplay = configSEE.weekDisplay
        weekNo = configSEE.weekNo
        weekType = configSEE.weekType
        logoSOE = configSEE.logoSOE
        env = configSEE.env
    __log('info','config','processConfig: env=' + env)

        if (env == 'prod') {
            urlAPI = 'https://soek.fr/see/API/diapo/' + idEcran
        }
        else if (env == 'local') {
            urlAPI = 'http://127.0.0.1:8000/see/API/diapo/' + idEcran
        }

        if (weekDisplay == false) {
            document.getElementById('week').style.display = 'none';
        } else {
            document.getElementById('week').style.display = 'block';
        }

        if (showMeteo == false) {
            document.getElementById('zone_meteo').style.display = 'none';
        } else {
            document.getElementById('zone_meteo').style.display = 'block';
        }

        if (logoSOE == false) {
            document.getElementById('footer').style.display = 'none';
        } else {
            document.getElementById('footer').style.display = 'block';
        }

        // Récupération et parsing de la liste de diapos depuis l'API
        requestJsonDiapo()

        // If meteorology display is enabled, trigger the meteo request now that config is loaded
        try {
            // Ne lancer la récupération météo que si showMeteo est activé et qu'une clé est disponible
            if (showMeteo) {
                if (!meteoApiKey) {
                    __log('warn','config','Skipping requestJsonMeteo: no meteoApiKey')
                } else if (typeof requestJsonMeteo === 'function') {
                    requestJsonMeteo()
                } else {
                    __log('warn','config','requestJsonMeteo not available')
                }
            }
        } catch (e) { __log('error','config','Error calling requestJsonMeteo after config load', e) }
    } catch (e) {
        __log('error','config','processConfig failed', e)
    }
}


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
    // Respecter la configuration, avec possibilité d'override via variable d'environnement METEO_FORCE
    let showMeteoConf = (typeof configSEE.meteo !== 'undefined') ? configSEE.meteo : true
    let forceMeteo = false
    try {
        const force = (window && window.api && typeof window.api.getEnv === 'function') ? window.api.getEnv('METEO_FORCE') : null
        forceMeteo = (force === '1' || force === 'true' || force === true)
    } catch (e) { forceMeteo = false }
    showMeteo = forceMeteo ? true : showMeteoConf
    __log('info','config','processConfig: showMeteo=' + showMeteo + (forceMeteo ? ' (forced)' : ''))

    // Lecture des paramètres météo (Open-Meteo n'exige pas de clé)
    // API Key supprimée car Open-Meteo est gratuit sans clé
    meteoApiKey = null // Pas d'API Key nécessaire pour Open-Meteo
    __log('debug','config','processConfig: Open-Meteo utilisé sans API Key')
        meteoLat = configSEE.meteoLat || 48.75
        meteoLon = configSEE.meteoLon || 2.3
        meteoUnits = configSEE.meteoUnits || 'metric'

        // Paramètres généraux
        // Supporte UUID (nouveau) ou idEcran (legacy) pour compatibilité
        idEcran = configSEE.ecranUuid || configSEE.idEcran
        weekDisplay = configSEE.weekDisplay
        weekNo = configSEE.weekNo
        weekType = configSEE.weekType
        logoSOE = configSEE.logoSOE
        env = configSEE.env
    __log('info','config','processConfig: env=' + env + ', ecranId=' + idEcran)

        if (env == 'prod') {
            urlAPI = 'https://soek.fr/see/API/diapo/' + idEcran
        }
        else if (env == 'local') {
            urlAPI = 'http://localhost:8000/see/API/diapo/' + idEcran
        }

        if (weekDisplay == false) {
            document.getElementById('week').style.display = 'none';
        } else {
            document.getElementById('week').style.display = 'block';
        }

        if (showMeteo == false) {
            __log('warn','config','processConfig: météo désactivée dans config, forçant l\'activation')
            showMeteo = true // Forcer l'activation de la météo
        }
        
        // Toujours afficher la météo
        document.getElementById('zone_meteo').style.display = 'block';
        __log('info','config','processConfig: zone_meteo display forcé à block')

        if (logoSOE == false) {
            document.getElementById('footer').style.display = 'none';
        } else {
            document.getElementById('footer').style.display = 'block';
        }

        // Récupération et parsing de la liste de diapos depuis l'API
        requestJsonDiapo()

        // If meteorology display is enabled, trigger the meteo request now that config is loaded
        try {
            // Lancer la récupération météo si showMeteo est activé
            if (showMeteo) {
                if (typeof requestJsonMeteo === 'function') {
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


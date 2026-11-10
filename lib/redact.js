/**
 * Masquage des secrets dans les logs (apiToken de l'écran, en-tête X-API-Token).
 *
 * Branché comme hook electron-log dans main.js : tout ce qui est journalisé
 * (main, preload, renderer via IPC, fichier comme console) passe par ici avant
 * d'être écrit. Le masquage se fait sur le NOM du champ, pas sur la forme de la
 * valeur, pour ne pas masquer les autres hashes (ETag, checksums) utiles au debug.
 */

const MASK = '***'
// apiKey / apikey : clé IDFM PRIM des templates trafic
const SECRET_KEYS = /^(api[_-]?token|api[_-]?key|token|x-api-token|authorization|password|secret)$/i

// "apiToken":"abc"  |  apiToken: 'abc'  |  X-API-Token=abc  |  "token": "abc"  |  apikey: abc
const SECRET_IN_TEXT = /((?:["']?)(?:api[_-]?token|api[_-]?key|x-api-token|token|authorization|password|secret)(?:["']?)\s*[:=]\s*["']?)([^"'\s,}&]{4,})/gi

function redactString(s) {
  if (typeof s !== 'string' || s.length < 8) return s
  return s.replace(SECRET_IN_TEXT, (_, prefix) => prefix + MASK)
}

function redactValue(value, depth = 0, seen = new WeakSet()) {
  if (typeof value === 'string') return redactString(value)
  if (!value || typeof value !== 'object') return value
  if (value instanceof Error) {
    const e = new Error(redactString(value.message))
    e.name = value.name
    e.stack = redactString(value.stack)
    return e
  }
  if (depth > 6 || seen.has(value)) return value
  seen.add(value)
  if (Array.isArray(value)) return value.map(v => redactValue(v, depth + 1, seen))
  const out = {}
  for (const k of Object.keys(value)) {
    out[k] = SECRET_KEYS.test(k) && value[k] ? MASK : redactValue(value[k], depth + 1, seen)
  }
  return out
}

/** Hook electron-log : (message) => message avec `data` masqué. */
function redactHook(message) {
  try {
    if (!message || !Array.isArray(message.data)) return message
    return Object.assign({}, message, { data: message.data.map(d => redactValue(d)) })
  } catch (e) {
    return message
  }
}

module.exports = { redactString, redactValue, redactHook, MASK }

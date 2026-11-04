/**
 * Téléchargement de médias vers le disque (process main).
 *
 * - Streaming (pas de buffer complet en RAM)
 * - Fichier temporaire `.part` renommé seulement si le transfert est complet :
 *   le fichier final n'est jamais visible à moitié écrit, y compris s'il est en
 *   cours de lecture par see-media://
 * - Timeouts : sans eux, un serveur qui ne répond plus laisse la promesse
 *   pendante et bloque syncMediaCache / requestJsonDiapo
 * - Déduplication par destination : syncMediaCache + downloadAllMedia + retry
 *   vidéo partagent le même transfert au lieu d'écrire deux fois le même .part
 */
const fs = require('fs')
const path = require('path')
const { Transform } = require('stream')
const { pipeline } = require('stream/promises')

const DEFAULTS = {
  connectTimeoutMs: 15000,  // jusqu'aux headers de réponse
  idleTimeoutMs: 30000,     // aucune donnée reçue pendant ce délai → abandon
  renameRetries: 5,
  renameRetryDelayMs: 300
}

/**
 * @param {object} deps
 * @param {object} deps.axios - instance axios
 * @param {object} [deps.fsp] - fs.promises (injectable pour les tests)
 * @param {object} [deps.options] - surcharge de DEFAULTS
 */
function createDownloader({ axios, fsp = fs.promises, options = {} } = {}) {
  const opts = Object.assign({}, DEFAULTS, options)
  const inFlight = new Map()

  /**
   * Remplace `dest` par `tmp` de façon atomique. Sous Windows le renommage peut
   * échouer si le fichier est ouvert (lecture vidéo en cours) → quelques retries.
   */
  async function replaceFile(tmp, dest) {
    for (let attempt = 0; attempt < opts.renameRetries; attempt++) {
      try {
        await fsp.rename(tmp, dest)
        return
      } catch (e) {
        if (!['EPERM', 'EBUSY', 'EACCES'].includes(e.code) || attempt === opts.renameRetries - 1) throw e
        await new Promise(r => setTimeout(r, opts.renameRetryDelayMs))
      }
    }
  }

  /**
   * Télécharge `url` vers `dest`.
   * @returns {Promise<{status: number, size?: number, etag?: string|null}>}
   */
  async function downloadToFile(url, dest, headers = {}) {
    await fsp.mkdir(path.dirname(dest), { recursive: true })

    const controller = new AbortController()
    const res = await axios.get(url, {
      responseType: 'stream',
      headers,
      timeout: opts.connectTimeoutMs,
      signal: controller.signal,
      validateStatus: s => s === 200 || s === 304
    })

    if (res.status === 304) {
      if (res.data && typeof res.data.destroy === 'function') res.data.destroy()
      return { status: 304 }
    }

    const tmp = dest + '.part'
    const expected = parseInt(res.headers['content-length'], 10)
    let received = 0
    let idleTimer = null
    const armIdle = () => {
      clearTimeout(idleTimer)
      idleTimer = setTimeout(() => {
        controller.abort()
        res.data.destroy(new Error('download idle timeout ' + opts.idleTimeoutMs + 'ms'))
      }, opts.idleTimeoutMs)
    }

    const counter = new Transform({
      transform(chunk, enc, cb) { received += chunk.length; armIdle(); cb(null, chunk) }
    })

    try {
      armIdle()
      await pipeline(res.data, counter, fs.createWriteStream(tmp))
      clearTimeout(idleTimer)

      if (!received) throw new Error('empty response')
      if (Number.isFinite(expected) && received !== expected) {
        throw new Error('incomplete download ' + received + '/' + expected + ' bytes')
      }

      await replaceFile(tmp, dest)
      return { status: 200, size: received, etag: res.headers.etag || null }
    } catch (e) {
      clearTimeout(idleTimer)
      try { await fsp.unlink(tmp) } catch (_) { /* ignore */ }
      throw e
    }
  }

  /** Sérialise les téléchargements concurrents vers un même fichier. */
  function downloadToFileOnce(url, dest, headers) {
    const pending = inFlight.get(dest)
    if (pending) return pending
    const p = downloadToFile(url, dest, headers).finally(() => inFlight.delete(dest))
    inFlight.set(dest, p)
    return p
  }

  return { downloadToFile, downloadToFileOnce, replaceFile, inFlightCount: () => inFlight.size }
}

module.exports = { createDownloader, DEFAULTS }

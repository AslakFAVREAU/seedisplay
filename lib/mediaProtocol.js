/**
 * Handler du protocole see-media:// (process main).
 *
 * URL: see-media://media/file.jpg → basePath + media/file.jpg
 * Nécessaire sur Linux où file:// ne peut pas accéder aux fichiers hors du dossier app.
 *
 * Le contenu est streamé depuis le disque : Chromium demande souvent "bytes=0-"
 * pour une vidéo, ce qui revenait à charger le fichier entier en RAM (et en
 * synchrone) dans le process principal.
 */
const fs = require('fs')
const path = require('path')
const { Readable } = require('stream')

const MIME_TYPES = {
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.ogg': 'video/ogg',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.json': 'application/json',
  '.pdf': 'application/pdf'
}

function createSeeMediaHandler({ basePath, log = console }) {
  const baseResolved = path.resolve(basePath)

  return async function seeMediaHandler(request) {
    let filePath
    try {
      filePath = decodeURIComponent(request.url.replace('see-media://', ''))
    } catch (e) {
      // URL mal encodée (ex: "%E0%A4%A") → decodeURIComponent lève une URIError
      log.warn(`[see-media] Malformed URL: ${request.url}`)
      return new Response('Bad Request', { status: 400 })
    }
    // Supprimer le slash initial si présent (see-media:///media/... → media/...)
    filePath = filePath.replace(/^\/+/, '')
    // Supprimer fragment (#nocache=...) et query s'ils existent
    filePath = filePath.split('#')[0].split('?')[0]
    const fullPath = path.resolve(baseResolved, filePath)

    // Garde anti path-traversal : rester sous basePath
    if (fullPath !== baseResolved && !fullPath.startsWith(baseResolved + path.sep)) {
      log.warn(`[see-media] Forbidden path: ${fullPath}`)
      return new Response('Forbidden', { status: 403 })
    }

    // Vérifier que le fichier existe (async : ne pas bloquer le process principal)
    let stat
    try {
      stat = await fs.promises.stat(fullPath)
    } catch (e) {
      log.warn(`[see-media] File not found: ${fullPath}`)
      return new Response('Not Found', { status: 404 })
    }
    if (!stat.isFile()) {
      return new Response('Not Found', { status: 404 })
    }
    const totalSize = stat.size
    const contentType = MIME_TYPES[path.extname(fullPath).toLowerCase()] || 'application/octet-stream'

    // Gérer les byte-range requests (crucial pour la lecture vidéo)
    const rangeHeader = request.headers.get('Range')
    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d*)-(\d*)/)
      if (match && (match[1] || match[2])) {
        let start, end
        if (match[1]) {
          start = parseInt(match[1], 10)
          end = match[2] ? Math.min(parseInt(match[2], 10), totalSize - 1) : totalSize - 1
        } else {
          // Suffix range "bytes=-N" → les N derniers octets
          const suffix = parseInt(match[2], 10)
          start = Math.max(0, totalSize - suffix)
          end = totalSize - 1
        }

        if (start >= totalSize || start > end) {
          return new Response(null, {
            status: 416,
            headers: { 'Content-Range': `bytes */${totalSize}` }
          })
        }

        const chunkSize = end - start + 1
        return new Response(Readable.toWeb(fs.createReadStream(fullPath, { start, end })), {
          status: 206,
          headers: {
            'Content-Type': contentType,
            'Content-Range': `bytes ${start}-${end}/${totalSize}`,
            'Content-Length': String(chunkSize),
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'no-cache'
          }
        })
      }
    }

    // Pas de Range → retourner le fichier complet (streamé)
    return new Response(Readable.toWeb(fs.createReadStream(fullPath)), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(totalSize),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache'
      }
    })
  }
}

module.exports = { createSeeMediaHandler, MIME_TYPES }

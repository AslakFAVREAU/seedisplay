/**
 * PlaybackLogger - Logs précis pour la régie publicitaire
 * 
 * Enregistre chaque affichage de média avec:
 * - Timestamp début/fin précis (ISO 8601)
 * - Durée réelle affichée (ms)
 * - Identifiants média (id, nom, fichier)
 * - Type de média (img/video)
 * - ID écran
 * - Statut de lecture (complète, interrompue, erreur)
 */

class PlaybackLogger {
    constructor() {
        this.currentPlayback = null;
        this.sessionId = this._generateSessionId();
        this.ecranUuid = null;
        this.logBuffer = [];
        this.flushInterval = null;
        
        // Flush logs toutes les 30 secondes
        this.flushInterval = setInterval(() => this._flushLogs(), 30000);
        
        this._log('info', 'PlaybackLogger initialized, session=' + this.sessionId);
    }
    
    /**
     * Génère un ID de session unique
     */
    _generateSessionId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }
    
    /**
     * Log helper
     */
    _log(level, msg) {
        if (window.logger && typeof window.logger[level] === 'function') {
            window.logger[level]('playback', msg);
        } else {
            console.log('[playback]', msg);
        }
    }
    
    /**
     * Configure l'UUID écran
     */
    setEcranUuid(uuid) {
        this.ecranUuid = uuid;
        this._log('info', 'ecranUuid set to ' + uuid);
    }
    
    /**
     * Configure l'ID écran (deprecated - use setEcranUuid)
     * @deprecated Use setEcranUuid instead
     */
    setEcranId(id) {
        this.ecranUuid = id;
        this._log('info', 'ecranUuid set to ' + id + ' (via deprecated setEcranId)');
    }
    
    /**
     * Démarre l'enregistrement d'un média
     */
    startMedia(mediaData) {
        // Terminer le précédent s'il existe
        if (this.currentPlayback) {
            this.endMedia('interrupted');
        }
        
        const now = new Date();
        
        this.currentPlayback = {
            sessionId: this.sessionId,
            ecranUuid: this.ecranUuid || window.configSEE?.ecranUuid || 'unknown',
            mediaId: mediaData.mediaId || null,
            mediaNom: mediaData.mediaNom || null,
            mediaFichier: mediaData.mediaFichier || mediaData.file || 'unknown',
            mediaType: mediaData.mediaType || mediaData.type || 'unknown',
            diapoId: mediaData.diapoId || null,
            diapoNom: mediaData.diapoNom || null,
            dureeConfiguree: mediaData.duree || 0, // Durée configurée en secondes
            startTime: now,
            startTimestamp: now.toISOString(),
            startUnix: now.getTime()
        };
        
        this._log('info', `▶ START media=${this.currentPlayback.mediaFichier} type=${this.currentPlayback.mediaType} diapo=${this.currentPlayback.diapoNom || 'N/A'}`);
    }
    
    /**
     * Termine l'enregistrement d'un média
     * @param {string} status - 'complete', 'interrupted', 'error', 'skipped'
     */
    endMedia(status = 'complete') {
        if (!this.currentPlayback) {
            return null;
        }
        
        const now = new Date();
        const playback = this.currentPlayback;
        
        playback.endTime = now;
        playback.endTimestamp = now.toISOString();
        playback.endUnix = now.getTime();
        playback.dureeReelle = now.getTime() - playback.startUnix; // ms
        playback.dureeReelleSeconds = Math.round(playback.dureeReelle / 1000 * 10) / 10; // arrondi 0.1s
        playback.status = status;
        
        // Log de fin
        this._log('info', `■ END media=${playback.mediaFichier} durée=${playback.dureeReelleSeconds}s status=${status}`);
        
        // Ajouter au buffer
        this.logBuffer.push(this._formatLogEntry(playback));
        
        // Log détaillé pour régie
        this._logPlaybackRecord(playback);
        
        this.currentPlayback = null;
        
        return playback;
    }
    
    /**
     * Formate une entrée de log pour stockage
     */
    _formatLogEntry(playback) {
        return {
            timestamp: playback.startTimestamp,
            ecranId: playback.ecranId,
            sessionId: playback.sessionId,
            mediaId: playback.mediaId,
            mediaNom: playback.mediaNom,
            mediaFichier: playback.mediaFichier,
            mediaType: playback.mediaType,
            diapoId: playback.diapoId,
            diapoNom: playback.diapoNom,
            startTime: playback.startTimestamp,
            endTime: playback.endTimestamp,
            dureeConfiguree: playback.dureeConfiguree,
            dureeReelle: playback.dureeReelleSeconds,
            status: playback.status
        };
    }
    
    /**
     * Log détaillé pour régie publicitaire
     */
    _logPlaybackRecord(playback) {
        const record = {
            type: 'PLAYBACK_RECORD',
            ecran: playback.ecranId,
            media: {
                id: playback.mediaId,
                nom: playback.mediaNom,
                fichier: playback.mediaFichier,
                type: playback.mediaType
            },
            diapo: {
                id: playback.diapoId,
                nom: playback.diapoNom
            },
            timing: {
                start: playback.startTimestamp,
                end: playback.endTimestamp,
                dureeConfiguree: playback.dureeConfiguree + 's',
                dureeReelle: playback.dureeReelleSeconds + 's'
            },
            status: playback.status
        };
        
        this._log('debug', 'RECORD: ' + JSON.stringify(record));
    }
    
    /**
     * Flush les logs vers le fichier
     */
    async _flushLogs() {
        if (this.logBuffer.length === 0) return;
        
        try {
            const logs = this.logBuffer.splice(0);
            const date = new Date().toISOString().split('T')[0];
            const filename = `playback-${date}.json`;
            
            // Lire le fichier existant
            let existingLogs = [];
            try {
                if (window.api && window.api.readFile) {
                    const content = await window.api.readFile('logs/' + filename);
                    if (content) {
                        const parsed = JSON.parse(content);
                        if (Array.isArray(parsed)) {
                            existingLogs = parsed;
                        }
                    }
                }
            } catch (e) {
                // Fichier n'existe pas encore ou JSON invalide - on démarre avec un tableau vide
                this._log('debug', 'Log file not found or invalid, starting fresh');
            }
            
            // Ajouter les nouveaux logs
            existingLogs.push(...logs);
            
            // Sauvegarder
            if (window.api && window.api.writeFile) {
                await window.api.writeFile('logs/' + filename, JSON.stringify(existingLogs, null, 2));
                this._log('info', `Flushed ${logs.length} playback records to ${filename}`);
            }
        } catch (e) {
            this._log('error', 'Failed to flush logs: ' + e.message);
            // Remettre les logs dans le buffer pour retry
            // (optionnel: limiter la taille du buffer)
        }
    }
    
    /**
     * Force un flush immédiat
     */
    async flush() {
        await this._flushLogs();
    }
    
    /**
     * Obtient les stats de la session
     */
    getSessionStats() {
        return {
            sessionId: this.sessionId,
            ecranId: this.ecranId,
            logsInBuffer: this.logBuffer.length,
            currentMedia: this.currentPlayback ? this.currentPlayback.mediaFichier : null
        };
    }
    
    /**
     * Cleanup
     */
    destroy() {
        if (this.currentPlayback) {
            this.endMedia('session_end');
        }
        this._flushLogs();
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
        }
    }
}

// Singleton global
window.playbackLogger = new PlaybackLogger();

// Export pour modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlaybackLogger;
}

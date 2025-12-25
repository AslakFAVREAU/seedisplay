/**
 * SleepManager.js - Gestionnaire du mode sleep/veille de l'écran
 * 
 * Gère les cas où l'API retourne status: "sleep":
 * - Affiche écran noir, logo SEE, ou image personnalisée
 * - Programme le réveil automatique
 * - Gère la transition sleep → active
 */

// Local safe logger
if (typeof window !== 'undefined') {
    window.__log = window.__log || function(level, tag, ...args) { 
        try { 
            if (window.logger && typeof window.logger[level] === 'function') 
                return window.logger[level](tag, ...args); 
            if (console && typeof console[level] === 'function') 
                return console[level](tag, ...args); 
            return console.log(tag, ...args); 
        } catch(e) { 
            try { console.log(tag, ...args); } catch(_) {} 
        } 
    };
    var __log = window.__log;
} else {
    var __log = function(level, tag, ...args) { 
        try { 
            if (console && typeof console[level] === 'function') 
                return console[level](tag, ...args); 
            return console.log(tag, ...args); 
        } catch(e) { 
            try { console.log(tag, ...args); } catch(_) {} 
        } 
    };
}

class SleepManager {
    constructor() {
        this.isSleeping = false;
        this.sleepContainer = null;
        this.wakeupTimeout = null;
        this.checkInterval = null;
    }

    /**
     * Vérifie si l'écran doit être en mode sleep
     * @param {Object} apiResponse - Réponse complète de l'API
     * @returns {boolean}
     */
    shouldSleep(apiResponse) {
        return apiResponse && apiResponse.status === 'sleep';
    }

    /**
     * Active le mode sleep
     * @param {Object} data - Données de l'API avec typeHorsPlage, imageHorsPlage, prochainDemarrage
     */
    enterSleepMode(data) {
        if (this.isSleeping) {
            __log('debug', 'sleep', 'Already in sleep mode');
            return;
        }

        __log('info', 'sleep', 'Entering sleep mode');
        this.isSleeping = true;

        // Arrêter la boucle de diaporama si elle existe
        if (typeof stopLoopDiapo === 'function') {
            stopLoopDiapo();
        } else if (typeof loopTimeout !== 'undefined' && loopTimeout) {
            clearTimeout(loopTimeout);
        }

        // Masquer le contenu principal
        this._hideMainContent();

        // Créer/afficher le container de sleep
        this._showSleepContainer(data);

        // Programmer le prochain check pour le réveil
        if (data.prochainDemarrage) {
            this._scheduleWakeup(data.prochainDemarrage);
        }

        // Programmer un check périodique (toutes les minutes)
        this._startPeriodicCheck();
    }

    /**
     * Quitte le mode sleep
     */
    exitSleepMode() {
        if (!this.isSleeping) {
            return;
        }

        __log('info', 'sleep', 'Exiting sleep mode');
        this.isSleeping = false;

        // Annuler les timeouts
        if (this.wakeupTimeout) {
            clearTimeout(this.wakeupTimeout);
            this.wakeupTimeout = null;
        }
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }

        // Cacher le container de sleep
        if (this.sleepContainer) {
            this.sleepContainer.style.display = 'none';
        }

        // Réafficher le contenu principal
        this._showMainContent();

        // Relancer la boucle
        if (typeof defaultScreen === 'function') {
            defaultScreen();
        }
    }

    /**
     * Cache le contenu principal (pageDefault + mediaContainer)
     * @private
     */
    _hideMainContent() {
        try {
            const mediaContainer = document.getElementById('mediaContainer');
            const pageDefault = document.getElementById('pageDefault');
            
            if (mediaContainer) mediaContainer.style.display = 'none';
            if (pageDefault) pageDefault.style.display = 'none';
        } catch (e) {
            __log('error', 'sleep', 'Error hiding main content: ' + e.message);
        }
    }

    /**
     * Affiche le contenu principal
     * @private
     */
    _showMainContent() {
        try {
            const pageDefault = document.getElementById('pageDefault');
            if (pageDefault) pageDefault.style.display = 'flex';
        } catch (e) {
            __log('error', 'sleep', 'Error showing main content: ' + e.message);
        }
    }

    /**
     * Crée et affiche le container de sleep selon le type
     * @param {Object} data - Données avec typeHorsPlage et imageHorsPlage
     * @private
     */
    _showSleepContainer(data) {
        // Créer le container s'il n'existe pas
        if (!this.sleepContainer) {
            this.sleepContainer = document.createElement('div');
            this.sleepContainer.id = 'sleepContainer';
            this.sleepContainer.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                background: #000;
            `;
            document.body.appendChild(this.sleepContainer);
        }

        // Configurer selon le type
        const typeHorsPlage = data.typeHorsPlage || 'noir';
        __log('info', 'sleep', 'Sleep display type: ' + typeHorsPlage);

        this.sleepContainer.innerHTML = '';
        this.sleepContainer.style.display = 'flex';

        switch (typeHorsPlage) {
            case 'noir':
                this.sleepContainer.style.background = '#000';
                break;

            case 'logo':
                this.sleepContainer.style.background = '#000';
                this.sleepContainer.innerHTML = `
                    <img src="logo/logoSoekBlue.png" alt="SEE" 
                         style="max-width: 200px; opacity: 0.3;" 
                         onerror="this.style.display='none'">
                `;
                break;

            case 'image':
                if (data.imageHorsPlage) {
                    this.sleepContainer.style.backgroundImage = `url(${data.imageHorsPlage})`;
                    this.sleepContainer.style.backgroundSize = 'cover';
                    this.sleepContainer.style.backgroundPosition = 'center';
                } else {
                    // Fallback noir si pas d'image
                    this.sleepContainer.style.background = '#000';
                }
                break;

            default:
                this.sleepContainer.style.background = '#000';
        }
    }

    /**
     * Programme le réveil à une heure donnée
     * @param {string} prochainDemarrage - Heure au format "HH:mm"
     * @private
     */
    _scheduleWakeup(prochainDemarrage) {
        __log('info', 'sleep', 'Next wakeup scheduled at: ' + prochainDemarrage);

        // Calculer le temps jusqu'au réveil
        const now = new Date();
        const [hours, minutes] = prochainDemarrage.split(':').map(Number);
        
        let wakeupTime = new Date(now);
        wakeupTime.setHours(hours, minutes, 0, 0);

        // Si l'heure est déjà passée, programmer pour demain
        if (wakeupTime <= now) {
            wakeupTime.setDate(wakeupTime.getDate() + 1);
        }

        const msUntilWakeup = wakeupTime - now;
        __log('debug', 'sleep', 'Ms until wakeup: ' + msUntilWakeup);

        // Programmer le réveil
        if (this.wakeupTimeout) {
            clearTimeout(this.wakeupTimeout);
        }
        this.wakeupTimeout = setTimeout(() => {
            __log('info', 'sleep', 'Scheduled wakeup triggered');
            this._triggerRefresh();
        }, msUntilWakeup);
    }

    /**
     * Démarre un check périodique pour vérifier si on doit se réveiller
     * @private
     */
    _startPeriodicCheck() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }

        // Check toutes les 60 secondes
        this.checkInterval = setInterval(() => {
            __log('debug', 'sleep', 'Periodic sleep check');
            this._triggerRefresh();
        }, 60000);
    }

    /**
     * Déclenche un refresh de l'API pour vérifier si on doit se réveiller
     * @private
     */
    _triggerRefresh() {
        // Appeler requestJsonDiapo qui vérifiera le status
        if (typeof requestJsonDiapo === 'function') {
            requestJsonDiapo();
        }
    }

    /**
     * Applique la luminosité (pour le mode nuit)
     * @param {number} luminosite - Valeur 0-100
     */
    applyLuminosity(luminosite) {
        const brightness = (luminosite || 100) / 100;
        document.body.style.filter = `brightness(${brightness})`;
        __log('info', 'sleep', 'Luminosity applied: ' + luminosite + '%');
    }

    /**
     * Réinitialise la luminosité
     */
    resetLuminosity() {
        document.body.style.filter = '';
    }
}

// Instance globale
if (typeof window !== 'undefined') {
    window.sleepManager = new SleepManager();
}

// Export pour tests Node
try {
    module.exports = { SleepManager };
} catch (e) {}

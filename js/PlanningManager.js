/**
 * PlanningManager.js - Gestion de l'affichage du planning du jour
 * 
 * Récupère et affiche le planning des salles associées à l'écran
 * Endpoint: /see/API/planning/{idEcran}
 */

// Safe logger
if (typeof window !== 'undefined') {
    window.__log = window.__log || function(level, tag, ...args) { 
        try { 
            if (window.logger && typeof window.logger[level] === 'function') return window.logger[level](tag, ...args); 
            if (console && typeof console[level] === 'function') return console[level](tag, ...args); 
            return console.log(tag, ...args) 
        } catch(e){ try{ console.log(tag, ...args) }catch(_){} } 
    }
}

class PlanningManager {
    constructor() {
        this.container = null;
        this.planningData = null;
        this.refreshInterval = 60000; // 60 secondes par défaut
        this.refreshTimer = null;
        this.clockTimer = null;
        this.isVisible = false;
        this._log = window.__log || console.log;
    }

    /**
     * Initialise le conteneur de planning
     */
    init() {
        this.container = document.getElementById('planningContainer');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'planningContainer';
            this.container.className = 'planning-container';
            this.container.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                display: none;
                z-index: 500;
            `;
            document.body.appendChild(this.container);
        }
        this._log('info', 'planning', 'PlanningManager initialized');
    }

    /**
     * Construit l'URL de l'API planning
     * @returns {string}
     */
    getPlanningApiUrl() {
        const idEcran = window.configSEE?.idEcran || window.idEcran || 1;
        const env = window.configSEE?.env || window.env || 'prod';
        
        const baseUrl = env === 'local' 
            ? 'http://localhost:8000' 
            : 'https://soek.fr';
        
        return `${baseUrl}/see/API/planning/${idEcran}`;
    }

    /**
     * Récupère le planning depuis l'API
     * @returns {Promise<Object|null>}
     */
    async fetchPlanning() {
        const url = this.getPlanningApiUrl();
        this._log('info', 'planning', 'Fetching planning from ' + url);

        try {
            // Utiliser ApiManager si disponible (avec la bonne méthode)
            if (window.apiManager && window.apiManager.fetchJson) {
                const response = await window.apiManager.fetchJson(url);
                if (response) {
                    this.planningData = response;
                    return response;
                }
            }
            
            // Fallback: utiliser window.api.fetchJson (preload)
            if (window.api && window.api.fetchJson) {
                const response = await window.api.fetchJson(url);
                if (response) {
                    this.planningData = response;
                    return response;
                }
            }
            
            // Fallback axios
            const response = await axios.get(url, { timeout: 10000 });
            if (response && response.data) {
                this.planningData = response.data;
                return response.data;
            }
        } catch (error) {
            this._log('error', 'planning', 'Failed to fetch planning:', error.message);
        }
        
        return null;
    }

    /**
     * Affiche le planning du jour
     * @param {number} duree - Durée d'affichage en secondes (0 = permanent)
     * @returns {Promise}
     */
    async show(duree = 0) {
        if (!this.container) this.init();

        // Récupérer les données
        const data = await this.fetchPlanning();
        
        if (!data || data.status === 'no_salles') {
            this._log('warn', 'planning', 'No planning data or no salles');
            return;
        }

        this._log('info', 'planning', 'Showing planning with ' + (data.totalEvenements || 0) + ' events');

        // Générer le HTML
        this.container.innerHTML = this.renderPlanning(data);
        this.container.style.display = 'block';
        this.isVisible = true;

        // Masquer les autres conteneurs
        this._hideOtherContainers();

        // Démarrer l'horloge temps réel
        this._startClock();

        // Démarrer le refresh automatique
        this._startRefresh(data.refreshInterval || 60);

        // Si durée définie, cacher après
        if (duree > 0) {
            return new Promise((resolve) => {
                setTimeout(() => {
                    this.hide();
                    resolve();
                }, duree * 1000);
            });
        }
    }

    /**
     * Cache le planning et restaure l'affichage normal
     */
    hide() {
        if (this.container) {
            this.container.style.display = 'none';
        }
        this.isVisible = false;
        this._stopClock();
        this._stopRefresh();
        
        // Restaurer le mediaContainer si on était en mode split
        var mediaContainer = document.getElementById('mediaContainer');
        if (mediaContainer) {
            mediaContainer.style.width = '100%';
            mediaContainer.style.left = '0';
            mediaContainer.style.right = 'auto';
        }
        
        this._log('info', 'planning', 'Planning hidden');
    }

    /**
     * Masque les autres conteneurs
     */
    _hideOtherContainers() {
        try {
            document.getElementById('divImg1').style.display = 'none';
            document.getElementById('divImg2').style.display = 'none';
            document.getElementById('divVideo1').style.display = 'none';
            document.getElementById('divVideo2').style.display = 'none';
            document.getElementById('pageDefault').style.display = 'none';
            document.getElementById('mediaContainer')?.classList.remove('active');
        } catch(e) {}
    }

    /**
     * Démarre l'horloge temps réel
     */
    _startClock() {
        this._stopClock();
        this.clockTimer = setInterval(() => {
            const clockEl = document.getElementById('planningClock');
            if (clockEl) {
                const now = new Date();
                clockEl.textContent = now.toTimeString().slice(0, 5);
            }
            // Mettre à jour les compteurs
            this._updateCountdowns();
        }, 1000);
    }

    /**
     * Arrête l'horloge
     */
    _stopClock() {
        if (this.clockTimer) {
            clearInterval(this.clockTimer);
            this.clockTimer = null;
        }
    }

    /**
     * Démarre le refresh automatique
     * @param {number} intervalSeconds 
     */
    _startRefresh(intervalSeconds) {
        this._stopRefresh();
        this.refreshInterval = intervalSeconds * 1000;
        this.refreshTimer = setInterval(async () => {
            if (this.isVisible) {
                const data = await this.fetchPlanning();
                if (data && data.status !== 'no_salles') {
                    this.container.innerHTML = this.renderPlanning(data);
                }
            }
        }, this.refreshInterval);
    }

    /**
     * Arrête le refresh
     */
    _stopRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    }

    /**
     * Met à jour les compteurs de temps
     */
    _updateCountdowns() {
        const countdowns = document.querySelectorAll('[data-countdown]');
        countdowns.forEach(el => {
            const type = el.dataset.countdown;
            const minutes = parseInt(el.dataset.minutes || '0');
            // Recalculer basé sur l'heure actuelle serait plus précis
            // Pour l'instant on décrémente simplement
        });
    }

    /**
     * Rendu du planning complet
     * @param {Object} data - Données de l'API planning
     * @returns {string} HTML
     */
    renderPlanning(data) {
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 5);

        return `
            <div class="planning-du-jour">
                <header class="planning-header">
                    <div class="planning-header-left">
                        <h1>Planning du ${this._escapeHtml(data.jourSemaine || '')} ${this._escapeHtml(data.dateFormatee || '')}</h1>
                    </div>
                    <div class="planning-header-right">
                        <time id="planningClock" class="planning-clock">${currentTime}</time>
                    </div>
                </header>
                
                <div class="planning-grid">
                    ${this.renderSallesGrid(data)}
                </div>
            </div>
        `;
    }

    /**
     * Rendu de la grille des salles
     * @param {Object} data 
     * @returns {string} HTML
     */
    renderSallesGrid(data) {
        if (!data.planningParSalle || data.planningParSalle.length === 0) {
            // Fallback: grouper par salle
            return this.renderEventsList(data);
        }

        return data.planningParSalle.map(salleData => `
            <div class="salle-column" style="--salle-color: ${salleData.salle?.couleur || '#0866C6'}">
                <h2 class="salle-title">${this._escapeHtml(salleData.salle?.nom || 'Salle')}</h2>
                ${salleData.salle?.batiment ? `<div class="salle-batiment">${this._escapeHtml(salleData.salle.batiment)}</div>` : ''}
                
                <div class="salle-events">
                    ${salleData.eventEnCours ? this.renderEvent(salleData.eventEnCours, true) : ''}
                    ${(salleData.evenements || [])
                        .filter(e => e.statut !== 'termine' && e.id !== salleData.eventEnCours?.id)
                        .slice(0, 5)
                        .map(evt => this.renderEvent(evt, false))
                        .join('')}
                    ${(!salleData.evenements || salleData.evenements.length === 0) && !salleData.eventEnCours 
                        ? '<div class="no-events">Aucun événement</div>' 
                        : ''}
                </div>
            </div>
        `).join('');
    }

    /**
     * Rendu de la liste simple des événements
     * @param {Object} data 
     * @returns {string} HTML
     */
    renderEventsList(data) {
        if (!data.evenements || data.evenements.length === 0) {
            return '<div class="no-events-global">Aucun événement prévu aujourd\'hui</div>';
        }

        // Grouper par salle
        const grouped = {};
        data.evenements.forEach(evt => {
            const salleId = evt.salleId || 0;
            if (!grouped[salleId]) {
                grouped[salleId] = {
                    salle: { 
                        nom: evt.salleNom || 'Salle', 
                        couleur: evt.salleCouleur || '#0866C6' 
                    },
                    evenements: []
                };
            }
            grouped[salleId].evenements.push(evt);
        });

        return Object.values(grouped).map(salleData => `
            <div class="salle-column" style="--salle-color: ${salleData.salle.couleur}">
                <h2 class="salle-title">${this._escapeHtml(salleData.salle.nom)}</h2>
                <div class="salle-events">
                    ${salleData.evenements
                        .filter(e => e.statut !== 'termine')
                        .map(evt => this.renderEvent(evt, evt.statut === 'en_cours'))
                        .join('')}
                </div>
            </div>
        `).join('');
    }

    /**
     * Rendu d'un événement
     * @param {Object} evt - Données de l'événement
     * @param {boolean} enCours - Est-ce l'événement en cours ?
     * @returns {string} HTML
     */
    renderEvent(evt, enCours = false) {
        let countdownHtml = '';
        
        if (enCours && evt.minutesRestantes) {
            countdownHtml = `<div class="event-countdown" data-countdown="remaining" data-minutes="${evt.minutesRestantes}">
                ${evt.minutesRestantes} min restantes
            </div>`;
        } else if (evt.statut === 'a_venir' && evt.minutesAvantDebut) {
            if (evt.minutesAvantDebut <= 30) {
                countdownHtml = `<div class="event-countdown soon" data-countdown="before" data-minutes="${evt.minutesAvantDebut}">
                    Dans ${evt.minutesAvantDebut} min
                </div>`;
            }
        }

        return `
            <div class="event ${enCours ? 'en-cours' : ''} ${evt.statut || ''}">
                <div class="event-time">${this._escapeHtml(evt.heureDebut || '')} - ${this._escapeHtml(evt.heureFin || '')}</div>
                <div class="event-name">${this._escapeHtml(evt.nom || '')}</div>
                ${evt.responsable ? `<div class="event-responsable">${this._escapeHtml(evt.responsable)}</div>` : ''}
                ${evt.typeEvent ? `<div class="event-type">${this._escapeHtml(evt.typeEvent)}</div>` : ''}
                ${countdownHtml}
            </div>
        `;
    }

    /**
     * Échappe le HTML
     * @param {string} text 
     * @returns {string}
     */
    _escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Instance globale
window.planningManager = new PlanningManager();

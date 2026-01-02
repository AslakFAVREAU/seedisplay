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
        this.carouselTimer = null;
        this.isVisible = false;
        this._log = window.__log || console.log;
        
        // Configuration multi-salles
        this.maxSallesPerPage = 4;  // Max salles affichées en même temps
        this.currentPage = 0;
        this.totalPages = 1;
        this.sallesPerPage = []; // Répartition équilibrée des salles par page
        // TODO SERVER: Ajouter paramètre "planning_slide_duree" dans formulaire gestion écran
        // pour permettre de configurer cette durée via l'API (planning.slideDuree)
        this.carouselInterval = 10000; // 10 secondes par page (défaut)
    }
    
    /**
     * Calcule la répartition équilibrée des salles entre les pages
     * Ex: 5 salles → [3, 2] au lieu de [4, 1]
     * Ex: 7 salles → [4, 3] au lieu de [4, 3]
     * Ex: 9 salles → [3, 3, 3] au lieu de [4, 4, 1]
     * @param {number} totalSalles - Nombre total de salles
     * @returns {Array<number>} - Nombre de salles par page
     */
    _calculateBalancedPages(totalSalles) {
        if (totalSalles <= this.maxSallesPerPage) {
            return [totalSalles];
        }
        
        // Calcul du nombre de pages nécessaires
        const numPages = Math.ceil(totalSalles / this.maxSallesPerPage);
        
        // Répartition équilibrée: diviser équitablement
        const basePerPage = Math.floor(totalSalles / numPages);
        const remainder = totalSalles % numPages;
        
        const distribution = [];
        for (let i = 0; i < numPages; i++) {
            // Les premières pages ont +1 si il y a un reste
            distribution.push(basePerPage + (i < remainder ? 1 : 0));
        }
        
        this._log('info', 'planning', `Balanced distribution for ${totalSalles} salles: [${distribution.join(', ')}]`);
        return distribution;
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

        // Appliquer slideDuree depuis config si disponible
        // TODO SERVER: planning.slideDuree dans formulaire gestion écran
        if (window._planningSlideDuree) {
            this.carouselInterval = window._planningSlideDuree * 1000;
        }

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
        
        // Démarrer le carousel si plusieurs pages
        if (this.totalPages > 1) {
            this._startCarousel();
        }

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
        this._stopCarousel();
        
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
     * Démarre le carousel pour pagination multi-salles
     */
    _startCarousel() {
        if (this.totalPages <= 1) return;
        
        this._stopCarousel();
        this._log('info', 'planning', `Starting carousel with ${this.totalPages} pages`);
        
        this.carouselTimer = setInterval(() => {
            if (this.isVisible && this.planningData) {
                this.currentPage = (this.currentPage + 1) % this.totalPages;
                this._log('info', 'planning', `Carousel: showing page ${this.currentPage + 1}/${this.totalPages}`);
                this.container.innerHTML = this.renderPlanning(this.planningData);
            }
        }, this.carouselInterval);
    }
    
    /**
     * Arrête le carousel
     */
    _stopCarousel() {
        if (this.carouselTimer) {
            clearInterval(this.carouselTimer);
            this.carouselTimer = null;
        }
        this.currentPage = 0;
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
        
        // Calculer le nombre de salles pour adapter l'affichage
        const totalSalles = (data.planningParSalle || []).length;
        
        // Calculer la répartition équilibrée des salles
        this.sallesPerPage = this._calculateBalancedPages(totalSalles);
        this.totalPages = this.sallesPerPage.length;
        
        // Nombre de salles sur la page courante
        const sallesOnCurrentPage = this.sallesPerPage[this.currentPage] || totalSalles;
        
        // Déterminer le mode d'affichage
        const displayMode = totalSalles > 6 ? 'carousel' : (totalSalles > 4 ? 'compact' : 'normal');
        
        // Vérifier le mode de position (footer, sidebar, fullscreen)
        const planningConfig = window.planningConfig || {};
        const isFooterMode = planningConfig.position === 'footer' || planningConfig.position === 'overlay-bottom';
        const isSidebarMode = planningConfig.position === 'sidebar' || planningConfig.position === 'split-right' || planningConfig.position === 'split-left';
        const positionClass = isFooterMode ? 'footer-mode' : (isSidebarMode ? 'sidebar-mode' : '');
        
        return `
            <div class="planning-du-jour ${displayMode}-mode ${positionClass}" data-total-salles="${totalSalles}">
                <header class="planning-header">
                    <div class="planning-header-left">
                        <h1>Planning du ${this._escapeHtml(data.jourSemaine || '')} ${this._escapeHtml(data.dateFormatee || '')}</h1>
                    </div>
                    <div class="planning-header-right">
                        <time id="planningClock" class="planning-clock">${currentTime}</time>
                    </div>
                </header>
                
                <div class="planning-grid salles-${sallesOnCurrentPage}">
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

        const totalSalles = data.planningParSalle.length;
        
        // Si pagination nécessaire, utiliser la répartition équilibrée
        if (this.sallesPerPage.length > 1) {
            // Calculer l'index de départ basé sur la répartition équilibrée
            let startIdx = 0;
            for (let i = 0; i < this.currentPage; i++) {
                startIdx += this.sallesPerPage[i];
            }
            const endIdx = startIdx + this.sallesPerPage[this.currentPage];
            const sallesPage = data.planningParSalle.slice(startIdx, endIdx);
            
            // Passer le nombre de salles sur cette page pour le style
            const sallesOnThisPage = sallesPage.length;
            return sallesPage.map(salleData => this.renderSalleColumn(salleData, sallesOnThisPage)).join('');
        }

        return data.planningParSalle.map(salleData => this.renderSalleColumn(salleData, totalSalles)).join('');
    }
    
    /**
     * Rendu d'une colonne de salle
     * @param {Object} salleData 
     * @param {number} sallesOnPage - Nombre de salles sur cette page (pour adapter le style)
     * @returns {string} HTML
     */
    renderSalleColumn(salleData, sallesOnPage = 1) {
        // Mode compact pour beaucoup de salles (moins d'événements affichés)
        const maxEvents = sallesOnPage > 3 ? 3 : 5;
        const isCompact = sallesOnPage > 3;
        
        // Filtrer les événements non terminés (hors eventEnCours)
        const eventsNonTermines = (salleData.evenements || [])
            .filter(e => e.statut !== 'termine' && e.id !== salleData.eventEnCours?.id);
        
        // Aucun événement à afficher si pas d'eventEnCours ET pas d'événements non terminés
        const hasNoEvents = !salleData.eventEnCours && eventsNonTermines.length === 0;
        
        return `
            <div class="salle-column ${isCompact ? 'compact' : ''}" style="--salle-color: ${salleData.salle?.couleur || '#0866C6'}">
                <h2 class="salle-title">${this._escapeHtml(salleData.salle?.nom || 'Salle')}</h2>
                ${salleData.salle?.batiment ? `<div class="salle-batiment">${this._escapeHtml(salleData.salle.batiment)}</div>` : ''}
                
                <div class="salle-events">
                    ${salleData.eventEnCours ? this.renderEvent(salleData.eventEnCours, true, isCompact) : ''}
                    ${eventsNonTermines
                        .slice(0, maxEvents)
                        .map(evt => this.renderEvent(evt, false, isCompact))
                        .join('')}
                    ${hasNoEvents ? '<div class="no-events">Aucun événement à venir</div>' : ''}
                </div>
            </div>
        `;
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
     * @param {boolean} isCompact - Mode compact (moins de détails)
     * @returns {string} HTML
     */
    renderEvent(evt, enCours = false, isCompact = false) {
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

        // En mode compact, on affiche moins de détails
        if (isCompact) {
            return `
                <div class="event compact ${enCours ? 'en-cours' : ''} ${evt.statut || ''}">
                    <div class="event-time">${this._escapeHtml(evt.heureDebut || '')} - ${this._escapeHtml(evt.heureFin || '')}</div>
                    <div class="event-name">${this._escapeHtml(evt.nom || '')}</div>
                    ${countdownHtml}
                </div>
            `;
        }

        return `
            <div class="event ${enCours ? 'en-cours' : ''} ${evt.statut || ''}">
                <div class="event-time">${this._escapeHtml(evt.heureDebut || '')} - ${this._escapeHtml(evt.heureFin || '')}</div>
                <div class="event-name">${this._escapeHtml(evt.nom || '')}</div>
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

/**
 * TemplateRenderer.js - Rendu dynamique des templates (événements, etc.)
 * 
 * Gère l'affichage des diapos avec templateData au lieu de médias
 * Utilisé pour les événements SOEG générés automatiquement
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

class TemplateRenderer {
    constructor() {
        this.container = null;
        this._log = window.__log || console.log;
    }

    /**
     * Initialise le conteneur de template
     */
    init() {
        this.container = document.getElementById('templateContainer');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'templateContainer';
            this.container.className = 'template-container';
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
        this._log('info', 'template', 'TemplateRenderer initialized');
    }

    /**
     * Vérifie si un diapo a un templateData
     * @param {Object} diapo - Données du diapo
     * @returns {boolean}
     */
    hasTemplate(diapo) {
        return diapo && diapo.templateData && typeof diapo.templateData === 'object';
    }

    /**
     * Affiche un template
     * @param {Object} templateData - Données du template
     * @param {number} duree - Durée d'affichage en secondes
     * @returns {Promise} - Résolu quand le template a fini de s'afficher
     */
    show(templateData, duree = 10) {
        return new Promise((resolve) => {
            if (!this.container) this.init();

            this._log('info', 'template', 'Rendering template type=' + templateData.type);

            // Générer le HTML selon le type
            let html = '';
            switch (templateData.type) {
                case 'evenement':
                    html = this.renderEvenement(templateData);
                    break;
                case 'planning':
                    html = this.renderPlanning(templateData);
                    break;
                default:
                    html = this.renderDefault(templateData);
            }

            this.container.innerHTML = html;
            this.container.style.display = 'flex';

            // Masquer les autres conteneurs
            this._hideOtherContainers();

            // Timer pour la durée
            setTimeout(() => {
                this.hide();
                resolve();
            }, duree * 1000);
        });
    }

    /**
     * Cache le template
     */
    hide() {
        if (this.container) {
            this.container.style.display = 'none';
            this.container.innerHTML = '';
        }
    }

    /**
     * Masque les autres conteneurs média
     */
    _hideOtherContainers() {
        try {
            document.getElementById('divImg1').style.display = 'none';
            document.getElementById('divImg2').style.display = 'none';
            document.getElementById('divVideo1').style.display = 'none';
            document.getElementById('divVideo2').style.display = 'none';
            document.getElementById('pageDefault').style.display = 'none';
        } catch(e) {}
    }

    /**
     * Rendu d'un template événement
     * @param {Object} data - templateData de l'événement
     * @returns {string} HTML
     */
    renderEvenement(data) {
        const couleur = data.couleurSalle || '#0866C6';
        const gradientEnd = this._lightenColor(couleur, 20);
        
        // Formater la date pour affichage plus lisible
        let dateAffichage = data.date || '';
        if (dateAffichage) {
            try {
                const d = new Date(dateAffichage);
                const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
                dateAffichage = d.toLocaleDateString('fr-FR', options);
                // Première lettre en majuscule
                dateAffichage = dateAffichage.charAt(0).toUpperCase() + dateAffichage.slice(1);
            } catch(e) {}
        }

        // Support vidéo/image de fond
        const backgroundType = data.backgroundType || 'gradient';
        const backgroundVideo = data.backgroundVideo || null;
        const backgroundImage = data.backgroundImage || null;
        
        let backgroundStyle = `background: linear-gradient(135deg, ${couleur}, ${gradientEnd});`;
        let videoHtml = '';
        
        if (backgroundType === 'video' && backgroundVideo) {
            // Vidéo de fond
            const videoUrl = backgroundVideo.startsWith('http') 
                ? backgroundVideo 
                : (window.apiV2Response?.mediaBaseUrl || 'https://soek.fr/uploads/see/media/') + backgroundVideo;
            
            backgroundStyle = 'background: transparent;';
            videoHtml = `
                <video class="event-background-video" autoplay muted loop playsinline>
                    <source src="${this._escapeHtml(videoUrl)}" type="video/mp4">
                </video>
                <div class="event-video-overlay" style="background: linear-gradient(135deg, ${couleur}80, ${gradientEnd}80);"></div>
            `;
        } else if (backgroundType === 'image' && backgroundImage) {
            // Image de fond
            const imageUrl = backgroundImage.startsWith('http') 
                ? backgroundImage 
                : (window.apiV2Response?.mediaBaseUrl || 'https://soek.fr/uploads/see/media/') + backgroundImage;
            
            backgroundStyle = `
                background-image: url('${this._escapeHtml(imageUrl)}');
                background-size: cover;
                background-position: center;
            `;
        }

        return `
            <div class="event-template" style="${backgroundStyle}">
                ${videoHtml}
                <div class="event-content">
                    <h1 class="event-title">${this._escapeHtml(data.nom || data.titre || 'Événement')}</h1>
                    
                    <div class="event-details">
                        ${data.salle || data.lieu ? `
                        <div class="event-salle">${this._escapeHtml(data.salle || data.lieu)}</div>
                        ` : ''}
                        
                        <div class="event-horaires">${this._escapeHtml(data.heureDebut || '')} - ${this._escapeHtml(data.heureFin || '')}</div>
                    </div>
                    
                    ${dateAffichage ? `<div class="event-date-large">${this._escapeHtml(dateAffichage)}</div>` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Rendu d'un planning (simplifié - pour affichage dans la boucle diapo)
     * @param {Object} data - Données planning
     * @returns {string} HTML
     */
    renderPlanning(data) {
        return `
            <div class="planning-template">
                <div class="planning-header">
                    <h1>Planning du jour</h1>
                    <div class="planning-date">${this._escapeHtml(data.dateFormatee || '')}</div>
                </div>
                <div class="planning-content">
                    ${(data.evenements || []).slice(0, 6).map(evt => `
                        <div class="planning-event" style="border-left-color: ${evt.salleCouleur || '#0866C6'}">
                            <div class="planning-event-time">${this._escapeHtml(evt.heureDebut)} - ${this._escapeHtml(evt.heureFin)}</div>
                            <div class="planning-event-name">${this._escapeHtml(evt.nom)}</div>
                            <div class="planning-event-salle">${this._escapeHtml(evt.salleNom)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Rendu par défaut
     * @param {Object} data - Données quelconques
     * @returns {string} HTML
     */
    renderDefault(data) {
        return `
            <div class="default-template">
                <h1>${this._escapeHtml(data.titre || data.nom || 'Information')}</h1>
                ${data.message ? `<p>${this._escapeHtml(data.message)}</p>` : ''}
            </div>
        `;
    }

    /**
     * Échappe le HTML pour éviter XSS
     * @param {string} text 
     * @returns {string}
     */
    _escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Éclaircit une couleur hex
     * @param {string} color - Couleur hex (#RRGGBB)
     * @param {number} percent - Pourcentage d'éclaircissement
     * @returns {string}
     */
    _lightenColor(color, percent) {
        try {
            const num = parseInt(color.replace('#', ''), 16);
            const amt = Math.round(2.55 * percent);
            const R = Math.min(255, (num >> 16) + amt);
            const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
            const B = Math.min(255, (num & 0x0000FF) + amt);
            return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
        } catch(e) {
            return color;
        }
    }
}

// Instance globale
window.templateRenderer = new TemplateRenderer();

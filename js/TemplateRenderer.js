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
        
        // ── Cache trafic : prefetch pour éviter le spinner ──
        this._traficCache = null;        // { data, departures, fetchedAt }
        this._traficCacheTTL = 60000;    // 60s de validité
        this._traficRefreshTimer = null; // interval de refresh background
        this._traficPrefetching = false; // lock pour éviter les fetches concurrents
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
        return new Promise(async (resolve) => {
            if (!this.container) this.init();

            this._log('info', 'template', 'Rendering template type=' + templateData.type);

            // Types asynchrones (fetch + render) — on délègue et on résout quand c'est fini
            if (templateData.type === 'trafic') {
                await this._showTrafic(templateData, duree);
                return resolve();
            }
            if (templateData.type === 'meteo') {
                await this._showMeteo(templateData, duree);
                return resolve();
            }

            // Générer le HTML selon le type
            let html = '';
            switch (templateData.type) {
                case 'evenement':
                    html = this.renderEvenement(templateData);
                    break;
                case 'planning':
                    html = this.renderPlanning(templateData);
                    break;
                case 'anniversaire':
                    html = this.renderAnniversaire(templateData);
                    break;
                case 'menu':
                    html = this.renderMenu(templateData);
                    break;
                case 'annonce':
                    html = this.renderAnnonce(templateData);
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
        // Restore mediaContainer visibility
        try {
            const mc = document.getElementById('mediaContainer');
            if (mc) mc.style.visibility = 'visible';
        } catch(e) {}
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
            // Hide mediaContainer children but not the container itself
            // (templateContainer is now a sibling, no longer inside mediaContainer)
            const mc = document.getElementById('mediaContainer');
            if (mc) mc.style.visibility = 'hidden';
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
     * Rendu d'un template anniversaire
     * @param {Object} data - Données de l'anniversaire
     * @returns {string} HTML
     */
    renderAnniversaire(data) {
        // Get colors from presentation or defaults
        const presentation = data.presentation || {};
        const config = data.config || {};
        const couleur = presentation.couleurPrimaire || data.couleur || '#E91E63';
        const backgroundColor = presentation.backgroundColor || presentation.couleur_fond || '#FFE5E5';
        const emoji = presentation.emoji || '🎂';
        const gradientEnd = this._lightenColor(couleur, 30);
        
        // Support pour plusieurs personnes (anniversairesDuJour from API)
        const personnes = data.personnes || [{ nom: data.nom || 'Joyeux Anniversaire', photo: data.photo }];
        const afficherAge = data.afficherAge || config.afficherAge || config.afficher_age;
        const afficherClasse = data.afficherClasse || config.afficherClasse;
        
        // Formater la date
        let dateAffichage = data.date || '';
        if (dateAffichage) {
            try {
                const d = new Date(dateAffichage);
                const options = { day: 'numeric', month: 'long' };
                dateAffichage = d.toLocaleDateString('fr-FR', options);
            } catch(e) {}
        }
        
        const personnesHtml = personnes.map(p => {
            // Calculate age if dateNaissance is available
            let ageHtml = '';
            if (afficherAge && p.dateNaissance) {
                try {
                    const birthDate = new Date(p.dateNaissance);
                    const today = new Date();
                    let age = today.getFullYear() - birthDate.getFullYear();
                    const monthDiff = today.getMonth() - birthDate.getMonth();
                    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                        age--;
                    }
                    ageHtml = `<div class="anniversaire-age">${age} ans</div>`;
                } catch(e) {}
            }
            
            return `
                <div class="anniversaire-personne">
                    ${p.photo ? `<img class="anniversaire-photo" src="${this._escapeHtml(p.photo)}" alt="${this._escapeHtml(p.nom)}">` : 
                               `<div class="anniversaire-avatar">${this._getInitials(p.nom)}</div>`}
                    <div class="anniversaire-nom">${this._escapeHtml(p.nom)}</div>
                    ${afficherClasse && p.classe ? `<div class="anniversaire-service">${this._escapeHtml(p.classe)}</div>` : ''}
                    ${p.service ? `<div class="anniversaire-service">${this._escapeHtml(p.service)}</div>` : ''}
                    ${ageHtml}
                </div>
            `;
        }).join('');
        
        return `
            <div class="anniversaire-template" style="background: linear-gradient(135deg, ${couleur}, ${gradientEnd});">
                <div class="anniversaire-decoration">${emoji}</div>
                <div class="anniversaire-content">
                    <h1 class="anniversaire-titre">${this._escapeHtml(data.titre || 'Joyeux Anniversaire !')}</h1>
                    <div class="anniversaire-personnes ${personnes.length > 3 ? 'anniversaire-grid' : ''}">
                        ${personnesHtml}
                    </div>
                    ${dateAffichage ? `<div class="anniversaire-date">${dateAffichage}</div>` : ''}
                    ${data.message ? `<div class="anniversaire-message">${this._escapeHtml(data.message)}</div>` : ''}
                </div>
                <div class="anniversaire-confetti"></div>
            </div>
        `;
    }
    
    /**
     * Rendu d'un template menu (cantine, restaurant)
     * @param {Object} data - Données du menu
     * @returns {string} HTML
     */
    renderMenu(data) {
        // Get colors from presentation or defaults
        const presentation = data.presentation || {};
        const config = data.config || {};
        const couleurPrimaire = presentation.couleur_fond || presentation.couleurPrimaire || data.couleur || '#e7186b';
        const couleurTexte = presentation.couleur_texte || '#33691e';
        const backgroundColor = presentation.backgroundColor || '#f0f4f0';
        const gradientEnd = this._lightenColor(couleurPrimaire, 20);
        
        // Mode d'affichage: journalier ou semaine
        const modeAffichage = config.modeAffichage || 'journalier';
        
        if (modeAffichage === 'semaine') {
            return this._renderMenuSemaine(data, couleurPrimaire, gradientEnd, backgroundColor, couleurTexte);
        } else {
            return this._renderMenuJour(data, couleurPrimaire, gradientEnd, backgroundColor, couleurTexte);
        }
    }
    
    /**
     * Rendu mode journalier (Day Meal Planner style)
     */
    _renderMenuJour(data, couleurPrimaire, gradientEnd, backgroundColor, couleurTexte) {
        const config = data.config || {};
        
        // Trouver le menu du jour
        let menuDuJour = data.menuDuJour;
        if (!menuDuJour && data.menus && data.menus.length > 0) {
            const today = new Date().toISOString().split('T')[0];
            menuDuJour = data.menus.find(m => m.date === today) || data.menus[data.menus.length - 1];
        }
        
        // Formater la date
        let dateAffichage = menuDuJour?.date || data.date || '';
        let jourNom = '';
        if (dateAffichage) {
            try {
                const d = new Date(dateAffichage);
                const optionsJour = { weekday: 'long' };
                jourNom = d.toLocaleDateString('fr-FR', optionsJour);
                jourNom = jourNom.charAt(0).toUpperCase() + jourNom.slice(1);
                const options = { weekday: 'long', day: 'numeric', month: 'long' };
                dateAffichage = d.toLocaleDateString('fr-FR', options);
                dateAffichage = dateAffichage.charAt(0).toUpperCase() + dateAffichage.slice(1);
            } catch(e) {}
        }
        
        // Organiser les items par catégorie
        const categories = this._organizeItemsByCategory(menuDuJour?.items || []);
        
        // Sections avec labels et couleurs
        const sections = [
            { key: 'entrees', label: 'ENTRÉES', cssClass: 'entrees' },
            { key: 'plats', label: 'PLATS', cssClass: 'plats' },
            { key: 'accompagnements', label: 'ACCOMP.', cssClass: 'accompagnements' },
            { key: 'desserts', label: 'DESSERTS', cssClass: 'desserts' },
            { key: 'gouters', label: 'GOÛTER', cssClass: 'gouters' }
        ];
        
        let sectionsHtml = '';
        for (const section of sections) {
            const items = categories[section.key];
            if (items && items.length > 0) {
                sectionsHtml += `
                    <div class="menu-section ${section.cssClass}">
                        <div class="menu-section-label">${section.label}</div>
                        <div class="menu-section-items">
                            ${items.map(item => `<div class="menu-item">${this._escapeHtml(item)}</div>`).join('')}
                        </div>
                    </div>
                `;
            }
        }
        
        return `
            <div class="menu-template" style="background-color: ${backgroundColor};">
                <div class="menu-header" style="background: linear-gradient(135deg, ${couleurPrimaire}, ${gradientEnd}); position: relative;">
                    <span class="menu-chef-icon">👨‍🍳</span>
                    <h1 class="menu-titre">${this._escapeHtml(data.titre || config.titre || 'Menu du Jour')}</h1>
                    ${dateAffichage ? `<div class="menu-date">${dateAffichage}</div>` : ''}
                </div>
                <div class="menu-content" style="color: ${couleurTexte};">
                    <div class="menu-jour-container">
                        ${jourNom ? `<div class="menu-jour-header">${jourNom.toUpperCase()}</div>` : ''}
                        <div class="menu-jour-sections">
                            ${sectionsHtml || '<p class="menu-vide">Aucun menu disponible</p>'}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Rendu mode semaine (Weekly Meal Planner style)
     */
    _renderMenuSemaine(data, couleurPrimaire, gradientEnd, backgroundColor, couleurTexte) {
        const config = data.config || {};
        
        // Récupérer les 5 prochains jours de menus
        const menus = data.menus || data.menusDeLaSemaine || [];
        const joursNoms = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI'];
        
        // Construire les 5 prochains jours à partir d'aujourd'hui
        const today = new Date();
        const prochains5Jours = [];
        for (let i = 0; i < 5; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            const jourIndex = d.getDay(); // 0=dim, 1=lun, ...
            const jourNom = jourIndex === 0 ? 'DIMANCHE' : (jourIndex === 6 ? 'SAMEDI' : joursNoms[jourIndex - 1]);
            
            // Trouver le menu correspondant à cette date
            const menuJour = menus.find(m => m.date === dateStr);
            prochains5Jours.push({
                date: dateStr,
                jourNom: jourNom,
                items: menuJour ? this._organizeItemsByCategory(menuJour.items || []) : {}
            });
        }
        
        // Générer les en-têtes des jours
        const joursHeaderHtml = prochains5Jours.map(j => 
            `<div class="menu-semaine-jour-header">${j.jourNom}</div>`
        ).join('');
        
        // Sections avec labels
        const sections = [
            { key: 'entrees', label: 'ENTRÉES', cssClass: 'entrees' },
            { key: 'plats', label: 'PLATS', cssClass: 'plats' },
            { key: 'desserts', label: 'DESSERTS', cssClass: 'desserts' }
        ];
        
        // Générer les lignes du tableau
        let rowsHtml = '';
        for (const section of sections) {
            const cellsHtml = prochains5Jours.map(jour => {
                const items = jour.items[section.key] || [];
                return `
                    <div class="menu-semaine-cell">
                        ${items.map(item => `<div class="menu-item">${this._escapeHtml(item)}</div>`).join('') || '-'}
                    </div>
                `;
            }).join('');
            
            rowsHtml += `
                <div class="menu-semaine-row ${section.cssClass}">
                    <div class="menu-section-label">${section.label}</div>
                    <div class="menu-semaine-cells">
                        ${cellsHtml}
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="menu-template" style="background-color: ${backgroundColor};">
                <div class="menu-header" style="background: linear-gradient(135deg, ${couleurPrimaire}, ${gradientEnd}); position: relative;">
                    <span class="menu-chef-icon">👨‍🍳</span>
                    <h1 class="menu-titre">${this._escapeHtml(data.titre || config.titre || 'Menu de la Semaine')}</h1>
                </div>
                <div class="menu-content" style="color: ${couleurTexte};">
                    <div class="menu-semaine-container">
                        <div class="menu-semaine-header">
                            <div class="menu-semaine-corner"></div>
                            <div class="menu-semaine-jours">
                                ${joursHeaderHtml}
                            </div>
                        </div>
                        <div class="menu-semaine-body">
                            ${rowsHtml || '<p class="menu-vide">Aucun menu disponible</p>'}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Organise les items par catégorie
     */
    _organizeItemsByCategory(items) {
        const categories = {
            entrees: [],
            plats: [],
            accompagnements: [],
            desserts: [],
            gouters: []
        };
        
        for (const item of items) {
            const nom = item.nom || item.name || item;
            const cat = (item.categorie || item.category || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            
            if (cat.includes('entree') || cat.includes('entré')) {
                categories.entrees.push(nom);
            } else if (cat.includes('plat') || cat.includes('main')) {
                categories.plats.push(nom);
            } else if (cat.includes('accomp') || cat.includes('side')) {
                categories.accompagnements.push(nom);
            } else if (cat.includes('dessert')) {
                categories.desserts.push(nom);
            } else if (cat.includes('gouter') || cat.includes('goûter') || cat.includes('snack')) {
                categories.gouters.push(nom);
            }
        }
        
        return categories;
    }
    
    /**
     * Rendu d'un template annonce (info, alerte, communication)
     * @param {Object} data - Données de l'annonce
     * @returns {string} HTML
     */
    renderAnnonce(data) {
        // Types d'annonces avec couleurs par défaut
        const types = {
            info: { couleur: '#2196F3', icon: 'ℹ️', label: 'Information' },
            alerte: { couleur: '#FF5722', icon: '⚠️', label: 'Alerte' },
            urgent: { couleur: '#F44336', icon: '🚨', label: 'Urgent' },
            succes: { couleur: '#4CAF50', icon: '✅', label: 'Succès' },
            evenement: { couleur: '#9C27B0', icon: '📅', label: 'Événement' },
            maintenance: { couleur: '#FF9800', icon: '🔧', label: 'Maintenance' },
            communication: { couleur: '#00BCD4', icon: '📢', label: 'Communication' }
        };
        
        const typeAnnonce = data.typeAnnonce || 'info';
        const typeConfig = types[typeAnnonce] || types.info;
        const couleur = data.couleur || typeConfig.couleur;
        const gradientEnd = this._lightenColor(couleur, 25);
        const icon = data.icon || typeConfig.icon;
        
        // Support image ou vidéo de fond
        let backgroundStyle = `background: linear-gradient(135deg, ${couleur}, ${gradientEnd});`;
        let mediaHtml = '';
        
        if (data.backgroundImage) {
            const imageUrl = data.backgroundImage.startsWith('http') 
                ? data.backgroundImage 
                : (window.apiV2Response?.mediaBaseUrl || 'https://soek.fr/uploads/see/media/') + data.backgroundImage;
            backgroundStyle = `background-image: linear-gradient(135deg, ${couleur}CC, ${gradientEnd}CC), url('${this._escapeHtml(imageUrl)}'); background-size: cover; background-position: center;`;
        }
        
        // Image d'illustration (dans le contenu)
        if (data.image) {
            const imageUrl = data.image.startsWith('http') 
                ? data.image 
                : (window.apiV2Response?.mediaBaseUrl || 'https://soek.fr/uploads/see/media/') + data.image;
            mediaHtml = `<img class="annonce-image" src="${this._escapeHtml(imageUrl)}" alt="">`;
        }
        
        // Formater les dates si présentes
        let periodeHtml = '';
        if (data.dateDebut || data.dateFin) {
            const formatDate = (dateStr) => {
                try {
                    const d = new Date(dateStr);
                    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
                } catch(e) { return dateStr; }
            };
            
            if (data.dateDebut && data.dateFin) {
                periodeHtml = `<div class="annonce-periode">Du ${formatDate(data.dateDebut)} au ${formatDate(data.dateFin)}</div>`;
            } else if (data.dateDebut) {
                periodeHtml = `<div class="annonce-periode">À partir du ${formatDate(data.dateDebut)}</div>`;
            } else if (data.dateFin) {
                periodeHtml = `<div class="annonce-periode">Jusqu'au ${formatDate(data.dateFin)}</div>`;
            }
        }
        
        return `
            <div class="annonce-template ${typeAnnonce === 'urgent' || typeAnnonce === 'alerte' ? 'annonce-urgente' : ''}" style="${backgroundStyle}">
                <div class="annonce-content">
                    <div class="annonce-header">
                        <span class="annonce-icon">${icon}</span>
                        <span class="annonce-type-label">${this._escapeHtml(data.label || typeConfig.label)}</span>
                    </div>
                    
                    <h1 class="annonce-titre">${this._escapeHtml(data.titre || data.nom || 'Annonce')}</h1>
                    
                    ${data.sousTitre ? `<h2 class="annonce-sous-titre">${this._escapeHtml(data.sousTitre)}</h2>` : ''}
                    
                    ${mediaHtml}
                    
                    ${data.message ? `<div class="annonce-message">${this._escapeHtml(data.message)}</div>` : ''}
                    
                    ${periodeHtml}
                    
                    ${data.lieu ? `<div class="annonce-lieu">📍 ${this._escapeHtml(data.lieu)}</div>` : ''}
                    
                    ${data.contact ? `<div class="annonce-contact">📧 ${this._escapeHtml(data.contact)}</div>` : ''}
                </div>
            </div>
        `;
    }
    
    /**
     * Obtient les initiales d'un nom
     * @param {string} nom 
     * @returns {string}
     */
    _getInitials(nom) {
        if (!nom) return '?';
        return nom.split(' ').map(n => n.charAt(0).toUpperCase()).slice(0, 2).join('');
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

    // ══════════════════════════════════════════════
    //  TEMPLATE MÉTÉO — réutilise getMeteo() de meteo.js
    // ══════════════════════════════════════════════

    /**
     * Affiche le template MÉTÉO — appelle getMeteo() de meteo.js (Open-Meteo, pas de clé API)
     * @param {Object} data - templateData météo
     * @param {number} duree - Durée d'affichage en secondes
     * @returns {Promise}
     */
    _showMeteo(data, duree) {
        return new Promise(async (resolve) => {
            if (!this.container) this.init();

            this._log('info', 'template', 'METEO _showMeteo called');

            // Fetch les données AVANT d'afficher quoi que ce soit (évite le flash loader→contenu)
            let meteoData = null;
            try {
                meteoData = (typeof getMeteo === 'function') ? await getMeteo() : null;
                if (meteoData) {
                    this._log('info', 'template', 'METEO: data fetched successfully');
                } else {
                    this._log('warn', 'template', 'METEO: no data received');
                }
            } catch (e) {
                this._log('error', 'template', 'METEO fetch failed: ' + e.message);
            }

            // Afficher le contenu final directement (pas de loader intermédiaire)
            this.container.innerHTML = this._renderMeteo(data, meteoData);
            this.container.style.display = 'flex';
            this._hideOtherContainers();

            // Timer démarre APRÈS le rendu du contenu final (pas pendant le fetch)
            this._log('info', 'template', 'METEO: content ready, starting ' + duree + 's display timer');
            setTimeout(() => {
                this.hide();
                resolve();
            }, duree * 1000);
        });
    }

    /**
     * Rendu loading du template météo
     */
    _renderMeteoLoading(data) {
        const presentation = data.presentation || {};
        const couleurPrimaire = presentation.couleurPrimaire || '#0866C6';
        const gradientEnd = this._lightenColor(couleurPrimaire, 20);
        return `
            <div class="meteo-template">
                <div class="meteo-header" style="background: linear-gradient(135deg, ${couleurPrimaire}, ${gradientEnd});">
                    <div class="meteo-header-left">
                        <svg class="meteo-header-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z"/></svg>
                        <h1 class="meteo-titre">${this._escapeHtml(data.titre || 'Météo')}</h1>
                    </div>
                </div>
                <div class="trafic-loading">
                    <div class="trafic-spinner"></div>
                    <div>Chargement de la météo...</div>
                </div>
            </div>
        `;
    }

    /**
     * Traduit un code météo Open-Meteo en libellé français
     */
    _weatherCodeToLabel(code) {
        const labels = {
            0: 'Ciel dégagé', 1: 'Peu nuageux', 2: 'Partiellement nuageux', 3: 'Couvert',
            45: 'Brouillard', 48: 'Brouillard givrant',
            51: 'Bruine légère', 53: 'Bruine modérée', 55: 'Bruine dense',
            61: 'Pluie faible', 63: 'Pluie modérée', 65: 'Pluie forte',
            71: 'Neige faible', 73: 'Neige modérée', 75: 'Neige forte',
            80: 'Averses légères', 81: 'Averses modérées', 82: 'Averses violentes',
            95: 'Orage', 96: 'Orage avec grêle légère', 99: 'Orage avec grêle forte'
        };
        return labels[code] || 'Inconnu';
    }

    /**
     * Rendu du template météo avec les données Open-Meteo
     * Même design language que trafic/planning (fond clair, header couleur, cartes)
     * @param {Object} data - templateData de la diapo
     * @param {Object|null} meteoData - réponse brute de Open-Meteo
     */
    _renderMeteo(data, meteoData) {
        const presentation = data.presentation || {};
        const couleurPrimaire = presentation.couleurPrimaire || '#0866C6';
        const gradientEnd = this._lightenColor(couleurPrimaire, 20);
        const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const ville = data.ville || data.lieu || '';

        if (!meteoData) {
            return `
                <div class="meteo-template">
                    <div class="meteo-header" style="background: linear-gradient(135deg, ${couleurPrimaire}, ${gradientEnd});">
                        <div class="meteo-header-left">
                            <svg class="meteo-header-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z"/></svg>
                            <h1 class="meteo-titre">${this._escapeHtml(data.titre || 'Météo')}</h1>
                        </div>
                        <div class="meteo-header-right">
                            <span class="meteo-clock">${now}</span>
                        </div>
                    </div>
                    <div class="trafic-empty">Données météo indisponibles</div>
                </div>
            `;
        }

        // ── Current weather ──
        const cur = meteoData.current_weather || {};
        const curTemp = typeof cur.temperature !== 'undefined' ? Math.round(cur.temperature) : '--';
        const curCode = typeof cur.weathercode !== 'undefined' ? cur.weathercode : 0;
        const curIcon = (typeof mapCodeToIcon === 'function') ? mapCodeToIcon(curCode, true) : 'logo/meteo/01d.png';
        const curLabel = this._weatherCodeToLabel(curCode);
        const curWind = typeof cur.windspeed !== 'undefined' ? Math.round(cur.windspeed) : null;

        // ── Daily forecast ──
        const daily = meteoData.daily || {};
        let forecastHtml = '';
        if (daily.time && daily.time.length > 1) {
            const joursFormatFr = { 0: 'Dim', 1: 'Lun', 2: 'Mar', 3: 'Mer', 4: 'Jeu', 5: 'Ven', 6: 'Sam' };
            // j=1 to 4 (demain → d+4)
            for (let j = 1; j < Math.min(daily.time.length, 5); j++) {
                const d = new Date(daily.time[j]);
                const jourNom = joursFormatFr[d.getDay()] || '';
                const jourNum = d.getDate();
                const tempMax = daily.temperature_2m_max ? Math.round(daily.temperature_2m_max[j]) : '--';
                const tempMin = daily.temperature_2m_min ? Math.round(daily.temperature_2m_min[j]) : '--';
                const code = daily.weathercode ? daily.weathercode[j] : 0;
                const icon = (typeof mapCodeToIcon === 'function') ? mapCodeToIcon(code, true) : 'logo/meteo/01d.png';
                const label = this._weatherCodeToLabel(code);
                forecastHtml += `
                    <div class="meteo-forecast-card">
                        <div class="meteo-forecast-day">${jourNom} ${jourNum}</div>
                        <img class="meteo-forecast-icon" src="${this._escapeHtml(icon)}" alt="${this._escapeHtml(label)}">
                        <div class="meteo-forecast-label">${this._escapeHtml(label)}</div>
                        <div class="meteo-forecast-temps">
                            <span class="meteo-temp-max">${tempMax}°</span>
                            <span class="meteo-temp-min">${tempMin}°</span>
                        </div>
                    </div>
                `;
            }
        }

        // ── Sunrise / Sunset ──
        let sunHtml = '';
        if (daily.sunrise && daily.sunrise[0] && daily.sunset && daily.sunset[0]) {
            try {
                const sunrise = new Date(daily.sunrise[0]).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                const sunset = new Date(daily.sunset[0]).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                sunHtml = `
                    <div class="meteo-sun-info">
                        <div class="meteo-sun-item"><img class="meteo-sun-icon" src="logo/meteo/040-sunrise.png" alt="Lever"><span>${sunrise}</span></div>
                        <div class="meteo-sun-item"><img class="meteo-sun-icon" src="logo/meteo/041-sunset.png" alt="Coucher"><span>${sunset}</span></div>
                    </div>
                `;
            } catch(e) {}
        }

        return `
            <div class="meteo-template">
                <div class="meteo-header" style="background: linear-gradient(135deg, ${couleurPrimaire}, ${gradientEnd});">
                    <div class="meteo-header-left">
                        <svg class="meteo-header-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z"/></svg>
                        <h1 class="meteo-titre">${this._escapeHtml(data.titre || 'Météo')}</h1>
                    </div>
                    <div class="meteo-header-right">
                        ${ville ? `<span class="meteo-ville">${this._escapeHtml(ville)}</span>` : ''}
                        <span class="meteo-clock">${now}</span>
                    </div>
                </div>
                <div class="meteo-content">
                    <div class="meteo-current">
                        <img class="meteo-current-icon" src="${this._escapeHtml(curIcon)}" alt="${this._escapeHtml(curLabel)}">
                        <div class="meteo-current-info">
                            <div class="meteo-current-temp">${curTemp}°</div>
                            <div class="meteo-current-label">${this._escapeHtml(curLabel)}</div>
                            ${curWind !== null ? `<div class="meteo-current-wind">💨 ${curWind} km/h</div>` : ''}
                        </div>
                        ${sunHtml}
                    </div>
                    ${forecastHtml ? `
                    <div class="meteo-forecast">
                        <div class="meteo-forecast-title">Prévisions</div>
                        <div class="meteo-forecast-grid">
                            ${forecastHtml}
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Prefetch les données trafic en arrière-plan pour le cache.
     * Appelé par loopDiapo quand on détecte un template trafic dans la boucle.
     * @param {Object} data - templateData du trafic (arrets, apiKey)
     */
    async prefetchTrafic(data) {
        if (!data?.arrets?.length || !data?.apiKey) return;
        if (this._traficPrefetching) return; // déjà en cours
        
        this._traficPrefetching = true;
        this._log('info', 'template', 'TRAFIC PREFETCH: fetching departures in background...');
        
        try {
            const departures = await this._fetchAllDepartures(data.arrets, data.apiKey);
            this._traficCache = {
                data: data,
                departures: departures,
                fetchedAt: Date.now()
            };
            this._log('info', 'template', 'TRAFIC PREFETCH: cached ' + departures.reduce((n, s) => n + (s.departures?.length || 0), 0) + ' departures');
        } catch (e) {
            this._log('warn', 'template', 'TRAFIC PREFETCH failed: ' + e.message);
        } finally {
            this._traficPrefetching = false;
        }
        
        // Lancer le refresh automatique en background (toutes les 45s)
        this._startTraficRefresh(data);
    }
    
    /**
     * Démarre le rafraîchissement automatique du cache trafic
     */
    _startTraficRefresh(data) {
        // Stopper l'ancien timer
        if (this._traficRefreshTimer) {
            clearInterval(this._traficRefreshTimer);
        }
        
        // Refresh toutes les 45s (le cache est valide 60s, on refresh avant expiration)
        this._traficRefreshTimer = setInterval(async () => {
            if (this._traficPrefetching) return;
            this._traficPrefetching = true;
            try {
                const departures = await this._fetchAllDepartures(data.arrets, data.apiKey);
                this._traficCache = {
                    data: data,
                    departures: departures,
                    fetchedAt: Date.now()
                };
                this._log('debug', 'template', 'TRAFIC REFRESH: cache updated');
            } catch (e) {
                this._log('debug', 'template', 'TRAFIC REFRESH failed: ' + e.message);
            } finally {
                this._traficPrefetching = false;
            }
        }, 45000);
    }
    
    /**
     * Stoppe le rafraîchissement automatique du cache trafic
     */
    stopTraficRefresh() {
        if (this._traficRefreshTimer) {
            clearInterval(this._traficRefreshTimer);
            this._traficRefreshTimer = null;
        }
        this._traficCache = null;
    }
    
    /**
     * Affiche le template TRAFIC — utilise le cache prefetché si disponible
     * @param {Object} data - templateData du trafic (arrets, apiKey)
     * @param {number} duree - Durée d'affichage en secondes
     * @returns {Promise}
     */
    _showTrafic(data, duree) {
        return new Promise(async (resolve) => {
            if (!this.container) this.init();
            
            this._log('info', 'template', 'TRAFIC _showTrafic called, arrets=' + (data.arrets ? data.arrets.length : 'none') + ', apiKey=' + (data.apiKey ? 'yes' : 'MISSING'));
            
            // Handle missing configuration
            if (!data.arrets || data.arrets.length === 0 || !data.apiKey) {
                this._log('warn', 'template', 'TRAFIC: incomplete config - showing error state');
                this.container.innerHTML = this.renderTrafic(data, []);
                this.container.style.display = 'flex';
                this._hideOtherContainers();
                
                setTimeout(() => {
                    this.hide();
                    resolve();
                }, duree * 1000);
                return;
            }
            
            // ── Vérifier le cache : si frais, afficher directement SANS spinner ──
            const cacheAge = this._traficCache ? (Date.now() - this._traficCache.fetchedAt) : Infinity;
            
            if (this._traficCache && cacheAge < this._traficCacheTTL) {
                // Cache valide → affichage INSTANTANÉ
                this._log('info', 'template', `TRAFIC: using cached data (age: ${Math.round(cacheAge/1000)}s)`);
                this.container.innerHTML = this.renderTrafic(data, this._traficCache.departures);
                this.container.style.display = 'flex';
                this._hideOtherContainers();
                this._trimTraficOverflow();
                
                // Rafraîchir le cache en background pour la prochaine fois
                this.prefetchTrafic(data);
            } else {
                // Pas de cache → fetch live (avec loader)
                this._log('info', 'template', 'TRAFIC: no cache, fetching live...');
                this.container.innerHTML = this.renderTraficLoading(data);
                this.container.style.display = 'flex';
                this._hideOtherContainers();
                
                try {
                    const departures = await this._fetchAllDepartures(data.arrets, data.apiKey);
                    this._traficCache = {
                        data: data,
                        departures: departures,
                        fetchedAt: Date.now()
                    };
                    this.container.innerHTML = this.renderTrafic(data, departures);
                    this._trimTraficOverflow();
                    // Lancer le refresh pour la suite
                    this._startTraficRefresh(data);
                } catch (e) {
                    this._log('error', 'template', 'TRAFIC fetch failed: ' + e.message);
                    this.container.innerHTML = this.renderTrafic(data, []);
                }
            }
            
            // Timer démarre APRÈS le rendu du contenu final (pas pendant le fetch)
            this._log('info', 'template', 'TRAFIC: content ready, starting ' + duree + 's display timer');
            setTimeout(() => {
                this.hide();
                resolve();
            }, duree * 1000);
        });
    }
    
    /**
     * Fetch departures from IDFM PRIM for all stops
     */
    /**
     * Supprime les lignes de départ qui débordent du conteneur visible.
     * Appellé après chaque rendu trafic pour garantir qu'aucune ligne n'est coupée.
     */
    _trimTraficOverflow() {
        try {
            const content = this.container?.querySelector('.trafic-content');
            if (!content) return;
            const contentRect = content.getBoundingClientRect();
            const rows = content.querySelectorAll('.trafic-departure');
            let removed = 0;
            for (const row of rows) {
                const rowRect = row.getBoundingClientRect();
                // Si le bas de la ligne dépasse le bas du conteneur, on la supprime
                if (rowRect.bottom > contentRect.bottom + 2) {
                    row.remove();
                    removed++;
                }
            }
            if (removed > 0) {
                this._log('info', 'template', `TRAFIC: trimmed ${removed} overflow rows`);
            }
        } catch(e) {
            this._log('debug', 'template', 'trimOverflow error: ' + e.message);
        }
    }
    /**
     * Helper HTTP pour appeler l'API IDFM PRIM
     */
    async _fetchFromPRIM(url, apiKey, timeout = 8000) {
        try {
            if (window.api?.fetchJson) {
                return await window.api.fetchJson(url, { headers: { apikey: apiKey }, timeout });
            } else if (window.axios?.get) {
                const res = await window.axios.get(url, { headers: { apikey: apiKey }, timeout });
                return res.data;
            }
            this._log('warn', 'template', 'No HTTP client available for IDFM');
            return null;
        } catch (e) {
            this._log('error', 'template', `_fetchFromPRIM error: ${e.message} — url=${url}`);
            return null;
        }
    }

    /**
     * Fetch departures from IDFM PRIM for all stops
     * Utilise places_nearby (proximité géographique) pour trouver bus/tram à côté du stop_area principal
     */
    async _fetchAllDepartures(arrets, apiKey) {
        const results = [];
        const PRIM_BASE = 'https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia';
        
        for (const arret of arrets) {
            try {
                const arretId = arret.id || '';
                const lignes = arret.lignesSelectionnees || [];
                const arretNom = arret.nom || arret.label || '';
                
                this._log('info', 'template', `TRAFIC: === Processing arret "${arretNom}" id=${arretId} ===`);
                this._log('info', 'template', `TRAFIC: lignesSelectionnees RAW (${typeof lignes[0]}): ${JSON.stringify(lignes)}`);
                
                // ── 1) Fetch departures from the configured stop_area ──
                const mainUrl = `${PRIM_BASE}/stop_areas/${encodeURIComponent(arretId)}/departures?count=20&data_freshness=realtime&disable_geojson=true`;
                const mainResp = await this._fetchFromPRIM(mainUrl, apiKey);
                let allRawDeps = mainResp?.departures || [];
                this._log('info', 'template', `TRAFIC: main stop_area -> ${allRawDeps.length} departures`);
                
                // ── 2) Discover nearby stop_areas (bus, tram, etc.) via geographic proximity ──
                //    The IDFM API has SEPARATE stop_areas per transport mode
                //    e.g. "Antony" RER B ≠ "Antony Gare Routière" bus
                //    places_nearby finds ALL stop_areas within 500m radius
                const discoveredIds = new Set([arretId]);
                let nearbyFound = false;
                
                try {
                    const nearbyUrl = `${PRIM_BASE}/stop_areas/${encodeURIComponent(arretId)}/places_nearby?type[]=stop_area&distance=500&count=25&disable_geojson=true`;
                    this._log('info', 'template', `TRAFIC: calling places_nearby (500m radius)...`);
                    const nearbyResp = await this._fetchFromPRIM(nearbyUrl, apiKey, 6000);
                    
                    const nearbyStops = (nearbyResp?.places_nearby || [])
                        .filter(p => p.embedded_type === 'stop_area' && p.stop_area)
                        .map(p => ({ id: p.stop_area.id, name: p.stop_area.name, distance: p.distance || '?' }))
                        .filter(s => !discoveredIds.has(s.id));
                    
                    this._log('info', 'template', `TRAFIC: places_nearby found ${nearbyStops.length} nearby stop_areas`);
                    nearbyStops.forEach(s => {
                        this._log('info', 'template', `TRAFIC:   nearby: "${s.name}" (${s.id}) - ${s.distance}m`);
                        discoveredIds.add(s.id);
                    });
                    nearbyFound = true;
                    
                    // Fetch departures from each nearby stop_area (limit 6 to keep response time reasonable)
                    const fetchPromises = nearbyStops.slice(0, 6).map(async (nearby) => {
                        try {
                            const depUrl = `${PRIM_BASE}/stop_areas/${encodeURIComponent(nearby.id)}/departures?count=15&data_freshness=realtime&disable_geojson=true`;
                            const depResp = await this._fetchFromPRIM(depUrl, apiKey, 5000);
                            const extraDeps = depResp?.departures || [];
                            if (extraDeps.length > 0) {
                                this._log('info', 'template', `TRAFIC:   ${nearby.name} -> ${extraDeps.length} departures`);
                            }
                            return extraDeps;
                        } catch(e) {
                            this._log('debug', 'template', `TRAFIC:   fetch failed for "${nearby.name}": ${e.message}`);
                            return [];
                        }
                    });
                    
                    // Parallel fetch for speed
                    const nearbyResults = await Promise.all(fetchPromises);
                    for (const extraDeps of nearbyResults) {
                        allRawDeps = allRawDeps.concat(extraDeps);
                    }
                } catch(nearbyErr) {
                    this._log('warn', 'template', `TRAFIC: places_nearby failed: ${nearbyErr.message}`);
                }
                
                // ── 2b) Fallback: search by name if places_nearby returned nothing extra ──
                if (!nearbyFound || discoveredIds.size <= 1) {
                    const searchName = arretNom.replace(/\s*\(.*\)\s*$/, '').trim();
                    if (searchName) {
                        this._log('info', 'template', `TRAFIC: fallback name search for "${searchName}"...`);
                        try {
                            const searchUrl = `${PRIM_BASE}/places?q=${encodeURIComponent(searchName)}&type[]=stop_area&count=15&disable_geojson=true`;
                            const searchResp = await this._fetchFromPRIM(searchUrl, apiKey, 6000);
                            
                            const allPlaces = (searchResp?.places || [])
                                .filter(p => p.embedded_type === 'stop_area' && p.stop_area);
                            this._log('info', 'template', `TRAFIC: name search returned ${allPlaces.length} places: ${allPlaces.map(p => '"' + p.stop_area.name + '" (' + p.stop_area.id + ')').join(', ')}`);
                            
                            const searchLower = searchName.toLowerCase();
                            const matchedStops = allPlaces
                                .filter(p => {
                                    const name = (p.stop_area.name || '').toLowerCase();
                                    return name.includes(searchLower) || searchLower.includes(name);
                                })
                                .map(p => ({ id: p.stop_area.id, name: p.stop_area.name }))
                                .filter(s => !discoveredIds.has(s.id));
                            
                            this._log('info', 'template', `TRAFIC: name-matched ${matchedStops.length} new stop_areas`);
                            
                            for (const ms of matchedStops.slice(0, 5)) {
                                try {
                                    discoveredIds.add(ms.id);
                                    const depUrl = `${PRIM_BASE}/stop_areas/${encodeURIComponent(ms.id)}/departures?count=15&data_freshness=realtime&disable_geojson=true`;
                                    const depResp = await this._fetchFromPRIM(depUrl, apiKey, 5000);
                                    const extraDeps = depResp?.departures || [];
                                    if (extraDeps.length > 0) {
                                        this._log('info', 'template', `TRAFIC:   name-match ${ms.name} -> ${extraDeps.length} deps`);
                                        allRawDeps = allRawDeps.concat(extraDeps);
                                    }
                                } catch(e) {
                                    this._log('debug', 'template', `TRAFIC: fetch failed for ${ms.name}: ${e.message}`);
                                }
                            }
                        } catch(searchErr) {
                            this._log('warn', 'template', `TRAFIC: name search failed: ${searchErr.message}`);
                        }
                    }
                }
                
                this._log('info', 'template', `TRAFIC: total raw departures collected: ${allRawDeps.length} from ${discoveredIds.size} stop_areas`);
                
                // ── 3) Parse all departures ──
                const deps = allRawDeps.map(dep => {
                    const info = dep.display_informations || {};
                    const stopDt = dep.stop_date_time || {};
                    const stopPoint = dep.stop_point || {};
                    return {
                        arretId: arret.id,
                        arretNom: stopPoint.name || arret.nom || arret.label,
                        code: info.code || '',
                        mode: info.commercial_mode || '',
                        direction: info.direction || info.headsign || '',
                        couleur: '#' + (info.color || '999999'),
                        textColor: '#' + (info.text_color || '000000'),
                        headsign: info.headsign || '',
                        network: info.network || '',
                        departureTime: stopDt.departure_date_time || ''
                    };
                });
                
                // Log unique modes/lines found for debugging
                const uniqueLines = [...new Set(deps.map(d => d.mode + ' ' + d.code))];
                this._log('info', 'template', `TRAFIC: ${arretNom} total ${deps.length} parsed deps, unique lines: ${uniqueLines.join(', ')}`);
                
                // ── 4) Filter by selected lines if specified ──
                // lignesSelectionnees can be: strings ["B","196"], objects [{code:"B"}], or objects with other shapes
                // IMPORTANT: API SOEK sends bus codes as NUMBERS (3, 196), IDFM returns STRINGS ("3", "196")
                //            → Must compare as strings!
                let filtered;
                if (lignes.length > 0) {
                    this._log('info', 'template', `TRAFIC: filtering by ${lignes.length} lignes: ${JSON.stringify(lignes)}`);
                    this._log('info', 'template', `TRAFIC: available dep codes: ${[...new Set(deps.map(d => d.code))].join(', ')}`);
                    
                    filtered = deps.filter(d => {
                        return lignes.some(l => {
                            // Support multiple formats: string, number, {code:...}, {id:...}, {name:...}
                            const ligneCode = String((typeof l === 'string' || typeof l === 'number') ? l : (l.code || l.id || l.name || ''));
                            return ligneCode === String(d.code);
                        });
                    });
                    this._log('info', 'template', `TRAFIC: after filter: ${filtered.length} deps kept (from ${deps.length})`);
                    if (filtered.length === 0 && deps.length > 0) {
                        this._log('warn', 'template', `TRAFIC: ⚠ FILTER REMOVED ALL DEPS! lignes[0] type=${typeof lignes[0]}, value=${JSON.stringify(lignes[0])}, dep codes=[${[...new Set(deps.map(d=>d.code))].join(',')}]`);
                        // If filter kills everything, show unfiltered so user sees SOMETHING
                        filtered = deps;
                        this._log('warn', 'template', `TRAFIC: showing all ${filtered.length} deps unfiltered as fallback`);
                    }
                } else {
                    filtered = deps;
                }
                
                // 5) Deduplicate (same line+direction+time)
                const seen = new Set();
                const deduped = filtered.filter(d => {
                    const key = d.code + '|' + d.direction + '|' + d.departureTime;
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });
                
                results.push({ arret, departures: deduped });
                this._log('info', 'template', `TRAFIC: ${arret.nom} -> ${deduped.length} departures (after dedup)`);
            } catch (e) {
                this._log('warn', 'template', `TRAFIC: failed to fetch ${arret.nom}: ${e.message}`);
                results.push({ arret, departures: [], error: e.message });
            }
        }
        
        return results;
    }
    
    /**
     * Format departure time from IDFM format (YYYYMMDDTHHmmss) to minutes remaining
     */
    _formatDepartureTime(dtStr) {
        if (!dtStr || dtStr.length < 13) return '?';
        try {
            const h = parseInt(dtStr.substring(9, 11), 10);
            const m = parseInt(dtStr.substring(11, 13), 10);
            const now = new Date();
            const depDate = new Date();
            depDate.setHours(h, m, 0, 0);
            
            const diffMs = depDate.getTime() - now.getTime();
            const diffMin = Math.round(diffMs / 60000);
            
            if (diffMin <= 0) return 'À quai';
            if (diffMin === 1) return '1 min';
            return diffMin + ' min';
        } catch (e) {
            return '?';
        }
    }
    
    /**
     * Format departure time to HH:mm
     */
    _formatDepartureHour(dtStr) {
        if (!dtStr || dtStr.length < 13) return '';
        try {
            return dtStr.substring(9, 11) + ':' + dtStr.substring(11, 13);
        } catch (e) {
            return '';
        }
    }
    
    /**
     * SVG icons for transport modes (monochrome)
     */
    _getTraficIcon(mode, code) {
        const m = (mode || '').toLowerCase();
        const c = (code || '').toUpperCase();
        // RER
        if (m.includes('rer') || /^[A-E]$/.test(c)) {
            return '<svg class="trafic-mode-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7zm-1 14H9v-2h2v2zm4 0h-2v-2h2v2zm1.5-6.39l-.86.6V12c0 .28-.22.5-.5.5h-6.28c-.28 0-.5-.22-.5-.5v-1.79l-.86-.6C6.35 8.83 6 7.77 6 7c0-3.31 2.69-6 6-6s6 2.69 6 6c0 .77-.35 1.83-1.5 2.61z"/></svg>';
        }
        // Métro
        if (m.includes('métro') || m.includes('metro') || /^\d{1,2}$/.test(c)) {
            return '<svg class="trafic-mode-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M17.8 2H6.2C4.44 2 3 3.44 3 5.2v9.6C3 16.76 4.44 19 6.2 19l-1.2 2h2.2l1-2h7.6l1 2h2.2l-1.2-2c1.76 0 3.2-2.24 3.2-4.2V5.2C21 3.44 19.56 2 17.8 2zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-7H5V5h6v5zm2 0V5h6v5h-6zm3.5 7c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>';
        }
        // Tram
        if (m.includes('tram')) {
            return '<svg class="trafic-mode-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M19 16.94V8.5c0-2.79-2.61-3.4-5.5-3.5l.9-1.64L15 3l-3-1-3 1 .6.36L10.5 5C7.6 5.1 5 5.71 5 8.5v8.44c0 1.45.98 2.67 2.3 3.06L6 21v1h2l1.5-2h5l1.5 2h2v-1l-1.3-1c1.32-.39 2.3-1.61 2.3-3.06zM8.5 18c-.83 0-1.5-.67-1.5-1.5S7.67 15 8.5 15s1.5.67 1.5 1.5S9.33 18 8.5 18zm2.5-5H7V9h4v4zm2 0V9h4v4h-4zm2.5 5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>';
        }
        // Bus
        if (m.includes('bus')) {
            return '<svg class="trafic-mode-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/></svg>';
        }
        // Default: train
        return '<svg class="trafic-mode-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h2.23l2-2H14l2 2h2v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-6H6V6h5v5zm2 0V6h5v5h-5zm3.5 6c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>';
    }

    /**
     * Rendu loading du template trafic
     */
    renderTraficLoading(data) {
        return `
            <div class="trafic-template">
                <div class="trafic-header">
                    <svg class="trafic-header-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h2.23l2-2H14l2 2h2v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-6H6V6h5v5zm2 0V6h5v5h-5zm3.5 6c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
                    <h1 class="trafic-titre">${this._escapeHtml(data.titre || 'Prochains départs')}</h1>
                </div>
                <div class="trafic-loading">
                    <div class="trafic-spinner"></div>
                    <div>Chargement des horaires...</div>
                </div>
            </div>
        `;
    }
    
    /**
     * Rendu du template trafic avec les données de départ
     * Style unifié "planning" - fond clair, icônes monochromes
     * Tous les départs fusionnés et triés par heure
     */
    renderTrafic(data, stopsData) {
        const presentation = data.presentation || {};
        const config = data.config || {};
        const couleurPrimaire = presentation.couleurPrimaire || '#0866C6';
        // Calcul dynamique : hauteur viewport - header (~7vh) / hauteur d'une ligne (~4.5vh + marge)
        // En fallback on utilise config.maxDepartures ou un calcul basé sur window.innerHeight
        const estimatedRowHeight = window.innerHeight * 0.045; // ~4.5vh par ligne (padding + margin)
        const headerHeight = window.innerHeight * 0.08;        // ~8vh pour le header
        const availableHeight = window.innerHeight - headerHeight;
        const fittingRows = Math.floor(availableHeight / estimatedRowHeight);
        const maxDepartures = config.maxDepartures || Math.max(5, Math.min(fittingRows, 20));
        
        // Heure de mise à jour
        const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        
        let contentHtml = '';
        
        if (!stopsData || stopsData.length === 0) {
            contentHtml = '<div class="trafic-empty">Aucun arrêt configuré</div>';
        } else {
            // Merge ALL departures from ALL stops into one flat list
            const allDeps = [];
            const errors = [];
            
            for (const stop of stopsData) {
                if (stop.error) {
                    errors.push(stop.error);
                    continue;
                }
                for (const dep of (stop.departures || [])) {
                    allDeps.push(dep);
                }
            }
            
            // Sort by departure time (chronological order)
            allDeps.sort((a, b) => {
                const tA = a.departureTime || '';
                const tB = b.departureTime || '';
                return tA.localeCompare(tB);
            });
            
            // Take top N departures
            const displayDeps = allDeps.slice(0, maxDepartures);
            
            if (displayDeps.length === 0 && errors.length > 0) {
                contentHtml = `<div class="trafic-error-row">${this._escapeHtml(errors[0])}</div>`;
            } else if (displayDeps.length === 0) {
                contentHtml = '<div class="trafic-empty">Aucun départ à venir</div>';
            } else {
                contentHtml = displayDeps.map(dep => {
                    const minutesStr = this._formatDepartureTime(dep.departureTime);
                    const heureStr = this._formatDepartureHour(dep.departureTime);
                    const isImm = minutesStr === 'À quai';
                    
                    return `
                        <div class="trafic-departure ${isImm ? 'trafic-dep-imminent' : ''}">
                            <span class="trafic-line-badge" style="background-color:${dep.couleur}; color:${dep.textColor};">${this._escapeHtml(dep.code)}</span>
                            <div class="trafic-dep-info">
                                <span class="trafic-direction">${this._escapeHtml(dep.direction)}</span>
                            </div>
                            <div class="trafic-dep-time">
                                <span class="trafic-time ${isImm ? 'trafic-time-imminent' : ''}">${minutesStr}</span>
                                <span class="trafic-hour">${heureStr}</span>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }
        
        return `
            <div class="trafic-template" style="--trafic-primary: ${couleurPrimaire};">
                <div class="trafic-header">
                    <div class="trafic-header-left">
                        <svg class="trafic-header-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h2.23l2-2H14l2 2h2v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-6H6V6h5v5zm2 0V6h5v5h-5zm3.5 6c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
                        <h1 class="trafic-titre">${this._escapeHtml(data.titre || 'Prochains départs')}</h1>
                    </div>
                    <div class="trafic-header-right">
                        <span class="trafic-clock">${now}</span>
                    </div>
                </div>
                <div class="trafic-content">
                    ${contentHtml}
                </div>
            </div>
        `;
    }
}

// Instance globale
window.templateRenderer = new TemplateRenderer();

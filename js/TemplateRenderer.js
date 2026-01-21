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
}

// Instance globale
window.templateRenderer = new TemplateRenderer();



// Local safe logger
if (typeof window !== 'undefined') {
    window.__log = window.__log || function(level, tag, ...args) { try { if (window.logger && typeof window.logger[level] === 'function') return window.logger[level](tag, ...args); if (console && typeof console[level] === 'function') return console[level](tag, ...args); return console.log(tag, ...args) } catch(e){ try{ console.log(tag, ...args) }catch(_){} } }
    var __log = window.__log
} else {
    var __log = function(level, tag, ...args) { try { if (console && typeof console[level] === 'function') return console[level](tag, ...args); return console.log(tag, ...args) } catch(e){ try{ console.log(tag, ...args) }catch(_){} } }
}

// ============================================================
// Fêtes fixes françaises
// Chaque entrée : { name, icon, type ('ferie'|'fete'), saint?, saintGender? }
// Si saint est null → on ne montre pas de saint secondaire
// Si saint est défini → on l'affiche en complément de la fête
// ============================================================
var FETES_FIXES = {
    '01/01': { name: 'Jour de l\'An',       icon: '🎆', type: 'ferie', saint: 'Marie',     saintGender: 'f' },
    '06/01': { name: 'Épiphanie',            icon: '👑', type: 'fete',  saint: null },
    '02/02': { name: 'Chandeleur',           icon: '🕯️', type: 'fete', saint: null },
    '14/02': { name: 'Saint-Valentin',       icon: '❤️', type: 'fete', saint: 'Valentin',  saintGender: 'm' },
    '08/03': { name: 'Journée de la Femme',  icon: '♀️', type: 'fete', saint: null },
    '01/04': { name: 'Poisson d\'Avril',     icon: '🐟', type: 'fete',  saint: 'Hugues',    saintGender: 'm' },
    '01/05': { name: 'Fête du Travail',      icon: '⚒️', type: 'ferie', saint: 'Joseph',   saintGender: 'm' },
    '08/05': { name: 'Victoire 1945',        icon: '🕊️', type: 'ferie', saint: null },
    '21/06': { name: 'Fête de la Musique',   icon: '🎵', type: 'fete',  saint: null },
    '14/07': { name: 'Fête Nationale',       icon: '🇫🇷', type: 'ferie', saint: 'Camille', saintGender: 'm' },
    '15/08': { name: 'Assomption',           icon: '⛪', type: 'ferie',  saint: null },
    '31/10': { name: 'Halloween',            icon: '🎃', type: 'fete',   saint: null },
    '01/11': { name: 'Toussaint',            icon: '🕯️', type: 'ferie', saint: null },
    '02/11': { name: 'Jour des Défunts',     icon: '🕯️', type: 'fete',  saint: null },
    '11/11': { name: 'Armistice 1918',       icon: '🕊️', type: 'ferie', saint: 'Martin',  saintGender: 'm' },
    '24/12': { name: 'Réveillon de Noël',    icon: '🎄', type: 'fete',   saint: null },
    '25/12': { name: 'Noël',                 icon: '🎄', type: 'ferie',  saint: 'Emmanuel', saintGender: 'm' },
    '26/12': { name: 'Saint-Étienne',        icon: '🎄', type: 'fete',   saint: 'Étienne',  saintGender: 'm' },
    '31/12': { name: 'Saint-Sylvestre',      icon: '🎆', type: 'fete',   saint: 'Sylvestre', saintGender: 'm' }
}

// ============================================================
// Prénoms féminins connus — correction auto du genre
// ============================================================
var FEMALE_SAINTS = [
    'Marie','Alix','Pauline','Julienne','Paulette','Agnès','Angèle','Martine',
    'Brigitte','Agathe','Isabelle',
    'Colette','Perpétue','Françoise','Justine','Edwige','Clémence','Adèle',
    'Marina','Julie','Emilie','Émilie','Ida','Zoé','Zoe','Emma','Catherine',
    'Florence','Domitille','Solange','Estelle','Sophie','Caroline','Félicité',
    'Pétronille','Petronille',
    'Clotilde','Solène','Édith','Edith','Alice','Mariette','Marthe','Martha',
    'Laetitia','Clarisse','Hélène','Valérie','Monique','Maria',
    'Bertille','Reine','Marguerite','Teresa','Thérèse','Therese',
    'Joséphine','Josephine','Thecla','Thècle',
    'Gertrude','Paulina','Cécile','Cecilia','Émeline','Emeline','Sylvie',
    'Éléonore','Élisabeth','Elizabeth','Lucy','Lucie',
    'Élise','Barbara','Barbe','Myriam','Natalie','Nathalie',
    'Rosalie','Geneviève','Bernadette','Anne','Jeanne','Odile',
    'Olga','Lucienne','Jeannine','Viviane','Irène','Blandine',
    'Margot','Nadine','Véronique','Nicole','Amélie','Céline','Audile','Romaine'
]

// ============================================================
// Calcul de Pâques — algorithme de Butcher (Gregorian)
// ============================================================
function computeEaster(year) {
    var a = year % 19
    var b = Math.floor(year / 100)
    var c = year % 100
    var d = Math.floor(b / 4)
    var e = b % 4
    var f = Math.floor((b + 8) / 25)
    var g = Math.floor((b - f + 1) / 3)
    var h = (19 * a + b - d - g + 15) % 30
    var i = Math.floor(c / 4)
    var k = c % 4
    var l = (32 + 2 * e + 2 * i - h - k) % 7
    var m = Math.floor((a + 11 * h + 22 * l) / 451)
    var month = Math.floor((h + l - 7 * m + 114) / 31)
    var day = ((h + l - 7 * m + 114) % 31) + 1
    return new Date(year, month - 1, day)
}

function _fmtDDMM(d) {
    var day = d.getDate()
    var month = d.getMonth() + 1
    return (day < 10 ? '0' : '') + day + '/' + (month < 10 ? '0' : '') + month
}

function _addDays(d, n) {
    var r = new Date(d.getTime())
    r.setDate(r.getDate() + n)
    return r
}

// ============================================================
// Fêtes mobiles calculées depuis Pâques
// ============================================================
function getFetesMobiles(year) {
    var easter = computeEaster(year)
    var fetes = {}

    // Mardi Gras (Easter - 47)
    fetes[_fmtDDMM(_addDays(easter, -47))] = { name: 'Mardi Gras', icon: '🎭', type: 'fete', saint: null }
    // Dimanche des Rameaux (Easter - 7)
    fetes[_fmtDDMM(_addDays(easter, -7))] = { name: 'Rameaux', icon: '🌿', type: 'fete', saint: null }
    // Dimanche de Pâques
    fetes[_fmtDDMM(easter)] = { name: 'Pâques', icon: '🐣', type: 'ferie', saint: null }
    // Lundi de Pâques (Easter + 1)
    fetes[_fmtDDMM(_addDays(easter, 1))] = { name: 'Lundi de Pâques', icon: '🐣', type: 'ferie', saint: null }
    // Ascension (Easter + 39)
    fetes[_fmtDDMM(_addDays(easter, 39))] = { name: 'Ascension', icon: '✝️', type: 'ferie', saint: null }
    // Pentecôte (Easter + 49)
    fetes[_fmtDDMM(_addDays(easter, 49))] = { name: 'Pentecôte', icon: '🔥', type: 'ferie', saint: null }
    // Lundi de Pentecôte (Easter + 50)
    fetes[_fmtDDMM(_addDays(easter, 50))] = { name: 'Lundi de Pentecôte', icon: '🔥', type: 'ferie', saint: null }

    return fetes
}

// ============================================================
// Fonction principale — appelée au démarrage
// ============================================================
async function ephe() {
    __log('debug', 'ephe', 'today=' + dateDayMonth())
    var today = dateDayMonth()
    var year = new Date().getFullYear()

    // ── 1. Lire le CSV pour le saint du jour ──
    var saintName = ''
    var csvType = '2'

    try {
        var csvText = null
        if (window && window.api && typeof window.api.readFile === 'function') {
            try { csvText = await window.api.readFile('ephe.csv') } catch (e) { csvText = null }
        }
        if (!csvText && window && window.api && typeof window.api.readBundledFile === 'function') {
            try { csvText = await window.api.readBundledFile('ephe.csv') } catch (e) { csvText = null }
        }
        if (csvText && typeof csvText !== 'string') {
            try { csvText = csvText.toString() } catch (e) { csvText = null }
        }

        if (csvText) {
            var lines = csvText.split(/\r?\n/)
            for (var i = 0; i < lines.length; i++) {
                var row = lines[i].split(',')
                if (today === row[0]) {
                    csvType = row[1] || '2'
                    saintName = (row[2] || '').trim()
                    break
                }
            }
        }
    } catch (e) {
        __log('error', 'ephe', 'CSV read error', e && e.message)
    }

    // ── 2. Déterminer le genre du saint ──
    var saintGender = 'm'
    if (csvType === '3') {
        saintGender = 'f'
    } else if (csvType === '1') {
        saintGender = '' // événement brut
    } else if (saintName) {
        // Extract first name from full name (e.g., "Félicité Et Perpétue" => "Félicité")
        var firstName = saintName.split(/\s+/)[0]
        if (FEMALE_SAINTS.indexOf(firstName) !== -1) {
            saintGender = 'f'
        }
    }

    // ── 3. Chercher fête du jour (fixes puis mobiles prioritaires) ──
    var fete = FETES_FIXES[today] || null
    var mobiles = getFetesMobiles(year)
    if (mobiles[today]) fete = mobiles[today]

    // ── 4. Construire le texte du saint ──
    var saintFull = ''
    if (fete && fete.saint) {
        // La fête fournit un saint explicite
        saintFull = (fete.saintGender === 'f' ? 'Sainte ' : 'Saint ') + fete.saint
    } else if (saintName && csvType !== '1') {
        var prefix = saintGender === 'f' ? 'Sainte ' : (saintGender === 'm' ? 'Saint ' : '')
        saintFull = prefix + saintName
    } else if (saintName && csvType === '1' && !fete) {
        saintFull = saintName // événement CSV non couvert par les fêtes JS
    }

    // ── 5. Stocker les données structurées (pour sync horizontal) ──
    window._epheData = {
        saint: saintFull,
        fete: fete,
        hasFete: !!fete,
        isFerie: !!(fete && fete.type === 'ferie')
    }

    // ── 6. Construire le HTML — layout vertical ──
    var html = ''
    if (fete) {
        html += '<div class="ephe-fete-line' + (fete.type === 'ferie' ? ' ephe-ferie' : '') + '">'
        html += '  <span class="ephe-fete-icon">' + fete.icon + '</span>'
        html += '  <span class="ephe-fete-name">' + fete.name + '</span>'
        if (fete.type === 'ferie') html += '<span class="ephe-ferie-badge">Jour férié</span>'
        html += '</div>'
        if (saintFull) {
            html += '<div class="ephe-saint-line ephe-saint-secondary">'
            html += '  <span class="ephe-saint-dot">•</span> ' + saintFull
            html += '</div>'
        }
    } else {
        html += '<div class="ephe-saint-line ephe-saint-only">'
        html += '  <span class="ephe-saint-icon">✦</span>'
        html += '  <span class="ephe-saint-text">' + (saintFull || '') + '</span>'
        html += '</div>'
    }

    // ── 7. Mettre à jour le DOM ──
    var container = document.getElementById('epheContainer')
    if (container) container.innerHTML = html

    // Backward compat — ancien élément #ephe (caché)
    var el = document.getElementById('ephe')
    if (el) el.innerHTML = saintFull || ''

    // Classe CSS globale sur pageDefault pour animations
    var pageDefault = document.getElementById('pageDefault')
    if (pageDefault) {
        if (fete) {
            pageDefault.classList.add('has-fete')
            if (fete.type === 'ferie') pageDefault.classList.add('has-ferie')
        } else {
            pageDefault.classList.remove('has-fete')
            pageDefault.classList.remove('has-ferie')
        }
    }

    __log('info', 'ephe', 'loaded', { saint: saintFull, fete: fete ? fete.name : null })
}

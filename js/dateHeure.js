function addZero(i) {
    if (i < 10) {
        i = "0" + i;
    }
    return i;
}
var heure
/**
 * Renvoie l'heure au format "HH:MM"
 */
function heure() {
    var x = new Date();
    var hh = addZero(x.getHours());
    var mm = addZero(x.getMinutes());
    return hh + ":" + mm;
}

/**
 * Met à jour le DOM de l'horloge (#heure) sans recréer le ":"
 * pour éviter de relancer l'animation CSS à chaque seconde.
 */
function updateHeureElement() {
    var heureContainer = document.getElementById("heure");
    if (!heureContainer) return;

    var time = heure(); // "HH:MM"
    var parts = time.split(":");
    var hhSpan = document.getElementById("heureHH");
    var mmSpan = document.getElementById("heureMM");

    // Si la structure n'est pas encore en place (cas de pages anciennes), on la crée.
    if (!hhSpan || !mmSpan) {
        heureContainer.innerHTML = '<span id="heureHH"></span><span class="colon-blink">:</span><span id="heureMM"></span>';
        hhSpan = document.getElementById("heureHH");
        mmSpan = document.getElementById("heureMM");
    }

    if (hhSpan) hhSpan.textContent = parts[0] || "";
    if (mmSpan) mmSpan.textContent = parts[1] || "";
}

/**
 * Renvoie la date du type (dimanche 4 janvier 2020)
 */
function dateFr() {
    // les noms de jours / mois
    var jours = new Array("dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi");
    var mois = new Array("janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre");
    // on recupere la date
    var date = new Date();
    // on construit le message
    var message = jours[date.getDay()] + " ";   // nom du jour
    message += date.getDate() + " ";   // numero du jour
    message += mois[date.getMonth()] + " ";   // mois
    message += date.getFullYear();
    return message;
  
}

/**
 * Renvoie la date du type (dimanche 4 janvier 2020)
 */
function jourFr(dateTimestamp) {
    // les noms de jours / mois
    var jours = new Array("dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi");
    // on recupere la date
    var date = new Date(dateTimestamp* 1000);
    // on construit le message
    var message = jours[date.getDay()];   // nom du jour
    return message;
  
}

function semainePaireImpaire(d){
 // Copy date so don't modify original
 d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
 // Set to nearest Thursday: current date + 4 - current day number
 // Make Sunday's day number 7
 d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
 // Get first day of year
 var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
 // Calculate full weeks to nearest Thursday
 var weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
 // Return array of year and week number
if (weekNo %  2 == 0){
    typeOfWeek = "Semaine paire"
}
else{
    typeOfWeek = "Semaine impaire"
}

 return [weekNo,typeOfWeek];

}

function dateDigi(){
    date = new Date;
    dateString = addZero(date.getDate())+"/"+addZero(date.getMonth()+1)+"/"+date.getFullYear();

    return dateString
}

function dateDayMonth(){
    date = new Date;
    var day = date.getDate();
    var month = date.getMonth() + 1;
    dateString = (day < 10 ? '0' : '') + day + '/' + (month < 10 ? '0' : '') + month;

    return dateString
}

/**
 * Démarre le timer de mise à jour de l'heure (toutes les secondes)
 * Met à jour l'heure affichée en permanence, même pendant les diapos
 */
var clockInterval = null;
function startClockTimer() {
    if (clockInterval) clearInterval(clockInterval);
    clockInterval = setInterval(function() {
        try {
            if (document.getElementById("heure")) updateHeureElement();
            // Mise à jour de la date toutes les minutes (on vérifie si minute = 0)
            var now = new Date();
            if (now.getSeconds() === 0) {
                var dateEl = document.getElementById("date");
                if (dateEl) dateEl.innerHTML = dateFr();
            }
        } catch(e) {}
    }, 1000); // Toutes les secondes
}

/**
 * Vérifie côté client si on est dans la plage horaire de fonctionnement
 * Utilisé comme fallback si le serveur ne répond pas ou renvoie un mauvais status
 * @param {Object} programmation - Objet programmation de l'API
 * @returns {boolean} true si on devrait être actif, false si on devrait dormir
 */
function isWithinSchedule(programmation) {
    if (!programmation || !programmation.active) return true; // Pas de programmation = toujours actif
    
    var now = new Date();
    var currentDay = now.getDay(); // 0=dimanche, 1=lundi...7
    if (currentDay === 0) currentDay = 7; // Convertir dimanche de 0 à 7
    
    var jours = programmation.joursFonctionnement || [];
    if (jours.length > 0 && jours.indexOf(currentDay) === -1) {
        return false; // Pas un jour de fonctionnement
    }
    
    var heureDebut = programmation.heureDemarrage;
    var heureFin = programmation.heureExtinction;
    
    if (!heureDebut || !heureFin) return true; // Pas d'horaires = toujours actif
    
    var currentHHMM = addZero(now.getHours()) + ":" + addZero(now.getMinutes());
    
    // Comparaison simple de strings HH:MM
    if (currentHHMM >= heureDebut && currentHHMM < heureFin) {
        return true; // Dans la plage
    }
    return false; // Hors plage
}


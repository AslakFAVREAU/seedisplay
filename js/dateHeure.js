function addZero(i) {
    if (i < 10) {
        i = "0" + i;
    }
    return i;
}
var heure
/**
 * Renvoie l'heure au format 00:00
 */
function heure() {
    var x = new Date();
    var hh, mm, heure;
    dd = addZero(x.getDate());
    month = addZero(x.getMonth());
    yy = x.getFullYear();
    hh = addZero(x.getHours());
    mm = addZero(x.getMinutes());
    heure = hh + ":" + mm;
    return heure;
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
    dateString = date.getDate()+"/"+(date.getMonth()+1);

    return dateString
}


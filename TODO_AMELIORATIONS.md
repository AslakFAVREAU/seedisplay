# Améliorations à traiter

Points de priorité moyenne/faible identifiés lors de l'analyse du 11 mars 2026.
Les priorités 1–3 ont été implémentées (cf. commits).

---

## P4 — Double timer de refresh diapo

**Fichiers :** `js/DiapoManager.js` + `API/listeDiapo.js`

**Problème :**  
`DiapoManager._startRefreshTimer()` tourne à **60 s** et `listeDiapo.js startRefreshTimer()` tourne à **300 s** en parallèle si les deux modules sont actifs simultanément. Résultat : 5× plus de pulls API que nécessaire.

**Action :**  
Vérifier si `DiapoManager` est réellement utilisé dans `index.html` ou si c'est un doublon de `listeDiapo.js`. L'un des deux doit être désactivé / supprimé. Chercher `window.diapoManager` dans `index.html` pour confirmer.

---

## P5 — Race condition sur `window._usingOfflineCache`

**Fichier :** `API/listeDiapo.js` (~ligne 1260)

**Problème :**  
Le flag `window._usingOfflineCache` est resetté **de façon synchrone** juste après `listeDiapo(JsonDiapo.data)`, mais `listeDiapoV2()` contient des `await` internes. Des décisions sur le scheduling (sleep/active) peuvent être prises avec le flag déjà remis à `false` alors que le parsing est encore en cours.

**Action :**  
Passer la valeur comme paramètre à `listeDiapo(data, { isOffline: true })` au lieu d'une variable globale partagée. Supprimer le reset global.

---

## P6 — Preload vidéo limité à N+1

**Fichier :** `js/loopDiapo.js` — `_preloadNextVideo()`

**Problème :**  
Seule la vidéo immédiatement suivante est préchargée. Sur des boucles avec plusieurs vidéos consécutives, le deuxième changement peut créer un léger freeze (délai de `loadeddata`).

**Action :**  
Précharger N+1 **et** N+2 si le prochain média est aussi une vidéo. Attention à la consommation mémoire : ne précharger N+2 que si N+1 est aussi de type `video`.

---

## P7 — `syncHorizontalLayout` par polling permanent

**Fichier :** `js/defaultScreen.js` (~ligne 223)

**Problème :**  
`setInterval(syncHorizontalLayout, 1000)` tourne **en permanence** pour synchroniser le layout horizontal avec les données météo/éphe. C'est du polling CPU inutile.

**Action :**  
Remplacer par un callback event-driven :
- Appeler `syncHorizontalLayout()` directement depuis `requestJsonMeteo()` après mise à jour du DOM.
- Appeler `syncHorizontalLayout()` depuis `ephe()` après mise à jour de `#epheContainer`.
- Supprimer le `setInterval`.

---

## P8 — Refresh météo non lié au cycle diapo

**Fichiers :** `API/listeDiapo.js` + `js/meteo.js`

**Problème :**  
Les deux cycles (refresh diapo 5 min, refresh météo 30 min) sont totalement indépendants. Si la météo est en erreur mais que le réseau revient via le pull diapo, la météo ne se remet pas à jour avant le prochain tick de 30 min.

**Action :**  
Dans `requestJsonDiapo()`, après un succès API, vérifier si la dernière mise à jour météo date de plus de 15 min (`window._lastMeteoUpdate`) et si oui, appeler `requestJsonMeteo()` en fire-and-forget.

```js
// À ajouter dans requestJsonDiapo() après le reset de apiConsecutiveErrors
if (typeof requestJsonMeteo === 'function') {
  const lastMeteo = window._lastMeteoUpdate || 0
  if (Date.now() - lastMeteo > 15 * 60 * 1000) {
    requestJsonMeteo().catch(() => {})
  }
}
```
Penser à mettre à jour `window._lastMeteoUpdate = Date.now()` à la fin de `requestJsonMeteo` (succès).

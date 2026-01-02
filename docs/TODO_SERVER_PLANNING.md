# TODO Serveur - Paramètres Planning

## Formulaire Gestion Écran

Ajouter ces paramètres dans le formulaire d'édition d'écran (côté serveur) :

### 1. Durée par slide du carousel (`slideDuree`)

- **Champ** : `planning_slide_duree` ou `slideDuree`
- **Type** : Nombre (secondes)
- **Défaut** : 10 secondes
- **Description** : Durée d'affichage de chaque page du carousel quand il y a plus de 4 salles
- **Validation** : Min 5, Max 60

**Dans l'API diapo, retourner :**
```json
{
  "planning": {
    "actif": true,
    "position": "fullscreen",
    "duree": 20,
    "slideDuree": 10
  }
}
```

### 2. Nombre max de salles par page (`maxSallesPerPage`)

- **Champ** : `planning_max_salles` ou `maxSallesPerPage`  
- **Type** : Nombre
- **Défaut** : 4
- **Description** : Nombre maximum de salles affichées simultanément avant de paginer
- **Validation** : Min 2, Max 6

**Dans l'API diapo, retourner :**
```json
{
  "planning": {
    "actif": true,
    "position": "fullscreen",
    "duree": 20,
    "slideDuree": 10,
    "maxSallesPerPage": 4
  }
}
```

---

## Implémentation côté client (déjà fait)

Le client lit ces paramètres depuis `window.planningConfig` :

```javascript
// API/listeDiapo.js
window._planningSlideDuree = planningConfig.slideDuree || 10

// js/PlanningManager.js  
if (window._planningSlideDuree) {
    this.carouselInterval = window._planningSlideDuree * 1000;
}
```

---

## Fichiers à modifier côté serveur

1. **Migration/Schema** : Ajouter colonnes `planning_slide_duree`, `planning_max_salles` à table `ecrans`
2. **Formulaire** : Ajouter champs dans le formulaire d'édition d'écran
3. **Controller API** : Inclure ces valeurs dans la réponse `/see/API/diapo/{id}`

---

*Date création : 2026-01-02*

# Debug Mode Sleep - Vérifications Serveur

## Problème constaté

L'application Electron continue d'afficher les diapos après l'heure d'extinction (16h30) car le serveur retourne toujours `status: "active"` au lieu de `status: "sleep"`.

## Réponse API actuelle (après 16h30)

```json
{
  "status": "active",  // ❌ Devrait être "sleep"
  "programmation": {
    "active": true,
    "heureDemarrage": "07:20",
    "heureExtinction": "16:30",
    "joursFonctionnement": [1, 2, 3, 4, 5, 6, 7]
  }
}
```

## Réponse API attendue (après 16h30)

```json
{
  "status": "sleep",  // ✅ Correct
  "typeHorsPlage": "noir",  // ou "image"
  "imageHorsPlage": "path/to/image.jpg",  // si typeHorsPlage = "image"
  "prochainDemarrage": "07:20",  // optionnel, pour affichage
  "programmation": {
    "active": true,
    "heureDemarrage": "07:20",
    "heureExtinction": "16:30",
    "joursFonctionnement": [1, 2, 3, 4, 5, 6, 7]
  }
}
```

## Points à vérifier côté Laravel

### 1. Contrôleur API Diapo

Vérifier la logique qui détermine le `status` dans le contrôleur qui gère `/see/API/diapo/{id}` :

```php
// Pseudo-code attendu
$now = Carbon::now();
$currentTime = $now->format('H:i');
$currentDay = $now->dayOfWeekIso; // 1=lundi, 7=dimanche

$programmation = $ecran->programmation;

if ($programmation->active) {
    $heureDebut = $programmation->heureDemarrage;
    $heureFin = $programmation->heureExtinction;
    $jours = $programmation->joursFonctionnement;
    
    // Vérifier si on est dans la plage horaire
    $dansPlage = $currentTime >= $heureDebut && $currentTime < $heureFin;
    $jourActif = in_array($currentDay, $jours);
    
    if (!$dansPlage || !$jourActif) {
        $status = 'sleep';
    } else {
        $status = 'active';
    }
}
```

### 2. Timezone

Vérifier que le serveur utilise le bon fuseau horaire :
- `config/app.php` : `'timezone' => 'Europe/Paris'`
- La date serveur dans la réponse API : `"serverTime": "2026-01-01T16:21:17+01:00"`

### 3. Comparaison d'heures

Attention au format de comparaison des heures :
- `"16:30"` en string vs `Carbon::parse('16:30')`
- Utiliser `Carbon::createFromFormat('H:i', $heure)` pour parser

### 4. Cas limites

- **Passage minuit** : Si `heureDebut > heureFin` (ex: 22:00 à 06:00)
- **Jour férié** : Gérer les exceptions
- **Mode prioritaire** : Un diapo prioritaire doit-il ignorer la programmation ?

## Champs requis pour le mode sleep

| Champ | Type | Description |
|-------|------|-------------|
| `status` | string | `"sleep"` quand hors plage |
| `typeHorsPlage` | string | `"noir"` (écran noir) ou `"image"` (image personnalisée) |
| `imageHorsPlage` | string | Chemin de l'image si `typeHorsPlage = "image"` |
| `prochainDemarrage` | string | Prochaine heure de démarrage (format `HH:mm`) |

## Test rapide

```bash
# Vérifier l'heure serveur
curl http://localhost:8000/see/API/diapo/1 | jq '.serverTime, .status, .programmation'

# Forcer un test hors plage (modifier temporairement heureExtinction à une heure passée)
```

## Fallback client

Le client Electron a maintenant un fallback : si la communication est perdue, il peut calculer lui-même s'il doit être en mode sleep en utilisant les données de `programmation` reçues lors du dernier appel API réussi.

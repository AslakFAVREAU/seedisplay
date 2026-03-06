# Mise à jour API Heartbeat — SEE Display v1.12.8+

## Endpoint

`POST /see/API/heartbeat/{ecranUuid}`

## Nouveaux champs dans le body JSON

3 nouveaux champs au premier niveau, à côté de `version`, `uptime`, etc. :

| Champ | Type | Exemple | Description |
|-------|------|---------|-------------|
| `localIp` | `string\|null` | `"192.168.1.42"` | IP locale IPv4 du boîtier |
| `screenResolution` | `string\|null` | `"1920x1080"` | Résolution écran (largeur x hauteur) |
| `screenRefreshRate` | `int\|null` | `60` | Fréquence de rafraîchissement en Hz |

## Exemple de payload complet

```json
{
  "ecranUuid": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "version": "1.12.8",
  "timestamp": "2026-03-05T14:30:00.000Z",
  "uptime": 3600,
  "localIp": "192.168.1.42",
  "screenResolution": "1920x1080",
  "screenRefreshRate": 60,
  "debug": { ... },
  "screenshot": "data:image/jpeg;base64,..."
}
```

## Côté serveur SOEK

### Colonnes à ajouter

```sql
ALTER TABLE ecrans
  ADD COLUMN local_ip VARCHAR(45) NULL,
  ADD COLUMN screen_resolution VARCHAR(20) NULL,
  ADD COLUMN screen_refresh_rate INT NULL;
```

### Code PHP

```php
$data = json_decode($request->getContent(), true);

$localIp          = $data['localIp'] ?? null;
$screenResolution = $data['screenResolution'] ?? null;
$screenRefreshRate = $data['screenRefreshRate'] ?? null;

$ecran->local_ip = $localIp;
$ecran->screen_resolution = $screenResolution;
$ecran->screen_refresh_rate = $screenRefreshRate;
$ecran->save();
```

## Notes

- **Rétrocompatible** : les anciennes versions du boîtier n'envoient pas ces champs → utiliser `?? null`
- **L'IP publique** n'est pas envoyée. Si besoin, utiliser `$_SERVER['REMOTE_ADDR']` côté serveur
- **Fréquence d'envoi** : toutes les 30 secondes (inchangé)
- Le champ `debug` existant ne change pas

# seedisplay - Affichage dynamique SEE

Ce dépôt contient une application Electron simple pour l'affichage dynamique (kiosk) d'un écran SEE : heure/date/éphémérides, météo et boucle de diapositives (images/vidéos).

## Configuration météo (sécurité)

La clé OpenWeather ne doit pas être committée dans le dépôt. Voici les deux méthodes supportées (par ordre de priorité) :

1. Variable d'environnement (recommandée) :
   - Définir `METEO_API_KEY` sur la machine (Windows PowerShell) :

```powershell
$env:METEO_API_KEY = '07a8ad506ec50b4b6d95e17a894be9b2'
```

   - Cette méthode est préférable car la clé n'apparaît pas dans un fichier sur le disque.

2. Fichier de config local : `C:/SEE/configSEE.json` (si vous préférez stocker localement)
   - Copiez `config.example.json` vers `C:/SEE/configSEE.json` et remplacez `PUT_YOUR_KEY_HERE` par votre clé.
   - Exemple (fichier JSON minimal) :

```json
{
  "meteo": true,
  "meteoApiKey": "07a8ad506ec50b4b6d95e17a894be9b2",
  "meteoLat": 48.75,
  "meteoLon": 2.3,
  "meteoUnits": "metric",
   "idEcran": 13,
  "weekDisplay": true,
  "weekNo": true,
  "weekType": false,
  "logoSOE": true,
  "env": "prod"
}
```

> Remarque : `getConfigSEE.js` privilégie la variable d'environnement `METEO_API_KEY` si présente.

## Bonnes pratiques

- Ne commitez jamais de clés API. Si une clé a été exposée, révoquez-la/regénérez-la.
- Pour la production, envisager la migration vers `contextIsolation: true` et un fichier `preload.js` sécurisé au lieu de `nodeIntegration: true`.

## Lancement

- Installer les dépendances (dans le dossier du projet) :

```powershell
npm install
```

- Lancer en mode développement :

```powershell
npm start
```

## Notes techniques / modifications récentes

- `js/meteo.js` a été refactoré pour lire la clé depuis la config (ou variable d'environnement) et être tolérant aux différentes versions de l'API OpenWeather.
- `index.html` a été corrigé pour inclure correctement jQuery/Popper/Bootstrap via `<script>`.

## Suite possible

- Migration sécurité (preload + contextIsolation)
- Ajouter des tests unitaires pour le parsing `listeDiapo`
- Améliorer le retry/backoff et la gestion d'erreurs réseau

Si tu veux, je peux appliquer directement la migration sécurité et créer un `preload.js` minimal.

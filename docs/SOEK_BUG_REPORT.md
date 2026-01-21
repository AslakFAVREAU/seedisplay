# Bug Report - SOEK Backend API

**Date :** 17 janvier 2026  
**Rapporté par :** Agent seedisplay  
**Sévérité :** Critique (bloque l'application)

---

## Résumé

L'API SOEK retourne une erreur HTTP 500 lors de l'appel à l'endpoint `/see/API/diapo/{uuid}` à cause d'une méthode manquante dans l'entité `TemplateDiapo`.

---

## Détails de l'erreur

**Type :** `Symfony\Component\ErrorHandler\Error\UndefinedMethodError`

**Message :**
```
Attempted to call an undefined method named "getConfiguration" of class "App\Entity\TemplateDiapo"
```

**Fichier concerné :**  
`C:\Programation\soek\src\Controller\DiapoController.php`

**Ligne :** 568

**Méthode :** `buildTemplatesActifs()`

---

## Stack Trace (résumé)

1. `DiapoController::buildTemplatesActifs()` - ligne 568
2. `DiapoController::ApiDiapoCSV()` - ligne 300
3. `HttpKernel::handleRaw()` - ligne 181

---

## Requête de test

```powershell
Invoke-WebRequest -Uri "http://localhost:8000/see/API/diapo/9636f9ac-ed93-11f0-88b0-00e04cdaf7ae" `
    -Headers @{"X-API-Token"="61c3e118-2180-f094-7511-695cc3f8bdb1"} `
    -Method GET
```

**Résultat :** HTTP 500 Internal Server Error

---

## Cause racine

Dans `DiapoController.php` ligne 568, le code appelle :
```php
'configuration' => $template->getConfiguration() ?? [],
```

Mais la méthode `getConfiguration()` n'existe pas dans l'entité `App\Entity\TemplateDiapo`.

---

## Solutions proposées

### Option 1 : Ajouter la propriété à l'entité (recommandé)

Modifier `App\Entity\TemplateDiapo` :

```php
#[ORM\Column(type: 'json', nullable: true)]
private ?array $configuration = null;

public function getConfiguration(): ?array
{
    return $this->configuration;
}

public function setConfiguration(?array $configuration): self
{
    $this->configuration = $configuration;
    return $this;
}
```

Puis exécuter :
```bash
php bin/console doctrine:migrations:diff
php bin/console doctrine:migrations:migrate
```

### Option 2 : Fix temporaire

Modifier `DiapoController.php` ligne 568 :

```php
// Avant (bug)
'configuration' => $template->getConfiguration() ?? [],

// Après (fix temporaire)
'configuration' => [],
```

---

## Informations de test

| Paramètre | Valeur |
|-----------|--------|
| UUID écran | `9636f9ac-ed93-11f0-88b0-00e04cdaf7ae` |
| Token API | `61c3e118-2180-f094-7511-695cc3f8bdb1` |
| Environnement | localhost:8000 |

**Note :** L'authentification fonctionne correctement. L'erreur 500 survient après l'authentification, lors de la construction de la réponse JSON.

---

## Impact

- L'application seedisplay ne peut pas se connecter
- Aucun écran ne peut afficher de contenu
- Toutes les fonctionnalités sont bloquées

---

## Contexte

Cette erreur est apparue après l'ajout de la fonctionnalité "templates dynamiques" (anniversaires, menus, annonces). Le frontend seedisplay a été mis à jour pour supporter ces templates, mais le backend SOEK a une erreur dans la sérialisation des templates.

#!/usr/bin/env pwsh
# Create GitHub Issue for CEC Energy Management feature

$token = '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'
$owner = 'AslakFAVREAU'
$repo = 'seedisplay'

$headers = @{
    'Authorization' = "Bearer $token"
    'Accept' = 'application/vnd.github+json'
    'X-GitHub-Api-Version' = '2022-11-28'
}

$body = @{
    'title' = '[FEATURE] Gestion d''energie HDMI CEC avec horaires programmables'
    'body' = @"
Objectif: Implementer un systeme de gestion d'energie via HDMI CEC avec horaires programmables.

## Fonctionnalites
1. Eteindre l'ecran via HDMI CEC a heure programm'ee (defaut: 00h00)
2. Allumer l'ecran via HDMI CEC a heure programm'ee (defaut: 06h00)
3. Aucune coupure d'alimentation du PC (standby ecran uniquement)
4. Parametres configurables via API REST
5. Persistence des parametres dans configSEE.json

## API Endpoints a Creer
- GET /api/energy/schedule - Recuperer les horaires actuels
- POST /api/energy/schedule - Mettre a jour les horaires
- GET /api/energy/status - Statut CEC et ecran
- POST /api/energy/test-cec - Tester connexion CEC

## Configuration par Defaut
""json
{
  "energy": {
    "cecEnabled": true,
    "schedule": {
      "shutdown": "00:00",
      "startup": "06:00"
    },
    "noCutOff": true
  }
}
""

## Etapes d'Implementation
1. Installer package libcec ou cec-client
2. Creer module CEC dans js/cec-manager.js
3. Implementer detection horaire dans main.js
4. Ajouter endpoints API dans preload.js
5. Creer interface UI pour configuration
6. Tests sur ecran reel avec CEC active
7. Documentation API

## Fichiers a Creer/Modifier
- js/cec-manager.js (NEW - gestion CEC)
- main.js (ajouter scheduler)
- preload.js (ajouter endpoints API)
- configSEE.json (ajouter section energy)
- docs/ENERGY_MANAGEMENT.md (NEW - documentation)

## Criteres de Succes
- Ecran s'eteint a 00h00 (configurable)
- Ecran s'allume a 06h00 (configurable)
- Parametres sauvegardes dans configSEE.json
- API REST fonctionnelle
- Test CEC disponible
- Pas de coupure PC
- Logs detailles des actions CEC

## Details
- Priorite: Moyenne (Economies d'energie)
- Effort estime: 3-4 heures
- Impact: Economie d'energie 95-98% quand ecran eteint
- Compatibilite: Windows, Linux, macOS (si CEC disponible)

## Ressources
- [libcec GitHub](https://github.com/libcec/libcec)
- [node-cec npm](https://www.npmjs.com/package/node-cec)
- [HDMI CEC Specs](https://en.wikipedia.org/wiki/HDMI#CEC)
"@
    'labels' = @('feature', 'energy-management', 'hdmi-cec', 'api')
}

$jsonBody = $body | ConvertTo-Json -Depth 10

Write-Host 'Creating GitHub Issue for CEC Energy Management...' -ForegroundColor Cyan
Write-Host "Repository: $owner/$repo"
Write-Host "Title: [FEATURE] HDMI CEC Energy Management"
Write-Host ''

try {
    $response = Invoke-WebRequest `
        -Uri "https://api.github.com/repos/$owner/$repo/issues" `
        -Method POST `
        -Headers $headers `
        -Body $jsonBody `
        -ContentType 'application/json' `
        -ErrorAction Stop
    
    $issue = $response.Content | ConvertFrom-Json
    
    Write-Host 'SUCCESS! Issue created!' -ForegroundColor Green
    Write-Host ''
    Write-Host "Issue #$($issue.number)" -ForegroundColor Cyan
    Write-Host "URL: $($issue.html_url)" -ForegroundColor Green
    Write-Host "State: $($issue.state)" -ForegroundColor Yellow
    Write-Host "Labels: $($issue.labels | ForEach-Object { $_.name } | Join-String -Separator ', ')" -ForegroundColor Yellow
    
} catch {
    Write-Host 'ERROR: Failed to create issue' -ForegroundColor Red
    Write-Host "Status Code: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    
    try {
        $streamReader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        $streamReader.BaseStream.Position = 0
        $streamReader.DiscardBufferedData()
        $responseBody = $streamReader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Red
    } catch {
        Write-Host "Could not read error response" -ForegroundColor Red
    }
    
    exit 1
}

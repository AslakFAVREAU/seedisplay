#!/usr/bin/env pwsh
# Create GitHub Issue for display ratio improvement

$token = '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'
$owner = 'AslakFAVREAU'
$repo = 'seedisplay'

$headers = @{
    'Authorization' = "Bearer $token"
    'Accept' = 'application/vnd.github+json'
    'X-GitHub-Api-Version' = '2022-11-28'
}

$body = @{
    'title' = '[AMELIORATION] Gestion multi-ratio et orientation ecran (16:9, 16:10, Portrait, Vertical)'
    'body' = @"
Objectif: Gerer correctement l'affichage des images et videos selon les differents ratios d'ecran et orientations.

## Probleme
- Bandes noires visibles quand image 16:9 sur ecran 16:10
- Pas de support pour les orientations portrait/vertical
- Pas de support pour d'autres ratios (4:3, 21:9, etc.)

## Solution proposee
- Implementer trois modes d'affichage: FILL, FIT, STRETCH
- Detecter automatiquement le ratio de l'ecran
- Detecter le ratio de chaque image/video
- Stocker la preference dans configSEE.json

## Fichiers concernes
- index.html (structure CSS)
- app.scss (styles de lecture)
- js/loopDiapo.js (logique d'affichage)
- API/listeDiapo.js (donnees meta)
- configSEE.json (parametre de mode d'affichage)

## Criteres de succes
- Aucune bande noire non desiree sur 16:9 + 16:10
- Images en portrait s'affichent correctement
- Mode d'affichage configurable (FIT/FILL/STRETCH)
- Tests sur 3+ resolutions differentes
- Documentation mise a jour

## Details
- Priorite: Moyenne (Amelioration UX)
- Effort estime: 2-3 heures
- Complexite: Moyenne

Template technique complet: docs/GITHUB_ISSUE_TEMPLATE_DISPLAY_RATIO.md
"@
    'labels' = @('amelioration', 'enhancement', 'ui', 'display')
}

$jsonBody = $body | ConvertTo-Json -Depth 10

Write-Host 'Creating GitHub Issue...' -ForegroundColor Cyan
Write-Host "Repository: $owner/$repo"
Write-Host "Title: $($body.title)"
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

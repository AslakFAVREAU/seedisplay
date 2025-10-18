#!/usr/bin/env pwsh
# Script pour créer une GitHub Issue via curl
# Usage: .\scripts\create-github-issue-curl.ps1

param(
    [string]$Token = $env:GH_TOKEN,
    [string]$Owner = "AslakFAVREAU",
    [string]$Repo = "seedisplay"
)

if (-not $Token) {
    Write-Host "ERROR: Token GitHub manquant!" -ForegroundColor Red
    Write-Host "Set-Item -Path Env:GH_TOKEN -Value 'votre_token'" -ForegroundColor Yellow
    exit 1
}

Write-Host "Creating GitHub Issue..." -ForegroundColor Cyan
Write-Host "Repository: $Owner/$Repo" -ForegroundColor Gray

# Prepare JSON payload
$payload = @{
    title = "[AMELIORATION] Gestion multi-ratio et orientation d'ecran"
    body = "Gerer correctement l'affichage des images et videos selon les differents ratios d'ecran et orientations.

## Probleme
- Bandes noires visibles quand image 16:9 sur ecran 16:10
- Pas de support pour les orientations portrait/vertical
- Pas de support pour d'autres ratios (4:3, 21:9, etc.)

## Ratios a Gerer
1. 16:9 - HDMI standard
2. 16:10 - Moniteurs de bureau
3. 4:3 - Anciens ecrans
4. 21:9 - Ultrawide
5. Ratio libre - Images/videos non standard

## Orientations
1. Paysage (Horizontal) - 1920x1080
2. Portrait (Vertical) - 1080x1920
3. Carre (1:1) - 1024x1024

## Solution
Implémenter trois modes d'affichage:
- FILL: Remplir l'ecran (peut crop)
- FIT: Afficher l'image complete (peut avoir des bandes)
- STRETCH: Etirer l'image

## Fichiers
- index.html
- app.scss
- js/loopDiapo.js
- API/listeDiapo.js
- configSEE.json

## Criteres de Succes
- Aucune bande noire non desiree sur 16:9 + 16:10
- Images en portrait s'affichent correctement
- Mode d'affichage configurable (FIT/FILL/STRETCH)
- Tests sur 3+ resolutions differentes
- Documentation mise a jour

Priorite: Moyenne
Effort: 2-3 heures
Template technique: docs/GITHUB_ISSUE_TEMPLATE_DISPLAY_RATIO.md"
    labels = @("amelioration", "enhancement", "ui", "display")
} | ConvertTo-Json -Compress

# Create issue using curl
Write-Host "Sending request to GitHub API..." -ForegroundColor Cyan

$response = curl.exe -s `
    -X POST `
    -H "Authorization: Bearer $Token" `
    -H "Accept: application/vnd.github.v3+json" `
    -H "Content-Type: application/json" `
    "https://api.github.com/repos/$Owner/$Repo/issues" `
    -d $payload

$issue = $response | ConvertFrom-Json

if ($issue.number) {
    Write-Host "SUCCESS: Issue created!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Issue #$($issue.number)" -ForegroundColor Cyan
    Write-Host "URL: $($issue.html_url)" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "ERROR: Failed to create issue" -ForegroundColor Red
    Write-Host $response | ConvertFrom-Json | ConvertTo-Json
    exit 1
}

#!/usr/bin/env pwsh
# Script pour créer une GitHub Issue via l'API REST
# Usage: .\scripts\create-github-issue.ps1

param(
    [string]$Token = $env:GH_TOKEN,
    [string]$Owner = "AslakFAVREAU",
    [string]$Repo = "seedisplay",
    [string]$Title = "[AMÉLIORATION] Gestion multi-ratio et orientation d'écran (16:9, 16:10, Portrait, Vertical)",
    [array]$Labels = @("amélioration", "enhancement", "ui", "display")
)

# Vérifier le token
if (-not $Token) {
    Write-Error "❌ Token GitHub manquant!"
    Write-Host "Set: `$env:GH_TOKEN = 'votre_token'"
    exit 1
}

# Contenu de l'Issue
$Body = @"
## Objectif
Gerer correctement l'affichage des images et videos selon les differents ratios d'ecran et orientations.

## Problematique Actuelle
- Bandes noires visibles quand image 16:9 sur ecran 16:10
- Pas de support pour les orientations portrait/vertical
- Pas de support pour d'autres ratios (4:3, 21:9, etc.)

## Ratios a Gerer
1. **16:9** - HDMI standard, TV, projecteur classique
2. **16:10** - Moniteurs de bureau, certaines TV
3. **4:3** - Anciens ecrans, certains projecteurs
4. **21:9** - Ultrawide
5. **Ratio libre** - Images/videos non standard

## Orientations a Supporter
1. **Paysage (Horizontal)** - 1920x1080
2. **Portrait (Vertical)** - 1080x1920
3. **Carre (1:1)** - 1024x1024

## Solution Proposee

### Modes d'Affichage
- **FILL**: Remplir l'ecran (peut crop les bords)
- **FIT**: Afficher l'image complete (peut avoir des bandes)
- **STRETCH**: Etirer l'image (deforme le contenu)

### Fichiers Concernes
- \`index.html\` (structure CSS)
- \`app.scss\` (styles de lecture)
- \`js/loopDiapo.js\` (logique d'affichage)
- \`API/listeDiapo.js\` (donnees meta)
- \`configSEE.json\` (parametre de mode d'affichage)

## Criteres de Succes
- [ ] Aucune bande noire non desiree sur 16:9 + 16:10
- [ ] Images en portrait s'affichent correctement
- [ ] Mode d'affichage configurable (FIT/FILL/STRETCH)
- [ ] Tests sur 3+ resolutions differentes
- [ ] Documentation mise a jour

## Details
- **Priorite:** Moyenne (Amelioration UX)
- **Effort estime:** 2-3 heures
- **Impact:** Ameliore experience visuelle sur tous les ecrans
- **Complexite:** Moyenne

## Ressources
- Template technique: \`docs/GITHUB_ISSUE_TEMPLATE_DISPLAY_RATIO.md\`
- [object-fit CSS](https://developer.mozilla.org/en-US/docs/Web/CSS/object-fit)
- [Aspect Ratio Standards](https://en.wikipedia.org/wiki/Aspect_ratio_(image))
"@

# Préparer le payload JSON
$IssueData = @{
    title  = $Title
    body   = $Body
    labels = $Labels
} | ConvertTo-Json

# URL de l'API GitHub
$ApiUrl = "https://api.github.com/repos/$Owner/$Repo/issues"

# Headers avec authentification
$Headers = @{
    "Authorization" = "Bearer $Token"
    "Accept"        = "application/vnd.github.v3+json"
    "Content-Type"  = "application/json"
    "User-Agent"    = "PowerShell/SeedDisplay"
}

Write-Host "🚀 Création de l'Issue GitHub..."
Write-Host "📍 Repository: $Owner/$Repo"
Write-Host "📝 Titre: $Title"
Write-Host "🏷️  Labels: $($Labels -join ', ')"
Write-Host ""

try {
    # Créer l'Issue
    $Response = Invoke-WebRequest `
        -Uri $ApiUrl `
        -Method POST `
        -Headers $Headers `
        -Body $IssueData `
        -ContentType "application/json" `
        -ErrorAction Stop

    $IssueContent = $Response.Content | ConvertFrom-Json
    
    Write-Host "✅ Issue créée avec succès!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📌 Détails:"
    Write-Host "   Issue #$($IssueContent.number)"
    Write-Host "   URL: $($IssueContent.html_url)"
    Write-Host "   État: $($IssueContent.state)"
    Write-Host ""
    Write-Host "🎉 Ouvrez l'Issue: $($IssueContent.html_url)" -ForegroundColor Cyan
    
    return $IssueContent

} catch {
    Write-Error "❌ Erreur lors de la création de l'Issue:"
    Write-Host $_.Exception.Message
    Write-Host ""
    Write-Host "💡 Vérifiez:"
    Write-Host "   1. Le token GitHub: \$env:GH_TOKEN"
    Write-Host "   2. La permission 'repo' du token"
    Write-Host "   3. Le repository: $Owner/$Repo"
    exit 1
}

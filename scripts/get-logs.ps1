# Script pour récupérer les logs de SEE Display
# Usage: .\scripts\get-logs.ps1

$logPath = "$env:LOCALAPPDATA\SEE Display\logs"
$logsDir = "$env:APPDATA\..\..\AppData\Roaming\SEE Display\logs"

Write-Host "🔍 Recherche des logs SEE Display..." -ForegroundColor Cyan

# Vérifier les deux emplacements possibles
if (Test-Path $logPath) {
    Write-Host "✅ Logs trouvés dans : $logPath" -ForegroundColor Green
    $targetPath = $logPath
} elseif (Test-Path $logsDir) {
    Write-Host "✅ Logs trouvés dans : $logsDir" -ForegroundColor Green
    $targetPath = $logsDir
} else {
    Write-Host "❌ Aucun dossier de logs trouvé" -ForegroundColor Red
    Write-Host "   Chemins vérifiés :"
    Write-Host "   - $logPath"
    Write-Host "   - $logsDir"
    exit 1
}

# Lister les logs
Write-Host "`n📋 Fichiers de logs :" -ForegroundColor Yellow
Get-ChildItem $targetPath -Include "*.log" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | ForEach-Object {
    $age = ((Get-Date) - $_.LastWriteTime).TotalHours
    $size = [math]::Round($_.Length / 1KB, 2)
    Write-Host "   - $($_.Name) (${age}h, ${size} KB)" 
}

# Copier le dernier log sur le bureau
$latestLog = Get-ChildItem $targetPath -Include "*.log" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if ($latestLog) {
    $desktopPath = [Environment]::GetFolderPath("Desktop")
    $destFile = "$desktopPath\SEE-Display-latest.log"
    
    Copy-Item $latestLog.FullName $destFile -Force
    Write-Host "`n✅ Dernier log copié sur le bureau : $destFile" -ForegroundColor Green
    
    # Afficher les dernières lignes
    Write-Host "`n📄 Dernières 50 lignes du log :" -ForegroundColor Yellow
    Get-Content $latestLog.FullName | Select-Object -Last 50 | ForEach-Object { Write-Host "   $_" }
} else {
    Write-Host "`n⚠️  Aucun fichier .log trouvé" -ForegroundColor Yellow
}

Write-Host ""

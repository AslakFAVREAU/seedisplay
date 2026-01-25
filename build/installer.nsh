; SEE Display - Custom NSIS Installer Script
; Creates necessary directories for media storage

!macro customInstall
  ; Create SEE data directories
  CreateDirectory "C:\SEE"
  CreateDirectory "C:\SEE\media"
  CreateDirectory "C:\SEE\fonds"
  CreateDirectory "C:\SEE\logs"
  
  ; Note: AccessControl plugin not available, permissions set manually if needed
  ; AccessControl::GrantOnFile "C:\SEE" "(BU)" "FullAccess"
  
  ; Log creation
  DetailPrint "Created SEE data directories in C:\SEE\"
!macroend

!macro customUnInstall
  ; Ne JAMAIS supprimer les données utilisateur automatiquement
  ; L'utilisateur peut utiliser le Reset Mode (touche R au démarrage) si nécessaire
  ; Ou supprimer manuellement C:\SEE\ après désinstallation
  DetailPrint "User data preserved in C:\SEE\"
!macroend

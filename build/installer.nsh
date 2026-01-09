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
  ; Ask user if they want to delete data
  MessageBox MB_YESNO "Voulez-vous supprimer les données locales (médias, configuration) ?" IDNO skipDelete
    RMDir /r "C:\SEE\media"
    RMDir /r "C:\SEE\fonds"
    RMDir /r "C:\SEE\logs"
    Delete "C:\SEE\configSEE.json"
    Delete "C:\SEE\api-cache.json"
    ; Keep C:\SEE folder in case user has other files
    RMDir "C:\SEE"
    DetailPrint "SEE data directories removed"
  skipDelete:
!macroend

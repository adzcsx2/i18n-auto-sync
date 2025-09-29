# Uninstall i18n-auto-sync extension
Write-Host "Uninstalling i18n-auto-sync extension..." -ForegroundColor Yellow

try {
    code --uninstall-extension adzcsx2.i18n-auto-sync
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "SUCCESS: Extension uninstalled successfully!" -ForegroundColor Green
    } else {
        Write-Host "ERROR: Extension uninstall failed or not installed" -ForegroundColor Red
    }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
}

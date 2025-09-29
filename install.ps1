# Install i18n-auto-sync extension
Write-Host "Installing i18n-auto-sync extension..." -ForegroundColor Yellow

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

# Find .vsix files
$vsixFiles = Get-ChildItem -Path $scriptDir -Filter "*.vsix" | Sort-Object LastWriteTime -Descending

if ($vsixFiles.Count -eq 0) {
    Write-Host "ERROR: No .vsix file found. Please run 'npm run package' first." -ForegroundColor Red
    Write-Host "Press any key to continue..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Use the latest .vsix file
$vsixFile = $vsixFiles[0].FullName
Write-Host "Found extension file: $($vsixFiles[0].Name)" -ForegroundColor Cyan

try {
    # Uninstall old version first
    Write-Host "Uninstalling old version..." -ForegroundColor Yellow
    code --uninstall-extension adzcsx2.i18n-auto-sync 2>$null
    
    # Install new version
    Write-Host "Installing new version..." -ForegroundColor Yellow
    code --install-extension "$vsixFile"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "SUCCESS: Extension installed successfully!" -ForegroundColor Green
        Write-Host "TIP: You may need to restart VS Code." -ForegroundColor Cyan
    } else {
        Write-Host "ERROR: Installation failed" -ForegroundColor Red
    }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
}


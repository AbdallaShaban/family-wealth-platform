$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrWhiteSpace($scriptDir)) {
    $scriptDir = (Get-Location).Path
}

$desktopPath = [Environment]::GetFolderPath([Environment+SpecialFolder]::Desktop)
if (-not (Test-Path -LiteralPath $desktopPath)) {
    Write-Error "[ERROR] Could not locate Desktop folder at: $desktopPath"
    exit 1
}

$targetBat = Join-Path $scriptDir "run-family-platform.bat"
$wscript = New-Object -ComObject WScript.Shell

# 1. Create .lnk Shortcut to Launch Server and Cloudflare Tunnel ("تشغيل منصة العائلة.lnk")
$lnkName = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("2KrYtNi62YrZhCDZhdmG2LXYqSDYp9mE2LnYp9im2YTYqS5sbms="))
$launcherShortcutPath = Join-Path $desktopPath $lnkName
$shortcut = $wscript.CreateShortcut($launcherShortcutPath)
$shortcut.TargetPath = $targetBat
$shortcut.WorkingDirectory = $scriptDir
$shortcut.WindowStyle = 1
$shortcut.Description = "FAMILY Wealth Platform - Run Production Server and Cloudflare Tunnel"
$faviconPath = Join-Path $scriptDir "client\public\favicon.ico"
if (Test-Path -LiteralPath $faviconPath) {
    $shortcut.IconLocation = $faviconPath
}
$shortcut.Save()

# 2. Create .url Shortcut to Open Web Application in Browser ("منصة العائلة المالية.url")
$urlName = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("2YXZhti12Kkg2KfZhNi52KfYptmE2Kkg2KfZhNmF2KfZhNmK2KkudXJs"))
$urlShortcutPath = Join-Path $desktopPath $urlName
$urlShortcut = $wscript.CreateShortcut($urlShortcutPath)
$urlShortcut.TargetPath = "http://localhost:3000"
$urlShortcut.Save()

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host " [OK] Shortcuts created successfully on Desktop!" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host " 1. Launcher: $launcherShortcutPath" -ForegroundColor White
Write-Host " 2. Web App:  $urlShortcutPath" -ForegroundColor White
Write-Host "======================================================================" -ForegroundColor Cyan

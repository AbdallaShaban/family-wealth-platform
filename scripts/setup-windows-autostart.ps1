# ============================================================================
# Family Wealth Platform - Windows Boot Autostart Configuration Script
# ============================================================================

$ProjectDir = (Resolve-Path "$PSScriptRoot\..").Path
$StartupFolder = [System.Environment]::GetFolderPath('Startup')
$StartupDir = Join-Path $ProjectDir "scripts\startup"
$BatPath = Join-Path $StartupDir "FamilyWealthHub-Autostart.bat"
$VbsPath = Join-Path $StartupFolder "FamilyWealthHub-Autostart.vbs"

Write-Host "Project Directory: $ProjectDir" -ForegroundColor Cyan
Write-Host "Configuring PM2 startup and Cloudflare Tunnel system auto-start..." -ForegroundColor Cyan

# 1. Ensure scripts\startup directory exists
if (-not (Test-Path $StartupDir)) {
    New-Item -ItemType Directory -Path $StartupDir -Force | Out-Null
}

# 2. Write the batch file using UTF-8
$BatContent = @"
@echo off
cd /d "%~dp0..\.."
call npx pm2 resurrect
if %errorlevel% neq 0 (
  call npx pm2 start ecosystem.config.cjs
  call npx pm2 save
)
exit /b 0
"@
[System.IO.File]::WriteAllText($BatPath, $BatContent, [System.Text.Encoding]::ASCII)
Write-Host "Created batch runner in: $BatPath" -ForegroundColor Green

# 3. Create the invisible VBS runner in Windows Startup folder
$VbsContent = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run chr(34) & "$BatPath" & Chr(34), 0
Set WshShell = Nothing
"@
[System.IO.File]::WriteAllText($VbsPath, $VbsContent, [System.Text.Encoding]::ASCII)
Write-Host "Created silent autostart runner in: $VbsPath" -ForegroundColor Green

# 4. Save PM2 list with ecosystem.config.cjs
Set-Location $ProjectDir
npx pm2 start ecosystem.config.cjs
npx pm2 save
Write-Host "PM2 process dump saved successfully." -ForegroundColor Green

@echo off
setlocal enabledelayedexpansion
title FAMILY Wealth Platform - Unified Production Launcher
cd /d "%~dp0"

echo ======================================================================
echo         FAMILY Wealth Platform - One-Click Production ^& Tunnel
echo ======================================================================
echo.

:: 1. Check if .env exists
if not exist ".env" (
  echo [ERROR] .env file was NOT found in the root directory!
  echo [ERROR] Please create a .env file with DATABASE_URL, JWT_SECRET, etc.
  echo.
  pause
  exit /b 1
) else (
  echo [OK] .env configuration file detected.
)

:: 2. Check if dist/index.js exists
if not exist "dist\index.js" (
  echo [INFO] Production build not found. Building application bundle...
  where pnpm >nul 2>nul
  if errorlevel 1 (
    call npx pnpm build
  ) else (
    call pnpm build
  )
  if errorlevel 1 (
    echo [ERROR] Build failed. Please inspect the errors above.
    pause
    exit /b 1
  )
  echo [OK] Production build created successfully.
) else (
  echo [OK] Production build detected (dist\index.js).
)

:: 3. Check if cloudflared.exe exists; if missing, auto-download
if not exist "cloudflared.exe" (
  echo [INFO] cloudflared.exe not found. Downloading latest Windows binary...
  powershell -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'cloudflared.exe'"
  if not exist "cloudflared.exe" (
    echo [ERROR] Failed to download cloudflared.exe. Please check your internet connection.
    pause
    exit /b 1
  )
  echo [OK] cloudflared.exe downloaded successfully.
) else (
  echo [OK] cloudflared.exe binary detected.
)

:: 4. Launch local Node.js production server in a dedicated window
echo.
echo [1/2] Launching Family Platform production server on port 3000...
set NODE_ENV=production
start "Family Platform Server" cmd /k "node dist/index.js"

:: 5. Brief pause to allow the HTTP listener to initialize
timeout /t 2 /nobreak >nul

:: 6. Launch Cloudflare Quick Tunnel in a separate dedicated window
echo [2/2] Launching Cloudflare Tunnel for secure mobile and remote access...
start "Cloudflare Tunnel - Mobile Access" cmd /k "cloudflared.exe tunnel --url http://localhost:3000"

:: 7. User guidance
echo.
echo ======================================================================
echo                   FAMILY PLATFORM IS NOW LIVE!
echo ======================================================================
echo  - Local Web Access:    http://localhost:3000
echo  - Mobile/Remote URL:   Check the "Cloudflare Tunnel - Mobile Access"
echo                         window for your unique *.trycloudflare.com URL.
echo ======================================================================
echo.
echo Keep both background windows open while using the platform.
echo Press any key to close this launcher (server and tunnel will remain active).
pause >nul

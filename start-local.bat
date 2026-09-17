@echo off
setlocal enabledelayedexpansion

title FAMILY Wealth Platform - Production Runner

echo ======================================================================
echo           FAMILY Wealth Assessment Platform - Local Production
echo ======================================================================
echo.

:: 1. Check if .env exists
if not exist "%~dp0.env" (
  echo [WARN] .env file was not found in the application directory.
  echo [WARN] Please make sure environment variables (DATABASE_URL, JWT_SECRET, etc.) are set.
  echo.
) else (
  echo [OK] .env configuration file detected.
)

:: 2. Ensure production build exists
if not exist "%~dp0dist\index.js" (
  echo [INFO] dist\index.js not found. Generating production build now...
  call npm run build
  if errorlevel 1 (
    echo [ERROR] Build failed. Please check build logs.
    pause
    exit /b 1
  )
)

:: 3. Log live platform URL
echo.
echo Family Wealth Platform is live locally at http://localhost:3000
echo Reverse-proxy / Cloudflare Tunnel endpoint bound to 0.0.0.0:3000
echo.

:: 4. Launch node production server
set NODE_ENV=production
node "%~dp0dist\index.js"

if errorlevel 1 (
  echo.
  echo [ERROR] Application server exited with an error code.
  pause
)

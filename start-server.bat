@echo off
cd /d "%~dp0"

:: 1. Check if server is already responding on port 3000
netstat -ano | findstr :3000 | findstr LISTENING >nul 2>&1
if %errorlevel% equ 0 (
    start http://localhost:3000
    exit /b 0
)

:: 2. Restart or start using PM2 (with graceful fallbacks)
call pm2 restart family-hub >nul 2>&1 || call pm2 start ecosystem.config.cjs >nul 2>&1 || call npx pm2 restart family-hub >nul 2>&1 || call npx pm2 start dist/index.js --name "family-hub"
call pm2 save >nul 2>&1 || call npx pm2 save >nul 2>&1

:: 3. Pause briefly for service stabilization
ping 127.0.0.1 -n 3 >nul

:: 4. Open browser to application dashboard
start http://localhost:3000

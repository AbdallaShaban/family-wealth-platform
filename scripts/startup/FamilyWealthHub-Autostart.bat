@echo off
cd /d "%~dp0..\.."
call npx pm2 resurrect
if %errorlevel% neq 0 (
  call npx pm2 start ecosystem.config.cjs
  call npx pm2 save
)
exit /b 0
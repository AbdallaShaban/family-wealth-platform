@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0create-desktop-shortcuts.ps1"
if errorlevel 1 (
    echo [ERROR] Failed to create desktop shortcuts.
    pause
)

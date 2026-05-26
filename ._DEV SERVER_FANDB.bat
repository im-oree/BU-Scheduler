@echo off
REM start-all.bat — opens frontend and backend in separate command windows
REM Usage: double-click this file or run it from PowerShell/CMD

set "ROOT_DIR=%~dp0"

start "Frontend" cmd /k "cd /d "%ROOT_DIR%" && npm run dev"
start "Backend" cmd /k "cd /d "%ROOT_DIR%backend" && npm run dev"

exit /b 0

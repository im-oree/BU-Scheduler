@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

:menu
cls
echo.
echo ╔════════════════════════════════════════════════════╗
echo ║           StudentHub CONTROL CENTER                   ║
echo ╚════════════════════════════════════════════════════╝
echo.
echo 1. Start Dev Server (http://localhost:5173)
echo 2. Build for Production
echo 3. Build ^& Deploy Instructions
echo 4. Install Dependencies
echo 5. Clean ^& Reinstall Everything
echo 6. Stop All Node Processes
echo 7. Restart Dev Server (Kill ^& Restart)
echo 8. Show Local IP for Phone Access
echo 9. Check Project Status
echo 10. Open Project Folder
echo 11. View This Help Menu
echo 12. Exit
echo.
set /p choice="Enter your choice (1-12): "

if "%choice%"=="1" goto dev
if "%choice%"=="2" goto build
if "%choice%"=="3" goto build-deploy
if "%choice%"=="4" goto install
if "%choice%"=="5" goto clean
if "%choice%"=="6" goto stop
if "%choice%"=="7" goto restart
if "%choice%"=="8" goto ip
if "%choice%"=="9" goto status
if "%choice%"=="10" goto folder
if "%choice%"=="11" goto help
if "%choice%"=="12" exit /b 0
goto invalid

:dev
cls
echo Starting StudentHub Dev Server...
echo.
npm run dev
pause
goto menu

:build
cls
echo Building StudentHub for Production...
echo.
npm run build
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✓ Build successful! Output in: dist/
    echo.
) else (
    echo.
    echo ✗ Build failed!
    echo.
)
pause
goto menu

:build-deploy
cls
echo Building StudentHub for deployment...
echo.
npm run build
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✓ Build complete! Ready to deploy.
    echo.
    echo Next steps:
    echo 1. Go to https://app.netlify.com
    echo 2. Click "Add new site" ^> "Deploy manually"
    echo 3. Drag and drop the 'dist' folder
    echo.
    echo OR upload dist folder to your hosting provider
    echo.
) else (
    echo.
    echo ✗ Build failed!
    echo.
)
pause
goto menu

:install
cls
echo Installing dependencies...
echo.
npm install
echo.
echo ✓ Dependencies installed!
echo.
pause
goto menu

:clean
cls
echo Cleaning build artifacts and reinstalling...
echo.
if exist dist (
    echo Removing dist folder...
    rmdir /s /q dist
)
if exist node_modules (
    echo Removing node_modules...
    rmdir /s /q node_modules
)
if exist .vite (
    echo Removing .vite cache...
    rmdir /s /q .vite
)
echo.
echo Installing fresh dependencies...
npm install
echo.
echo ✓ Clean install complete!
echo.
pause
goto menu

:stop
cls
echo Stopping all Node processes...
echo.
taskkill /F /IM node.exe 2>nul
if %ERRORLEVEL% EQU 0 (
    echo ✓ Node processes stopped.
) else (
    echo ✓ No Node processes running.
)
echo.
pause
goto menu

:restart
cls
echo Restarting StudentHub Dev Server...
echo.
echo Killing all Node processes...
taskkill /F /IM node.exe 2>nul
if %ERRORLEVEL% EQU 0 (
    echo ✓ Node processes stopped.
) else (
    echo ✓ No Node processes running.
)
echo.
timeout /t 2 /nobreak
echo.
echo Starting StudentHub Dev Server...
echo.
npm run dev
pause
goto menu

:ip
cls
echo Getting your local IP address...
echo.
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| find "IPv4"') do (
    set ipaddr=%%a
    set ipaddr=!ipaddr:~1!
)
echo Your local IP: !ipaddr!
echo.
echo ╔════════════════════════════════════════════════════╗
echo ║ Access from phone on same WiFi:                    ║
echo ║ HTTP:  http://!ipaddr!:5173                  ║
echo ║ HTTPS: https://!ipaddr!:5173 (geolocation) ║
echo ╚════════════════════════════════════════════════════╝
echo.
pause
goto menu

:status
cls
echo Checking project status...
echo.
echo Project: StudentHub
echo Location: %cd%
echo.
echo Directories:
for /d %%i in (*) do echo   - %%i
echo.
echo Build Status:
if exist dist (
    echo   [✓] dist/ folder exists
) else (
    echo   [✗] dist/ folder - run Build
)
if exist node_modules (
    echo   [✓] node_modules exists
) else (
    echo   [✗] node_modules - run Install
)
echo.
echo Key Files:
if exist package.json echo   [✓] package.json
if exist vite.config.ts echo   [✓] vite.config.ts
if exist index.html echo   [✓] index.html
if exist src\main.tsx echo   [✓] src/main.tsx
echo.
pause
goto menu

:folder
explorer .
goto menu

:help
cls
echo.
echo ╔════════════════════════════════════════════════════╗
echo ║           StudentHub QUICK REFERENCE                 ║
echo ╚════════════════════════════════════════════════════╝
echo.
echo OPTION 1 - Start Dev Server
echo   Runs: npm run dev
echo   Access: http://localhost:5173
echo.
echo OPTION 2 - Build for Production
echo   Runs: npm run build
echo   Output: dist/ folder
echo.
echo OPTION 3 - Build ^& Deploy
echo   Shows Netlify deployment instructions
echo.
echo OPTION 4 - Install Dependencies
echo   Runs: npm install
echo.
echo OPTION 5 - Clean ^& Reinstall
echo   Removes node_modules, dist, and .vite
echo   Then reinstalls everything fresh
echo.
echo OPTION 6 - Stop All Node Processes
echo   Kills any running Node.js processes
echo.
echo OPTION 7 - Restart Dev Server
echo   Kills all Node processes and restarts server
echo   Useful if server becomes unresponsive
echo.
echo OPTION 8 - Show Local IP
echo   Shows your PC's IP for phone access
echo   Useful for testing on mobile
echo.
echo OPTION 9 - Check Project Status
echo   Lists directories and build artifacts
echo.
echo OPTION 10 - Open Project Folder
echo   Opens project in File Explorer
echo.
echo QUICK START:
echo   1. Choose option 4 (Install)
echo   2. Choose option 1 (Dev Server)
echo   3. Open: http://localhost:5173
echo.
pause
goto menu

:invalid
cls
echo Invalid choice! Please try again.
pause
goto menu

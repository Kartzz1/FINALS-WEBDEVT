@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Download it from https://nodejs.org version 20 or newer, then run this again.
  pause
  exit /b 1
)

echo.
echo === Installing backend packages. This can take a minute. ===
cd backend
call npm install
if errorlevel 1 (
  echo Backend install failed. Read the message above.
  pause
  exit /b 1
)
cd ..

echo.
echo === Installing frontend packages ===
cd frontend
call npm install
if errorlevel 1 (
  echo Frontend install failed. Read the message above.
  pause
  exit /b 1
)
cd ..

echo.
echo === Creating the backend settings file ===
node scripts\setup.mjs

echo.
echo Setup finished. Double-click start.bat to run the website.
pause

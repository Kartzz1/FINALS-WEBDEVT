@echo off
cd /d "%~dp0"

if not exist backend\.env (
  echo Run setup.bat first.
  pause
  exit /b 1
)

echo Starting the backend and the frontend in two new windows.
start "Backend - Restaurant Reservation System" cmd /k "cd /d %~dp0backend && npm run dev"
start "Frontend - Restaurant Reservation System" cmd /k "cd /d %~dp0frontend && npm run dev"

echo Waiting for the servers to start...
timeout /t 8 /nobreak >nul
start http://localhost:5173

@echo off
title Analyst Price Target Extractor Hub launcher
cd /d "%~dp0"

echo ===================================================
echo Starting Analyst Price Target Extractor Hub...
echo ===================================================

echo Launching API Backend (npm run server)...
start "Price Target Backend API" cmd /k "npm run server"

echo Launching Frontend Dashboard (npm run dev)...
start "Price Target Frontend Dev" cmd /k "npm run dev"

echo.
echo Both servers have been launched in separate windows!
echo - API Backend running on: http://localhost:3001
echo - Frontend Dashboard running on: http://localhost:5173
echo.
pause

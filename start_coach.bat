@echo off
title FitForm AI - Personal Workout Coach
echo ========================================================
echo     ⚡ FitForm AI — Personal AI Workout Coach
echo ========================================================
echo.
echo Starting local web server on port 8000...
echo.

cd /d "%~dp0"

start "" http://localhost:8000

echo Local application running at: http://localhost:8000
echo Keep this terminal window open during your workout!
echo Press Ctrl+C in this terminal to stop the server when done.
echo.

python -m http.server 8000
if %ERRORLEVEL% NEQ 0 (
    "C:\Users\91995\AppData\Local\Programs\Python\Python314\python.exe" -m http.server 8000
)

pause

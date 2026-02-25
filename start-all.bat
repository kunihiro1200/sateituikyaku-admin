@echo off
echo Starting Admin System...
start "" "%~dp0start-backend.bat"
timeout /t 3 /nobreak
start "" "%~dp0start-frontend.bat"
echo Both servers are starting...
pause

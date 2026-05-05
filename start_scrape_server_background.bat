@echo off
REM スクレイピングサーバーをバックグラウンドで起動

cd /d "%~dp0"

REM 既存のプロセスを確認
tasklist /FI "WINDOWTITLE eq スクレイピングサーバー" 2>NUL | find /I /N "python.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo スクレイピングサーバーは既に起動しています
    exit /b
)

REM バックグラウンドで起動
start "スクレイピングサーバー" /MIN python scrape_server.py

echo スクレイピングサーバーをバックグラウンドで起動しました
echo ポート: 8765
echo 停止するには: taskkill /FI "WINDOWTITLE eq スクレイピングサーバー"

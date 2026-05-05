@echo off
REM スクレイピングサーバーを停止

taskkill /FI "WINDOWTITLE eq スクレイピングサーバー" /F

echo スクレイピングサーバーを停止しました

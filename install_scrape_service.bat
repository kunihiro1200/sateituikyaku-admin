@echo off
REM スクレイピングサーバーをWindowsサービスとして登録
REM 管理者権限で実行してください

echo Windowsサービスとして登録するには、NSSMが必要です
echo.
echo 手順:
echo 1. NSSMをダウンロード: https://nssm.cc/download
echo 2. nssm.exeをこのフォルダに配置
echo 3. このバッチファイルを管理者権限で実行
echo.
pause

if not exist nssm.exe (
    echo エラー: nssm.exeが見つかりません
    echo https://nssm.cc/download からダウンロードしてください
    pause
    exit /b 1
)

REM Pythonのパスを取得
for /f "delims=" %%i in ('where python') do set PYTHON_PATH=%%i

REM スクレイピングサーバーのパス
set SCRIPT_PATH=%~dp0scrape_server.py

echo Pythonパス: %PYTHON_PATH%
echo スクリプトパス: %SCRIPT_PATH%
echo.

REM サービスをインストール
nssm install ScrapeServer "%PYTHON_PATH%" "%SCRIPT_PATH%"
nssm set ScrapeServer AppDirectory "%~dp0"
nssm set ScrapeServer DisplayName "スクレイピングサーバー"
nssm set ScrapeServer Description "アットホームスクレイピングAPIサーバー"
nssm set ScrapeServer Start SERVICE_AUTO_START

echo.
echo サービスをインストールしました
echo サービスを開始するには: net start ScrapeServer
echo サービスを停止するには: net stop ScrapeServer
echo サービスを削除するには: nssm remove ScrapeServer confirm
echo.
pause

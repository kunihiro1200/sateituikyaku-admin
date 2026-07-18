@echo off
REM Python実行ファイルを動的に探して実行する
for /f "tokens=*" %%i in ('where python 2^>nul') do (
    set PYTHON_EXE=%%i
    goto found
)

REM whereで見つからない場合はpy.exeを試す
where py >nul 2>&1
if %errorlevel% == 0 (
    set PYTHON_EXE=py
    goto found
)

echo Python not found
exit /b 1

:found
"%PYTHON_EXE%" "C:\Users\kunih\sateituikyaku-admin\mail_notify.py"

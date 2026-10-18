@echo off
title PersonalCinema 4K
cd /d "%~dp0backend"

echo ========================================================
echo                 PersonalCinema 4K
echo ========================================================
echo.
echo Launching media center...
echo.

where python >nul 2>nul
if %errorlevel%==0 (
    python main.py
    goto finish
)

where py >nul 2>nul
if %errorlevel%==0 (
    py main.py
    goto finish
)

if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
    "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" main.py
    goto finish
)

echo ERROR: Python is not installed or not found in PATH!
pause

:finish
if %errorlevel% neq 0 (
    echo.
    echo Backend process closed unexpectedly.
    pause
)

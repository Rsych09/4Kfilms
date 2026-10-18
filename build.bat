@echo off
title PersonalCinema 4K - Builder
cd /d "%~dp0"

echo ========================================================
echo          Building PersonalCinema4K.exe
echo ========================================================
echo.

python build_exe.py

echo.
pause

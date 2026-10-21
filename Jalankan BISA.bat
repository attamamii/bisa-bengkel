@echo off
title BISA - Bengkel Integrated Service Application
cd /d "%~dp0"

echo ============================================================
echo   BISA - Bengkel Integrated Service Application
echo ============================================================
echo.
echo   Menjalankan server di http://127.0.0.1:5000
echo   Browser akan terbuka otomatis dalam beberapa detik.
echo.
echo   JANGAN tutup jendela ini selama aplikasi dipakai.
echo   Tekan CTRL+C untuk menghentikan server.
echo.
echo ============================================================
echo.

start "" cmd /c "timeout /t 4 >nul & start "" http://127.0.0.1:5000"
python run.py

echo.
echo Server sudah berhenti.
pause

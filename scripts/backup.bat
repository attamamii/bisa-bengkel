@echo off
rem Backup harian BISA (NFR-13). Dipanggil oleh Task Scheduler pukul 23:59 WITA.
cd /d "%~dp0.."

if not exist "backups" mkdir "backups"

echo [%date% %time%] mulai backup >> "backups\backup.log"
python scripts\backup.py --keep 14 >> "backups\backup.log" 2>&1
echo [%date% %time%] selesai (exit %ERRORLEVEL%) >> "backups\backup.log"

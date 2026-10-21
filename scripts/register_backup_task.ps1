# Daftarkan backup harian BISA pukul 23:59 WITA (NFR-13).
#
# Jalankan sekali dari PowerShell (tidak perlu Administrator bila memakai
# akun pengguna saat ini):
#     powershell -ExecutionPolicy Bypass -File scripts\register_backup_task.ps1
#
# Hapus jadwal:
#     Unregister-ScheduledTask -TaskName "BISA Daily Backup" -Confirm:$false

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$scriptPath = Join-Path $projectRoot "scripts\backup.bat"
$taskName = "BISA Daily Backup"

if (-not (Test-Path $scriptPath)) {
    throw "Tidak menemukan $scriptPath"
}

$action = New-ScheduledTaskAction -Execute $scriptPath -WorkingDirectory $projectRoot
$trigger = New-ScheduledTaskTrigger -Daily -At "23:59"
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries `
    -AllowStartIfOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
    -Settings $settings -Description "Backup harian basis data BISA (SRS NFR-13)" -Force | Out-Null

Write-Host "[OK] Tugas '$taskName' terdaftar: setiap hari 23:59 waktu lokal." -ForegroundColor Green
Write-Host "     Skrip : $scriptPath"
Write-Host "     Hasil : $projectRoot\backups"
Write-Host "     Uji   : Start-ScheduledTask -TaskName '$taskName'"

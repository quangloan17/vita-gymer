# Run once in PowerShell as Administrator to start VITA before Windows login.
# This creates only the VITA-Gymer-System task and enables Tailscale unattended.
$ErrorActionPreference = 'Stop'
$vitaRoot = Split-Path -Parent $PSScriptRoot
$vitaIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
$vitaAdmin = New-Object Security.Principal.WindowsPrincipal($vitaIdentity)
if (-not $vitaAdmin.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Open PowerShell as Administrator, then run this script again.'
}
$vitaAction = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$PSScriptRoot\supervisor.ps1`"" -WorkingDirectory $vitaRoot
$vitaSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew
$vitaPrincipal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'VITA-Gymer-System' -Action $vitaAction -Trigger (New-ScheduledTaskTrigger -AtStartup) -Settings $vitaSettings -Principal $vitaPrincipal -Description 'VITA server, before Windows login' -Force | Out-Null
& 'C:\Program Files\Tailscale\tailscale.exe' set --unattended=true
Start-ScheduledTask -TaskName 'VITA-Gymer-System'
Write-Host 'VITA system-start task installed. It will also start before login after reboot.'

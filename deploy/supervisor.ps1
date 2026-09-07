$ErrorActionPreference = 'Stop'
$vitaRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $vitaRoot
$vitaMutex = New-Object System.Threading.Mutex($false, 'Local\VitaGymerSupervisor')
if (-not $vitaMutex.WaitOne(0)) { exit 0 }
try {
    while ($true) {
        try {
            $vitaChild = Start-Process -FilePath "$vitaRoot\.venv\Scripts\python.exe" -ArgumentList "`"$PSScriptRoot\server.py`"" -WorkingDirectory $vitaRoot -WindowStyle Hidden -PassThru -Wait -RedirectStandardOutput "$vitaRoot\.runtime\worker.stdout.log" -RedirectStandardError "$vitaRoot\.runtime\worker.stderr.log"
            Add-Content -LiteralPath "$vitaRoot\.runtime\supervisor.log" -Value "$(Get-Date -Format o) Worker exited: $($vitaChild.ExitCode); restarting in 5 seconds."
        } catch {
            Add-Content -LiteralPath "$vitaRoot\.runtime\supervisor.log" -Value "$(Get-Date -Format o) $($_.Exception.Message)"
        }
        Start-Sleep -Seconds 5
    }
} finally {
    $vitaMutex.ReleaseMutex()
    $vitaMutex.Dispose()
}

# Persist direct private-tailnet TCP access at 100.88.123.53:8765.
$ErrorActionPreference = 'Stop'
$vitaRoot = Split-Path -Parent $PSScriptRoot
& 'C:\Program Files\Tailscale\tailscale.exe' serve --bg --tcp=8765 tcp://127.0.0.1:8765 *> "$vitaRoot\.runtime\tailscale.log"
exit $LASTEXITCODE

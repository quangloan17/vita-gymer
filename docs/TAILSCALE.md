
# VITA over Tailscale

Current address: `http://100.88.123.53:8765/` (tailnet only).

The VITA-Gymer task starts the Django/Waitress service when the LOAN user logs in. The VITA-OpenBrowser task waits for the service, then opens the current Tailscale address in the default browser. Tailscale itself runs as an automatic Windows service.

If the browser does not open, run `Start-ScheduledTask -TaskName VITA-OpenBrowser` in PowerShell as the LOAN user. The server can still be reached manually at the address above.
